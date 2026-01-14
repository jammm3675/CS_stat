// frontend/src/components/MatchReport.tsx
import React, { useState, useEffect } from 'react';
import api, { MatchReportResult } from '../api';
import './MatchReport.css';

interface MatchReportProps {
  matchId: string;
}

const MatchReport = ({ matchId }: MatchReportProps) => {
  const [report, setReport] = useState<MatchReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await api.getMatchReport(matchId);
        setReport(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load match report.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [matchId]);

  if (loading) return <p>Loading match report...</p>;
  if (error) return <p className="error-message">{error}</p>;
  if (!report) return <p>No report data found.</p>;

  return (
    <div className="match-report">
      <h2>Match Report</h2>
      <div className="report-header">
        <h3>Map: {report.map}</h3>
        <h3>Score: {report.score}</h3>
      </div>

      {report.teams.map((team, index) => (
        <div key={index} className="team-table">
          <h4>{team.name}</h4>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>K</th>
                <th>A</th>
                <th>D</th>
                <th>K/D</th>
                <th>HS%</th>
              </tr>
            </thead>
            <tbody>
              {team.players.map(p => (
                <tr key={p.player_id}>
                  <td>{p.nickname}</td>
                  <td>{p.player_stats.Kills}</td>
                  <td>{p.player_stats.Assists}</td>
                  <td>{p.player_stats.Deaths}</td>
                  <td>{p.player_stats['K/D Ratio']}</td>
                  <td>{p.player_stats['Headshots %']}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default MatchReport;
