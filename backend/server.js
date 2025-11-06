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
      CREATE INDEX IF NOT EXISTS idx_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_coins ON users(coins DESC);
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

