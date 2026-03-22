// backend/middleware/databaseErrorHandler.js

/**
 * Database Error Handler Middleware
 * Catches database connection errors and returns HTTP 503 with retry-after header
 * Requirements: 17.4, 17.5
 */

/**
 * Database error handler middleware
 * Catches database connection errors and returns appropriate HTTP 503 responses
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function databaseErrorHandler(err, req, res, next) {
  // Check if this is a database connection error
  const errorMessage = err.message?.toLowerCase() || '';
  const isDatabaseError = 
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNRESET' ||
    errorMessage.includes('connection') ||
    errorMessage.includes('database') ||
    errorMessage.includes('pool') ||
    errorMessage.includes('timeout');

  if (isDatabaseError) {
    console.error('Database connection error:', {
      code: err.code,
      message: err.message,
      timestamp: new Date().toISOString()
    });

    // Return HTTP 503 Service Unavailable with Retry-After header
    // Requirement 17.4: Return HTTP 503 on database connection failure
    const retryAfterSeconds = 30; // Retry after 30 seconds
    
    return res.status(503)
      .header('Retry-After', retryAfterSeconds)
      .json({
        error: 'Database service temporarily unavailable',
        code: 'DATABASE_UNAVAILABLE',
        retryAfter: retryAfterSeconds,
        message: 'Please try again in a few moments'
      });
  }

  // Not a database error, pass to next error handler
  next(err);
}

module.exports = { databaseErrorHandler };
