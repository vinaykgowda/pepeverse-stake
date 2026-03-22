const logger = require('./logger');

describe('Logger', () => {
  let originalEnv;
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  
  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });
  
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
  
  describe('Sensitive Data Redaction', () => {
    test('should redact private keys', () => {
      // Real Solana private key format (base58, 88 chars, no 0, O, I, l)
      const privateKey = '5JqX7WqYvZ8K9mN3pQ2rS4tU6vW8xY9zA1bC2dE3fG4hH5iJ6kL7mN8P9qRsTuVwXyZaBcDeFgHiJk';
      const result = logger.redactSensitiveData(`Private key: ${privateKey}`);
      
      expect(result).not.toContain(privateKey);
      expect(result).toContain('[REDACTED_PRIVATE_KEY]');
    });
    
    test('should redact API keys', () => {
      const apiKey = 'api_key=sk_live_1234567890abcdefghij';
      const result = logger.redactSensitiveData(`Config: ${apiKey}`);
      
      expect(result).not.toContain('sk_live_1234567890abcdefghij');
      expect(result).toContain('[REDACTED_API_KEY]');
    });
    
    test('should redact JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = logger.redactSensitiveData(`Token: ${jwt}`);
      
      expect(result).not.toContain(jwt);
      expect(result).toContain('[REDACTED_JWT]');
    });
    
    test('should redact database passwords in connection strings', () => {
      const connStr = 'postgresql://user:mySecretPassword123@host.neon.tech/dbname';
      const result = logger.redactSensitiveData(connStr);
      
      expect(result).not.toContain('mySecretPassword123');
      expect(result).toContain('[REDACTED_PASSWORD]');
    });
    
    test('should redact full wallet addresses', () => {
      const wallet = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      const result = logger.redactSensitiveData(`Wallet: ${wallet}`);
      
      expect(result).not.toContain(wallet);
      expect(result).toContain('DYw8...NSKK');
    });
    
    test('should redact password fields in objects', () => {
      const obj = {
        username: 'user123',
        password: 'secretPassword',
        apiKey: 'sk_test_123456',
        walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
      };
      
      const result = logger.redactSensitiveData(obj);
      
      expect(result.username).toBe('user123');
      expect(result.password).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.walletAddress).toBe('DYw8...NSKK');
    });
    
    test('should redact nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret123',
            privateKey: 'abc123xyz'
          }
        }
      };
      
      const result = logger.redactSensitiveData(obj);
      
      expect(result.user.name).toBe('John');
      expect(result.user.credentials.password).toBe('[REDACTED]');
      expect(result.user.credentials.privateKey).toBe('[REDACTED]');
    });
    
    test('should redact arrays', () => {
      const arr = [
        { walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK' },
        { walletAddress: 'AbC1jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CDEFG' }
      ];
      
      const result = logger.redactSensitiveData(arr);
      
      expect(result[0].walletAddress).toBe('DYw8...NSKK');
      expect(result[1].walletAddress).toBe('AbC1...DEFG');
    });
  });
  
  describe('Log Levels', () => {
    test('should log INFO and above in production', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = new (require('./logger').constructor)();
      
      expect(prodLogger.logLevel).toBe('info');
      expect(prodLogger.shouldLog('debug')).toBe(false);
      expect(prodLogger.shouldLog('info')).toBe(true);
      expect(prodLogger.shouldLog('warn')).toBe(true);
      expect(prodLogger.shouldLog('error')).toBe(true);
    });
    
    test('should log DEBUG and above in development', () => {
      process.env.NODE_ENV = 'development';
      const devLogger = new (require('./logger').constructor)();
      
      expect(devLogger.logLevel).toBe('debug');
      expect(devLogger.shouldLog('debug')).toBe(true);
      expect(devLogger.shouldLog('info')).toBe(true);
      expect(devLogger.shouldLog('warn')).toBe(true);
      expect(devLogger.shouldLog('error')).toBe(true);
    });
  });
  
  describe('JSON Format', () => {
    test('should output JSON in production', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = new (require('./logger').constructor)();
      
      const formatted = prodLogger.formatLog('info', 'Test message', { key: 'value' });
      
      expect(() => JSON.parse(formatted)).not.toThrow();
      const parsed = JSON.parse(formatted);
      expect(parsed.level).toBe('INFO');
      expect(parsed.message).toBe('Test message');
      expect(parsed.key).toBe('value');
      expect(parsed.timestamp).toBeDefined();
    });
    
    test('should output human-readable format in development', () => {
      process.env.NODE_ENV = 'development';
      const devLogger = new (require('./logger').constructor)();
      
      const formatted = devLogger.formatLog('info', 'Test message', { key: 'value' });
      
      expect(formatted).toContain('INFO');
      expect(formatted).toContain('Test message');
      expect(formatted).toContain('key');
      expect(formatted).toContain('value');
    });
  });
  
  describe('Logging Methods', () => {
    test('should log debug messages', () => {
      logger.debug('Debug message', { context: 'test' });
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Debug message');
    });
    
    test('should log info messages', () => {
      logger.info('Info message', { context: 'test' });
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Info message');
    });
    
    test('should log warn messages', () => {
      logger.warn('Warning message', { context: 'test' });
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      const logOutput = consoleWarnSpy.mock.calls[0][0];
      expect(logOutput).toContain('Warning message');
    });
    
    test('should log error messages', () => {
      logger.error('Error message', { context: 'test' });
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('Error message');
    });
    
    test('should include stack trace for error objects', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', { error });
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('stack');
      expect(logOutput).toContain('Test error');
    });
  });
  
  describe('Child Logger', () => {
    test('should create child logger with additional context', () => {
      const childLogger = logger.child({ service: 'auth', requestId: '123' });
      
      childLogger.info('Test message');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('service');
      expect(logOutput).toContain('auth');
      expect(logOutput).toContain('requestId');
      expect(logOutput).toContain('123');
    });
    
    test('should merge child context with log metadata', () => {
      const childLogger = logger.child({ service: 'auth' });
      
      childLogger.info('Test message', { userId: '456' });
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('service');
      expect(logOutput).toContain('auth');
      expect(logOutput).toContain('userId');
      expect(logOutput).toContain('456');
    });
  });
  
  describe('Integration Tests', () => {
    test('should redact sensitive data in production logs', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = new (require('./logger').constructor)();
      
      const spy = jest.spyOn(console, 'log').mockImplementation();
      
      prodLogger.info('User authenticated', {
        walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        apiKey: 'sk_live_1234567890'
      });
      
      const logOutput = spy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      
      expect(parsed.walletAddress).toBe('DYw8...NSKK');
      expect(parsed.apiKey).toBe('[REDACTED]');
      
      spy.mockRestore();
    });
    
    test('should not log debug messages in production', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = new (require('./logger').constructor)();
      
      const spy = jest.spyOn(console, 'log').mockImplementation();
      
      prodLogger.debug('Debug message');
      
      expect(spy).not.toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });
  
  describe('Vercel Integration', () => {
    test('should output to stdout for INFO logs (Vercel captures stdout)', () => {
      logger.info('Test message');
      
      // Vercel captures console.log (stdout)
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
    
    test('should output to stderr for ERROR logs (Vercel captures stderr)', () => {
      logger.error('Error message');
      
      // Vercel captures console.error (stderr)
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
    
    test('should output to stderr for WARN logs (Vercel captures stderr)', () => {
      logger.warn('Warning message');
      
      // Vercel captures console.warn (stderr)
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
    
    test('should output valid JSON in production for Vercel parsing', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = new (require('./logger').constructor)();
      
      const spy = jest.spyOn(console, 'log').mockImplementation();
      
      prodLogger.info('Transaction processed', {
        transactionId: 'tx_123',
        amount: 1.5,
        duration: 234
      });
      
      const logOutput = spy.mock.calls[0][0];
      
      // Should be valid JSON that Vercel can parse
      expect(() => JSON.parse(logOutput)).not.toThrow();
      
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('INFO');
      expect(parsed.message).toBe('Transaction processed');
      expect(parsed.transactionId).toBe('tx_123');
      expect(parsed.amount).toBe(1.5);
      expect(parsed.duration).toBe(234);
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      spy.mockRestore();
    });
    
    test('should include all metadata fields for Vercel filtering', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = new (require('./logger').constructor)();
      
      const spy = jest.spyOn(console, 'log').mockImplementation();
      
      prodLogger.info('Request completed', {
        requestId: 'req_abc123',
        method: 'POST',
        path: '/api/stake',
        statusCode: 200,
        duration: 145,
        walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
      });
      
      const logOutput = spy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      
      // All fields should be present for Vercel to filter on
      expect(parsed.requestId).toBe('req_abc123');
      expect(parsed.method).toBe('POST');
      expect(parsed.path).toBe('/api/stake');
      expect(parsed.statusCode).toBe(200);
      expect(parsed.duration).toBe(145);
      expect(parsed.walletAddress).toBe('DYw8...NSKK'); // Redacted but present
      
      spy.mockRestore();
    });
  });
});
