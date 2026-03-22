// backend/src/db.test.js

// Set up test environment variable before requiring the module
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test?sslmode=require';

describe('Database Connection with Vercel Environment Variables', () => {
  let originalEnv;
  let db;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear mocks and reset modules
    jest.clearAllMocks();
    jest.resetModules();
    
    db = require('./db');
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('DATABASE_URL Configuration', () => {
    test('should use DATABASE_URL from environment for PostgreSQL', async () => {
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/test_db?sslmode=require';
      
      // Mock the database healthCheck to avoid real connection
      const mockHealthCheck = jest.fn().mockResolvedValue(true);
      db.database.healthCheck = mockHealthCheck;
      
      await db.initializeDatabase();
      
      expect(mockHealthCheck).toHaveBeenCalled();
    });
    
    test('should throw error if DATABASE_URL is missing', async () => {
      delete process.env.DATABASE_URL;
      
      // Reset modules to force re-initialization
      jest.resetModules();
      
      expect(() => {
        require('./config/database');
      }).toThrow('DATABASE_URL environment variable is required');
    });
    
    test('should throw error if database health check fails', async () => {
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/test_db?sslmode=require';
      
      // Mock the database healthCheck to fail
      const mockHealthCheck = jest.fn().mockResolvedValue(false);
      db.database.healthCheck = mockHealthCheck;
      
      await expect(db.initializeDatabase()).rejects.toThrow('Database health check failed');
    });
  });
  
  describe('getPool', () => {
    test('should return database manager instance', () => {
      const pool = db.getPool();
      expect(pool).toBeDefined();
      expect(pool.query).toBeDefined();
      expect(pool.healthCheck).toBeDefined();
    });
    
    test('should provide backward compatibility with pool property', () => {
      expect(db.pool).toBeDefined();
      expect(db.pool.query).toBeDefined();
    });
  });
  
  describe('Neon DB Configuration', () => {
    test('should configure 10-second connection timeout', () => {
      const database = db.database;
      expect(database.pool.options.connectionTimeoutMillis).toBe(10000);
    });
    
    test('should configure max 20 connections', () => {
      const database = db.database;
      expect(database.pool.options.max).toBe(20);
    });
    
    test('should enable SSL for Neon DB', () => {
      const database = db.database;
      expect(database.pool.options.ssl).toEqual({
        rejectUnauthorized: false
      });
    });
  });
});
