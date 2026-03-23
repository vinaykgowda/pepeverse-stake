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

// Load routes
try {
  const authRoutes = require('../routes/auth');
  app.use('/api/v1/auth', authRoutes);
  console.log('[ROUTES] auth loaded from ../routes/auth');
} catch (e) { console.error('[ROUTES] Failed to load auth routes:', e.message); }

try {
  const heliusRoutes = require('../routes/helius');
  app.use('/api/v1/helius', heliusRoutes);
  console.log('[ROUTES] helius loaded from ../routes/helius');
} catch (e) { console.error('[ROUTES] Failed to load helius routes:', e.message); }

try {
  const adminRoutes = require('../backend/routes/admin');
  app.use('/api/v1/admin', adminRoutes);
  console.log('[ROUTES] admin loaded from ../backend/routes/admin');
} catch (e) { console.error('[ROUTES] Failed to load admin routes:', e.message, e.stack); }

try {
  const userRoutes = require('../backend/routes/user');
  app.use('/api/v1/user', userRoutes);
  console.log('[ROUTES] user loaded from ../backend/routes/user');
} catch (e) { console.error('[ROUTES] Failed to load user routes:', e.message, e.stack); }

try {
  const apiRoutes = require('../src/solana-api-endpoints');
  app.use('/api/v1', apiRoutes);
  console.log('[ROUTES] solana-api-endpoints loaded');
} catch (e) { console.error('[ROUTES] Failed to load API routes:', e.message); }

// Debug: log all registered routes
app.get('/api/v1/debug-routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(layer => {
    if (layer.handle && layer.handle.stack) {
      layer.handle.stack.forEach(r => {
        if (r.route) routes.push({ path: layer.regexp.toString().substring(0, 60), route: r.route.path, methods: Object.keys(r.route.methods) });
      });
    } else if (layer.route) {
      routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
    }
  });
  res.json({ routes });
});

// 404
app.use((req, res) => {
  console.log('[404]', req.method, req.path);
  res.status(404).json({ error: 'Not Found', path: req.path, message: 'The requested endpoint does not exist' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
