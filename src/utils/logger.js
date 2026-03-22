/**
 * Structured Logger for Production
 * 
 * Features:
 * - JSON format for production
 * - Automatic sensitive data redaction
 * - INFO level or higher in production
 * - Integrates with Vercel's built-in logging
 */

class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = this.isProduction ? 'info' : 'debug';
    
    // Log levels with numeric values for comparison
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    // Patterns for sensitive data detection
    this.sensitivePatterns = [
      // API keys (various formats)
      { pattern: /api[_-]?key["\s:=]+[a-zA-Z0-9_-]{20,}/gi, replacement: 'api_key=[REDACTED_API_KEY]' },
      // JWT tokens
      { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: '[REDACTED_JWT]' },
      // Database connection strings with passwords
      { pattern: /postgresql:\/\/[^:]+:([^@]+)@/g, replacement: 'postgresql://user:[REDACTED_PASSWORD]@' },
      // Generic password fields
      { pattern: /"password"\s*:\s*"[^"]+"/gi, replacement: '"password":"[REDACTED]"' },
      { pattern: /'password'\s*:\s*'[^']+'/gi, replacement: "'password':'[REDACTED]'" }
    ];
  }
  
  /**
   * Redact sensitive data from log messages and metadata
   */
  redactSensitiveData(data) {
    if (typeof data === 'string') {
      let redacted = data;
      
      // First, redact very long base58 strings (likely private keys, 64+ chars)
      // Use lookahead/lookbehind or non-word boundaries to catch them
      redacted = redacted.replace(
        /[1-9A-HJ-NP-Za-km-z]{64,}/g,
        '[REDACTED_PRIVATE_KEY]'
      );
      
      // Then apply other sensitive patterns
      for (const { pattern, replacement } of this.sensitivePatterns) {
        redacted = redacted.replace(pattern, replacement);
      }
      
      // Finally, redact wallet addresses (44 chars, but not already redacted)
      redacted = redacted.replace(
        /\b([1-9A-HJ-NP-Za-km-z]{44})\b/g,
        (match) => {
          // Don't redact if it's already been replaced
          if (match.includes('REDACTED')) return match;
          return `${match.slice(0, 4)}...${match.slice(-4)}`;
        }
      );
      
      return redacted;
    }
    
    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => this.redactSensitiveData(item));
      }
      
      const redacted = {};
      for (const [key, value] of Object.entries(data)) {
        // Redact specific field names
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('password') || 
            lowerKey.includes('secret') || 
            lowerKey.includes('private') ||
            lowerKey.includes('apikey') ||
            lowerKey.includes('api_key')) {
          redacted[key] = '[REDACTED]';
        } else if (lowerKey === 'walletaddress' || lowerKey === 'wallet_address') {
          // Redact wallet addresses (show first 4 and last 4)
          if (typeof value === 'string' && value.length === 44) {
            redacted[key] = `${value.slice(0, 4)}...${value.slice(-4)}`;
          } else {
            redacted[key] = value;
          }
        } else {
          redacted[key] = this.redactSensitiveData(value);
        }
      }
      return redacted;
    }
    
    return data;
  }
  
  /**
   * Check if a log level should be logged
   */
  shouldLog(level) {
    const currentLevel = this.levels[this.logLevel] || 0;
    const messageLevel = this.levels[level] || 0;
    return messageLevel >= currentLevel;
  }
  
  /**
   * Format log entry as JSON for production or human-readable for development
   */
  formatLog(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const redactedMetadata = this.redactSensitiveData(metadata);
    const redactedMessage = this.redactSensitiveData(message);
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message: redactedMessage,
      ...redactedMetadata
    };
    
    if (this.isProduction) {
      // JSON format for production (Vercel Logs)
      return JSON.stringify(logEntry);
    } else {
      // Human-readable format for development
      const metaStr = Object.keys(redactedMetadata).length > 0 
        ? '\n' + JSON.stringify(redactedMetadata, null, 2)
        : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${redactedMessage}${metaStr}`;
    }
  }
  
  /**
   * Log at DEBUG level
   */
  debug(message, metadata = {}) {
    if (!this.shouldLog('debug')) return;
    
    const formatted = this.formatLog('debug', message, metadata);
    console.log(formatted);
  }
  
  /**
   * Log at INFO level
   */
  info(message, metadata = {}) {
    if (!this.shouldLog('info')) return;
    
    const formatted = this.formatLog('info', message, metadata);
    console.log(formatted);
  }
  
  /**
   * Log at WARN level
   */
  warn(message, metadata = {}) {
    if (!this.shouldLog('warn')) return;
    
    const formatted = this.formatLog('warn', message, metadata);
    console.warn(formatted);
  }
  
  /**
   * Log at ERROR level
   */
  error(message, metadata = {}) {
    if (!this.shouldLog('error')) return;
    
    // Include stack trace if error object is provided
    if (metadata.error instanceof Error) {
      metadata.stack = metadata.error.stack;
      metadata.errorMessage = metadata.error.message;
      delete metadata.error; // Remove error object to avoid circular references
    }
    
    const formatted = this.formatLog('error', message, metadata);
    console.error(formatted);
  }
  
  /**
   * Create a child logger with additional context
   */
  child(context = {}) {
    const childLogger = Object.create(this);
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    
    // Override log methods to include default context
    ['debug', 'info', 'warn', 'error'].forEach(level => {
      childLogger[level] = (message, metadata = {}) => {
        this[level](message, { ...childLogger.defaultContext, ...metadata });
      };
    });
    
    return childLogger;
  }
}

// Export singleton instance
module.exports = new Logger();
