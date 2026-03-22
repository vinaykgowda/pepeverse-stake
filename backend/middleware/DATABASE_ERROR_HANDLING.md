# Database Connection Error Handling

## Overview

This module implements comprehensive database connection error handling with HTTP 503 responses and automatic retry logic for transient connection failures.

**Requirements:** 17.4, 17.5

## Components

### 1. Database Error Handler Middleware

**File:** `backend/middleware/databaseErrorHandler.js`

Catches database connection errors and returns appropriate HTTP 503 responses with retry-after headers.

#### Features

- Detects database connection errors by error code and message
- Returns HTTP 503 Service Unavailable
- Includes Retry-After header (30 seconds)
- Provides user-friendly error messages
- Logs errors with timestamps for debugging

#### Detected Error Types

- `ECONNREFUSED` - Connection refused
- `ETIMEDOUT` - Connection timeout
- `ENOTFOUND` - Host not found
- `ECONNRESET` - Connection reset
- Messages containing: "connection", "database", "pool", "timeout"

#### Response Format

```json
{
  "error": "Database service temporarily unavailable",
  "code": "DATABASE_UNAVAILABLE",
  "retryAfter": 30,
  "message": "Please try again in a few moments"
}
```

#### Usage

```javascript
const { databaseErrorHandler } = require('./middleware/databaseErrorHandler');

// Add to Express app after routes
app.use(databaseErrorHandler);
```

### 2. Database Manager Retry Logic

**File:** `backend/src/config/database.js`

Enhanced DatabaseManager class with automatic retry logic for transient connection failures.

#### Features

- **Automatic Retries:** Up to 3 attempts by default
- **Exponential Backoff:** 100ms, 200ms, 400ms delays
- **Transient Error Detection:** Identifies temporary connection issues
- **Detailed Logging:** Tracks retry attempts and outcomes

#### Retry Logic

The retry logic applies to:
- `query()` method - Database queries
- `getClient()` method - Connection pool client acquisition

#### Transient Errors (Retried)

- `ECONNREFUSED` - Connection refused
- `ETIMEDOUT` - Connection timeout
- `ECONNRESET` - Connection reset
- `EPIPE` - Broken pipe
- Messages containing: "Connection terminated", "Connection lost"

#### Non-Transient Errors (Not Retried)

- Syntax errors
- Authentication errors
- Permission errors
- Other application-level errors

#### Usage Examples

```javascript
const db = require('./config/database');

// Query with default 3 retries
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Query with custom retry count
const result = await db.query('SELECT * FROM users', [], 1); // Only 1 retry

// Get client with automatic retries
const client = await db.getClient();
try {
  await client.query('BEGIN');
  // ... transaction operations
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Integration

### Server Configuration

The database error handler middleware is integrated into the Express application in `backend/server.js`:

```javascript
const { databaseErrorHandler } = require('./middleware/databaseErrorHandler');

// ... other middleware

// Database error handler (before general error handler)
app.use(databaseErrorHandler);

// General error handler
app.use((err, req, res, next) => {
  // ... general error handling
});
```

### Middleware Order

The database error handler should be placed:
1. **After** all route handlers
2. **After** JSON parsing error handler
3. **Before** the general error handler

This ensures database errors are caught and handled with appropriate HTTP 503 responses.

## Testing

### Unit Tests

**Middleware Tests:** `backend/middleware/databaseErrorHandler.test.js`
- Tests all error code detection
- Tests message-based detection
- Tests HTTP 503 response format
- Tests Retry-After header
- Tests non-database error pass-through

**Database Tests:** `backend/src/config/database.test.js`
- Tests retry logic for transient errors
- Tests exponential backoff timing
- Tests max retry limit
- Tests non-transient error handling
- Tests custom retry counts

### Running Tests

```bash
# Test middleware
npm test -- middleware/databaseErrorHandler.test.js

