import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clicking, setClicking] = useState(false);
  const [clickAnimation, setClickAnimation] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);

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


  // Direct payment in Mini App (без выхода из приложения)
  const handleBuyStarsDirect = () => {
    if (processingPayment || !user || !window.Telegram?.WebApp) {
      console.log('Cannot process payment:', { processingPayment, user: !!user, hasWebApp: !!window.Telegram?.WebApp });
      return;
    }

    const tg = window.Telegram.WebApp;
    
    // Generate unique invoice payload
    const invoicePayload = `stars_direct_${user.telegram_id}_${Date.now()}`;
    console.log('Creating direct invoice with payload:', invoicePayload);

    // Create invoice for Stars payment in Mini App
    const invoice = {
      title: '10000 монет',
      description: 'Получите 10000 монет за 1 звезду Telegram',
      currency: 'XTR', // XTR is the currency code for Telegram Stars
      prices: [
        {
          label: '10000 монет',
          amount: 1 // 1 star
        }
      ],
      payload: invoicePayload
    };

    console.log('Opening invoice in Mini App:', invoice);
    setProcessingPayment(true);
    
    // Open invoice directly in Mini App
    try {
      tg.openInvoice(invoice, async (status) => {
        console.log('Invoice callback status:', status);
        
        if (status === 'paid') {
          console.log('Payment successful via direct payment');
          
          try {
            // Send payment confirmation to backend
            const response = await fetch(`${API_URL}/api/payment/stars/direct`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                telegram_id: user.telegram_id,
                invoice_payload: invoicePayload,
                currency: 'XTR',
                total_amount: 1
              }),
            });

            const data = await response.json();

            if (data.success) {
              // Update user data
              setUser(data.user);
              loadLeaderboard();

              // Show success message
              tg.showAlert(`✅ Успешно! Получено ${data.coins_awarded} монет!`);
              tg.HapticFeedback.notificationOccurred('success');

              // Animation for coins
              const x = Math.random() * 200 - 100;
              const y = Math.random() * 200 - 100;
              setClickAnimation({ x, y, coins: data.coins_awarded });
              setTimeout(() => setClickAnimation(null), 2000);
            } else {
              throw new Error(data.error || 'Payment processing failed');
            }
          } catch (error) {
            console.error('Error processing direct payment:', error);
            tg.showAlert(`Ошибка при обработке платежа: ${error.message}`);
          } finally {
            setProcessingPayment(false);
          }
        } else {
          setProcessingPayment(false);
          if (status === 'cancelled') {
            console.log('Payment cancelled');
            tg.showAlert('Оплата отменена');
          } else if (status === 'failed') {
            console.log('Payment failed');
            tg.showAlert('Оплата не удалась');
          }
        }
      });
    } catch (error) {
      console.error('Error opening invoice:', error);
      setProcessingPayment(false);
      tg.showAlert('Ошибка при открытии платежной формы');
    }
  };

  // Payment via bot (в чате с ботом)
  const handleBuyStarsViaBot = async () => {
    if (processingPayment || !user || !window.Telegram?.WebApp) {
      console.log('Cannot process payment:', { processingPayment, user: !!user, hasWebApp: !!window.Telegram?.WebApp });
      return;
    }

    const tg = window.Telegram.WebApp;
    setProcessingPayment(true);
    
    try {
      console.log('Requesting invoice creation for user:', user.telegram_id);
      
      // Request invoice creation from backend
      const response = await fetch(`${API_URL}/api/payment/create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegram_id: user.telegram_id
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Invoice sent successfully');
        tg.showAlert('💳 Инвойс отправлен! Проверьте чат с ботом для оплаты.');
        setProcessingPayment(false);
      } else {
        throw new Error(data.error || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      tg.showAlert(`Ошибка: ${error.message}`);
      setProcessingPayment(false);
    }
  };

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

      // Note: Payment will be processed via webhook on backend
      // User will receive a message from bot after successful payment
    } else {
      // Fallback for local development
      loadUser({ id: 123456789, first_name: 'Test User', username: 'testuser' });
    }
  }, []);

  // Separate effect to poll for payment updates
  useEffect(() => {
    if (!user || !user.telegram_id) return;

    // Poll for user updates to check if payment was processed
    const checkPaymentInterval = setInterval(async () => {
      try {
        const userResponse = await fetch(`${API_URL}/api/user/${user.telegram_id}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          // If coins increased, payment was processed
          if (userData.coins > user.coins) {
            const coinsAdded = userData.coins - user.coins;
            setUser(userData);
            loadLeaderboard();
            if (window.Telegram?.WebApp) {
              window.Telegram.WebApp.showAlert(`Успешно! Получено ${coinsAdded} монет!`);
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    }, 3000); // Check every 3 seconds

    // Cleanup
    return () => {
      clearInterval(checkPaymentInterval);
    };
  }, [user]);

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

        <div className="payment-section">
          <div className="payment-options">
            <h3 className="payment-title">💰 Пополнить баланс</h3>
            <p className="payment-description">1 звезда = 10000 монет</p>
            
            <button 
              className="buy-stars-button buy-stars-direct" 
              onClick={handleBuyStarsDirect}
              disabled={processingPayment || !window.Telegram?.WebApp}
            >
              {processingPayment ? (
                <>
                  <span className="spinner">⏳</span>
                  <span>Обработка...</span>
                </>
              ) : (
                <>
                  <span className="stars-icon">⭐</span>
                  <span>Оплатить прямо здесь (1 звезда)</span>
                </>
              )}
            </button>

            <button 
              className="buy-stars-button buy-stars-bot" 
              onClick={handleBuyStarsViaBot}
              disabled={processingPayment || !window.Telegram?.WebApp}
            >
              {processingPayment ? (
                <>
                  <span className="spinner">⏳</span>
                  <span>Обработка...</span>
                </>
              ) : (
                <>
                  <span className="bot-icon">🤖</span>
                  <span>Оплатить через бота</span>
                </>
              )}
            </button>
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

