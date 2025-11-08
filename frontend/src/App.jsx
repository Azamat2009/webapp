import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clicking, setClicking] = useState(false);
  const [clickAnimation, setClickAnimation] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [currentInvoicePayload, setCurrentInvoicePayload] = useState(null);

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

  const handlePaymentSuccess = useCallback(async (event) => {
    if (!user) return;

    try {
      // Use the stored invoice payload or try to extract from event
      let invoicePayload = currentInvoicePayload;
      
      if (!invoicePayload && event.url) {
        // Try to extract from URL
        const urlParams = new URLSearchParams(event.url.split('?')[1]);
        invoicePayload = urlParams.get('payload') || `stars_${user.telegram_id}_${Date.now()}`;
      }
      
      if (!invoicePayload) {
        invoicePayload = `stars_${user.telegram_id}_${Date.now()}`;
      }

      // Send payment confirmation to backend
      const response = await fetch(`${API_URL}/api/payment/stars`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegram_id: user.telegram_id,
          invoice_payload: invoicePayload,
          currency: 'XTR',
          total_amount: event.total_amount || 1
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update user data
        setUser(data.user);
        loadLeaderboard();

        // Show success message
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(`Успешно! Получено ${data.coins_awarded} монет!`);
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }

        // Animation for coins
        const x = Math.random() * 200 - 100;
        const y = Math.random() * 200 - 100;
        setClickAnimation({ x, y, coins: data.coins_awarded });
        setTimeout(() => setClickAnimation(null), 2000);
      } else {
        throw new Error(data.error || 'Payment processing failed');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Ошибка при обработке платежа. Попробуйте еще раз.');
      }
    } finally {
      setProcessingPayment(false);
      setCurrentInvoicePayload(null);
    }
  }, [user, currentInvoicePayload]);

  const handleBuyStars = () => {
    if (processingPayment || !user || !window.Telegram?.WebApp) return;

    const tg = window.Telegram.WebApp;
    
    // Generate unique invoice payload
    const invoicePayload = `stars_${user.telegram_id}_${Date.now()}`;
    setCurrentInvoicePayload(invoicePayload);

    // Create invoice for Stars payment
    // For Telegram Stars, we use openInvoice with XTR currency
    const invoice = {
      title: '10000 монет',
      description: 'Получите 10000 монет за звезды Telegram',
      currency: 'XTR', // XTR is the currency code for Telegram Stars
      prices: [
        {
          label: '10000 монет',
          amount: 1 // 1 star (minimum amount)
        }
      ],
      payload: invoicePayload,
      provider_token: '', // Not needed for Stars
      provider_data: JSON.stringify({
        telegram_id: user.telegram_id
      })
    };

    setProcessingPayment(true);
    
    // Open invoice - for Stars payments
    // The callback fires when invoice is closed (paid, cancelled, or failed)
    tg.openInvoice(invoice, (status) => {
      console.log('Invoice callback status:', status);
      if (status === 'paid') {
        // Payment successful - handlePaymentSuccess will be called via invoiceClosed event
        // But we also handle it here as a fallback
        handlePaymentSuccess({ status: 'paid', total_amount: 1 });
      } else {
        setProcessingPayment(false);
        setCurrentInvoicePayload(null);
        // Payment was cancelled or failed
        if (status === 'cancelled' || status === 'failed') {
          tg.showAlert('Оплата отменена');
        }
      }
    });
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

      // Listen for invoice closed event (payment completed)
      const handleInvoiceClosed = (event) => {
        console.log('Invoice closed event:', event);
        // Handle both callback and event-based payment completion
        if (event && (event.status === 'paid' || event === 'paid')) {
          handlePaymentSuccess(event);
        }
      };

      tg.onEvent('invoiceClosed', handleInvoiceClosed);
      
      // Also handle payment callback from openInvoice
      // This will be handled in handleBuyStars callback

      // Cleanup
      return () => {
        tg.offEvent('invoiceClosed', handleInvoiceClosed);
      };
    } else {
      // Fallback for local development
      loadUser({ id: 123456789, first_name: 'Test User', username: 'testuser' });
    }
  }, [handlePaymentSuccess]);

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
          <button 
            className="buy-stars-button" 
            onClick={handleBuyStars}
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
                <span>Купить 10000 монет за звезды</span>
              </>
            )}
          </button>
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

