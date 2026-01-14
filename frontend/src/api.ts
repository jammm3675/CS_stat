// frontend/src/api.ts

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

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

async function fetchApi(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'An unknown error occurred');
  }
  return response.json();
}

const api = {
  analyzeLobby: (nickname: string): Promise<LobbyAnalysisResult> => fetchApi(`/analyze/${nickname}`),
  duelPlayers: (nickname1: string, nickname2: string): Promise<DuelResult> => fetchApi('/duel', {
    method: 'POST',
    body: JSON.stringify({ nickname1, nickname2 }),
  }),
  saveUserNickname: (telegramId: number, nickname: string): Promise<any> => fetchApi('/user', {
    method: 'POST',
    body: JSON.stringify({ telegram_id: telegramId, faceit_nickname: nickname }),
  }),
  getUserNickname: (telegramId: number): Promise<{ faceit_nickname: string }> => fetchApi(`/user/${telegramId}`),
  getHistory: (telegramId: number): Promise<any[]> => fetchApi(`/history/${telegramId}`),
  getProfileAnalytics: (nickname: string): Promise<ProfileAnalyticsResult> => fetchApi(`/profile/${nickname}`),
  getMatchReport: (matchId: string): Promise<MatchReportResult> => fetchApi(`/match-report/${matchId}`),
  compareWithPro: (playerId: string): Promise<ProComparisonResult> => fetchApi(`/compare-with-pro/${playerId}`),
};

export default api;
