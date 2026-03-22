// backend/src/config/database.js
const { Pool } = require('pg');

/**
 * DatabaseManager class for Neon DB serverless PostgreSQL
 * Uses Neon's built-in connection pooling optimized for serverless environments
 */
class DatabaseManager {
  constructor() {
    // Neon DB connection string from Vercel environment
    this.connectionString = process.env.DATABASE_URL;
    
    if (!this.connectionString) {
      console.warn('DATABASE_URL environment variable is not set - database features will be disabled');
      this.disabled = true;
      return;
    }
    
    // Neon DB handles connection pooling automatically for serverless
    // Configure with 10-second timeout as per requirements
    this.pool = new Pool({
      connectionString: this.connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 10000, // 10-second timeout (Requirement 17.2)
      max: 20 // Maximum 20 connections (design spec)
    });
    
    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }
  
  /**
   * Execute a query with automatic logging and retry logic
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @param {number} retries - Number of retry attempts (default: 3)
   * @returns {Promise<Object>} Query result
   */
  async query(text, params, retries = 3) {
    if (this.disabled) {
      throw new Error('Database is not configured. Please set DATABASE_URL environment variable.');
    }
    const start = Date.now();
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.pool.query(text, params);
        const duration = Date.now() - start;
        
        if (attempt > 1) {
          console.log('Query succeeded after retry', { 
            text, 
            duration, 
            rows: result.rowCount,
            attempt 
          });
        } else {
          console.log('Query executed', { text, duration, rows: result.rowCount });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if this is a transient connection error that should be retried
        const isTransientError = 
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET' ||
          error.code === 'EPIPE' ||
          error.message?.includes('Connection terminated') ||
          error.message?.includes('Connection lost');
        
        if (isTransientError && attempt < retries) {
          // Exponential backoff: 100ms, 200ms, 400ms
          const backoffMs = Math.pow(2, attempt - 1) * 100;
          console.warn('Query failed, retrying...', { 
            text, 
            error: error.message,
            code: error.code,
            attempt,
            retryIn: `${backoffMs}ms`
          });
          
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
        
        // Non-transient error or out of retries
        console.error('Query error:', { 
          text, 
          error: error.message,
          code: error.code,
          attempt
        });
        throw error;
      }
    }
    
    // Should never reach here, but just in case
    throw lastError;
  }
  
  /**
   * Get a client from the pool for transactions with retry logic
   * @param {number} retries - Number of retry attempts (default: 3)
   * @returns {Promise<PoolClient>} Database client
   */
  async getClient(retries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const client = await this.pool.connect();
        
        if (attempt > 1) {
          console.log('Client acquired after retry', { attempt });
        }
        
        return client;
      } catch (error) {
        lastError = error;
        
        // Check if this is a transient connection error
        const isTransientError = 
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET' ||
          error.code === 'EPIPE' ||
          error.message?.includes('Connection terminated') ||
          error.message?.includes('Connection lost');
        
        if (isTransientError && attempt < retries) {
          // Exponential backoff: 100ms, 200ms, 400ms
          const backoffMs = Math.pow(2, attempt - 1) * 100;
          console.warn('Failed to acquire client, retrying...', { 
            error: error.message,
            code: error.code,
            attempt,
            retryIn: `${backoffMs}ms`
          });
          
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
        
        // Non-transient error or out of retries
        console.error('Failed to acquire client:', { 
          error: error.message,
          code: error.code,
          attempt
        });
        throw error;
      }
    }
    
    // Should never reach here, but just in case
    throw lastError;
  }
  
  /**
   * Health check for database connectivity
   * @returns {Promise<boolean>} True if healthy, false otherwise
   */
  async healthCheck() {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Close the connection pool (for graceful shutdown)
   * @returns {Promise<void>}
   */
  async close() {
    await this.pool.end();
  }
}

// Export singleton instance
module.exports = new DatabaseManager();
