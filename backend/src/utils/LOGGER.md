# Structured Logger

Production-ready structured logger with automatic sensitive data redaction and JSON formatting for Vercel deployment.

## Features

- **JSON Format**: Outputs structured JSON logs in production for easy parsing and analysis
- **Sensitive Data Redaction**: Automatically redacts private keys, API keys, passwords, and wallet addresses
- **Log Levels**: Supports DEBUG, INFO, WARN, and ERROR levels
- **Production Mode**: Only logs INFO and above in production (NODE_ENV=production)
- **Development Mode**: Logs all levels in human-readable format for local development
- **Child Loggers**: Create contextual loggers with default metadata
- **Vercel Integration**: Works seamlessly with Vercel's built-in logging infrastructure

## Usage

### Basic Logging

```javascript
const logger = require('./utils/logger');

// Info level
logger.info('User authenticated', { 
  walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
  timestamp: Date.now()
});

// Warning level
logger.warn('Rate limit approaching', { 
  wallet: 'DYw8...NSKK',
  requestCount: 18,
  limit: 20
});

// Error level
logger.error('Transaction failed', { 
  error: new Error('Insufficient funds'),
  transactionId: 'abc123'
});

// Debug level (only in development)
logger.debug('Cache hit', { 
  key: 'collection:123',
  ttl: 300
});
```

### Child Loggers

Create child loggers with default context that's included in every log:

```javascript
const logger = require('./utils/logger');

// Create a child logger for a specific service
const authLogger = logger.child({ 
  service: 'auth',
  version: '1.0.0'
});

// All logs from this logger will include service and version
authLogger.info('Nonce generated', { 
  walletAddress: 'DYw8...NSKK'
});
// Output: { service: 'auth', version: '1.0.0', walletAddress: 'DYw8...NSKK', ... }

// Create request-specific logger
function handleRequest(req, res) {
  const requestLogger = logger.child({ 
    requestId: req.id,
    method: req.method,
    path: req.path
  });
  
  requestLogger.info('Request started');
  // ... handle request ...
  requestLogger.info('Request completed', { duration: 123 });
}
```

### Error Logging

```javascript
try {
  await processTransaction(tx);
} catch (error) {
  logger.error('Transaction processing failed', {
    error, // Stack trace will be automatically included
    transactionId: tx.id,
    walletAddress: tx.wallet
  });
}
```

## Sensitive Data Redaction

The logger automatically redacts sensitive information:

### Private Keys
```javascript
logger.info('Key loaded', { 
  privateKey: '5JqX7WqYvZ8K9mN3pQ2rS4tU6vW8xY9zA1bC2dE3fG4hH5iJ6kL7mN8P9qRsTuVwXyZaBcDeFgHiJk'
});
// Output: { privateKey: '[REDACTED]' }
```

### API Keys
```javascript
logger.info('API configured', { 
  apiKey: 'sk_live_1234567890abcdefghij'
});
// Output: { apiKey: '[REDACTED]' }
```

### Wallet Addresses
```javascript
logger.info('Payment received', { 
  walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
});
// Output: { walletAddress: 'DYw8...NSKK' }
```

### Passwords
```javascript
logger.info('User login', { 
  username: 'admin',
  password: 'secret123'
});
// Output: { username: 'admin', password: '[REDACTED]' }
```

### Database Connection Strings
```javascript
logger.info('Database connected', { 
  connectionString: 'postgresql://user:myPassword@host.neon.tech/db'
});
// Output: { connectionString: 'postgresql://user:[REDACTED_PASSWORD]@host.neon.tech/db' }
```

## Log Levels

### DEBUG
- Only logged in development (NODE_ENV !== 'production')
- Use for detailed debugging information
- Example: Cache hits/misses, internal state changes

### INFO
- Logged in all environments
- Use for general informational messages
- Example: User actions, successful operations, system events

### WARN
- Logged in all environments
- Use for warning conditions that don't prevent operation
- Example: Rate limits approaching, deprecated API usage, retries

### ERROR
- Logged in all environments
- Use for error conditions that need attention
- Example: Failed transactions, database errors, API failures

## Output Format

### Production (JSON)
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "User authenticated",
  "walletAddress": "DYw8...NSKK",
  "service": "auth"
}
```

### Development (Human-Readable)
```
[2024-01-15T10:30:45.123Z] INFO: User authenticated
{
  "walletAddress": "DYw8...NSKK",
  "service": "auth"
}
```

## Integration with Services

### Express Middleware
```javascript
const logger = require('./utils/logger');

app.use((req, res, next) => {
  const requestLogger = logger.child({
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  
  req.logger = requestLogger;
  requestLogger.info('Request received');
  
  const start = Date.now();
  res.on('finish', () => {
    requestLogger.info('Request completed', {
      statusCode: res.statusCode,
      duration: Date.now() - start
    });
  });
  
  next();
});

// Use in routes
app.post('/api/stake', async (req, res) => {
  req.logger.info('Stake request', { nftCount: req.body.nfts.length });
  // ... handle request ...
});
```

### Service Classes
```javascript
const logger = require('./utils/logger');

class TransactionService {
  constructor() {
    this.logger = logger.child({ service: 'transaction' });
  }
  
  async processTransaction(tx) {
    this.logger.info('Processing transaction', { txId: tx.id });
    
    try {
      const result = await this.submitToBlockchain(tx);
      this.logger.info('Transaction confirmed', { 
        txId: tx.id,
        signature: result.signature
      });
      return result;
    } catch (error) {
      this.logger.error('Transaction failed', { 
        txId: tx.id,
        error
      });
      throw error;
    }
  }
}
```

## Vercel Logs Integration

The logger outputs to stdout/stderr, which Vercel automatically captures:

1. **View Logs**: Go to Vercel Dashboard → Your Project → Logs
2. **Filter by Level**: Use Vercel's log filtering to show only errors or warnings
3. **Search**: Search logs by message content or metadata fields
4. **Real-time**: View logs in real-time during deployment and runtime

**For detailed Vercel logging documentation, see [VERCEL_LOGGING.md](./VERCEL_LOGGING.md)**

## Best Practices

1. **Use Appropriate Levels**: Don't log everything at ERROR level
2. **Include Context**: Add relevant metadata to help with debugging
3. **Avoid Logging in Loops**: Be careful with high-frequency operations
4. **Use Child Loggers**: Create contextual loggers for services and requests
5. **Don't Log Sensitive Data**: The logger redacts common patterns, but be cautious
6. **Log Errors with Stack Traces**: Always pass the error object to capture stack traces
7. **Keep Messages Concise**: Use metadata for details, keep messages short

## Migration from console.log

Replace console.log statements with appropriate logger calls:

```javascript
// Before
console.log('User logged in:', walletAddress);
console.error('Error:', error);

// After
logger.info('User logged in', { walletAddress });
logger.error('Authentication failed', { error });
```

## Requirements Satisfied

- **31.1**: Structured logging with JSON format ✓
- **31.2**: Automatic sensitive data redaction ✓
- **31.3**: INFO level or higher in production ✓
- **31.5**: Integration with Vercel's built-in logging ✓
