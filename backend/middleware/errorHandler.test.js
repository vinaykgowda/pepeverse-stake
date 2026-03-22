// backend/middleware/errorHandler.test.js
// Unit tests for centralized error handling middleware
// Requirements: 30.1, 30.2, 30.3, 30.5

const { errorHandler, notFoundHandler } = require('./errorHandler');
const logger = require('../src/utils/logger');
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
} = require('../src/utils/errors');

// Mock logger
jest.mock('../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

describe('Error Handler Middleware', () => {
  let mockReq, mockRes, mockNext;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockReq = {
      path: '/api/test',
      method: 'POST'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    
    // Clear mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Custom Error Classes', () => {
    test('should handle ValidationError with correct status and format', () => {
      const error = new ValidationError('Invalid wallet address', { field: 'walletAddress' });
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid wallet address',
        code: 'VALIDATION_ERROR',
        details: { field: 'walletAddress' }
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    test('should handle AuthenticationError with correct status', () => {
      const error = new AuthenticationError('Invalid signature');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid signature',
        code: 'AUTHENTICATION_ERROR'
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    test('should handle AuthorizationError with correct status', () => {
      const error = new AuthorizationError('NFT ownership verification failed');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'NFT ownership verification failed',
        code: 'AUTHORIZATION_ERROR'
      });
    });

    test('should handle NotFoundError with correct status', () => {
      const error = new NotFoundError('Collection not found');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Collection not found',
        code: 'NOT_FOUND'
      });
    });

    test('should handle ConflictError with correct status', () => {
      const error = new ConflictError('NFT already staked', { nftMint: 'abc123' });
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'NFT already staked',
        code: 'CONFLICT_ERROR',
        details: { nftMint: 'abc123' }
      });
    });

    test('should handle RateLimitError with Retry-After header', () => {
      const error = new RateLimitError('Too many requests', 120);
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', 120);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 120
      });
    });

    test('should handle DatabaseError with correct status', () => {
      const error = new DatabaseError('Connection failed');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Connection failed',
        code: 'DATABASE_ERROR'
      });
      expect(logger.error).toHaveBeenCalled();
    });

    test('should handle ExternalServiceError with service name', () => {
      const error = new ExternalServiceError('Helius API unavailable', 'Helius');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Helius API unavailable',
        code: 'EXTERNAL_SERVICE_ERROR',
        service: 'Helius'
      });
    });

    test('should handle TransactionError with correct status', () => {
      const error = new TransactionError('Transaction failed', 400, { signature: 'abc123' });
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Transaction failed',
        code: 'TRANSACTION_ERROR',
        details: { signature: 'abc123' }
      });
    });

    test('should handle InternalServerError with correct status', () => {
      const error = new InternalServerError('Unexpected error');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unexpected error',
        code: 'INTERNAL_SERVER_ERROR'
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Logging Behavior', () => {
    test('should log server errors (5xx) with error level', () => {
      const error = new DatabaseError('Connection timeout');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(logger.error).toHaveBeenCalledWith(
        'Server error occurred',
        expect.objectContaining({
          code: 'DATABASE_ERROR',
          message: 'Connection timeout',
          statusCode: 503,
          stack: expect.any(String)
        })
      );
    });

    test('should log client errors (4xx) with warn level', () => {
      const error = new ValidationError('Invalid input');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Client error occurred',
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          statusCode: 400
        })
      );
    });

    test('should log unexpected errors with stack trace', () => {
      const error = new Error('Unexpected error');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(logger.error).toHaveBeenCalledWith(
        'Unexpected error occurred',
        expect.objectContaining({
          message: 'Unexpected error',
          stack: expect.any(String)
        })
      );
    });
  });

  describe('Production vs Development Behavior', () => {
    test('should hide internal error details in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Database connection string is invalid');
      error.stack = 'Error: Database connection string is invalid\n    at ...';
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
      // Should not include stack trace in response
      expect(mockRes.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.anything()
        })
      );
    });

    test('should show error details in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Database connection failed');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database connection failed',
          details: expect.objectContaining({
            stack: expect.any(String)
          })
        })
      );
    });

    test('should show operational error details even in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new ValidationError('Invalid wallet address', { 
        field: 'walletAddress',
        reason: 'must be 44 characters'
      });
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid wallet address',
        code: 'VALIDATION_ERROR',
        details: {
          field: 'walletAddress',
          reason: 'must be 44 characters'
        }
      });
    });
  });

  describe('Response Format', () => {
    test('should return consistent JSON format', () => {
      const error = new ValidationError('Test error');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: expect.any(String)
        })
      );
    });

    test('should include details when present', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: { field: 'email' }
        })
      );
    });

    test('should not include details when not present', () => {
      const error = new ValidationError('Invalid input');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('details');
    });
  });

  describe('Edge Cases', () => {
    test('should handle errors without message', () => {
      const error = new Error();
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalled();
    });

    test('should handle errors with custom status property', () => {
      const error = new Error('Custom error');
      error.status = 418; // I'm a teapot
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(418);
    });

    test('should handle errors with statusCode property', () => {
      const error = new Error('Custom error');
      error.statusCode = 422;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(422);
    });

    test('should prefer statusCode over status', () => {
      const error = new Error('Custom error');
      error.status = 400;
      error.statusCode = 422;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(422);
    });
  });
});

describe('Not Found Handler', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      path: '/api/nonexistent',
      method: 'GET'
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  test('should create NotFoundError with route information', () => {
    notFoundHandler(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Route not found: GET /api/nonexistent',
        statusCode: 404,
        code: 'NOT_FOUND'
      })
    );
  });

  test('should pass error to next middleware', () => {
    notFoundHandler(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
  });
});
