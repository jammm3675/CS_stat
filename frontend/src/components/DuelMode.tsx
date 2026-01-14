// frontend/src/components/DuelMode.tsx
import React, { useState } from 'react';
import { duelPlayers, DuelResult, PlayerStats } from '../api';
import './DuelMode.css'; // Добавим стили

// Вспомогательный компонент для отображения статистики в дуэли
const DuelStat = ({ label, value1, value2 }: { label: string, value1: number, value2: number }) => {
  const isWinner1 = value1 > value2;
  const isWinner2 = value2 > value1;

  return (
    <div className="duel-stat-row">
      <span className={isWinner1 ? 'winner' : ''}>{value1}</span>
      <span className="label">{label}</span>
      <span className={isWinner2 ? 'winner' : ''}>{value2}</span>
    </div>
  );
};

interface DuelModeProps {
  telegramId: number | null;
  faceitNickname: string | null;
}

const DuelMode = ({ telegramId, faceitNickname }: DuelModeProps) => {
  const [nickname1, setNickname1] = useState(faceitNickname || '');
  const [nickname2, setNickname2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DuelResult | null>(null);

  const handleCompare = async () => {
    if (!nickname1 || !nickname2) {
      setError('Please enter both nicknames.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await duelPlayers(nickname1, nickname2);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const getPlayerStats = (nickname: string): PlayerStats | null => {
    return result ? result[nickname] : null;
  };

  return (
    <div>
      <div className="duel-inputs">
        <input
          type="text"
          value={nickname1}
          onChange={(e) => setNickname1(e.target.value)}
          placeholder="Player 1 nickname"
          disabled={loading}
        />
        <input
          type="text"
          value={nickname2}
          onChange={(e) => setNickname2(e.target.value)}
          placeholder="Player 2 nickname"
          disabled={loading}
        />
      </div>
      <button onClick={handleCompare} disabled={loading}>
        {loading ? 'Comparing...' : 'Compare'}
      </button>

      {error && <p className="error-message">{error}</p>}

      {result && (
        <div className="duel-result">
          <div className="duel-header">
            <h3>{nickname1}</h3>
            <h3>VS</h3>
            <h3>{nickname2}</h3>
          </div>
          <div className="duel-stats-container">
            {getPlayerStats(nickname1) && getPlayerStats(nickname2) && (
              <>
                <DuelStat label="Elo" value1={getPlayerStats(nickname1)!.elo} value2={getPlayerStats(nickname2)!.elo} />
                <DuelStat label="K/D Ratio" value1={getPlayerStats(nickname1)!.kd_ratio} value2={getPlayerStats(nickname2)!.kd_ratio} />
                <DuelStat label="Win Rate %" value1={getPlayerStats(nickname1)!.win_rate} value2={getPlayerStats(nickname2)!.win_rate} />
                <DuelStat label="Headshots %" value1={getPlayerStats(nickname1)!.hs_percent} value2={getPlayerStats(nickname2)!.hs_percent} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DuelMode;
