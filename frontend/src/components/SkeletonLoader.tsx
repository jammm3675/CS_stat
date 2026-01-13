// frontend/src/components/SkeletonLoader.tsx
import React from 'react';
import './SkeletonLoader.css';

const SkeletonLoader = () => {
  return (
    <div className="skeleton-container">
      <div className="skeleton-win-prob" />
      <div className="skeleton-weak-link" />
      <div className="skeleton-teams">
        <div className="skeleton-team">
          <div className="skeleton-team-header" />
          <div className="skeleton-player-card" />
          <div className="skeleton-player-card" />
          <div className="skeleton-player-card" />
          <div className="skeleton-player-card" />
          <div className="skeleton-player-card" />
        </div>
        <div className="skeleton-team">
          <div className="skeleton-team-header" />
          <div className="skeleton-player-card" />
          <div className="skeleton-player-card" />
          <div className="skeleton-player-card" />
          <div className="skeleton-player-card" />
          <div className="skeleton-player-card" />
        </div>
      </div>
    </div>
  );
};

export default SkeletonLoader;
