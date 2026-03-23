// backend/server.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { initializeDatabase } = require('./src/db');
const apiRoutes = require('./src/solana-api-endpoints');
const authRoutes = require('./routes/auth');
const heliusRoutes = require('./routes/helius');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const networkConfig = require('./src/config/network');
const { validateOrExit, getConfigSummary } = require('./src/config/startup-validation');
const { jsonParseErrorHandler } = require('./middleware/jsonErrorHandler');
const { databaseErrorHandler } = require('./middleware/databaseErrorHandler');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./src/utils/logger');
dotenv.config();

// Validate all required environment variables and secrets
// This will exit with code 1 if any required variables are missing
logger.info('Validating environment configuration');
validateOrExit();

// Log configuration summary (with sensitive values redacted)
const configSummary = getConfigSummary();
logger.info('Configuration loaded', configSummary);


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
  
  logger.info('Development mode: localhost origins automatically allowed');
}

if (allowedOrigins.length === 0) {
  logger.error('ALLOWED_ORIGINS is not configured. CORS will reject all cross-origin requests');
  if (!isDevelopment) {
    process.exit(1);
  }
}

logger.info('CORS Configuration', {
  environment: isDevelopment ? 'development' : 'production',
  allowedOrigins: allowedOrigins.join(', '),
  wildcardAllowed: false
});

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is in whitelist
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy does not allow access from origin: ${origin}`;
      logger.warn('CORS rejection', { origin, message: msg });
      return callback(new Error(msg), false);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Request logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to all routes
app.use(limiter);

// Parse URL-encoded request body
app.use(express.urlencoded({ extended: true }));

// API routes
const apiBaseUrl = process.env.API_BASE_URL;
if (!apiBaseUrl) {
  logger.error('API_BASE_URL environment variable is required');
  process.exit(1);
}

app.use(`${apiBaseUrl}/auth`, authRoutes);
app.use(`${apiBaseUrl}/helius`, heliusRoutes);
app.use(`${apiBaseUrl}/admin`, adminRoutes);
app.use(`${apiBaseUrl}/user`, userRoutes);
app.use(apiBaseUrl, apiRoutes);

// Health check endpoint - mounted at root level for monitoring
app.use('/', healthRoutes);

// JSON parsing error handler middleware (must be after routes that use express.json())
// Requirements: 16.1, 16.2 - Catch and handle JSON parsing errors
app.use(jsonParseErrorHandler);

// Database error handler middleware
// Requirements: 17.4, 17.5 - Return HTTP 503 on database connection failure
app.use(databaseErrorHandler);

// 404 handler for undefined routes
// Requirements: 30.1 - Centralized error handling
app.use(notFoundHandler);

// Centralized error handling middleware
// Requirements: 30.1, 30.2, 30.3, 30.5 - Consistent error handling with logging
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Validate network configuration and connectivity
    logger.info('Validating network configuration');
    const networkValidation = await networkConfig.validateConnectivity();
    logger.info('Network validation results', {
      primaryRpc: networkValidation.primaryRpc.status,
      fallbackRpc: networkValidation.fallbackRpc.status,
      helius: networkValidation.helius.status
    });
    logger.info('Network configuration validated successfully');
    
    // Initialize database connection with secrets manager
    logger.info('Initializing database connection');
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Start server
    const PORT = process.env.PORT;
    if (!PORT) {
      logger.error('PORT environment variable is required');
      process.exit(1);
    }

    app.listen(PORT, () => {
      logger.info('Server running', { 
        port: PORT,
        note: 'Admin routes now served through solana-api-endpoints.js'
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Start the server
startServer();