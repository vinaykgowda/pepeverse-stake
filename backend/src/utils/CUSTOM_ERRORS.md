# Custom Error Classes

This module provides custom error classes for consistent error handling throughout the application. All custom errors extend from the base `AppError` class and are designed to work with the centralized error handling middleware.

## Requirements

- **Requirement 30.4**: Create custom error classes that extend Error to distinguish between different types of errors

## Available Error Classes

### AppError (Base Class)

Base class for all application errors. Provides common functionality for all custom errors.

**Properties:**
- `message` (string): Error message
- `statusCode` (number): HTTP status code (default: 500)
- `code` (string): Error code for client identification (default: 'APP_ERROR')
- `details` (any): Additional error details (default: null)
- `isOperational` (boolean): Distinguishes operational errors from programming errors (default: true)
- `stack` (string): Stack trace

**Methods:**
- `toJSON()`: Serializes error to JSON format for API responses

**Usage:**
```javascript
const { AppError } = require('./utils/errors');

throw new AppError('Something went wrong', 500, 'CUSTOM_CODE', { field: 'value' });
```

### ValidationError (HTTP 400)

Used for invalid input data, malformed requests, or validation failures.

**Usage:**
```javascript
const { ValidationError } = require('./utils/errors');

// Simple validation error
throw new ValidationError('Invalid wallet address');

// With details
throw new ValidationError('Invalid input', {
  field: 'walletAddress',
  reason: 'Must be a valid Solana address'
});
```

**Common Use Cases:**
- Invalid wallet address format
- Invalid transaction hash format
- Out of range numeric values
- Missing required fields
- Invalid array sizes

### AuthenticationError (HTTP 401)

Used for authentication failures when user identity cannot be verified.

**Usage:**
```javascript
const { AuthenticationError } = require('./utils/errors');

// Default message
throw new AuthenticationError();

// Custom message
throw new AuthenticationError('Invalid signature');

// With details
throw new AuthenticationError('Nonce expired', {
  reason: 'Nonce must be used within 5 minutes'
});
```

**Common Use Cases:**
- Invalid or expired JWT tokens
- Invalid wallet signatures
- Expired or missing nonces
- Invalid credentials

### AuthorizationError (HTTP 403)

Used when user is authenticated but lacks permission to access a resource.

**Usage:**
```javascript
const { AuthorizationError } = require('./utils/errors');

// Default message
throw new AuthorizationError();

// Custom message
throw new AuthorizationError('NFT ownership verification failed');

// With details
throw new AuthorizationError('Access denied', {
  nftMint: 'abc123',
  requiredOwner: 'wallet123',
  actualOwner: 'wallet456'
});
```

**Common Use Cases:**
- NFT ownership verification failures
- Admin-only endpoint access
- Collection access restrictions
- Insufficient permissions

### NotFoundError (HTTP 404)

Used when a requested resource doesn't exist.

**Usage:**
```javascript
const { NotFoundError } = require('./utils/errors');

// Default message
throw new NotFoundError();

// Custom message
throw new NotFoundError('Collection not found');

// With details
throw new NotFoundError('Staked NFT not found', {
  nftMint: 'abc123',
  walletAddress: 'wallet123'
});
```

**Common Use Cases:**
- Collection not found
- Staked NFT not found
- User not found
- Transaction not found

### ConflictError (HTTP 409)

Used for resource conflicts, duplicate entries, or concurrent modifications.

**Usage:**
```javascript
const { ConflictError } = require('./utils/errors');

// Default message
throw new ConflictError();

// Custom message
throw new ConflictError('NFT already staked');

// With details
throw new ConflictError('NFT already staked', {
  nftMint: 'abc123',
  stakedAt: '2024-01-01T00:00:00Z'
});
```

**Common Use Cases:**
- NFT already staked
- Duplicate transaction
- Concurrent claim attempts
- Resource already exists

### RateLimitError (HTTP 429)

Used when rate limits are exceeded.

**Usage:**
```javascript
const { RateLimitError } = require('./utils/errors');

// Default (60 seconds retry)
throw new RateLimitError();

// Custom retry after
throw new RateLimitError('Too many claim requests', 120);

// With details
throw new RateLimitError('Rate limit exceeded', 60, {
  limit: 5,
  window: '1 minute',
  endpoint: '/api/claim'
});
```

**Properties:**
- `retryAfter` (number): Seconds until retry is allowed

**Common Use Cases:**
- Claim endpoint rate limiting (5 req/min)
- Stake endpoint rate limiting (20 req/min)
- Unstake endpoint rate limiting (20 req/min)
- Auth endpoint rate limiting (10 req/min)

