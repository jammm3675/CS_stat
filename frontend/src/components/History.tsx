// frontend/src/components/History.tsx
import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { getHistory } from '../api';
import './History.css'; // Добавим стили

const History = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!WebApp.initDataUnsafe?.user?.id) {
        setError("User information not available.");
        setLoading(false);
        return;
      }

      try {
        const data = await getHistory(WebApp.initDataUnsafe.user.id);
        setHistory(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load history.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) {
    return <p>Loading history...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <div>
      {history.length === 0 ? (
        <p>No history found. Analyze a match to see it here.</p>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <div key={item.id} className="history-item">
              <div className="history-item-header">
                <span>Match: {item.match_id.substring(0, 15)}...</span>
                <span className="history-date">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="history-item-body">
                <span>Win Chance: <strong>{item.win_probability}%</strong></span>
                <span>Weak Link: <strong>{item.weak_link_nickname}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
