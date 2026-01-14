# backend/faceit_api.py

import httpx
import os
from async_lru import alru_cache

# Базовый URL для FACEIT Data API v4
BASE_URL = "https://open.faceit.com/data/v4"

# Получаем API ключ из переменных окружения
API_KEY = os.getenv("FACEIT_API_KEY")

# Проверяем, что ключ доступен
if not API_KEY:
    raise Exception("FACEIT_API_KEY must be set in the .env file")

# Создаем заголовки для аутентификации
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# --- Функции-хелперы для работы с FACEIT API ---

@alru_cache(maxsize=256, ttl=300) # Кэш на 5 минут
async def get_player_id(nickname: str) -> str:
    """Получает ID игрока по его никнейму."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/players?nickname={nickname}", headers=HEADERS)
        response.raise_for_status()  # Вызовет исключение, если запрос неудачный
        return response.json().get("player_id")

async def get_active_match_id(player_id: str) -> str:
    """Получает ID текущего (активного) матча для игрока."""
    async with httpx.AsyncClient() as client:
        # Сначала получаем общую информацию об игроке, где может быть ID матча
        response = await client.get(f"{BASE_URL}/players/{player_id}", headers=HEADERS)
        response.raise_for_status()

        games = response.json().get("games", {})
        csgo_details = games.get("csgo") or games.get("cs2") # Поддержка CSGO и CS2
        if csgo_details:
             match_id = csgo_details.get("match_id")
             if match_id:
                 return match_id

        # Если в профиле нет, пробуем найти через историю матчей
        response = await client.get(f"{BASE_URL}/players/{player_id}/history?game=cs2&offset=0&limit=1", headers=HEADERS)
        response.raise_for_status()
        matches = response.json().get("items", [])
        if matches:
            # Проверяем статус матча, чтобы убедиться, что он активен
            match = matches[0]
            if match.get("status") in ["ongoing", "voting", "configuring", "ready"]:
                 return match.get("match_id")
        return None


@alru_cache(maxsize=32, ttl=60) # Кэш на 1 минуту
async def get_match_details(match_id: str) -> dict:
    """Получает детальную информацию о матче, включая команды."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/matches/{match_id}", headers=HEADERS)
        response.raise_for_status()
        return response.json()

@alru_cache(maxsize=256, ttl=300) # Кэш на 5 минут
async def get_player_stats(player_id: str) -> dict:
    """Получает статистику игрока для CS2/CSGO."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/players/{player_id}/stats/cs2", headers=HEADERS)
        # Если для cs2 статистики нет (старый игрок), пробуем csgo
        if response.status_code == 404:
             response = await client.get(f"{BASE_URL}/players/{player_id}/stats/csgo", headers=HEADERS)

        response.raise_for_status()
        return response.json()

@alru_cache(maxsize=128, ttl=300) # Кэш на 5 минут
async def get_player_match_history(player_id: str, limit: int = 5) -> list:
    """Получает историю последних матчей игрока."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/players/{player_id}/history?game=cs2&offset=0&limit={limit}", headers=HEADERS)
        response.raise_for_status()
        return response.json().get("items", [])

@alru_cache(maxsize=256, ttl=300) # Кэш на 5 минут
async def get_player_stats_for_map(player_id: str, map_name: str) -> dict:
    """Получает статистику игрока для CS2 на определенной карте."""
    async with httpx.AsyncClient() as client:
        # У FACEIT API нет прямого эндпоинта для статистики по картам.
        # Мы будем агрегировать ее из истории матчей.
        response = await client.get(f"{BASE_URL}/players/{player_id}/history?game=cs2&offset=0&limit=100", headers=HEADERS)
        response.raise_for_status()

        matches = response.json().get("items", [])
        map_stats = {'wins': 0, 'matches': 0, 'win_rate': 0}

        for match in matches:
            if match.get('i1') == map_name: # i1 - название карты
                map_stats['matches'] += 1
                if match.get('i10') == '1': # i10 - победа/поражение
                    map_stats['wins'] += 1

        if map_stats['matches'] > 0:
            map_stats['win_rate'] = round((map_stats['wins'] / map_stats['matches']) * 100)

        return map_stats

async def get_player_profile_analytics(player_id: str) -> dict:
    """
    Получает расширенную статистику и аналитику для профиля игрока.
    """
    stats_data = await get_player_stats(player_id)

    # Базовая информация
    lifetime_stats = stats_data.get('lifetime', {})
    games_stats = stats_data.get('games', {}).get('cs2', {})

    analytics = {
        'elo': games_stats.get('faceit_elo', 1000),
        'kd_ratio': float(lifetime_stats.get('Average K/D Ratio', 0)),
        'win_rate': float(lifetime_stats.get('Win Rate %', 0)),
        'hs_percent': float(lifetime_stats.get('Average Headshots %', 0)),
        'best_maps': [],
        'favorite_weapon': None
    }

    # Анализ карт и оружия из сегментов
    segments = stats_data.get('segments', [])

    # Карты
    map_data = []
    for segment in segments:
        if segment.get('type') == 'map' and segment.get('mode') == '5v5':
            map_stats = segment.get('stats', {})
            matches = int(map_stats.get('Matches', 0))
            if matches > 10: # Показывать только карты с достаточным количеством матчей
                map_data.append({
                    'name': segment.get('label', 'Unknown Map').replace('de_', '').capitalize(),
                    'win_rate': int(map_stats.get('Win Rate %', 0)),
                    'matches': matches
                })

    # Сортируем карты по винрейту и берем топ-3
    analytics['best_maps'] = sorted(map_data, key=lambda x: x['win_rate'], reverse=True)[:3]

    # Оружие
    weapon_data = []
    for segment in segments:
        if segment.get('type') == 'weapon':
            weapon_stats = segment.get('stats', {})
            kills = int(weapon_stats.get('Kills', 0))
            weapon_data.append({
                'name': segment.get('label', 'Unknown Weapon'),
                'kills': kills
            })

    # Находим оружие с наибольшим количеством убийств
    if weapon_data:
        favorite_weapon = max(weapon_data, key=lambda x: x['kills'])
        analytics['favorite_weapon'] = favorite_weapon['name']

    return analytics

@alru_cache(maxsize=128, ttl=1800) # Кэш на 30 минут, т.к. статистика матча не меняется
async def get_match_stats(match_id: str) -> dict:
    """Получает статистику по матчу (количество раундов, команды, очки игроков)."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/matches/{match_id}/stats", headers=HEADERS)
        response.raise_for_status()
        return response.json()