# Test database retry logic
npm test -- src/config/database.test.js
```

## Error Flow

```
┌─────────────────────────────────────────────────────────┐
│  Database Operation (query/getClient)                   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Attempt 1: Execute operation                           │
└─────────────────────────────────────────────────────────┘
                        │
                ┌───────┴───────┐
                │               │
            Success         Failure
                │               │
                │               ▼
                │   ┌─────────────────────────┐
                │   │  Is Transient Error?    │
                │   └─────────────────────────┘
                │               │
                │       ┌───────┴───────┐
                │      Yes              No
                │       │               │
                │       ▼               ▼
                │   Wait 100ms      Throw Error
                │       │               │
                │       ▼               │
                │   Attempt 2           │
                │       │               │
                │   ┌───┴───┐           │
                │  Success  Fail        │
                │   │       │           │
                │   │   Wait 200ms      │
                │   │       │           │
                │   │   Attempt 3       │
                │   │       │           │
                │   │   ┌───┴───┐       │
                │   │  Success  Fail    │
                │   │   │       │       │
                ▼   ▼   ▼       ▼       ▼
            ┌─────────────────────────────┐
            │  Return Result or Error     │
            └─────────────────────────────┘
                        │
                        ▼
            ┌─────────────────────────────┐
            │  Database Error Middleware  │
            └─────────────────────────────┘
                        │
                ┌───────┴───────┐
                │               │
        Database Error    Other Error
                │               │
                ▼               ▼
        HTTP 503 with      Pass to Next
        Retry-After        Middleware
```

## Configuration

### Retry Settings

Default retry configuration in `database.js`:
- **Max Retries:** 3 attempts
- **Backoff:** Exponential (100ms, 200ms, 400ms)
- **Total Max Time:** ~700ms for all retries

### Retry-After Header

Default retry-after value in `databaseErrorHandler.js`:
- **Retry-After:** 30 seconds

To customize, modify the `retryAfterSeconds` constant in the middleware.

## Monitoring

### Log Messages

**Successful Retry:**
```
Query succeeded after retry { text: 'SELECT...', duration: 100, rows: 5, attempt: 2 }
```

**Retry Attempt:**
```
Query failed, retrying... { text: 'SELECT...', error: 'Connection refused', code: 'ECONNREFUSED', attempt: 1, retryIn: '100ms' }
```

**Final Failure:**
```
Query error: { text: 'SELECT...', error: 'Connection refused', code: 'ECONNREFUSED', attempt: 3 }
```

**Database Error Caught:**
```
Database connection error: { code: 'ECONNREFUSED', message: 'Connection refused', timestamp: '2024-03-10T...' }
```

## Best Practices

1. **Use Default Retries:** The default 3 retries with exponential backoff is suitable for most cases
2. **Monitor Logs:** Watch for frequent retry attempts indicating connection issues
3. **Set Alerts:** Alert on repeated HTTP 503 responses
4. **Connection Pooling:** Neon DB handles connection pooling automatically
5. **Timeout Configuration:** 10-second connection timeout is configured per requirements

## Troubleshooting

### High Retry Rates

If you see many retry attempts:
1. Check Neon DB status and connectivity
2. Verify network configuration
3. Check connection pool settings
4. Review database load and performance

### HTTP 503 Responses

If clients receive frequent 503 errors:
1. Check database health endpoint
2. Verify Neon DB is operational
3. Review connection pool exhaustion
4. Check for network issues between server and database

### Connection Pool Exhaustion

If seeing "Connection pool exhausted" errors:
1. Review max connections setting (currently 20)
2. Check for connection leaks (unreleased clients)
3. Monitor concurrent request load
4. Consider increasing pool size if needed

## Related Files

- `backend/middleware/databaseErrorHandler.js` - Error handler middleware
- `backend/middleware/databaseErrorHandler.test.js` - Middleware tests
- `backend/src/config/database.js` - DatabaseManager with retry logic
- `backend/src/config/database.test.js` - Database tests
- `backend/server.js` - Express app integration