### DatabaseError (HTTP 503)

Used for database connection or query failures.

**Usage:**
```javascript
const { DatabaseError } = require('./utils/errors');

// Default message
throw new DatabaseError();

// Custom message
throw new DatabaseError('Database connection failed');

// With details
throw new DatabaseError('Query timeout', {
  query: 'SELECT * FROM staked_nfts',
  timeout: 10000
});
```

**Common Use Cases:**
- Connection pool exhausted
- Query timeout
- Connection refused
- Database unavailable

### ExternalServiceError (HTTP 503)

Used when external services (Helius, Solana RPC, etc.) fail.

**Usage:**
```javascript
const { ExternalServiceError } = require('./utils/errors');

// Default message
throw new ExternalServiceError();

// With service name
throw new ExternalServiceError('Helius API unavailable', 'Helius');

// With details
throw new ExternalServiceError('RPC timeout', 'Solana RPC', {
  endpoint: 'https://api.mainnet-beta.solana.com',
  timeout: 10000
});
```

**Properties:**
- `serviceName` (string): Name of the external service

**Common Use Cases:**
- Helius API failures
- Solana RPC timeouts
- Metaplex metadata fetch failures
- Third-party service unavailable

### TransactionError (HTTP 400 or 503)

Used for blockchain transaction failures.

**Usage:**
```javascript
const { TransactionError } = require('./utils/errors');

// Client error (default 400)
throw new TransactionError('Insufficient funds');

// Service error (503)
throw new TransactionError('Transaction timeout', 503);

// With details
throw new TransactionError('Transaction verification failed', 400, {
  signature: 'abc123',
  expectedAmount: 1000000,
  actualAmount: 900000
});
```

**Common Use Cases:**
- Transaction verification failures
- Insufficient funds
- Transaction timeout
- Invalid transaction signature
- Transaction amount mismatch

### InternalServerError (HTTP 500)

Used for unexpected server errors.

**Usage:**
```javascript
const { InternalServerError } = require('./utils/errors');

// Default message
throw new InternalServerError();

// Custom message
throw new InternalServerError('Unexpected error occurred');

// With details (avoid exposing in production)
throw new InternalServerError('Unexpected error', {
  context: 'reward calculation'
});
```

**Common Use Cases:**
- Unexpected exceptions
- Programming errors
- Unhandled edge cases
- System failures

## Integration with Error Middleware

These error classes are designed to work with the centralized error handling middleware (task 21.2). The middleware will:

1. Catch all errors thrown in route handlers
2. Check if error is an instance of `AppError`
3. Use the error's `statusCode` and `toJSON()` method for the response
4. Log errors with stack traces
5. Hide internal error details in production

**Example Route Handler:**
```javascript
const { ValidationError, AuthenticationError } = require('../utils/errors');

router.post('/api/stake', async (req, res, next) => {
  try {
    const { walletAddress, nftMints } = req.body;
    
    // Validation
    if (!isValidSolanaAddress(walletAddress)) {
      throw new ValidationError('Invalid wallet address', {
        field: 'walletAddress',
        value: walletAddress
      });
    }
    
    // Authentication
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }
    
    // Business logic...
    const result = await stakeNFTs(walletAddress, nftMints);
    
    res.json({ success: true, data: result });
  } catch (error) {
    // Pass to error middleware
    next(error);
  }
});
```

## Best Practices

1. **Use Specific Error Classes**: Choose the most specific error class for the situation
2. **Provide Helpful Messages**: Include clear, user-friendly error messages
3. **Add Details for Debugging**: Include relevant details to help with debugging
4. **Don't Expose Sensitive Data**: Avoid including sensitive information in error details
5. **Use Consistent Error Codes**: The `code` property helps clients handle errors programmatically
6. **Let Middleware Handle Responses**: Throw errors and let the middleware format responses
7. **Check isOperational**: Use the `isOperational` flag to distinguish operational errors from programming errors

## Error Response Format

All errors will be formatted by the error middleware as:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "value"
  }
}
```

For rate limit errors:
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

For external service errors:
```json
{
  "error": "Service unavailable",
  "code": "EXTERNAL_SERVICE_ERROR",
  "service": "Helius"
}
```

## Testing

All error classes include comprehensive unit tests. Run tests with:

```bash
npm test -- errors.test.js
```

## See Also

- Task 21.2: Centralized error handling middleware
- Requirement 30.4: Custom error classes
- `backend/middleware/databaseErrorHandler.js`: Database-specific error handling
- `backend/middleware/jsonErrorHandler.js`: JSON parsing error handling
