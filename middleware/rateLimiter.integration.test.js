/**
 * Integration tests for rate limiter headers on actual endpoints
 * Tests that rate limit headers are properly added to API responses
 */

const request = require('supertest');
const express = require('express');
const { stakeLimiter, unstakeLimiter, claimLimiter, authLimiter, rateLimiter } = require('./rateLimiter');

// Mock JWT verification middleware
const mockVerifyJWT = (req, res, next) => {
  req.user = { walletAddress: 'TestWallet123' };
  next();
};

// Create test app with rate limiters
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Auth endpoints
  app.post('/auth/nonce', authLimiter, (req, res) => {
    res.json({ success: true, nonce: 'test-nonce' });
  });

  app.post('/auth/verify', authLimiter, (req, res) => {
    res.json({ success: true, token: 'test-token' });
  });

  // Stake endpoints
  app.post('/nfts/stake', mockVerifyJWT, stakeLimiter, (req, res) => {
    res.json({ success: true, message: 'Staked' });
  });

  app.post('/nfts/stake/execute', mockVerifyJWT, stakeLimiter, (req, res) => {
    res.json({ success: true, message: 'Stake executed' });
  });

  // Unstake endpoint
  app.post('/nfts/unstake', mockVerifyJWT, unstakeLimiter, (req, res) => {
    res.json({ success: true, message: 'Unstaked' });
  });

  // Claim endpoint
  app.post('/rewards/claim', mockVerifyJWT, claimLimiter, (req, res) => {
    res.json({ success: true, message: 'Claimed' });
  });

  return app;
}

