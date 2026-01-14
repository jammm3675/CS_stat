// frontend/src/api.ts

// URL нашего бэкенда. При развертывании на Render его нужно будет заменить на публичный URL.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

// --- Типы данных, которые мы ожидаем от API ---
// (Хорошая практика в TypeScript - определять формы данных)

export interface PlayerStats {
  player_id: string; // Добавлено для запроса сравнения с про
  nickname: string;
  elo: number;
  win_rate: number;
  kd_ratio: number;
  recent_kd_ratio: number; // Новое поле
  hs_percent: number;
  map_win_rate: number | null;
}

export interface TeamAnalysis {
  avg_elo: number;
  avg_map_wr: number;
  players: PlayerStats[];
}

export interface ProComparisonResult {
  verdict: string;
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

export interface ProfileAnalyticsResult {
  elo: number;
  kd_ratio: number;
  win_rate: number;
  hs_percent: number;
  best_maps: { name: string; win_rate: number; matches: number }[];
  favorite_weapon: string;
  tips: string[];
}

export interface MatchPlayerStats {
  player_id: string;
  nickname: string;
  player_stats: {
    Kills: string;
    Assists: string;
    Deaths: string;
    'K/D Ratio': string;
    'Headshots %': string;
  };
}

export interface MatchReportResult {
  map: string;
  score: string;
  teams: {
    name: string;
    players: MatchPlayerStats[];
  }[];
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
export const saveUserNickname = (telegramId: number, nickname: string): Promise<any> => {
  return fetchApi('/user', {
    method: 'POST',
    body: JSON.stringify({ telegram_id: telegramId, faceit_nickname: nickname }),
  });
};

/**
 * Получает сохраненный никнейм пользователя.
 */
export const getUserNickname = (telegramId: number): Promise<{ faceit_nickname: string }> => {
  return fetchApi(`/user/${telegramId}`);
};

/**
 * Получает историю матчей пользователя.
 */
export const getHistory = (telegramId: number): Promise<any[]> => {
  return fetchApi(`/history/${telegramId}`);
};

/**
 * Получает расширенную аналитику по профилю игрока.
 */
export const getProfileAnalytics = (nickname: string): Promise<ProfileAnalyticsResult> => {
  return fetchApi(`/profile/${nickname}`);
};

/**
 * Получает детальную статистику по завершенному матчу.
 */
export const getMatchReport = (matchId: string): Promise<MatchReportResult> => {
  return fetchApi(`/match-report/${matchId}`);
};

/**
 * Сравнивает статистику игрока с профессиональным игроком.
 */
export const compareWithPro = (playerId: string): Promise<ProComparisonResult> => {
  return fetchApi(`/compare-with-pro/${playerId}`);
};

/**
 * Сравнивает игрока с про-игроком.
 */
export const compareWithPro = (playerId: string): Promise<{ verdict: string | null }> => {
  return fetchApi(`/compare_with_pro/${playerId}`);
};
