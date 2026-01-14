# backend/main.py

import os
import asyncio
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
import httpx

# Импортируем наши функции для работы с FACEIT API
import faceit_api as faceit

# Загружаем переменные окружения из .env файла
load_dotenv()

# --- Настройка Supabase ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Supabase URL and Key must be set in the .env file")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Настройка FastAPI ---
app = FastAPI(title="Predictor & Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Модели данных (Pydantic) ---
class UserCreate(BaseModel):
    telegram_id: int
    faceit_nickname: str

class DuelRequest(BaseModel):
    nickname1: str
    nickname2: str

# --- Логика анализа (хелперы) ---

async def calculate_player_stats(player_id: str, nickname: str, map_name: str = None):
    """Асинхронно получает и рассчитывает статистику игрока, включая ELO, K/D за 20 матчей и винрейт на карте."""
    # Создаем задачи для параллельного выполнения
    details_task = faceit.get_player_details(player_id)
    stats_task = faceit.get_player_stats(player_id)
    history_task = faceit.get_player_match_history(player_id, limit=20)
    map_stats_task = faceit.get_player_stats_for_map(player_id, map_name) if map_name else asyncio.sleep(0)

    # Выполняем все запросы одновременно
    details, stats, history, map_stats = await asyncio.gather(
        details_task, stats_task, history_task, map_stats_task
    )

    # Расчет K/D за последние 20 матчей
    recent_kd = 0
    if history:
        total_kills = sum(int(m.get('i6', 0)) for m in history) # i6 = Kills
        total_deaths = sum(int(m.get('i8', 0)) for m in history) # i8 = Deaths
        recent_kd = round(total_kills / (total_deaths or 1), 2)

    lifetime_stats = stats.get('lifetime', {})

    player_data = {
        'player_id': player_id, # Добавляем FACEIT ID
        'nickname': nickname,
        'elo': details.get('games', {}).get('cs2', {}).get('faceit_elo', 1000),
        'win_rate': float(lifetime_stats.get('Win Rate %', 0)),
        'kd_ratio': float(lifetime_stats.get('Average K/D Ratio', 0)),
        'recent_kd_ratio': recent_kd,
        'hs_percent': float(lifetime_stats.get('Average Headshots %', 0)),
        'map_win_rate': map_stats.get('win_rate') if map_name and map_stats else None
    }
    return player_data

async def analyze_weak_link(player_id: str):
    """Анализирует последние 5 матчей игрока и возвращает средний K/D и винрейт."""
    history = await faceit.get_player_match_history(player_id, limit=5)
    if not history:
        return {'avg_kd': 0, 'win_rate': 0}

    total_kd = 0
    wins = 0
    for match in history:
        player_stats = next((p for p in match['playing_players'] if p['player_id'] == player_id), None)
        if player_stats:
            total_kd += float(player_stats.get('c2', 0)) # c2 = K/D ratio
            if player_stats.get('i10', '0') == '1': # i10 = Win/Loss (1 for win)
                wins += 1

    return {
        'avg_kd': round(total_kd / len(history), 2),
        'win_rate': round((wins / len(history)) * 100)
    }


# --- Эндпоинты API ---

@app.get("/")
def read_root():
    return {"message": "Welcome to Predictor & Analyzer API"}

@app.post("/user")
def create_or_update_user(user_data: UserCreate):
    try:
        supabase.table('users').upsert({
            'telegram_id': user_data.telegram_id,
            'faceit_nickname': user_data.faceit_nickname
        }, on_conflict='telegram_id').execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/{telegram_id}")
def get_user_nickname(telegram_id: int):
    try:
        data, count = supabase.table('users').select('faceit_nickname').eq('telegram_id', telegram_id).execute()
        if not data[1]:
            raise HTTPException(status_code=404, detail="User not found")
        return {"faceit_nickname": data[1][0]['faceit_nickname']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analyze/{nickname}")
async def analyze_lobby(nickname: str):
    """Главный эндпоинт для анализа активного матча 5v5."""
    try:
        player_id = await faceit.get_player_id(nickname)
        if not player_id:
            raise HTTPException(status_code=404, detail=f"Player '{nickname}' not found")

        match_id = await faceit.get_active_match_id(player_id)
        if not match_id:
            raise HTTPException(status_code=404, detail="Active match not found")

        match_details = await faceit.get_match_details(match_id)

        # Определяем, в какой команде находится наш игрок
        team1_players = [p['player_id'] for p in match_details['teams']['faction1']['roster']]
        player_team_faction = 'faction1' if player_id in team1_players else 'faction2'
        enemy_team_faction = 'faction2' if player_team_faction == 'faction1' else 'faction1'

        player_team = match_details['teams'][player_team_faction]['roster']
        enemy_team = match_details['teams'][enemy_team_faction]['roster']

        current_map = match_details.get('voting', {}).get('map', {}).get('pick', [None])[0]

        # Асинхронно собираем статистику для всех игроков, передавая ID, никнейм и карту
        player_team_stats_tasks = [calculate_player_stats(p['player_id'], p['nickname'], current_map) for p in player_team]
        enemy_team_stats_tasks = [calculate_player_stats(p['player_id'], p['nickname'], current_map) for p in enemy_team]

        player_team_stats = await asyncio.gather(*player_team_stats_tasks)
        enemy_team_stats = await asyncio.gather(*enemy_team_stats_tasks)

        # Рассчитываем средние показатели команд
        avg_player_team_elo = sum(s['elo'] for s in player_team_stats) / len(player_team_stats)
        avg_enemy_team_elo = sum(s['elo'] for s in enemy_team_stats) / len(enemy_team_stats)

        # Простой расчет вероятности победы на основе Elo
        elo_diff = avg_player_team_elo - avg_enemy_team_elo
        win_probability = round(50 + (elo_diff / 10)) # Примерная формула: +/- 1% за каждые 10 Elo

        # Ищем "слабое звено" в команде противника
        weak_link_tasks = [analyze_weak_link(p['player_id']) for p in enemy_team]
        weak_link_stats = await asyncio.gather(*weak_link_tasks)

        # Оцениваем "слабость" = (1 - K/D) + (100 - винрейт). Чем выше, тем слабее.
        worst_player_score = -1
        weak_link_index = -1
        for i, stats in enumerate(weak_link_stats):
            score = (1 - stats['avg_kd']) + (100 - stats['win_rate'])
            if score > worst_player_score:
                worst_player_score = score
                weak_link_index = i

        weak_link_nickname = enemy_team[weak_link_index]['nickname'] if weak_link_index != -1 else "Not found"

        # --- Генерация текстовых подсказок ---
        tips = []
        # 1. Анализ "слабого звена"
        if weak_link_index != -1:
            tips.append(f"Фокусируйтесь на '{weak_link_nickname}', он сейчас не в лучшей форме.")

        # 2. Сравнение винрейта на карте
        avg_player_map_wr = sum(p['map_win_rate'] for p in player_team_stats if p['map_win_rate'] is not None) / (len(player_team_stats) or 1)
        avg_enemy_map_wr = sum(p['map_win_rate'] for p in enemy_team_stats if p['map_win_rate'] is not None) / (len(enemy_team_stats) or 1)

        if current_map and avg_player_map_wr > avg_enemy_map_wr + 10:
            tips.append(f"Ваша команда отлично играет на '{current_map}'. Это ваше преимущество!")
        elif current_map and avg_enemy_map_wr > avg_player_map_wr + 10:
            tips.append(f"Противник очень силен на '{current_map}'. Играйте осторожно.")

        # 3. Наличие "якоря" (сильного игрока) у врага
        strongest_enemy = max(enemy_team_stats, key=lambda p: p['kd_ratio'], default=None)
        if strongest_enemy and strongest_enemy['kd_ratio'] > 1.5:
            tips.append(f"Опасайтесь '{strongest_enemy['nickname']}', у него высокий K/D.")

        return {
            "match_id": match_id,
            "map_name": current_map,
            "win_probability": max(0, min(100, win_probability)),
            "weak_link": weak_link_nickname,
            "tips": tips,
            "player_team": {'avg_elo': round(avg_player_team_elo), "avg_map_wr": round(avg_player_map_wr), "players": player_team_stats},
            "enemy_team": {'avg_elo': round(avg_enemy_team_elo), "avg_map_wr": round(avg_enemy_map_wr), "players": enemy_team_stats},
        }

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"FACEIT API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/duel")
async def duel_players(request: DuelRequest):
    """Сравнивает статистику двух игроков."""
    try:
        # Асинхронно получаем ID и статистику для обоих игроков
        player1_id_task = faceit.get_player_id(request.nickname1)
        player2_id_task = faceit.get_player_id(request.nickname2)
        player1_id, player2_id = await asyncio.gather(player1_id_task, player2_id_task)

        if not player1_id: raise HTTPException(status_code=404, detail=f"Player '{request.nickname1}' not found")
        if not player2_id: raise HTTPException(status_code=404, detail=f"Player '{request.nickname2}' not found")

        # Для дуэли карта не важна, поэтому передаем None
        player1_stats_task = calculate_player_stats(player1_id, request.nickname1, None)
        player2_stats_task = calculate_player_stats(player2_id, request.nickname2, None)
        player1_stats, player2_stats = await asyncio.gather(player1_stats_task, player2_stats_task)

        return {
            request.nickname1: player1_stats,
            request.nickname2: player2_stats
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"FACEIT API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/{telegram_id}")
def get_match_history(telegram_id: int):
    """Получает историю анализов для пользователя."""
    try:
        data, count = supabase.table('match_history').select('*').eq('telegram_id', telegram_id).order('created_at', desc=True).limit(10).execute()
        return data[1]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def generate_profile_tips(analytics: dict) -> List[str]:
    """Генерирует персональные советы на основе статистики игрока."""
    tips = []

    # Совет на основе K/D
    if analytics['kd_ratio'] < 0.9:
        tips.append("Your K/D ratio is a bit low. Focus on survival and positioning to improve it.")
    elif analytics['kd_ratio'] > 1.3:
        tips.append("Excellent K/D ratio! You are a strong fragger for your team.")

    # Совет на основе процента хедшотов
    if analytics['hs_percent'] < 25:
        tips.append("Consider practicing your aim on headshot-only servers to increase your headshot percentage.")
    elif analytics['hs_percent'] > 50:
        tips.append("Amazing headshot accuracy! Keep clicking those heads.")

    # Совет на основе лучшей карты
    if analytics['best_maps']:
        best_map = analytics['best_maps'][0]
        if best_map['win_rate'] > 60:
            tips.append(f"You have a fantastic win rate on {best_map['name']}. It's your playground!")

    # Совет на основе любимого оружия
    if analytics['favorite_weapon'] in ['AK-47', 'M4A4', 'M4A1-S']:
        tips.append(f"Mastering the {analytics['favorite_weapon']} is key. Keep up the good work.")
    elif analytics['favorite_weapon'] == 'AWP':
        tips.append("As an AWPer, your positioning is crucial. Make every shot count.")

    return tips


@app.get("/profile/{nickname}")
async def get_profile_analytics(nickname: str):
    """Возвращает расширенную аналитику по профилю игрока."""
    try:
        player_id = await faceit.get_player_id(nickname)
        if not player_id:
            raise HTTPException(status_code=404, detail=f"Player '{nickname}' not found")

        analytics = await faceit.get_player_profile_analytics(player_id)

        # Добавляем персональные советы
        analytics['tips'] = generate_profile_tips(analytics)

        return analytics

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"FACEIT API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/match-report/{match_id}")
async def get_match_report(match_id: str):
    """Возвращает детальную статистику по завершенному матчу."""
    try:
        stats = await faceit.get_match_stats(match_id)

        # Обрабатываем данные для удобного отображения на фронтенде
        report = {
            'map': stats['rounds'][0]['round_stats']['Map'],
            'score': stats['rounds'][0]['round_stats']['Score'],
            'teams': []
        }

        for team in stats['rounds'][0]['teams']:
            team_details = {
                'name': team['team_stats']['Team'],
                'players': sorted(team['players'], key=lambda p: int(p['player_stats']['Kills']), reverse=True)
            }
            report['teams'].append(team_details)

        return report

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"FACEIT API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/compare-with-pro/{player_id}")
async def compare_with_pro(player_id: str):
    """Сравнивает статистику игрока со случайным про-игроком из базы."""
    try:
        # 1. Получаем статистику нашего игрока
        player_stats_task = faceit.get_player_stats(player_id)

        # 2. Получаем случайного про-игрока из нашей БД
        pro_player_data, count = supabase.rpc('get_random_pro_player', {}).execute()
        if not pro_player_data[1]:
            raise HTTPException(status_code=404, detail="No pro players found in the database.")

        pro_player = pro_player_data[1][0]
        pro_player_name = pro_player['name']
        pro_player_id = pro_player['faceit_id']

        # 3. Получаем статистику про-игрока
        pro_stats_task = faceit.get_player_stats(pro_player_id)

        # Выполняем запросы параллельно
        player_stats, pro_stats = await asyncio.gather(player_stats_task, pro_stats_task)

        # 4. Сравниваем и генерируем вердикт
        player_kd = float(player_stats.get('lifetime', {}).get('Average K/D Ratio', 0))
        pro_kd = float(pro_stats.get('lifetime', {}).get('Average K/D Ratio', 0))

        verdict = ""
        if player_kd >= pro_kd * 0.95: # Если K/D составляет 95% от K/D про-игрока
            verdict = f"В этом матче твой K/D на уровне {pro_player_name}!"
        elif player_kd > pro_kd * 0.8:
            verdict = f"Отличный результат! Ты почти догнал {pro_player_name} по K/D."
        else:
            verdict = f"Продолжай тренироваться, и однажды твой K/D будет как у {pro_player_name}."

        return {"verdict": verdict, "player_kd": player_kd, "pro_player": pro_player_name, "pro_kd": pro_kd}

    except Exception as e:
        # Возвращаем пустой объект в случае ошибки, чтобы не ломать фронтен-д
        return {"verdict": None}

# --- Инструкция по запуску ---
# Чтобы запустить сервер локально, выполните в терминале из папки backend:
# 1. pip install -r requirements.txt
# 2. uvicorn main:app --reload
