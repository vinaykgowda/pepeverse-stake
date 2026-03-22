/**
 * Example usage of SecretsManager in the application
 * 
 * This file demonstrates how to integrate the SecretsManager
 * into various parts of the application.
 */

const secretsManager = require('./secrets');

/**
 * Example 1: Initialize database connection with secrets
 */
async function initializeDatabase() {
  const mysql = require('mysql2');
  
  try {
    const secrets = await secretsManager.getRequiredSecrets();
    
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: secrets.dbPassword,
      database: process.env.DB_NAME,
      connectionLimit: 20,
      maxIdle: 10,
      idleTimeout: 30000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 10000,
      acquireTimeout: 10000,
      timezone: 'Z',
      charset: 'utf8mb4'
    });
    
    console.log('Database connection pool created successfully');
    return pool;
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  }
}

/**
 * Example 2: JWT authentication middleware
 */
async function createAuthMiddleware() {
  const jwt = require('jsonwebtoken');
  
  const secrets = await secretsManager.getRequiredSecrets();
  
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'MISSING_TOKEN'
      });
    }
    
    try {
      const decoded = jwt.verify(token, secrets.jwtSecret);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  };
}

/**
 * Example 3: Helius API client initialization
 */
async function initializeHeliusClient() {
  const axios = require('axios');
  
  try {
    const secrets = await secretsManager.getRequiredSecrets();
    
    const heliusClient = axios.create({
      baseURL: process.env.HELIUS_MAINNET_ENDPOINT,
      headers: {
        'Authorization': `Bearer ${secrets.heliusApiKey}`
      },
      timeout: 10000
    });
    
    console.log('Helius API client initialized successfully');
    return heliusClient;
  } catch (error) {
    console.error('Failed to initialize Helius client:', error.message);
    process.exit(1);
  }
}

/**
 * Example 4: Application startup with secrets validation
 */
async function startApplication() {
  console.log('Starting application...');
  
  try {
    // Load and validate all required secrets at startup
    console.log('Loading secrets...');
    const secrets = await secretsManager.getRequiredSecrets();
    console.log('✓ All required secrets loaded successfully');
    
    // Initialize database
    console.log('Initializing database...');
    const dbPool = await initializeDatabase();
    console.log('✓ Database initialized');
    
    // Initialize Helius client
    console.log('Initializing Helius client...');
    const heliusClient = await initializeHeliusClient();
    console.log('✓ Helius client initialized');
    
    // Initialize auth middleware
    console.log('Initializing authentication...');
    const authMiddleware = await createAuthMiddleware();
    console.log('✓ Authentication initialized');
    
    console.log('Application started successfully!');
    
    return {
      dbPool,
      heliusClient,
      authMiddleware
    };
  } catch (error) {
    console.error('Failed to start application:', error.message);
    console.error('Please ensure all required secrets are configured:');
    console.error('  - JWT_SECRET');
    console.error('  - DB_PASSWORD');
    console.error('  - HELIUS_API_KEY');
    console.error('  - REWARDS_WALLET_PRIVATE_KEY');
    process.exit(1);
  }
}

/**
 * Example 5: Graceful handling of missing secrets
 */
async function validateEnvironment() {
  const requiredSecrets = [
    'JWT_SECRET',
    'DB_PASSWORD',
    'HELIUS_API_KEY',
    'REWARDS_WALLET_PRIVATE_KEY'
  ];
  
  const missingSecrets = [];
  
  for (const secretName of requiredSecrets) {
    try {
      await secretsManager.getSecret(secretName);
    } catch (error) {
      missingSecrets.push(secretName);
    }
  }
  
  if (missingSecrets.length > 0) {
    console.error('Missing required secrets:');
    missingSecrets.forEach(secret => console.error(`  - ${secret}`));
    return false;
  }
  
  return true;
}

// Export examples
module.exports = {
  initializeDatabase,
  createAuthMiddleware,
  initializeHeliusClient,
  startApplication,
  validateEnvironment
};

// If running directly, demonstrate usage
if (require.main === module) {
  startApplication().catch(error => {
    console.error('Application failed to start:', error);
    process.exit(1);
  });
}
