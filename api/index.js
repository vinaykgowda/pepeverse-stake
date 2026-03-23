// api/index.js - Vercel Serverless Entry Point (v3)

const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');

// Load environment variables first
dotenv.config();

// Create Express app
const app = express();

// Disable x-powered-by header
app.disable('x-powered-by');

// Basic security headers (simplified for serverless)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple health check at root
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Pepeverse Staking API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    database: process.env.DATABASE_URL ? 'configured' : 'not configured'
  });
});

// Database connection pool (lazy initialization)
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

// Middleware to attach db to request
app.use(async (req, res, next) => {
  try {
    req.db = await getDbPool();
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    next(); // Continue even if DB fails
  }
});

// Load routes dynamically to avoid startup crashes
try {
  const authRoutes = require('../routes/auth');
  app.use('/api/v1/auth', authRoutes);
} catch (error) {
  console.error('Failed to load auth routes:', error.message);
}

try {
  const heliusRoutes = require('../routes/helius');
  app.use('/api/v1/helius', heliusRoutes);
} catch (error) {
  console.error('Failed to load helius routes:', error.message);
}

try {
  const apiRoutes = require('../src/solana-api-endpoints');
  app.use('/api/v1', apiRoutes);
} catch (error) {
  console.error('Failed to load API routes:', error.message);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
    message: 'The requested endpoint does not exist'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Export for Vercel serverless
module.exports = app;
