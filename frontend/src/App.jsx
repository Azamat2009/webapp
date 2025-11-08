import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clicking, setClicking] = useState(false);
  const [clickAnimation, setClickAnimation] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const currentInvoicePayloadRef = useRef(null);

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
    console.log('handlePaymentSuccess called with event:', event);
    console.log('Current user:', user);
    
    if (!user) {
      console.error('No user available for payment processing');
      return;
    }

    // Use the invoice payload from ref
    let invoicePayload = currentInvoicePayloadRef.current;
    
    if (!invoicePayload) {
      // Generate fallback payload based on user and timestamp
      invoicePayload = `stars_${user.telegram_id}_${Date.now()}`;
      console.log('Generated fallback payload:', invoicePayload);
    }

    console.log('Sending payment to backend:', {
      telegram_id: user.telegram_id,
      invoice_payload: invoicePayload,
      API_URL
    });

    try {
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
          total_amount: event?.total_amount || 1
        }),
      });

      console.log('Backend response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Backend error:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Backend response data:', data);

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
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        API_URL
      });
      
      if (window.Telegram?.WebApp) {
        const errorMsg = error.message.includes('fetch') 
          ? 'Не удалось подключиться к серверу. Проверьте настройки API_URL.' 
          : `Ошибка: ${error.message}`;
        window.Telegram.WebApp.showAlert(errorMsg);
      }
    } finally {
      console.log('Payment processing finished, resetting state');
      setProcessingPayment(false);
      currentInvoicePayloadRef.current = null;
    }
  }, [user]);

  const handleBuyStars = () => {
    if (processingPayment || !user || !window.Telegram?.WebApp) {
      console.log('Cannot process payment:', { processingPayment, user: !!user, hasWebApp: !!window.Telegram?.WebApp });
      return;
    }

    const tg = window.Telegram.WebApp;
    
    // Generate unique invoice payload
    const invoicePayload = `stars_${user.telegram_id}_${Date.now()}`;
    console.log('Creating invoice with payload:', invoicePayload);
    currentInvoicePayloadRef.current = invoicePayload;

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

    console.log('Opening invoice:', invoice);
    setProcessingPayment(true);
    
    // Open invoice - for Stars payments
    // The callback fires when invoice is closed (paid, cancelled, or failed)
    try {
      tg.openInvoice(invoice, (status) => {
        console.log('Invoice callback received with status:', status);
        console.log('Status type:', typeof status);
        console.log('Full status object:', JSON.stringify(status));
        
        // Check payment status
        const isPaid = status === 'paid' || (typeof status === 'object' && status?.status === 'paid');
        const isCancelled = status === 'cancelled' || (typeof status === 'object' && status?.status === 'cancelled');
        const isFailed = status === 'failed' || (typeof status === 'object' && status?.status === 'failed');
        
        if (isPaid) {
          console.log('Payment successful via callback');
          // Payment successful - process payment
          // Keep processing state true until payment is processed
          const paymentData = typeof status === 'object' ? status : { status: 'paid', total_amount: 1 };
          handlePaymentSuccess(paymentData);
        } else {
          // Reset processing state for cancelled/failed payments
          setProcessingPayment(false);
          currentInvoicePayloadRef.current = null;
          
          if (isCancelled) {
            console.log('Payment cancelled');
            tg.showAlert('Оплата отменена');
          } else if (isFailed) {
            console.log('Payment failed');
            tg.showAlert('Оплата не удалась');
          } else {
            console.log('Unknown payment status:', status);
            tg.showAlert('Статус платежа неизвестен. Проверьте консоль.');
          }
        }
      });
    } catch (error) {
      console.error('Error opening invoice:', error);
      setProcessingPayment(false);
      currentInvoicePayloadRef.current = null;
      tg.showAlert('Ошибка при открытии платежной формы');
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

      // Listen for invoice closed event (payment completed)
      // Note: For Stars payments, the callback from openInvoice is usually sufficient
      // But we keep this as a backup
      const handleInvoiceClosed = (event) => {
        console.log('Invoice closed event received:', event);
        console.log('Event type:', typeof event);
        console.log('Event status:', event?.status);
        
        // Only process if status is paid
        if (event && (event.status === 'paid' || event === 'paid')) {
          console.log('Processing payment via invoiceClosed event');
          // Use a small delay to ensure callback from openInvoice processes first
          setTimeout(() => {
            handlePaymentSuccess(event);
          }, 100);
        } else {
          console.log('Invoice closed but not paid, status:', event?.status || event);
        }
      };

      // Register event listener
      if (tg.onEvent) {
        tg.onEvent('invoiceClosed', handleInvoiceClosed);
        console.log('Registered invoiceClosed event listener');
      } else {
        console.warn('onEvent not available in Telegram WebApp');
      }

      // Cleanup
      return () => {
        if (tg.offEvent) {
          tg.offEvent('invoiceClosed', handleInvoiceClosed);
        }
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

