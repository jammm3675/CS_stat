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

type DuelModeType = 'stats' | 'manual';

const DuelMode = ({ telegramId, faceitNickname }: DuelModeProps) => {
  const [mode, setMode] = useState<DuelModeType>('stats');
  const [nickname1, setNickname1] = useState(faceitNickname || '');
  const [nickname2, setNickname2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DuelResult | null>(null);

  // State for manual mode
  const [manualStats, setManualStats] = useState({
    player1: { morale: 50, experience: 50, clutch: 50 },
    player2: { morale: 50, experience: 50, clutch: 50 },
  });
  const [manualResult, setManualResult] = useState<string | null>(null);

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

  const handleManualStatChange = (player: 'player1' | 'player2', stat: string, value: number) => {
    setManualStats(prev => ({
      ...prev,
      [player]: { ...prev[player], [stat]: value }
    }));
  };

  const handleManualPredict = () => {
    const score1 = Object.values(manualStats.player1).reduce((a, b) => a + b, 0);
    const score2 = Object.values(manualStats.player2).reduce((a, b) => a + b, 0);

    let winner = 'It is a close call!';
    if (score1 > score2 * 1.1) winner = `${nickname1 || 'Player 1'} has the edge!`;
    if (score2 > score1 * 1.1) winner = `${nickname2 || 'Player 2'} looks stronger!`;

    setManualResult(winner);
  };

  const renderStatsMode = () => (
    <>
      <div className="duel-inputs">
        <input type="text" value={nickname1} onChange={(e) => setNickname1(e.target.value)} placeholder="Player 1 nickname" disabled={loading} />
        <input type="text" value={nickname2} onChange={(e) => setNickname2(e.target.value)} placeholder="Player 2 nickname" disabled={loading} />
      </div>
      <button onClick={handleCompare} disabled={loading}>{loading ? 'Comparing...' : 'Compare Stats'}</button>
    </>
  );

  const renderManualMode = () => (
    <>
      <div className="manual-sliders">
        <div className="player-sliders">
          <h4>{nickname1 || 'Player 1'}</h4>
          <label>Morale: {manualStats.player1.morale}</label>
          <input type="range" min="0" max="100" value={manualStats.player1.morale} onChange={(e) => handleManualStatChange('player1', 'morale', +e.target.value)} />
          <label>Experience: {manualStats.player1.experience}</label>
          <input type="range" min="0" max="100" value={manualStats.player1.experience} onChange={(e) => handleManualStatChange('player1', 'experience', +e.target.value)} />
          <label>Clutch Factor: {manualStats.player1.clutch}</label>
          <input type="range" min="0" max="100" value={manualStats.player1.clutch} onChange={(e) => handleManualStatChange('player1', 'clutch', +e.target.value)} />
        </div>
        <div className="player-sliders">
          <h4>{nickname2 || 'Player 2'}</h4>
          <label>Morale: {manualStats.player2.morale}</label>
          <input type="range" min="0" max="100" value={manualStats.player2.morale} onChange={(e) => handleManualStatChange('player2', 'morale', +e.target.value)} />
          <label>Experience: {manualStats.player2.experience}</label>
          <input type="range" min="0" max="100" value={manualStats.player2.experience} onChange={(e) => handleManualStatChange('player2', 'experience', +e.target.value)} />
          <label>Clutch Factor: {manualStats.player2.clutch}</label>
          <input type="range" min="0" max="100" value={manualStats.player2.clutch} onChange={(e) => handleManualStatChange('player2', 'clutch', +e.target.value)} />
        </div>
      </div>
      <button onClick={handleManualPredict}>Predict Winner</button>
    </>
  );

  return (
    <div>
      <div className="mode-toggle">
        <button className={mode === 'stats' ? 'active' : ''} onClick={() => setMode('stats')}>Stats</button>
        <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>VS Builder</button>
      </div>

      {mode === 'stats' ? renderStatsMode() : renderManualMode()}

      {error && <p className="error-message">{error}</p>}

      {mode === 'stats' && result && (
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

      {mode === 'manual' && manualResult && (
        <div className="manual-result">
          <h3>Prediction</h3>
          <p>{manualResult}</p>
        </div>
      )}
    </div>
  );
};

export default DuelMode;
