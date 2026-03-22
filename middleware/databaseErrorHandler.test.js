// backend/middleware/databaseErrorHandler.test.js

const { databaseErrorHandler } = require('./databaseErrorHandler');

describe('Database Error Handler Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('Database Connection Errors', () => {
    test('should return 503 for ECONNREFUSED error', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', 30);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Database service temporarily unavailable',
        code: 'DATABASE_UNAVAILABLE',
        retryAfter: 30,
        message: 'Please try again in a few moments'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 503 for ETIMEDOUT error', () => {
      const error = new Error('Connection timeout');
      error.code = 'ETIMEDOUT';

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', 30);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 503 for ENOTFOUND error', () => {
      const error = new Error('Host not found');
      error.code = 'ENOTFOUND';

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', 30);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 503 for ECONNRESET error', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', 30);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 503 for error with "connection" in message', () => {
      const error = new Error('Database connection failed');

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', 30);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 503 for error with "database" in message', () => {
      const error = new Error('Database is unavailable');

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', 30);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 503 for error with "pool" in message', () => {
      const error = new Error('Connection pool exhausted');

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', 30);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 503 for error with "timeout" in message', () => {
      const error = new Error('Query timeout exceeded');

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', 30);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Non-Database Errors', () => {
    test('should pass non-database errors to next middleware', () => {
      const error = new Error('Some other error');

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.header).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('should pass validation errors to next middleware', () => {
      const error = new Error('Invalid input');
      error.code = 'VALIDATION_ERROR';

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('should pass authentication errors to next middleware', () => {
      const error = new Error('Unauthorized');
      error.code = 'AUTH_ERROR';

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('Response Format', () => {
    test('should include all required fields in response', () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: expect.any(String),
          retryAfter: expect.any(Number),
          message: expect.any(String)
        })
      );
    });

    test('should set Retry-After header to 30 seconds', () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';

      databaseErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', 30);
    });
  });
});
