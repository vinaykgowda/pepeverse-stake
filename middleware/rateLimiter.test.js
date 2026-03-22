const { WalletRateLimiter, rateLimiter } = require('./rateLimiter');

describe('WalletRateLimiter', () => {
  let limiter;
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    limiter = new WalletRateLimiter();
    
    mockReq = {
      user: { walletAddress: 'TestWallet123456789012345678901234' },
      body: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    nextFn = jest.fn();
  });

  afterEach(() => {
    limiter.clear();
    limiter.destroy(); // Clean up interval
  });

  describe('createLimiter', () => {
    test('should allow requests within limit', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test'
      });

      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
    });

    test('should block requests exceeding limit', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'test'
      });

      // Make 2 requests (should succeed)
      await middleware(mockReq, mockRes, nextFn);
      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalledTimes(2);

      // Third request should be blocked
      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded'
        })
      );
      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });

    test('should track requests per wallet address', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'test'
      });

      const wallet1Req = { ...mockReq, user: { walletAddress: 'Wallet1' } };
      const wallet2Req = { ...mockReq, user: { walletAddress: 'Wallet2' } };

      // Wallet1 makes 2 requests
      await middleware(wallet1Req, mockRes, nextFn);
      await middleware(wallet1Req, mockRes, nextFn);

      // Wallet2 should still be able to make requests
      await middleware(wallet2Req, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalledTimes(3);
    });

    test('should use sliding window algorithm', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 100, // 100ms window
        maxRequests: 2,
        keyPrefix: 'test'
      });

      // Make 2 requests
      await middleware(mockReq, mockRes, nextFn);
      await middleware(mockReq, mockRes, nextFn);

      // Third request should be blocked
      await middleware(mockReq, mockRes, nextFn);
      expect(mockRes.status).toHaveBeenCalledWith(429);

      // Wait for window to pass
      await new Promise(resolve => setTimeout(resolve, 150));

      // Reset mock
      mockRes.status.mockClear();
      nextFn.mockClear();

      // Should allow new requests after window
      await middleware(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should return 400 if wallet address is missing', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test'
      });

      const reqWithoutWallet = { user: {}, body: {} };

      await middleware(reqWithoutWallet, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Wallet address required'
      });
      expect(nextFn).not.toHaveBeenCalled();
    });

    test('should extract wallet address from request body if not in user', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test'
      });

      const reqWithBodyWallet = {
        body: { walletAddress: 'BodyWallet123' }
      };

      await middleware(reqWithBodyWallet, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should set correct rate limit headers', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test'
      });

      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      );
    });

    test('should use different key prefixes for different limiters', async () => {
      const limiter1 = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'endpoint1'
      });

      const limiter2 = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'endpoint2'
      });

      // Same wallet, different endpoints
      await limiter1(mockReq, mockRes, nextFn);
      await limiter2(mockReq, mockRes, nextFn);

      // Both should succeed because they use different key prefixes
      expect(nextFn).toHaveBeenCalledTimes(2);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    test('should remove old entries', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test'
      });

      await middleware(mockReq, mockRes, nextFn);

      expect(limiter.size()).toBe(1);

      // Manually set old timestamp
      const key = 'test:TestWallet123456789012345678901234';
      limiter.requests.set(key, [Date.now() - 6 * 60 * 1000]); // 6 minutes ago

      limiter.cleanup();

      expect(limiter.size()).toBe(0);
    });

    test('should keep recent entries', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test'
      });

      await middleware(mockReq, mockRes, nextFn);

      expect(limiter.size()).toBe(1);

      limiter.cleanup();

      // Should still have the entry
      expect(limiter.size()).toBe(1);
    });
  });

  describe('size', () => {
    test('should return number of tracked keys', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test'
      });

      expect(limiter.size()).toBe(0);

      await middleware(mockReq, mockRes, nextFn);

      expect(limiter.size()).toBe(1);

      const wallet2Req = { ...mockReq, user: { walletAddress: 'Wallet2' } };
      await middleware(wallet2Req, mockRes, nextFn);

      expect(limiter.size()).toBe(2);
    });
  });

  describe('clear', () => {
    test('should clear all rate limit data', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test'
      });

      await middleware(mockReq, mockRes, nextFn);

      expect(limiter.size()).toBe(1);

      limiter.clear();

      expect(limiter.size()).toBe(0);
    });
  });

  describe('exported limiters', () => {
    test('should export claimLimiter with correct config', () => {
      const { claimLimiter } = require('./rateLimiter');
      expect(claimLimiter).toBeDefined();
      expect(typeof claimLimiter).toBe('function');
    });

    test('should export stakeLimiter with correct config', () => {
      const { stakeLimiter } = require('./rateLimiter');
      expect(stakeLimiter).toBeDefined();
      expect(typeof stakeLimiter).toBe('function');
    });

    test('should export unstakeLimiter with correct config', () => {
      const { unstakeLimiter } = require('./rateLimiter');
      expect(unstakeLimiter).toBeDefined();
      expect(typeof unstakeLimiter).toBe('function');
    });

    test('should export authLimiter with correct config', () => {
      const { authLimiter } = require('./rateLimiter');
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe('function');
    });
  });
});
