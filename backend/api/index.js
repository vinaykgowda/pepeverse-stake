// backend/api/index.js - Vercel Serverless Entry Point

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { initializeDatabase } = require('../src/db');
const apiRoutes = require('../src/solana-api-endpoints');
const authRoutes = require('../routes/auth');
const heliusRoutes = require('../routes/helius');
const healthRoutes = require('../routes/health');
const { jsonParseErrorHandler } = require('../middleware/jsonErrorHandler');
const { databaseErrorHandler } = require('../middleware/databaseErrorHandler');
const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');
const logger = require('../src/utils/logger');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Basic security headers
app.use(helmet());

app.use(express.json({ limit: '5mb' }));

// CORS configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : [];

// In development, automatically allow localhost origins
if (isDevelopment) {
  const localhostOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173'
  ];
  
  localhostOrigins.forEach(origin => {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  });
}

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy does not allow access from origin: ${origin}`;
      logger.warn('CORS rejection', { origin, message: msg });
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logger
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database connection (cached across invocations)
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
    logger.info('Database initialized');
  }
}

// Middleware to ensure DB is initialized
app.use(async (req, res, next) => {
  try {
    await ensureDbInitialized();
    next();
  } catch (error) {
    logger.error('Database initialization failed', { error: error.message });
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
});

// API routes
const apiBaseUrl = process.env.API_BASE_URL || '/api/v1';

app.use(`${apiBaseUrl}/auth`, authRoutes);
app.use(`${apiBaseUrl}/helius`, heliusRoutes);
app.use(apiBaseUrl, apiRoutes);

// Health check endpoint
app.use('/', healthRoutes);

// Error handlers
app.use(jsonParseErrorHandler);
app.use(databaseErrorHandler);
app.use(notFoundHandler);
app.use(errorHandler);

// Export for Vercel serverless
module.exports = app;
