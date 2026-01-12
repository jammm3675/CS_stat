// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import LobbyAnalyzer from './components/LobbyAnalyzer';
import DuelMode from './components/DuelMode';
import History from './components/History';
import './App.css'; // Создадим этот файл для стилей App компонента

// Определяем тип для текущего экрана
type Screen = 'analyze' | 'duel' | 'history';

function App() {
  const [screen, setScreen] = useState<Screen>('analyze');

  // Эффект для инициализации SDK и настройки темы
  useEffect(() => {
    // Устанавливаем цветовую схему Telegram на "dark"
    WebApp.ready();
    WebApp.setHeaderColor('secondary_bg_color');
  }, []);

  // Функция для рендеринга активного экрана
  const renderScreen = () => {
    switch (screen) {
      case 'analyze':
        return <LobbyAnalyzer />;
      case 'duel':
        return <DuelMode />;
      case 'history':
        return <History />;
      default:
        return <LobbyAnalyzer />;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Predictor & Analyzer</h1>
        <p>Your competitive edge on FACEIT</p>
      </header>

      {/* Навигация (табы) */}
      <nav className="App-nav">
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
        {renderScreen()}
      </main>
    </div>
  );
}

export default App;
