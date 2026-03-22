// backend/src/db.js
// This file is maintained for backward compatibility
// New code should use backend/src/config/database.js directly

const database = require('./config/database');
const logger = require('./utils/logger');

/**
 * Initialize database connection pool using DATABASE_URL from environment
 * Uses Neon DB serverless PostgreSQL with built-in connection pooling
 * 
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  // Test connection
  try {
    const isHealthy = await database.healthCheck();
    if (isHealthy) {
      logger.info('Connected to Neon DB (PostgreSQL)');
    } else {
      throw new Error('Database health check failed');
    }
  } catch (error) {
    logger.error('Database connection error', { error });
    throw new Error(`Failed to connect to database: ${error.message}`);
  }
}

/**
 * Get the database manager instance
 * @returns {DatabaseManager} The database manager
 */
function getPool() {
  return database;
}

module.exports = {
  initializeDatabase,
  getPool,
  // For backward compatibility, export database manager as pool
  get pool() {
    return database;
  },
  // Direct access to database manager
  database
};
