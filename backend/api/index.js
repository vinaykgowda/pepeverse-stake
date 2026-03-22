// backend/api/index.js - Vercel Serverless Entry Point

const express = require('express');
const cors = require('cors');
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

// CORS - simplified for initial deployment
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['*'];

console.log('CORS - Allowed origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    console.log('CORS - Request origin:', origin);
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS - Rejected origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add explicit CORS headers for all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

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
