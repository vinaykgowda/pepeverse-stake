// backend/middleware/errorHandler.js
// Centralized error handling middleware
// Requirements: 30.1, 30.2, 30.3, 30.5

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

/**
 * Centralized error handling middleware
 * 
 * Features:
 * - Consistent JSON format for all errors
 * - Logs errors with stack traces using structured logger
 * - Hides internal error details in production
 * - Uses custom error classes to determine HTTP status codes
 * 
 * Requirements:
 * - 30.1: Centralized error handling middleware
 * - 30.2: Consistent JSON format: {"error": "message", "code": "ERROR_CODE"}
 * - 30.3: Log all errors with stack traces
 * - 30.5: Hide internal error details in production
 */
function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Determine if this is an operational error (expected) or programming error (unexpected)
  const isOperationalError = err.isOperational || err instanceof AppError;
  
  // Default values
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let errorMessage = 'Internal server error';
  let errorDetails = null;
  
  // Handle custom error classes
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    errorMessage = err.message;
    errorDetails = err.details;
    
    // Log operational errors at appropriate level
    if (statusCode >= 500) {
      // Server errors - log as error with stack trace
      logger.error('Server error occurred', {
        code: errorCode,
        message: errorMessage,
        statusCode,
        path: req.path,
        method: req.method,
        error: err,
        stack: err.stack,
        details: errorDetails
      });
    } else if (statusCode >= 400) {
      // Client errors - log as warning
      logger.warn('Client error occurred', {
        code: errorCode,
        message: errorMessage,
        statusCode,
        path: req.path,
        method: req.method,
        details: errorDetails
      });
    }
  } else {
    // Handle unexpected errors (programming errors)
    // Requirement 30.3: Log all errors with stack traces
    logger.error('Unexpected error occurred', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      error: err
    });
    
    // Requirement 30.5: Hide internal error details in production
    if (isProduction) {
      errorMessage = 'Internal server error';
      errorCode = 'INTERNAL_SERVER_ERROR';
    } else {
      errorMessage = err.message || 'Internal server error';
      errorCode = err.code || 'INTERNAL_SERVER_ERROR';
      errorDetails = {
        stack: err.stack
      };
    }
    
    statusCode = err.statusCode || err.status || 500;
  }
  
  // Build response object
  // Requirement 30.2: Consistent JSON format
  const response = {
    error: errorMessage,
    code: errorCode
  };
  
  // Add details if present and not in production (or if it's an operational error)
  if (errorDetails && (!isProduction || isOperationalError)) {
    response.details = errorDetails;
  }
  
  // Add special fields for specific error types
  if (err instanceof RateLimitError) {
    response.retryAfter = err.retryAfter;
    res.header('Retry-After', err.retryAfter);
  }
  
  if (err instanceof ExternalServiceError && err.serviceName) {
    response.service = err.serviceName;
  }
  
  // Send response
  res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler
 * Handles requests to undefined routes
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route not found: ${req.method} ${req.path}`);
  next(error);
}

module.exports = {
  errorHandler,
  notFoundHandler
};
