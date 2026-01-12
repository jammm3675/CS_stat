// frontend/src/components/LobbyAnalyzer.tsx
import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { analyzeLobby, saveUserNickname, getUserNickname, LobbyAnalysisResult } from '../api';
import './LobbyAnalyzer.css'; // Добавим стили для этого компонента

// Вспомогательный компоент для отображения карточки игрока
const PlayerCard = ({ stats }: { stats: any }) => (
  <div className="player-card">
    <p className="player-nickname">{stats.nickname}</p>
    <div className="player-stats">
      <span>Elo: {stats.elo}</span>
      <span>K/D: {stats.kd_ratio}</span>
      <span>Win %: {stats.win_rate}</span>
    </div>
  </div>
);


const LobbyAnalyzer = () => {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LobbyAnalysisResult | null>(null);

  // Пытаемся получить сохраненный никнейм при загрузке компонента
  useEffect(() => {
    const fetchNickname = async () => {
      if (WebApp.initDataUnsafe?.user?.id) {
        try {
          const data = await getUserNickname(WebApp.initDataUnsafe.user.id);
          setNickname(data.faceit_nickname);
        } catch (err) {
          console.log("No saved nickname found.");
        }
      }
    };
    fetchNickname();
  }, []);

  const handleAnalyze = async () => {
    if (!nickname) {
      setError('Please enter a nickname.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeLobby(nickname);
      setResult(data);

      // Сохраняем никнейм для будущего использования
      if (WebApp.initDataUnsafe?.user?.id) {
        await saveUserNickname(WebApp.initDataUnsafe.user.id, nickname);
      }

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
        placeholder="Enter your FACEIT nickname"
        disabled={loading}
      />
      <button onClick={handleAnalyze} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>

      {error && <p className="error-message">{error}</p>}

      {result && (
        <div className="analysis-result">
          <div className="win-probability">
            <h2>Win Probability</h2>
            <p className={result.win_probability >= 50 ? 'win' : 'loss'}>
              {result.win_probability}%
            </p>
          </div>

          <div className="weak-link">
            <h3>🎯 Weak Link Target</h3>
            <p>{result.weak_link}</p>
          </div>

          <div className="teams-container">
            <div className="team">
              <h4>Your Team (Avg Elo: {result.player_team.avg_elo})</h4>
              {result.player_team.players.map((p, i) => <PlayerCard key={i} stats={p} />)}
            </div>
            <div className="team">
              <h4>Enemy Team (Avg Elo: {result.enemy_team.avg_elo})</h4>
              {result.enemy_team.players.map((p, i) => <PlayerCard key={i} stats={p} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LobbyAnalyzer;
