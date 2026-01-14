// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import LobbyAnalyzer from './components/LobbyAnalyzer';
import DuelMode from './components/DuelMode';
import History from './components/History';
import ProfileAnalytics from './components/ProfileAnalytics';
import { getUserNickname, saveUserNickname } from './api';
import './App.css';

// Определяем тип для текущего экрана
type Screen = 'analyze' | 'duel' | 'history' | 'profile';

function App() {
  const [screen, setScreen] = useState<Screen>('profile');
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [faceitNickname, setFaceitNickname] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const init = async () => {
      if (WebApp.initDataUnsafe.user) {
        const tId = WebApp.initDataUnsafe.user.id;
        setTelegramId(tId);
        try {
          const data = await getUserNickname(tId);
          setFaceitNickname(data.faceit_nickname);
        } catch (error) {
          // Никнейм не найден, это нормальное поведение
        }
      }
      setIsLoading(false);
    };

    WebApp.ready();
    WebApp.setHeaderColor('secondary_bg_color');
    init();
  }, []);

  const handleSaveNickname = async () => {
    if (!telegramId || !nicknameInput) {
      setError('Please enter a nickname.');
      return;
    }
    setError(null);
    try {
      await saveUserNickname(telegramId, nicknameInput);
      setFaceitNickname(nicknameInput);
    } catch (err: any) {
      setError(err.message || 'Failed to save nickname.');
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return <p>Loading...</p>;
    }

    if (!faceitNickname) {
      return (
        <div className="nickname-prompt">
          <h2>Enter Your FACEIT Nickname</h2>
          <p>This will be saved for quick access to your stats and match analysis.</p>
          <input
            type="text"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            placeholder="Your FACEIT nickname"
          />
          <button onClick={handleSaveNickname}>Save Nickname</button>
          {error && <p className="error-message">{error}</p>}
        </div>
      );
    }

    // Функция для рендеринга активного экрана
    const renderScreen = () => {
      const props = { telegramId, faceitNickname };
      switch (screen) {
        case 'analyze':
          return <LobbyAnalyzer {...props} />;
        case 'duel':
          return <DuelMode {...props} />;
        case 'history':
          return <History {...props} />;
        case 'profile':
          return <ProfileAnalytics {...props} />;
        default:
          return <ProfileAnalytics {...props} />;
      }
    };

    return renderScreen();
  }


  return (
    <div className="App">
      <header className="App-header">
        <h1>Predictor & Analyzer</h1>
        <p>Your competitive edge on FACEIT</p>
      </header>

      {/* Навигация (табы) */}
      <nav className="App-nav">
        <button
          className={screen === 'profile' ? 'active' : ''}
          onClick={() => setScreen('profile')}
        >
          Profile
        </button>
        <button
          className={screen === 'analyze' ? 'active' : ''}
          onClick={() => setScreen('analyze')}
        >
          Lobby (5v5)
        </button>
        <button
          className={screen === 'duel' ? 'active' : ''}
          onClick={() => setScreen('duel')}
        >
          Duel (1v1)
        </button>
        <button
          className={screen === 'history' ? 'active' : ''}
          onClick={() => setScreen('history')}
        >
          History
        </button>
      </nav>

      <main>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
