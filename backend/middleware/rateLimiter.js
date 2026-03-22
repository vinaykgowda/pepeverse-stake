/**
 * WalletRateLimiter - In-memory rate limiting for wallet addresses
 * 
 * Uses a sliding window algorithm to track requests per wallet address.
 * Automatically cleans up old entries to prevent memory leaks.
 */

class WalletRateLimiter {
  constructor() {
    // In-memory storage: Map<key, Array<timestamp>>
    this.requests = new Map();
    
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  /**
   * Stop the cleanup interval (for testing/shutdown)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Create a rate limiter middleware with specific options
   * @param {Object} options - Configuration options
   * @param {number} options.windowMs - Time window in milliseconds (default: 60000 = 1 minute)
   * @param {number} options.maxRequests - Maximum requests per window (default: 10)
   * @param {string} options.keyPrefix - Prefix for storage key (default: 'ratelimit')
   * @returns {Function} Express middleware function
   */
  createLimiter(options) {
    const { 
      windowMs = 60000, // 1 minute
      maxRequests = 10,
      keyPrefix = 'ratelimit'
    } = options;
    
    return async (req, res, next) => {
      // Extract wallet address from JWT or request
      const walletAddress = req.user?.walletAddress || req.body?.walletAddress;
      
      if (!walletAddress) {
        return res.status(400).json({ 
          error: 'Wallet address required' 
        });
      }
      
      const key = `${keyPrefix}:${walletAddress}`;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Get or create request array
      let timestamps = this.requests.get(key) || [];
      
      // Remove old timestamps outside the window (sliding window)
      timestamps = timestamps.filter(ts => ts > windowStart);
      
      if (timestamps.length >= maxRequests) {
        const oldestRequest = timestamps[0];
        const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
        
        return res.status(429)
          .header('Retry-After', retryAfter)
          .json({
            error: 'Rate limit exceeded',
            retryAfter: retryAfter
          });
      }
      
      // Add current request
      timestamps.push(now);
      this.requests.set(key, timestamps);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - timestamps.length);
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
      
      next();
    };
  }
  
  /**
   * Cleanup old entries to prevent memory leaks
   * Removes entries with no recent requests (older than 5 minutes)
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, timestamps] of this.requests.entries()) {
      // Remove entries with no recent requests
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] < now - maxAge) {
        this.requests.delete(key);
      }
    }
  }
  
  /**
   * Get current size of the rate limiter storage (for testing/monitoring)
   * @returns {number} Number of tracked keys
   */
  size() {
    return this.requests.size;
  }
  
  /**
   * Clear all rate limit data (for testing)
   */
  clear() {
    this.requests.clear();
  }
}

const rateLimiter = new WalletRateLimiter();

// Export specific limiters for different endpoints
module.exports = {
  claimLimiter: rateLimiter.createLimiter({
    windowMs: 60000,
    maxRequests: 5,
    keyPrefix: 'claim'
  }),
  
  stakeLimiter: rateLimiter.createLimiter({
    windowMs: 60000,
    maxRequests: 20,
    keyPrefix: 'stake'
  }),
  
  unstakeLimiter: rateLimiter.createLimiter({
    windowMs: 60000,
    maxRequests: 20,
    keyPrefix: 'unstake'
  }),
  
  authLimiter: rateLimiter.createLimiter({
    windowMs: 60000,
    maxRequests: 10,
    keyPrefix: 'auth'
  }),
  
  // Export the class and instance for testing
  WalletRateLimiter,
  rateLimiter
};
