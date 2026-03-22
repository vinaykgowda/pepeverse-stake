// backend/src/config/database.test.js

// Set up test environment variable before requiring the module
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test?sslmode=require';

const DatabaseManager = require('./database');

describe('DatabaseManager', () => {
  describe('constructor', () => {
    it('should throw error if DATABASE_URL is not set', () => {
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      
      expect(() => {
        // Force re-instantiation by requiring a fresh copy
        jest.resetModules();
        require('./database');
      }).toThrow('DATABASE_URL environment variable is required');
      
      process.env.DATABASE_URL = originalUrl;
    });
  });

  describe('query', () => {
    it('should execute query and return results', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      DatabaseManager.pool.query = jest.fn().mockResolvedValue(mockResult);
      
      const result = await DatabaseManager.query('SELECT 1', []);
      
      expect(result).toEqual(mockResult);
      expect(DatabaseManager.pool.query).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should log query execution time', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockResult = { rows: [], rowCount: 0 };
      DatabaseManager.pool.query = jest.fn().mockResolvedValue(mockResult);
      
      await DatabaseManager.query('SELECT 1', []);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Query executed',
        expect.objectContaining({
          text: 'SELECT 1',
          duration: expect.any(Number),
          rows: 0
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should log and throw error on query failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Query failed');
      DatabaseManager.pool.query = jest.fn().mockRejectedValue(error);
      
      await expect(DatabaseManager.query('INVALID SQL', [])).rejects.toThrow('Query failed');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Query error:',
        expect.objectContaining({
          text: 'INVALID SQL',
          error: 'Query failed'
        })
      );
      
      consoleSpy.mockRestore();
    });

    describe('retry logic', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should retry on transient ECONNREFUSED error', async () => {
        const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        
        DatabaseManager.pool.query = jest.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(mockResult);
        
        const queryPromise = DatabaseManager.query('SELECT 1', []);
        
        // Fast-forward through the backoff delay
        await jest.advanceTimersByTimeAsync(100);
        
        const result = await queryPromise;
        
        expect(result).toEqual(mockResult);
        expect(DatabaseManager.pool.query).toHaveBeenCalledTimes(2);
      });

      it('should retry on transient ETIMEDOUT error', async () => {
        const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
        const error = new Error('Connection timeout');
        error.code = 'ETIMEDOUT';
        
        DatabaseManager.pool.query = jest.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(mockResult);
        
        const queryPromise = DatabaseManager.query('SELECT 1', []);
        await jest.advanceTimersByTimeAsync(100);
        const result = await queryPromise;
        
        expect(result).toEqual(mockResult);
        expect(DatabaseManager.pool.query).toHaveBeenCalledTimes(2);
      });

      it('should retry on Connection terminated error', async () => {
        const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
        const error = new Error('Connection terminated unexpectedly');
        
        DatabaseManager.pool.query = jest.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(mockResult);
        
        const queryPromise = DatabaseManager.query('SELECT 1', []);
        await jest.advanceTimersByTimeAsync(100);
        const result = await queryPromise;
        
        expect(result).toEqual(mockResult);
        expect(DatabaseManager.pool.query).toHaveBeenCalledTimes(2);
      });

      it('should use exponential backoff for retries', async () => {
        const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        
        DatabaseManager.pool.query = jest.fn()
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(mockResult);
        
        const queryPromise = DatabaseManager.query('SELECT 1', []);
        
        // First retry: 100ms
        await jest.advanceTimersByTimeAsync(100);
        // Second retry: 200ms
        await jest.advanceTimersByTimeAsync(200);
        
        const result = await queryPromise;
        
        expect(result).toEqual(mockResult);
        expect(DatabaseManager.pool.query).toHaveBeenCalledTimes(3);
      });

      it('should throw error after max retries', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        
        DatabaseManager.pool.query = jest.fn().mockRejectedValue(error);
        
        const queryPromise = DatabaseManager.query('SELECT 1', []);
        
        // Advance through all retry attempts
        await jest.advanceTimersByTimeAsync(100); // First retry
        await jest.advanceTimersByTimeAsync(200); // Second retry
        await jest.advanceTimersByTimeAsync(1); // Allow final rejection to process
        
        await expect(queryPromise).rejects.toThrow('Connection refused');
        expect(DatabaseManager.pool.query).toHaveBeenCalledTimes(3);
        
        consoleSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      });

      it('should not retry non-transient errors', async () => {
        const error = new Error('Syntax error');
        error.code = 'SYNTAX_ERROR';
        
        DatabaseManager.pool.query = jest.fn().mockRejectedValue(error);
        
        await expect(DatabaseManager.query('INVALID SQL', [])).rejects.toThrow('Syntax error');
        expect(DatabaseManager.pool.query).toHaveBeenCalledTimes(1);
      });

      it('should respect custom retry count', async () => {
        const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        
        DatabaseManager.pool.query = jest.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(mockResult);
        
        const queryPromise = DatabaseManager.query('SELECT 1', [], 1);
        
        await expect(queryPromise).rejects.toThrow('Connection refused');
        expect(DatabaseManager.pool.query).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('getClient', () => {
    it('should return a client from the pool', async () => {
      const mockClient = { release: jest.fn() };
      DatabaseManager.pool.connect = jest.fn().mockResolvedValue(mockClient);
      
      const client = await DatabaseManager.getClient();
      
      expect(client).toEqual(mockClient);
      expect(DatabaseManager.pool.connect).toHaveBeenCalled();
    });

    describe('retry logic', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should retry on transient connection error', async () => {
        const mockClient = { release: jest.fn() };
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        
        DatabaseManager.pool.connect = jest.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(mockClient);
        
        const clientPromise = DatabaseManager.getClient();
        await jest.advanceTimersByTimeAsync(100);
        const client = await clientPromise;
        
        expect(client).toEqual(mockClient);
        expect(DatabaseManager.pool.connect).toHaveBeenCalledTimes(2);
      });

      it('should use exponential backoff', async () => {
        const mockClient = { release: jest.fn() };
        const error = new Error('Connection timeout');
        error.code = 'ETIMEDOUT';
        
        DatabaseManager.pool.connect = jest.fn()
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(mockClient);
        
        const clientPromise = DatabaseManager.getClient();
        await jest.advanceTimersByTimeAsync(100);
        await jest.advanceTimersByTimeAsync(200);
        const client = await clientPromise;
        
        expect(client).toEqual(mockClient);
        expect(DatabaseManager.pool.connect).toHaveBeenCalledTimes(3);
      });

      it('should throw error after max retries', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        
        DatabaseManager.pool.connect = jest.fn().mockRejectedValue(error);
        
        const clientPromise = DatabaseManager.getClient();
        await jest.advanceTimersByTimeAsync(100);
        await jest.advanceTimersByTimeAsync(200);
        await jest.advanceTimersByTimeAsync(1); // Allow final rejection to process
        
        await expect(clientPromise).rejects.toThrow('Connection refused');
        expect(DatabaseManager.pool.connect).toHaveBeenCalledTimes(3);
        
        consoleSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      });

      it('should not retry non-transient errors', async () => {
        const error = new Error('Authentication failed');
        error.code = 'AUTH_ERROR';
        
        DatabaseManager.pool.connect = jest.fn().mockRejectedValue(error);
        
        await expect(DatabaseManager.getClient()).rejects.toThrow('Authentication failed');
        expect(DatabaseManager.pool.connect).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when database is healthy', async () => {
      DatabaseManager.query = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
      
      const result = await DatabaseManager.healthCheck();
      
      expect(result).toBe(true);
      expect(DatabaseManager.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false when database is unhealthy', async () => {
      DatabaseManager.query = jest.fn().mockRejectedValue(new Error('Connection failed'));
      
      const result = await DatabaseManager.healthCheck();
      
      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('should close the connection pool', async () => {
      DatabaseManager.pool.end = jest.fn().mockResolvedValue();
      
      await DatabaseManager.close();
      
      expect(DatabaseManager.pool.end).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should configure pool with correct settings', () => {
      // Check that pool was created with correct configuration
      expect(DatabaseManager.pool).toBeDefined();
      expect(DatabaseManager.connectionString).toBe(process.env.DATABASE_URL);
    });

    it('should set 10-second connection timeout', () => {
      // The pool options should include 10-second timeout
      // This is verified by the constructor configuration
      expect(DatabaseManager.pool.options.connectionTimeoutMillis).toBe(10000);
    });

    it('should set max 20 connections', () => {
      expect(DatabaseManager.pool.options.max).toBe(20);
    });

    it('should enable SSL with rejectUnauthorized false', () => {
      expect(DatabaseManager.pool.options.ssl).toEqual({
        rejectUnauthorized: false
      });
    });
  });
});
