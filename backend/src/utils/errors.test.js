// backend/src/utils/errors.test.js
// Unit tests for custom error classes
// Requirements: 30.4

const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  TransactionError,
  InternalServerError
} = require('./errors');

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with default values', () => {
      const error = new AppError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('APP_ERROR');
      expect(error.details).toBeNull();
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });

    it('should create an error with custom values', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new AppError('Custom error', 400, 'CUSTOM_CODE', details);
      
      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.details).toEqual(details);
    });

    it('should have a stack trace', () => {
      const error = new AppError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError('Test error', 400, 'TEST_CODE');
      const json = error.toJSON();
      
      expect(json).toEqual({
        error: 'Test error',
        code: 'TEST_CODE'
      });
    });

    it('should include details in JSON when present', () => {
      const details = { field: 'email' };
      const error = new AppError('Test error', 400, 'TEST_CODE', details);
      const json = error.toJSON();
      
      expect(json).toEqual({
        error: 'Test error',
        code: 'TEST_CODE',
        details: { field: 'email' }
      });
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with correct defaults', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });

    it('should accept details', () => {
      const details = { field: 'walletAddress', reason: 'invalid format' };
      const error = new ValidationError('Invalid wallet address', details);
      
      expect(error.details).toEqual(details);
    });
  });

  describe('AuthenticationError', () => {
    it('should create an authentication error with default message', () => {
      const error = new AuthenticationError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should accept custom message', () => {
      const error = new AuthenticationError('Invalid signature');
      
      expect(error.message).toBe('Invalid signature');
      expect(error.statusCode).toBe(401);
    });

    it('should accept details', () => {
      const details = { reason: 'nonce expired' };
      const error = new AuthenticationError('Nonce expired', details);
      
      expect(error.details).toEqual(details);
    });
  });

  describe('AuthorizationError', () => {
    it('should create an authorization error with default message', () => {
      const error = new AuthorizationError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('should accept custom message', () => {
      const error = new AuthorizationError('NFT ownership verification failed');
      
      expect(error.message).toBe('NFT ownership verification failed');
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error with default message', () => {
      const error = new NotFoundError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should accept custom message', () => {
      const error = new NotFoundError('Collection not found');
      
      expect(error.message).toBe('Collection not found');
    });
  });

  describe('ConflictError', () => {
    it('should create a conflict error with default message', () => {
      const error = new ConflictError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Resource conflict');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT_ERROR');
    });

    it('should accept custom message and details', () => {
      const details = { nftMint: 'abc123', reason: 'already staked' };
      const error = new ConflictError('NFT already staked', details);
      
      expect(error.message).toBe('NFT already staked');
      expect(error.details).toEqual(details);
    });
  });

  describe('RateLimitError', () => {
    it('should create a rate limit error with default values', () => {
      const error = new RateLimitError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(60);
    });

    it('should accept custom retry after value', () => {
      const error = new RateLimitError('Too many requests', 120);
      
      expect(error.retryAfter).toBe(120);
    });

    it('should include retryAfter in JSON', () => {
      const error = new RateLimitError('Too many requests', 30);
      const json = error.toJSON();
      
      expect(json).toEqual({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 30
      });
    });
  });

  describe('DatabaseError', () => {
    it('should create a database error with default message', () => {
      const error = new DatabaseError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Database error');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('DATABASE_ERROR');
    });

    it('should accept custom message and details', () => {
      const details = { query: 'SELECT * FROM users', error: 'connection timeout' };
      const error = new DatabaseError('Database connection failed', details);
      
      expect(error.message).toBe('Database connection failed');
      expect(error.details).toEqual(details);
    });
  });

  describe('ExternalServiceError', () => {
    it('should create an external service error with default message', () => {
      const error = new ExternalServiceError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('External service unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.serviceName).toBeNull();
    });

    it('should accept service name', () => {
      const error = new ExternalServiceError('Helius API unavailable', 'Helius');
      
      expect(error.message).toBe('Helius API unavailable');
      expect(error.serviceName).toBe('Helius');
    });

    it('should include service name in JSON', () => {
      const error = new ExternalServiceError('RPC timeout', 'Solana RPC');
      const json = error.toJSON();
      
      expect(json).toEqual({
        error: 'RPC timeout',
        code: 'EXTERNAL_SERVICE_ERROR',
        service: 'Solana RPC'
      });
    });

    it('should not include service name in JSON when null', () => {
      const error = new ExternalServiceError('Service unavailable');
      const json = error.toJSON();
      
      expect(json).toEqual({
        error: 'Service unavailable',
        code: 'EXTERNAL_SERVICE_ERROR'
      });
    });
  });

  describe('TransactionError', () => {
    it('should create a transaction error with default status code', () => {
      const error = new TransactionError('Transaction failed');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Transaction failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TRANSACTION_ERROR');
    });

    it('should accept custom status code', () => {
      const error = new TransactionError('Transaction timeout', 503);
      
      expect(error.statusCode).toBe(503);
    });

    it('should accept details', () => {
      const details = { signature: 'abc123', reason: 'insufficient funds' };
      const error = new TransactionError('Transaction failed', 400, details);
      
      expect(error.details).toEqual(details);
    });
  });

  describe('InternalServerError', () => {
    it('should create an internal server error with default message', () => {
      const error = new InternalServerError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Internal server error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should accept custom message and details', () => {
      const details = { stack: 'Error stack trace' };
      const error = new InternalServerError('Unexpected error occurred', details);
      
      expect(error.message).toBe('Unexpected error occurred');
      expect(error.details).toEqual(details);
    });
  });

  describe('Error inheritance', () => {
    it('should maintain proper inheritance chain', () => {
      const errors = [
        new ValidationError('test'),
        new AuthenticationError('test'),
        new AuthorizationError('test'),
        new NotFoundError('test'),
        new ConflictError('test'),
        new RateLimitError('test'),
        new DatabaseError('test'),
        new ExternalServiceError('test'),
        new TransactionError('test'),
        new InternalServerError('test')
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
        expect(error.isOperational).toBe(true);
      });
    });
  });

  describe('Error catching', () => {
    it('should be catchable with try-catch', () => {
      expect(() => {
        throw new ValidationError('Test error');
      }).toThrow(ValidationError);

      expect(() => {
        throw new ValidationError('Test error');
      }).toThrow(AppError);

      expect(() => {
        throw new ValidationError('Test error');
      }).toThrow(Error);
    });

    it('should allow type checking in catch blocks', () => {
      try {
        throw new AuthenticationError('Invalid token');
      } catch (error) {
        expect(error instanceof AuthenticationError).toBe(true);
        expect(error instanceof AppError).toBe(true);
        expect(error.statusCode).toBe(401);
      }
    });
  });
});
