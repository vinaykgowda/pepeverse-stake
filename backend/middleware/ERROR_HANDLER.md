# Centralized Error Handler

## Overview

The centralized error handler provides consistent error handling across the entire application. It catches all errors, logs them appropriately, and returns standardized JSON responses to clients.

**Requirements:** 30.1, 30.2, 30.3, 30.5

## Features

1. **Consistent JSON Format**: All errors return in the format `{"error": "message", "code": "ERROR_CODE"}`
2. **Structured Logging**: Logs all errors with stack traces using the structured logger
3. **Production Safety**: Hides internal error details in production environment
4. **Custom Error Classes**: Uses custom error classes to determine HTTP status codes
5. **Operational vs Programming Errors**: Distinguishes between expected (operational) and unexpected (programming) errors

## Usage

### In server.js

```javascript
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// ... routes ...

// 404 handler for undefined routes
app.use(notFoundHandler);

// Centralized error handling (must be last)
app.use(errorHandler);
```

### Throwing Errors in Route Handlers

```javascript
const { ValidationError, AuthenticationError, NotFoundError } = require('../src/utils/errors');

// Validation error
app.post('/api/stake', (req, res, next) => {
  if (!req.body.walletAddress) {
    return next(new ValidationError('Wallet address is required', {
      field: 'walletAddress'
    }));
  }
  // ... rest of handler
});

// Authentication error
app.post('/api/auth/verify', (req, res, next) => {
  if (!isValidSignature(req.body.signature)) {
    return next(new AuthenticationError('Invalid signature'));
  }
  // ... rest of handler
});

// Not found error
app.get('/api/collection/:id', async (req, res, next) => {
  const collection = await getCollection(req.params.id);
  if (!collection) {
    return next(new NotFoundError('Collection not found'));
  }
  res.json(collection);
});
```

### Using Async/Await with Error Handler

```javascript
// Wrap async route handlers to catch errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/api/nfts/:wallet', asyncHandler(async (req, res) => {
  const nfts = await fetchNFTs(req.params.wallet);
  res.json(nfts);
}));
```

## Error Response Format

### Client Errors (4xx)

```json
{
  "error": "Invalid wallet address",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "walletAddress",
    "reason": "must be 44 characters"
  }
}
```

### Server Errors (5xx) - Production

```json
{
  "error": "Internal server error",
  "code": "INTERNAL_SERVER_ERROR"
}
```

### Server Errors (5xx) - Development

```json
{
  "error": "Database connection failed",
  "code": "INTERNAL_SERVER_ERROR",
  "details": {
    "stack": "Error: Database connection failed\n    at ..."
  }
}
```

### Rate Limit Errors

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

Response includes `Retry-After` header.

### External Service Errors

```json
{
  "error": "Helius API unavailable",
  "code": "EXTERNAL_SERVICE_ERROR",
  "service": "Helius"
}
```

## Custom Error Classes

The error handler works with the following custom error classes:

| Error Class | Status Code | Use Case |
|------------|-------------|----------|
| `ValidationError` | 400 | Invalid input data |
| `AuthenticationError` | 401 | Authentication failures |
| `AuthorizationError` | 403 | Permission denied |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Resource conflicts |
| `RateLimitError` | 429 | Rate limit exceeded |
| `DatabaseError` | 503 | Database failures |
| `ExternalServiceError` | 503 | External service failures |
| `TransactionError` | 400/503 | Blockchain transaction errors |
| `InternalServerError` | 500 | Unexpected server errors |

## Logging Behavior

### Client Errors (4xx)
- Logged at **WARN** level
- Includes error code, message, and request details
- Does not include stack trace

### Server Errors (5xx)
- Logged at **ERROR** level
- Includes error code, message, stack trace, and request details
- Full error context for debugging

### Unexpected Errors
- Logged at **ERROR** level
- Includes full stack trace
- Treated as programming errors requiring investigation

## Production vs Development

### Production Mode (`NODE_ENV=production`)
- Hides internal error details for unexpected errors
- Returns generic "Internal server error" message
- Logs full details for debugging
- Shows operational error details (ValidationError, etc.)

### Development Mode
- Shows full error details including stack traces
- Helps with debugging
- More verbose error messages

## Error Handler Order

The error handlers must be applied in this order:

1. **JSON Parse Error Handler** - Catches JSON parsing errors
2. **Database Error Handler** - Catches database connection errors
3. **Not Found Handler** - Catches 404 errors for undefined routes
4. **Centralized Error Handler** - Catches all other errors (must be last)

## Best Practices

1. **Always use custom error classes** for operational errors
2. **Pass errors to next()** instead of sending responses directly
3. **Include helpful details** in error objects for debugging
4. **Don't expose sensitive data** in error messages
5. **Use appropriate status codes** for different error types
6. **Log errors before responding** to ensure they're captured
7. **Test error handling** in both production and development modes

## Example: Complete Error Handling Flow

```javascript
const { ValidationError, DatabaseError } = require('../src/utils/errors');

app.post('/api/stake', async (req, res, next) => {
  try {
    // Validate input
    if (!req.body.walletAddress) {
      throw new ValidationError('Wallet address is required', {
        field: 'walletAddress'
      });
    }
    
    // Database operation
    const result = await db.query('INSERT INTO staked_nfts ...');
    
    if (!result.rowCount) {
      throw new DatabaseError('Failed to insert stake record');
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    // Pass error to centralized handler
    next(error);
  }
});
```

## Testing

Run tests with:

```bash
npm test -- errorHandler.test.js
```

Tests cover:
- All custom error classes
- Production vs development behavior
- Logging behavior
- Response format consistency
- Edge cases

## Related Files

- `backend/middleware/errorHandler.js` - Main error handler implementation
- `backend/middleware/errorHandler.test.js` - Unit tests
- `backend/src/utils/errors.js` - Custom error classes
- `backend/src/utils/logger.js` - Structured logger
- `backend/server.js` - Error handler registration
