// api/index.js - Vercel Serverless Entry Point

const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.disable('x-powered-by');

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Health checks
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Pepeverse Staking API', timestamp: new Date().toISOString() }));
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'production', database: process.env.DATABASE_URL ? 'configured' : 'not configured' }));

// Database pool (lazy init)
let dbPool = null;
async function getDbPool() {
  if (!dbPool && process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return dbPool;
}

app.use(async (req, res, next) => {
  try { req.db = await getDbPool(); next(); } catch (error) { next(); }
});

// Load routes from backend/routes/ - these have correct internal relative paths
try {
  app.use('/api/v1/auth', require('../routes/auth'));
} catch (e) { console.error('Failed to load auth routes:', e.message); }

try {
  app.use('/api/v1/helius', require('../routes/helius'));
} catch (e) { console.error('Failed to load helius routes:', e.message); }

try {
  app.use('/api/v1/admin', require('../backend/routes/admin'));
} catch (e) { console.error('Failed to load admin routes:', e.message); }

try {
  app.use('/api/v1/user', require('../backend/routes/user'));
} catch (e) { console.error('Failed to load user routes:', e.message); }

try {
  app.use('/api/v1', require('../src/solana-api-endpoints'));
} catch (e) { console.error('Failed to load API routes:', e.message); }

// 404
app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.path, message: 'The requested endpoint does not exist' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