describe('Rate Limiter Headers Integration Tests', () => {
  let app;

  beforeEach(() => {
    // Clear rate limiter state before each test
    rateLimiter.clear();
    app = createTestApp();
  });

  describe('Rate limit headers on auth endpoints', () => {
    test('should add rate limit headers to /auth/nonce', async () => {
      const response = await request(app)
        .post('/auth/nonce')
        .send({ walletAddress: 'TestWallet123' })
        .expect(200);

      // Verify headers are present
      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBe('9');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      
      // Verify reset is a valid ISO date
      const resetDate = new Date(response.headers['x-ratelimit-reset']);
      expect(resetDate.toString()).not.toBe('Invalid Date');
    });

    test('should add rate limit headers to /auth/verify', async () => {
      const response = await request(app)
        .post('/auth/verify')
        .send({ walletAddress: 'TestWallet123' })
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBe('9');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    test('should return 429 with Retry-After when auth limit exceeded', async () => {
      const walletAddress = 'TestWallet456';

      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/auth/nonce')
          .send({ walletAddress })
          .expect(200);
      }

      // 11th request should be rate limited
      const response = await request(app)
        .post('/auth/nonce')
        .send({ walletAddress })
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
      expect(response.body.error).toBe('Rate limit exceeded');
      expect(response.body.retryAfter).toBeDefined();
    });
  });

  describe('Rate limit headers on stake endpoints', () => {
    test('should add rate limit headers to /nfts/stake', async () => {
      const response = await request(app)
        .post('/nfts/stake')
        .send({ walletAddress: 'TestWallet123', nfts: ['mint1'] })
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('20');
      expect(response.headers['x-ratelimit-remaining']).toBe('19');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    test('should add rate limit headers to /nfts/stake/execute', async () => {
      const response = await request(app)
        .post('/nfts/stake/execute')
        .send({ walletAddress: 'TestWallet123', nfts: ['mint1'] })
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('20');
      expect(response.headers['x-ratelimit-remaining']).toBe('19');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    test('should return 429 with Retry-After when stake limit exceeded', async () => {
      const walletAddress = 'TestWallet789';

      // Make 20 requests (the limit)
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post('/nfts/stake')
          .send({ walletAddress, nfts: ['mint1'] })
          .expect(200);
      }

      // 21st request should be rate limited
      const response = await request(app)
        .post('/nfts/stake')
        .send({ walletAddress, nfts: ['mint1'] })
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
      expect(response.body.error).toBe('Rate limit exceeded');
    });
  });

  describe('Rate limit headers on unstake endpoint', () => {
    test('should add rate limit headers to /nfts/unstake', async () => {
      const response = await request(app)
        .post('/nfts/unstake')
        .send({ walletAddress: 'TestWallet123', nftIds: [1] })
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('20');
      expect(response.headers['x-ratelimit-remaining']).toBe('19');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    test('should return 429 with Retry-After when unstake limit exceeded', async () => {
      const walletAddress = 'TestWalletUnstake';

      // Make 20 requests (the limit)
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post('/nfts/unstake')
          .send({ walletAddress, nftIds: [1] })
          .expect(200);
      }

      // 21st request should be rate limited
      const response = await request(app)
        .post('/nfts/unstake')
        .send({ walletAddress, nftIds: [1] })
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('Rate limit headers on claim endpoint', () => {
    test('should add rate limit headers to /rewards/claim', async () => {
      const response = await request(app)
        .post('/rewards/claim')
        .send({ walletAddress: 'TestWallet123' })
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBe('4');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    test('should return 429 with Retry-After when claim limit exceeded', async () => {
      const walletAddress = 'TestWalletClaim';

      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/rewards/claim')
          .send({ walletAddress })
          .expect(200);
      }

      // 6th request should be rate limited
      const response = await request(app)
        .post('/rewards/claim')
        .send({ walletAddress })
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
      expect(response.body.error).toBe('Rate limit exceeded');
    });
  });

  describe('Rate limit headers update correctly', () => {
    test('should decrement X-RateLimit-Remaining with each request', async () => {
      const walletAddress = 'TestWalletDecrement';

      // First request
      let response = await request(app)
        .post('/rewards/claim')
        .send({ walletAddress })
        .expect(200);
      expect(response.headers['x-ratelimit-remaining']).toBe('4');

      // Second request
      response = await request(app)
        .post('/rewards/claim')
        .send({ walletAddress })
        .expect(200);
      expect(response.headers['x-ratelimit-remaining']).toBe('3');

      // Third request
      response = await request(app)
        .post('/rewards/claim')
        .send({ walletAddress })
        .expect(200);
      expect(response.headers['x-ratelimit-remaining']).toBe('2');
    });

    test('should maintain consistent X-RateLimit-Limit across requests', async () => {
      const walletAddress = 'TestWalletConsistent';

      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/auth/nonce')
          .send({ walletAddress })
          .expect(200);
        
        expect(response.headers['x-ratelimit-limit']).toBe('10');
      }
    });
  });

  describe('Rate limit isolation per wallet', () => {
    test('should track rate limits separately for different wallets', async () => {
      // Create a custom app with dynamic wallet address from body
      const customApp = express();
      customApp.use(express.json());
      
      // Mock JWT that uses wallet from body
      const dynamicMockJWT = (req, res, next) => {
        req.user = { walletAddress: req.body.walletAddress };
        next();
      };
      
      customApp.post('/rewards/claim', dynamicMockJWT, claimLimiter, (req, res) => {
        res.json({ success: true, message: 'Claimed' });
      });

      const wallet1 = 'Wallet1';
      const wallet2 = 'Wallet2';

      // Make 4 requests from wallet1
      for (let i = 0; i < 4; i++) {
        await request(customApp)
          .post('/rewards/claim')
          .send({ walletAddress: wallet1 })
          .expect(200);
      }

      // Wallet1 should have 1 remaining
      let response = await request(customApp)
        .post('/rewards/claim')
        .send({ walletAddress: wallet1 })
        .expect(200);
      expect(response.headers['x-ratelimit-remaining']).toBe('0');

      // Wallet2 should still have full limit
      response = await request(customApp)
        .post('/rewards/claim')
        .send({ walletAddress: wallet2 })
        .expect(200);
      expect(response.headers['x-ratelimit-remaining']).toBe('4');
    });
  });

  describe('Rate limit enforcement - Requirement 9.1, 9.2, 9.3', () => {
    test('should enforce exact 5 request limit for claim endpoint (Req 9.1)', async () => {
      const walletAddress = 'TestWalletExactLimit';

      // Requests 1-5 should succeed
      for (let i = 1; i <= 5; i++) {
        const response = await request(app)
          .post('/rewards/claim')
          .send({ walletAddress })
          .expect(200);
        
        expect(response.headers['x-ratelimit-limit']).toBe('5');
        expect(response.headers['x-ratelimit-remaining']).toBe(String(5 - i));
      }

      // Request 6 should be blocked
      await request(app)
        .post('/rewards/claim')
        .send({ walletAddress })
        .expect(429);
    });

    test('should enforce exact 20 request limit for stake endpoint (Req 9.2)', async () => {
      const walletAddress = 'TestWalletStakeLimit';

      // Requests 1-20 should succeed
      for (let i = 1; i <= 20; i++) {
        const response = await request(app)
          .post('/nfts/stake')
          .send({ walletAddress, nfts: ['mint1'] })
          .expect(200);
        
        expect(response.headers['x-ratelimit-limit']).toBe('20');
        expect(response.headers['x-ratelimit-remaining']).toBe(String(20 - i));
      }

      // Request 21 should be blocked
      await request(app)
        .post('/nfts/stake')
        .send({ walletAddress, nfts: ['mint1'] })
        .expect(429);
    });

    test('should enforce exact 20 request limit for unstake endpoint (Req 9.3)', async () => {
      const walletAddress = 'TestWalletUnstakeLimit';

      // Requests 1-20 should succeed
      for (let i = 1; i <= 20; i++) {
        const response = await request(app)
          .post('/nfts/unstake')
          .send({ walletAddress, nftIds: [1] })
          .expect(200);
        
        expect(response.headers['x-ratelimit-limit']).toBe('20');
        expect(response.headers['x-ratelimit-remaining']).toBe(String(20 - i));
      }

      // Request 21 should be blocked
      await request(app)
        .post('/nfts/unstake')
        .send({ walletAddress, nftIds: [1] })
        .expect(429);
    });
  });

  describe('Rate limit headers on 429 responses - Requirement 9.4', () => {
    test('should include rate limit headers on 429 response', async () => {
      const walletAddress = 'TestWallet429Headers';

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/rewards/claim')
          .send({ walletAddress })
          .expect(200);
      }

      // Next request should return 429 with headers
      const response = await request(app)
        .post('/rewards/claim')
        .send({ walletAddress })
        .expect(429);

      // Verify Retry-After header (Req 9.4)
      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
      expect(parseInt(response.headers['retry-after'])).toBeLessThanOrEqual(60);

      // Verify error response includes retryAfter
      expect(response.body.error).toBe('Rate limit exceeded');
      expect(response.body.retryAfter).toBeDefined();
      expect(response.body.retryAfter).toBeGreaterThan(0);
    });

    test('should return HTTP 429 status code when limit exceeded (Req 9.4)', async () => {
      const walletAddress = 'TestWallet429Status';

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/rewards/claim')
          .send({ walletAddress })
          .expect(200);
      }

      // Verify 429 status
      const response = await request(app)
        .post('/rewards/claim')
        .send({ walletAddress });

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });
  });

  describe('Per-wallet tracking - Requirement 9.5', () => {
    test('should track requests independently per wallet address (Req 9.5)', async () => {
      const customApp = express();
      customApp.use(express.json());
      
      const dynamicMockJWT = (req, res, next) => {
        req.user = { walletAddress: req.body.walletAddress };
        next();
      };
      
      customApp.post('/rewards/claim', dynamicMockJWT, claimLimiter, (req, res) => {
        res.json({ success: true });
      });

      const wallets = ['WalletA', 'WalletB', 'WalletC'];

      // Each wallet should have independent limit
      for (const wallet of wallets) {
        // Make 5 requests (full limit)
        for (let i = 0; i < 5; i++) {
          await request(customApp)
            .post('/rewards/claim')
            .send({ walletAddress: wallet })
            .expect(200);
        }

        // 6th request should be blocked for this wallet
        await request(customApp)
          .post('/rewards/claim')
          .send({ walletAddress: wallet })
          .expect(429);
      }
    });

    test('should use sliding window algorithm for rate limiting (Req 9.5)', async () => {
      const customApp = express();
      customApp.use(express.json());
      
      const dynamicMockJWT = (req, res, next) => {
        req.user = { walletAddress: req.body.walletAddress };
        next();
      };
      
      // Create limiter with short window for testing
      const testLimiter = rateLimiter.createLimiter({
        windowMs: 200, // 200ms window
        maxRequests: 3,
        keyPrefix: 'test-sliding'
      });
      
      customApp.post('/test', dynamicMockJWT, testLimiter, (req, res) => {
        res.json({ success: true });
      });

      const wallet = 'TestSlidingWindow';

      // Make 3 requests (exhaust limit)
      for (let i = 0; i < 3; i++) {
        await request(customApp)
          .post('/test')
          .send({ walletAddress: wallet })
          .expect(200);
      }

      // 4th request should be blocked
      await request(customApp)
        .post('/test')
        .send({ walletAddress: wallet })
        .expect(429);

      // Wait for window to slide (250ms > 200ms window)
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should allow new requests after window expires
      await request(customApp)
        .post('/test')
        .send({ walletAddress: wallet })
        .expect(200);
    });
  });
});
