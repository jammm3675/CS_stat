// frontend/src/components/LobbyAnalyzer.tsx
import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { analyzeLobby, saveUserNickname, getUserNickname, LobbyAnalysisResult, compareWithPro } from '../api';
import SkeletonLoader from './SkeletonLoader'; // Импортируем наш лоадер
import './LobbyAnalyzer.css'; // Добавим стили для этого компонента

// Вспомогательный компонент для отображения карточки игрока
const PlayerCard = ({ stats, mapName }: { stats: any, mapName: string | null }) => (
  <div className="player-card">
    <div className="player-main-stats">
      <p className="player-nickname">{stats.nickname}</p>
      <span className="player-elo">{stats.elo} Elo</span>
    </div>
    <div className="player-secondary-stats">
      <span title="Lifetime K/D Ratio">K/D: {stats.kd_ratio}</span>
      <span title="K/D Ratio in last 20 matches" className={stats.recent_kd_ratio > stats.kd_ratio ? 'stat-up' : 'stat-down'}>
        Recent K/D: {stats.recent_kd_ratio}
      </span>
      {mapName && stats.map_win_rate !== null ? (
        <span title={`Win rate on ${mapName}`}>Map WR: {stats.map_win_rate}%</span>
      ) : (
        <span>Win %: {stats.win_rate}</span>
      )}
    </div>
  </div>
);


const LobbyAnalyzer = () => {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LobbyAnalysisResult | null>(null);
  const [proVerdict, setProVerdict] = useState<string | null>(null);

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

  const handleAnalyze = async (useSavedNickname = false) => {
    let nicknameToAnalyze = nickname;

    if (useSavedNickname) {
      if (WebApp.initDataUnsafe?.user?.id) {
        try {
          const data = await getUserNickname(WebApp.initDataUnsafe.user.id);
          nicknameToAnalyze = data.faceit_nickname;
          setNickname(nicknameToAnalyze); // Обновляем поле ввода
        } catch (err) {
          setError("You don't have a saved nickname yet. Please enter it first.");
          return;
        }
      } else {
        setError("Telegram user ID not found.");
        return;
      }
    }

    if (!nicknameToAnalyze) {
      setError('Please enter a nickname.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProVerdict(null); // Сбрасываем вердикт при новом анализе

    try {
      const data = await analyzeLobby(nicknameToAnalyze);
      setResult(data);

      // После успешного анализа, запрашиваем сравнение с про
      const currentUser = data.player_team.players.find(p => p.nickname.toLowerCase() === nicknameToAnalyze.toLowerCase());
      if (currentUser) {
        const proData = await compareWithPro(currentUser.player_id);
        if (proData.verdict) {
          setProVerdict(proData.verdict);
        }
      }

      // Сохраняем никнейм для будущего использования, если он был введен вручную
      if (!useSavedNickname && WebApp.initDataUnsafe?.user?.id) {
        await saveUserNickname(WebApp.initDataUnsafe.user.id, nicknameToAnalyze);
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
      <div className="button-group">
        <button className="main-button" onClick={() => handleAnalyze()} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze Nickname'}
        </button>
        <button className="secondary-button" onClick={() => handleAnalyze(true)} disabled={loading}>
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

          {proVerdict && (
            <div className="pro-verdict-section">
              <h4>🏆 Pro Comparison</h4>
              <p>{proVerdict}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LobbyAnalyzer;
