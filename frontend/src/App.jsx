import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clicking, setClicking] = useState(false);
  const [clickAnimation, setClickAnimation] = useState(null);

  useEffect(() => {
    // Initialize Telegram Web App
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      // Get user data from Telegram
      const initData = tg.initDataUnsafe?.user;
      if (initData) {
        loadUser(initData);
      } else {
        // Fallback for testing
        loadUser({ id: 123456789, first_name: 'Test User', username: 'testuser' });
      }
    } else {
      // Fallback for local development
      loadUser({ id: 123456789, first_name: 'Test User', username: 'testuser' });
    }
  }, []);

  const loadUser = async (telegramUser) => {
    try {
      const response = await fetch(`${API_URL}/api/user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: telegramUser.id,
          username: telegramUser.username,
          first_name: telegramUser.first_name,
        }),
      });

      const userData = await response.json();
      setUser(userData);
      loadLeaderboard();
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/leaderboard?limit=10`);
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const handleClick = async () => {
    if (clicking || !user) return;

    setClicking(true);
    
    // Random coins per click (1-3)
    const coins = Math.floor(Math.random() * 3) + 1;
    
    // Animation
    const x = Math.random() * 200 - 100;
    const y = Math.random() * 200 - 100;
    setClickAnimation({ x, y, coins });

    try {
      const response = await fetch(`${API_URL}/api/click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegram_id: user.telegram_id,
          coins: coins,
        }),
      });

      const updatedUser = await response.json();
      setUser(updatedUser);
      loadLeaderboard();

      // Haptic feedback
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
    } catch (error) {
      console.error('Error clicking:', error);
    } finally {
      setTimeout(() => {
        setClicking(false);
        setClickAnimation(null);
      }, 300);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <div className="error">Ошибка загрузки данных</div>
      </div>
    );
  }

  const userRank = leaderboard.findIndex(u => u.telegram_id === user.telegram_id) + 1;

  return (
    <div className="app">
      <div className="header">
        <h1>💰 Click Game</h1>
        <div className="user-info">
          <div className="coins-display">
            <span className="coins-icon">🪙</span>
            <span className="coins-value">{user.coins || 0}</span>
          </div>
          <div className="clicks-display">
            Кликов: {user.total_clicks || 0}
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="click-area" onClick={handleClick}>
          <div className={`coin-button ${clicking ? 'clicking' : ''}`}>
            <span className="coin-emoji">🪙</span>
            <span className="click-text">Нажми!</span>
          </div>
          {clickAnimation && (
            <div
              className="click-animation"
              style={{
                left: `calc(50% + ${clickAnimation.x}px)`,
                top: `calc(50% + ${clickAnimation.y}px)`,
              }}
            >
              +{clickAnimation.coins}
            </div>
          )}
        </div>

        <div className="stats-section">
          <div className="stat-card">
            <div className="stat-label">Ваш ранг</div>
            <div className="stat-value">{userRank || '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Всего монет</div>
            <div className="stat-value">{user.coins || 0}</div>
          </div>
        </div>
      </div>

      <div className="leaderboard-section">
        <h2>🏆 Лидерборд</h2>
        <div className="leaderboard">
          {leaderboard.map((player, index) => (
            <div
              key={player.telegram_id}
              className={`leaderboard-item ${
                player.telegram_id === user.telegram_id ? 'current-user' : ''
              }`}
            >
              <div className="rank">#{index + 1}</div>
              <div className="player-info">
                <div className="player-name">
                  {player.first_name || player.username || 'Аноним'}
                </div>
                <div className="player-stats">
                  {player.coins} 🪙 • {player.total_clicks} кликов
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;

