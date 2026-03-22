// backend/src/utils/errors.js
// Custom error classes for consistent error handling
// Requirements: 30.4

/**
 * Base application error class
 * All custom errors extend from this class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes operational errors from programming errors
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details })
    };
  }
}

/**
 * Validation error (HTTP 400)
 * Used for invalid input data
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Authentication error (HTTP 401)
 * Used for authentication failures (invalid credentials, expired tokens, etc.)
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details = null) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Authorization error (HTTP 403)
 * Used when user is authenticated but lacks permission
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied', details = null) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

/**
 * Not found error (HTTP 404)
 * Used when a requested resource doesn't exist
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

/**
 * Conflict error (HTTP 409)
 * Used for resource conflicts (duplicate entries, concurrent modifications, etc.)
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

/**
 * Rate limit error (HTTP 429)
 * Used when rate limits are exceeded
 */
class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', retryAfter = 60, details = null) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter
    };
  }
}

/**
 * Database error (HTTP 503)
 * Used for database connection or query failures
 */
class DatabaseError extends AppError {
  constructor(message = 'Database error', details = null) {
    super(message, 503, 'DATABASE_ERROR', details);
  }
}

/**
 * External service error (HTTP 503)
 * Used when external services (Helius, Solana RPC, etc.) fail
 */
class ExternalServiceError extends AppError {
  constructor(message = 'External service unavailable', serviceName = null, details = null) {
    super(message, 503, 'EXTERNAL_SERVICE_ERROR', details);
    this.serviceName = serviceName;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.serviceName && { service: this.serviceName })
    };
  }
}

/**
 * Transaction error (HTTP 400 or 503)
 * Used for blockchain transaction failures
 */
class TransactionError extends AppError {
  constructor(message, statusCode = 400, details = null) {
    super(message, statusCode, 'TRANSACTION_ERROR', details);
  }
}

/**
 * Internal server error (HTTP 500)
 * Used for unexpected server errors
 */
class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details = null) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

module.exports = {
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
};
