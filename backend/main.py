# backend/main.py

import os
import asyncio
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

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
    user_id: int
    faceit_nickname: str

class DuelRequest(BaseModel):
    nickname1: str
    nickname2: str

# --- Логика анализа (хелперы) ---

async def calculate_player_stats(player_id: str, nickname: str):
    """Асинхронно получает и рассчитывает основную статистику игрока."""
    stats = await faceit.get_player_stats(player_id)
    lifetime_stats = stats.get('lifetime', {})

    # Извлекаем нужные данные. Используем .get() с дефолтными значениями на случай отсутствия данных.
    return {
        'nickname': nickname, # Добавляем никнейм
        'elo': int(stats.get('games', {}).get('cs2', {}).get('faceit_elo', 1000)),
        'win_rate': float(lifetime_stats.get('Win Rate %', 0)),
        'kd_ratio': float(lifetime_stats.get('Average K/D Ratio', 0)),
        'hs_percent': float(lifetime_stats.get('Average Headshots %', 0))
    }

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
            'id': user_data.user_id,
            'faceit_nickname': user_data.faceit_nickname
        }, on_conflict='id').execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/{user_id}")
def get_user_nickname(user_id: int):
    try:
        data, count = supabase.table('users').select('faceit_nickname').eq('id', user_id).execute()
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

        # Асинхронно собираем статистику для всех игроков, передавая ID и никнейм
        player_team_stats_tasks = [calculate_player_stats(p['player_id'], p['nickname']) for p in player_team]
        enemy_team_stats_tasks = [calculate_player_stats(p['player_id'], p['nickname']) for p in enemy_team]

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

        return {
            "match_id": match_id,
            "win_probability": max(0, min(100, win_probability)),
            "weak_link": weak_link_nickname,
            "player_team": {'avg_elo': round(avg_player_team_elo), "players": player_team_stats},
            "enemy_team": {'avg_elo': round(avg_enemy_team_elo), "players": enemy_team_stats},
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

        player1_stats_task = calculate_player_stats(player1_id, request.nickname1)
        player2_stats_task = calculate_player_stats(player2_id, request.nickname2)
        player1_stats, player2_stats = await asyncio.gather(player1_stats_task, player2_stats_task)

        return {
            request.nickname1: player1_stats,
            request.nickname2: player2_stats
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"FACEIT API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/{user_id}")
def get_match_history(user_id: int):
    """Получает историю анализов для пользователя."""
    try:
        data, count = supabase.table('match_history').select('*').eq('user_id', user_id).order('created_at', desc=True).limit(10).execute()
        return data[1]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Инструкция по запуску ---
# Чтобы запустить сервер локально, выполните в терминале из папки backend:
# 1. pip install -r requirements.txt
# 2. uvicorn main:app --reload
