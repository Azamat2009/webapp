const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Process Stars payment
app.post('/api/payment/stars', async (req, res) => {
  try {
    const { telegram_id, invoice_payload, currency, total_amount } = req.body;
    
    if (!telegram_id || !invoice_payload) {
      return res.status(400).json({ error: 'Telegram ID and invoice payload are required' });
    }

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
      // Award coins to user
      const userResult = await pool.query(
        `UPDATE users 
         SET coins = coins + $1, 
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $2
         RETURNING *`,
        [coinsAwarded, telegram_id]
      );

      res.json({
        success: true,
        user: userResult.rows[0],
        payment: paymentResult.rows[0],
        coins_awarded: coinsAwarded
      });
    } else {
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

