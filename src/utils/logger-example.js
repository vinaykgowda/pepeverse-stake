/**
 * Logger Usage Examples
 * 
 * This file demonstrates various ways to use the structured logger
 */

const logger = require('./logger');

// Example 1: Basic logging at different levels
function basicLoggingExample() {
  console.log('\n=== Basic Logging Example ===\n');
  
  logger.debug('This is a debug message', { detail: 'Only visible in development' });
  logger.info('Application started', { port: 3000, env: process.env.NODE_ENV });
  logger.warn('Cache size approaching limit', { currentSize: 950, maxSize: 1000 });
  logger.error('Failed to connect to database', { 
    error: new Error('Connection timeout'),
    retryAttempt: 3
  });
}

// Example 2: Sensitive data redaction
function sensitiveDataExample() {
  console.log('\n=== Sensitive Data Redaction Example ===\n');
  
  // Private keys are automatically redacted
  logger.info('Wallet initialized', {
    privateKey: '5JqX7WqYvZ8K9mN3pQ2rS4tU6vW8xY9zA1bC2dE3fG4hH5iJ6kL7mN8P9qRsTuVwXyZaBcDeFgHiJk'
  });
  
  // Wallet addresses show only first 4 and last 4 characters
  logger.info('Payment received', {
    from: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
    amount: 1.5
  });
  
  // API keys are redacted
  logger.info('External service configured', {
    apiKey: 'sk_live_1234567890abcdefghij',
    endpoint: 'https://api.example.com'
  });
  
  // Passwords are redacted
  logger.info('User credentials', {
    username: 'admin',
    password: 'secretPassword123'
  });
}

// Example 3: Child loggers with context
function childLoggerExample() {
  console.log('\n=== Child Logger Example ===\n');
  
  // Create a service-specific logger
  const authLogger = logger.child({ 
    service: 'auth',
    version: '1.0.0'
  });
  
  authLogger.info('Nonce generated', { 
    walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
    expiresIn: 300
  });
  
  authLogger.info('Signature verified', {
    walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
  });
  
  // Create a request-specific logger
  const requestLogger = logger.child({
    requestId: 'req-123-456',
    method: 'POST',
    path: '/api/stake'
  });
  
  requestLogger.info('Request started');
  requestLogger.info('Validation passed', { nftCount: 5 });
  requestLogger.info('Request completed', { duration: 234, statusCode: 200 });
}

// Example 4: Error logging with stack traces
function errorLoggingExample() {
  console.log('\n=== Error Logging Example ===\n');
  
  try {
    // Simulate an error
    throw new Error('Transaction failed: Insufficient funds');
  } catch (error) {
    logger.error('Transaction processing failed', {
      error, // Stack trace will be automatically included
      transactionId: 'tx-789',
      walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
      amount: 10.5
    });
  }
}

// Example 5: Service class integration
class StakingService {
  constructor() {
    this.logger = logger.child({ service: 'staking' });
  }
  
  async stakeNFT(walletAddress, nftMint) {
    this.logger.info('Stake request received', { 
      walletAddress,
      nftMint
    });
    
    try {
      // Simulate staking logic
      this.logger.debug('Verifying NFT ownership', { nftMint });
      this.logger.debug('Checking collection eligibility', { nftMint });
      this.logger.info('NFT staked successfully', { 
        walletAddress,
        nftMint,
        stakedAt: new Date().toISOString()
      });
      
      return { success: true };
    } catch (error) {
      this.logger.error('Stake operation failed', {
        error,
        walletAddress,
        nftMint
      });
      throw error;
    }
  }
}

// Example 6: Express middleware integration
function expressMiddlewareExample() {
  console.log('\n=== Express Middleware Example ===\n');
  
  // Simulated Express middleware
  function loggingMiddleware(req, res, next) {
    const requestLogger = logger.child({
      requestId: req.id || 'req-' + Date.now(),
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    
    req.logger = requestLogger;
    requestLogger.info('Request received');
    
    const start = Date.now();
    
    // Simulate response finish
    const originalEnd = res.end;
    res.end = function(...args) {
      requestLogger.info('Request completed', {
        statusCode: res.statusCode,
        duration: Date.now() - start
      });
      originalEnd.apply(res, args);
    };
    
    next();
  }
  
  // Simulated request
  const mockReq = {
    id: 'req-abc-123',
    method: 'POST',
    path: '/api/stake',
    ip: '192.168.1.1'
  };
  
  const mockRes = {
    statusCode: 200,
    end: function() {}
  };
  
  loggingMiddleware(mockReq, mockRes, () => {
    mockReq.logger.info('Processing stake request', { nftCount: 3 });
  });
}

// Example 7: Production vs Development output
function environmentExample() {
  console.log('\n=== Environment-Specific Output Example ===\n');
  
  console.log('Current NODE_ENV:', process.env.NODE_ENV);
  console.log('Log level:', logger.logLevel);
  console.log('Is production:', logger.isProduction);
  
  logger.info('This message will be formatted based on environment', {
    feature: 'environment-detection',
    timestamp: Date.now()
  });
  
  if (logger.isProduction) {
    console.log('\nIn production: JSON format, INFO level and above only');
  } else {
    console.log('\nIn development: Human-readable format, all levels');
  }
}

// Run all examples
if (require.main === module) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Structured Logger Usage Examples                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  basicLoggingExample();
  sensitiveDataExample();
  childLoggerExample();
  errorLoggingExample();
  
  console.log('\n=== Service Class Example ===\n');
  const stakingService = new StakingService();
  stakingService.stakeNFT(
    'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
    'NFTmint123456789'
  ).catch(() => {});
  
  expressMiddlewareExample();
  environmentExample();
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Examples completed. Check output above for results.      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

module.exports = {
  basicLoggingExample,
  sensitiveDataExample,
  childLoggerExample,
  errorLoggingExample,
  StakingService,
  expressMiddlewareExample,
  environmentExample
};
