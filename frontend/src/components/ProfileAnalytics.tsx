// frontend/src/components/ProfileAnalytics.tsx
import React, { useState, useEffect } from 'react';
import { getProfileAnalytics, ProfileAnalyticsResult } from '../api';
import SkeletonLoader from './SkeletonLoader';
import './ProfileAnalytics.css';

interface ProfileAnalyticsProps {
  faceitNickname: string | null;
}

const ProfileAnalytics = ({ faceitNickname }: ProfileAnalyticsProps) => {
  const [nickname, setNickname] = useState(faceitNickname || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProfileAnalyticsResult | null>(null);

  const handleAnalyze = async (nicknameToAnalyze: string) => {
    if (!nicknameToAnalyze) {
      setError('Please enter a nickname.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await getProfileAnalytics(nicknameToAnalyze);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (faceitNickname) {
      handleAnalyze(faceitNickname);
    }
  }, [faceitNickname]);

  return (
    <div className="profile-analytics">
      <div className="search-bar">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Enter FACEIT nickname to analyze"
          disabled={loading}
        />
        <button onClick={() => handleAnalyze(nickname)} disabled={loading}>
          {loading ? '...' : 'Analyze'}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loading && <SkeletonLoader />}

      {result && !loading && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Elo</h3>
            <p>{result.elo}</p>
          </div>
          <div className="stat-card">
            <h3>K/D Ratio</h3>
            <p>{result.kd_ratio}</p>
          </div>
          <div className="stat-card">
            <h3>Win Rate</h3>
            <p>{result.win_rate}%</p>
          </div>
          <div className="stat-card">
            <h3>Headshots</h3>
            <p>{result.hs_percent}%</p>
          </div>

          <div className="stat-card large-card">
            <h3>Best Maps</h3>
            {result.best_maps.length > 0 ? (
              <ul>
                {result.best_maps.map(map => (
                  <li key={map.name}>{map.name} - <strong>{map.win_rate}% WR</strong> ({map.matches} matches)</li>
                ))}
              </ul>
            ) : <p>Not enough match data.</p>}
          </div>

          <div className="stat-card large-card">
            <h3>Favorite Weapon</h3>
            <p>{result.favorite_weapon || 'N/A'}</p>
          </div>

          <div className="stat-card full-width-card">
            <h3>Analyst's Tips</h3>
            {result.tips.length > 0 ? (
              <ul>
                {result.tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            ) : <p>No specific tips at the moment.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileAnalytics;
