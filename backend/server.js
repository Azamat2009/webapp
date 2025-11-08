const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { Pool } = require('pg');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I';

// Initialize Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        coins INTEGER DEFAULT 0,
        total_clicks INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL,
        invoice_payload VARCHAR(255) UNIQUE NOT NULL,
        currency VARCHAR(10) DEFAULT 'XTR',
        total_amount INTEGER NOT NULL,
        coins_awarded INTEGER DEFAULT 10000,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_coins ON users(coins DESC);
      CREATE INDEX IF NOT EXISTS idx_payments_telegram_id ON payments(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_payments_invoice_payload ON payments(invoice_payload);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Initialize database on startup
initDatabase();

// Routes

// Get or create user
app.post('/api/user', async (req, res) => {
  try {
    const { id, username, first_name } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

    // Check if user exists
    let result = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      // Create new user
      result = await pool.query(
        `INSERT INTO users (telegram_id, username, first_name, coins, total_clicks)
         VALUES ($1, $2, $3, 0, 0)
         RETURNING *`,
        [id, username || null, first_name || null]
      );
    } else {
      // Update user info if changed
      result = await pool.query(
        `UPDATE users 
         SET username = $1, first_name = $2, updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $3
         RETURNING *`,
        [username || result.rows[0].username, first_name || result.rows[0].first_name, id]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in /api/user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add coins (click)
app.post('/api/click', async (req, res) => {
  try {
    const { telegram_id, coins } = req.body;
    
    if (!telegram_id) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

    const coinsToAdd = coins || 1;

    const result = await pool.query(
      `UPDATE users 
       SET coins = coins + $1, 
           total_clicks = total_clicks + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE telegram_id = $2
       RETURNING *`,
      [coinsToAdd, telegram_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in /api/click:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await pool.query(
      `SELECT telegram_id, username, first_name, coins, total_clicks
       FROM users
       ORDER BY coins DESC
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error in /api/leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user stats
app.get('/api/user/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegram_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in /api/user/:telegram_id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create invoice for Stars payment
app.post('/api/payment/create-invoice', async (req, res) => {
  try {
    const { telegram_id } = req.body;
    
    if (!telegram_id) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

    // Verify user exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegram_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate unique invoice payload
    const invoicePayload = `stars_${telegram_id}_${Date.now()}`;
    
    // Create invoice payload for database
    await pool.query(
      `INSERT INTO payments (telegram_id, invoice_payload, currency, total_amount, coins_awarded, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (invoice_payload) DO NOTHING`,
      [telegram_id, invoicePayload, 'XTR', 1, 10000]
    );

    // Send invoice via Bot API
    try {
      await bot.sendInvoice(
        telegram_id,
        '10000 монет',
        'Получите 10000 монет за звезды Telegram',
        invoicePayload,
        '', // provider_token - не нужен для Stars
        'XTR', // currency - Telegram Stars
        [
          {
            label: '10000 монет',
            amount: 1 // 1 star
          }
        ],
        {
          start_parameter: invoicePayload,
          need_name: false,
          need_phone_number: false,
          need_email: false,
          need_shipping_address: false,
          send_phone_number_to_provider: false,
          send_email_to_provider: false,
          is_flexible: false
        }
      );

      res.json({
        success: true,
        message: 'Invoice sent successfully',
        invoice_payload: invoicePayload
      });
    } catch (botError) {
      console.error('Error sending invoice:', botError);
      return res.status(500).json({ 
        error: 'Failed to send invoice',
        message: botError.message 
      });
    }
  } catch (error) {
    console.error('Error in /api/payment/create-invoice:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process Stars payment (for successful payment updates)
app.post('/api/payment/stars', async (req, res) => {
  try {
    console.log('Payment request received:', {
      body: req.body,
      headers: req.headers
    });
    
    const { telegram_id, invoice_payload, currency, total_amount } = req.body;
    
    if (!telegram_id || !invoice_payload) {
      console.error('Missing required fields:', { telegram_id: !!telegram_id, invoice_payload: !!invoice_payload });
      return res.status(400).json({ error: 'Telegram ID and invoice payload are required' });
    }
    
    console.log('Processing payment for user:', telegram_id, 'with payload:', invoice_payload);

    // Check if payment already processed
    const existingPayment = await pool.query(
      'SELECT * FROM payments WHERE invoice_payload = $1',
      [invoice_payload]
    );

    if (existingPayment.rows.length > 0 && existingPayment.rows[0].status === 'completed') {
      return res.status(400).json({ error: 'Payment already processed' });
    }

    // Verify user exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegram_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // For Stars payments, we trust the payment data from Telegram
    // In production, you might want to verify with Telegram Bot API
    const coinsAwarded = 10000;

    // Record payment
    let paymentResult;
    if (existingPayment.rows.length > 0) {
      // Update existing payment
      paymentResult = await pool.query(
        `UPDATE payments 
         SET status = 'completed', 
             coins_awarded = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE invoice_payload = $2
         RETURNING *`,
        [coinsAwarded, invoice_payload]
      );
    } else {
      // Create new payment record
      paymentResult = await pool.query(
        `INSERT INTO payments (telegram_id, invoice_payload, currency, total_amount, coins_awarded, status)
         VALUES ($1, $2, $3, $4, $5, 'completed')
         RETURNING *`,
        [telegram_id, invoice_payload, currency || 'XTR', total_amount || 0, coinsAwarded]
      );
    }

    // Only award coins if payment status changed to completed
    if (existingPayment.rows.length === 0 || existingPayment.rows[0].status !== 'completed') {
      console.log('Awarding coins to user:', telegram_id, 'amount:', coinsAwarded);
      
      // Award coins to user
      const userResult = await pool.query(
        `UPDATE users 
         SET coins = coins + $1, 
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $2
         RETURNING *`,
        [coinsAwarded, telegram_id]
      );

      console.log('Coins awarded successfully. New balance:', userResult.rows[0]?.coins);

      res.json({
        success: true,
        user: userResult.rows[0],
        payment: paymentResult.rows[0],
        coins_awarded: coinsAwarded
      });
    } else {
      console.log('Payment already processed for payload:', invoice_payload);
      // Payment was already processed
      res.json({
        success: true,
        user: userCheck.rows[0],
        payment: paymentResult.rows[0],
        coins_awarded: 0,
        message: 'Payment already processed'
      });
    }
  } catch (error) {
    console.error('Error in /api/payment/stars:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Webhook for Telegram Bot updates (for payment processing)
app.post('/webhook', express.json(), async (req, res) => {
  try {
    const update = req.body;
    
    // Handle pre_checkout_query
    if (update.pre_checkout_query) {
      const query = update.pre_checkout_query;
      console.log('Pre-checkout query received:', query);
      
      // Always approve the payment for digital goods
      try {
        await bot.answerPreCheckoutQuery(query.id, true);
        console.log('Pre-checkout query approved');
      } catch (error) {
        console.error('Error answering pre-checkout query:', error);
      }
    }
    
    // Handle successful payment
    if (update.message && update.message.successful_payment) {
      const payment = update.message.successful_payment;
      const telegram_id = update.message.from.id;
      const invoicePayload = payment.invoice_payload;
      
      console.log('Successful payment received:', {
        telegram_id,
        invoice_payload: invoicePayload,
        total_amount: payment.total_amount,
        currency: payment.currency
      });

      // Check if payment already processed
      const existingPayment = await pool.query(
        'SELECT * FROM payments WHERE invoice_payload = $1',
        [invoicePayload]
      );

      if (existingPayment.rows.length > 0 && existingPayment.rows[0].status === 'completed') {
        console.log('Payment already processed');
        return res.json({ ok: true });
      }

      // Verify user exists
      const userCheck = await pool.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegram_id]
      );

      if (userCheck.rows.length === 0) {
        console.error('User not found for payment');
        return res.json({ ok: true });
      }

      const coinsAwarded = 10000;

      // Record payment
      let paymentResult;
      if (existingPayment.rows.length > 0) {
        paymentResult = await pool.query(
          `UPDATE payments 
           SET status = 'completed', 
               coins_awarded = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE invoice_payload = $2
           RETURNING *`,
          [coinsAwarded, invoicePayload]
        );
      } else {
        paymentResult = await pool.query(
          `INSERT INTO payments (telegram_id, invoice_payload, currency, total_amount, coins_awarded, status)
           VALUES ($1, $2, $3, $4, $5, 'completed')
           RETURNING *`,
          [telegram_id, invoicePayload, payment.currency || 'XTR', payment.total_amount || 1, coinsAwarded]
        );
      }

      // Award coins to user
      if (existingPayment.rows.length === 0 || existingPayment.rows[0].status !== 'completed') {
        await pool.query(
          `UPDATE users 
           SET coins = coins + $1, 
               updated_at = CURRENT_TIMESTAMP
           WHERE telegram_id = $2`,
          [coinsAwarded, telegram_id]
        );

        // Send confirmation message to user
        try {
          await bot.sendMessage(
            telegram_id,
            `✅ Оплата успешна! Вам начислено ${coinsAwarded} монет!`
          );
        } catch (msgError) {
          console.error('Error sending confirmation message:', msgError);
        }

        console.log('Coins awarded successfully to user:', telegram_id);
      }
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error in webhook:', error);
    res.json({ ok: true }); // Always return ok to prevent Telegram from retrying
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Bot token: ${BOT_TOKEN ? 'Set' : 'Not set'}`);
});

