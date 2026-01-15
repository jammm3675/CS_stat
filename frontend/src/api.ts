// frontend/src/api.ts

// URL нашего бэкенда. При развертывании на Render его нужно будет заменить на публичный URL.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

// --- Типы данных, которые мы ожидаем от API ---
// (Хорошая практика в TypeScript - определять формы данных)

export interface PlayerStats {
  player_id: string;
  nickname: string;
  elo: number;
  win_rate: number;
  kd_ratio: number;
  recent_kd_ratio: number;
  hs_percent: number;
  map_win_rate: number | null;
}

export interface TeamAnalysis {
  avg_elo: number;
  avg_map_wr: number;
  players: PlayerStats[];
}

export interface LobbyAnalysisResult {
  match_id: string;
  map_name: string | null;
  win_probability: number;
  weak_link: string;
  tips: string[];
  player_team: TeamAnalysis;
  enemy_team: TeamAnalysis;
}

export interface DuelResult {
  [nickname: string]: PlayerStats;
}

// --- Функции для вызова эндпоинтов ---

/**
 * Обработчик для всех запросов, чтобы избежать дублирования кода.
 */
async function fetchApi(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'An unknown error occurred');
  }
  return response.json();
}

/**
 * Запрашивает анализ активного матча по никнейму игрока.
 */
export const analyzeLobby = (nickname: string): Promise<LobbyAnalysisResult> => {
  return fetchApi(`/analyze/${nickname}`);
};

/**
 * Сравнивает двух игроков.
 */
export const duelPlayers = (nickname1: string, nickname2: string): Promise<DuelResult> => {
  return fetchApi('/duel', {
    method: 'POST',
    body: JSON.stringify({ nickname1, nickname2 }),
  });
};

/**
 * Сохраняет или обновляет никнейм пользователя.
 */
export const saveUserNickname = (userId: number, nickname: string): Promise<any> => {
  return fetchApi('/user', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, faceit_nickname: nickname }),
  });
};

/**
 * Получает сохраненный никнейм пользователя.
 */
export const getUserNickname = (userId: number): Promise<{ faceit_nickname: string }> => {
  return fetchApi(`/user/${userId}`);
};

/**
 * Получает историю матчей пользователя.
 */
export const getHistory = (userId: number): Promise<any[]> => {
  return fetchApi(`/history/${userId}`);
};

/**
 * Сравнивает игрока с про-игроком.
 */
export const compareWithPro = (playerId: string): Promise<{ verdict: string | null }> => {
  return fetchApi(`/compare_with_pro/${playerId}`);
};
