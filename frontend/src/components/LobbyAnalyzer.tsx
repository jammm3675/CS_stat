// frontend/src/components/LobbyAnalyzer.tsx
import React, { useState } from 'react';
import { analyzeLobby, LobbyAnalysisResult } from '../api';
import SkeletonLoader from './SkeletonLoader';
import './LobbyAnalyzer.css';

const PlayerCard = ({ stats, mapName }: { stats: any, mapName: string | null }) => (
  <div className="player-card">
    <p className="player-nickname">{stats.nickname}</p>
    <div className="player-stats">
      <span>Elo: {stats.elo}</span>
      <span>K/D: {stats.kd_ratio}</span>
      {mapName && stats.map_win_rate !== null ? (
        <span title={`Win rate on ${mapName}`}>Map WR: {stats.map_win_rate}%</span>
      ) : (
        <span>Win %: {stats.win_rate}</span>
      )}
    </div>
  </div>
);

interface LobbyAnalyzerProps {
  telegramId: number | null;
  faceitNickname: string | null;
}

const LobbyAnalyzer = ({ telegramId, faceitNickname }: LobbyAnalyzerProps) => {
  const [nickname, setNickname] = useState(faceitNickname || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LobbyAnalysisResult | null>(null);

  const handleAnalyze = async (nicknameToAnalyze: string | null) => {
    if (!nicknameToAnalyze) {
      setError('Nickname not provided. Please enter a nickname.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeLobby(nicknameToAnalyze);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="Enter a FACEIT nickname"
        disabled={loading}
      />
      <div className="button-group">
        <button className="main-button" onClick={() => handleAnalyze(nickname)} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze Nickname'}
        </button>
        <button className="secondary-button" onClick={() => handleAnalyze(faceitNickname)} disabled={loading}>
          Find My Match
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {loading && <SkeletonLoader />}

      {result && !loading && (
        <div className="analysis-result">
          <div className="match-info">
            <div className="win-probability">
              <h2>Win Probability</h2>
              <p className={result.win_probability >= 50 ? 'win' : 'loss'}>
                {result.win_probability}%
              </p>
            </div>
            {result.map_name && (
              <div className="map-info">
                <h3>Map: {result.map_name}</h3>
              </div>
            )}
          </div>

          {result.tips && result.tips.length > 0 && (
            <div className="tips-section">
              <h4>💡 Analyst's Tips</h4>
              <ul>
                {result.tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>
          )}

          <div className="weak-link">
            <h3>🎯 Weak Link Target</h3>
            <p>{result.weak_link}</p>
          </div>

          <div className="teams-container">
            <div className="team">
              <h4>Your Team (Avg Elo: {result.player_team.avg_elo})</h4>
              {result.player_team.players.map((p, i) => <PlayerCard key={i} stats={p} mapName={result.map_name} />)}
            </div>
            <div className="team">
              <h4>Enemy Team (Avg Elo: {result.enemy_team.avg_elo})</h4>
              {result.enemy_team.players.map((p, i) => <PlayerCard key={i} stats={p} mapName={result.map_name} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LobbyAnalyzer;
