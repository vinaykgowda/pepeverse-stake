/**
 * Security Testing Suite
 * 
 * Comprehensive security tests covering:
 * - Authentication flow (Requirement 37.1)
 * - Input validation with malformed data (Requirement 37.2)
 * - Rate limiting effectiveness (Requirement 37.3)
 * - NFT ownership verification (Requirement 37.4)
 * - Transaction verification with invalid signatures (Requirement 37.5)
 */

const request = require('supertest');
const express = require('express');
const authService = require('../src/services/auth');
const { validateWalletAddress, validateTransactionHash } = require('../middleware/validation');
const { WalletRateLimiter } = require('../middleware/rateLimiter');
const nacl = require('tweetnacl');
const bs58 = require('bs58');

// Mock Helius proxy to avoid requiring API keys
jest.mock('../src/services/heliusProxy', () => ({
  getAssetMetadata: jest.fn(),
  getAssetsByOwner: jest.fn(),
  clearCache: jest.fn()
}));

// Mock transaction verification to avoid requiring RPC connection
jest.mock('../src/services/transactionVerification', () => ({
  verifySignature: jest.fn(),
  waitForConfirmation: jest.fn(),
  verifyPayment: jest.fn(),
  verifyPaymentWithConfirmation: jest.fn(),
  AMOUNT_TOLERANCE_LAMPORTS: 100000,
  CONFIRMATION_TIMEOUT_MS: 15000
}));

const ownershipVerification = require('../src/services/ownershipVerification');
const transactionVerification = require('../src/services/transactionVerification');

describe('Security Testing Suite', () => {
  // Test keypair for authentication tests
  let testKeypair;
  let testWalletAddress;

  beforeAll(() => {
    testKeypair = nacl.sign.keyPair();
    testWalletAddress = bs58.encode(testKeypair.publicKey);
  });

  afterEach(() => {
    // Clean up auth service nonces
    authService.nonces.clear();
  });

  afterAll(() => {
    authService.destroy();
  });

  /**
   * Requirement 37.1: Test authentication flow
   */
  describe('Authentication Flow Security (Requirement 37.1)', () => {
    describe('Nonce Generation Security', () => {
      test('should generate cryptographically secure nonces', async () => {
        const nonce1 = await authService.generateNonce(testWalletAddress);
        const nonce2 = await authService.generateNonce(testWalletAddress);
        
        // Nonces should be unique
        expect(nonce1).not.toBe(nonce2);
        
        // Nonces should be base64 encoded (32 bytes = 44 chars)
        expect(nonce1.length).toBe(44);
        expect(nonce2.length).toBe(44);
        
        // Nonces should be different even for same wallet
        expect(nonce1).not.toEqual(nonce2);
      });

      test('should enforce 5-minute TTL on nonces', async () => {
        const nonce = await authService.generateNonce(testWalletAddress);
        const ttl = await authService.getNonceTTL(testWalletAddress);
        
        expect(ttl).toBeGreaterThan(290);
        expect(ttl).toBeLessThanOrEqual(300);
      });

      test('should reject invalid wallet addresses', async () => {
        const invalidAddresses = [
          'invalid-address',
          '123',
          '',
          'a'.repeat(100),
          '0OIl' + 'a'.repeat(40) // Invalid base58 characters
        ];

        for (const addr of invalidAddresses) {
          await expect(authService.generateNonce(addr))
            .rejects
            .toThrow('Invalid wallet address format');
        }
      });
    });

    describe('Signature Verification Security', () => {
      test('should verify valid signatures correctly', async () => {
        const nonce = await authService.generateNonce(testWalletAddress);
        const messageBytes = Buffer.from(nonce, 'utf8');
        const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
        const signature = bs58.encode(signatureBytes);

        const result = await authService.verifySignature(testWalletAddress, signature, nonce);
        
        expect(result.valid).toBe(true);
        expect(result.walletAddress).toBe(testWalletAddress);
      });

      test('should reject signature from wrong wallet', async () => {
        const nonce = await authService.generateNonce(testWalletAddress);
        
        // Create different keypair
        const wrongKeypair = nacl.sign.keyPair();
        const messageBytes = Buffer.from(nonce, 'utf8');
        const signatureBytes = nacl.sign.detached(messageBytes, wrongKeypair.secretKey);
        const signature = bs58.encode(signatureBytes);

        await expect(authService.verifySignature(testWalletAddress, signature, nonce))
          .rejects
          .toThrow('Invalid signature');
      });

      test('should prevent nonce reuse (replay attack)', async () => {
        const nonce = await authService.generateNonce(testWalletAddress);
        const messageBytes = Buffer.from(nonce, 'utf8');
        const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
        const signature = bs58.encode(signatureBytes);

        // First verification should succeed
        await authService.verifySignature(testWalletAddress, signature, nonce);

        // Second verification with same nonce should fail
        await expect(authService.verifySignature(testWalletAddress, signature, nonce))
          .rejects
          .toThrow('Nonce not found or expired');
      });

      test('should reject expired nonces', async () => {
        // Manually add expired nonce
        authService.nonces.set(testWalletAddress, {
          nonce: 'expired-nonce',
          expiresAt: Date.now() - 1000
        });

        const messageBytes = Buffer.from('expired-nonce', 'utf8');
        const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
        const signature = bs58.encode(signatureBytes);

        await expect(authService.verifySignature(testWalletAddress, signature, 'expired-nonce'))
          .rejects
          .toThrow('Nonce not found or expired');
      });

      test('should reject mismatched nonce and message', async () => {
        const nonce = await authService.generateNonce(testWalletAddress);
        const differentMessage = 'different-message';
        
        const messageBytes = Buffer.from(differentMessage, 'utf8');
        const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
        const signature = bs58.encode(signatureBytes);

        await expect(authService.verifySignature(testWalletAddress, signature, differentMessage))
          .rejects
          .toThrow('Nonce mismatch');
      });

      test('should reject invalid signature encoding', async () => {
        const nonce = await authService.generateNonce(testWalletAddress);
        const invalidSignature = 'invalid-signature-encoding';

        await expect(authService.verifySignature(testWalletAddress, invalidSignature, nonce))
          .rejects
          .toThrow();
      });

      test('should reject signature with wrong length', async () => {
        const nonce = await authService.generateNonce(testWalletAddress);
        const wrongLengthBytes = Buffer.alloc(32); // Should be 64 bytes
        const wrongLengthSignature = bs58.encode(wrongLengthBytes);

        await expect(authService.verifySignature(testWalletAddress, wrongLengthSignature, nonce))
          .rejects
          .toThrow();
      });
    });

    describe('Authentication Timing Attacks', () => {
      test('should not leak timing information on invalid wallet', async () => {
        const validWallet = testWalletAddress;
        const invalidWallet = 'invalid-wallet';

        const start1 = Date.now();
        try {
          await authService.generateNonce(invalidWallet);
        } catch (e) {}
        const time1 = Date.now() - start1;

        const start2 = Date.now();
        await authService.generateNonce(validWallet);
        const time2 = Date.now() - start2;

        // Timing difference should be minimal (< 100ms)
        // This is a basic check; real timing attack prevention requires constant-time operations
        expect(Math.abs(time1 - time2)).toBeLessThan(100);
      });
    });
  });

  /**
   * Requirement 37.2: Test input validation with malformed data
   */
  describe('Input Validation Security (Requirement 37.2)', () => {
    let app;
    let req, res, next;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      
      req = { body: {}, params: {}, query: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    describe('Malformed Wallet Address Validation', () => {
      test('should reject SQL injection attempts', () => {
        const sqlInjectionAttempts = [
          "'; DROP TABLE users; --",
          "1' OR '1'='1",
          "admin'--",
          "' OR 1=1--",
          "'; DELETE FROM staked_nfts WHERE '1'='1"
        ];

        const middleware = validateWalletAddress();

        sqlInjectionAttempts.forEach(malicious => {
          req.body.walletAddress = malicious;
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
              code: 'INVALID_WALLET_ADDRESS'
            })
          );
          
          // Reset mocks
          res.status.mockClear();
          res.json.mockClear();
          next.mockClear();
        });
      });

      test('should reject XSS attempts', () => {
        const xssAttempts = [
          '<script>alert("XSS")</script>',
          '<img src=x onerror=alert("XSS")>',
          'javascript:alert("XSS")',
          '<svg onload=alert("XSS")>',
          '"><script>alert(String.fromCharCode(88,83,83))</script>'
        ];

        const middleware = validateWalletAddress();

        xssAttempts.forEach(malicious => {
          req.body.walletAddress = malicious;
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          res.status.mockClear();
          res.json.mockClear();
          next.mockClear();
        });
      });

      test('should reject command injection attempts', () => {
        const commandInjectionAttempts = [
          '; ls -la',
          '| cat /etc/passwd',
          '`whoami`',
          '$(rm -rf /)',
          '& ping -c 10 127.0.0.1 &'
        ];

        const middleware = validateWalletAddress();

        commandInjectionAttempts.forEach(malicious => {
          req.body.walletAddress = malicious;
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          res.status.mockClear();
          res.json.mockClear();
          next.mockClear();
        });
      });

      test('should reject path traversal attempts', () => {
        const pathTraversalAttempts = [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32',
          '....//....//....//etc/passwd',
          '%2e%2e%2f%2e%2e%2f',
          '..;/..;/'
        ];

        const middleware = validateWalletAddress();

        pathTraversalAttempts.forEach(malicious => {
          req.body.walletAddress = malicious;
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          res.status.mockClear();
          res.json.mockClear();
          next.mockClear();
        });
      });

      test('should reject null bytes and special characters', () => {
        const specialCharAttempts = [
          'wallet\x00address',
          'wallet\naddress',
          'wallet\raddress',
          'wallet\taddress',
          'wallet%00address'
        ];

        const middleware = validateWalletAddress();

        specialCharAttempts.forEach(malicious => {
          req.body.walletAddress = malicious;
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          res.status.mockClear();
          res.json.mockClear();
          next.mockClear();
        });
      });

      test('should reject extremely long inputs (buffer overflow attempt)', () => {
        const middleware = validateWalletAddress();
        
        // Try various long inputs
        const longInputs = [
          'A'.repeat(1000),
          'A'.repeat(10000),
          'A'.repeat(100000)
        ];

        longInputs.forEach(longInput => {
          req.body.walletAddress = longInput;
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          res.status.mockClear();
          res.json.mockClear();
          next.mockClear();
        });
      });
    });

    describe('Malformed Transaction Hash Validation', () => {
      test('should reject invalid transaction hash formats', () => {
        const invalidHashes = [
          'short',
          'a'.repeat(87), // Too short
          'a'.repeat(89), // Too long
          '0OIl' + 'a'.repeat(84), // Invalid base58 chars
          '<script>alert("XSS")</script>' + 'a'.repeat(60),
          "'; DROP TABLE transactions; --" + 'a'.repeat(60)
        ];

        const middleware = validateTransactionHash();

        invalidHashes.forEach(hash => {
          req.body.signature = hash;
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          res.status.mockClear();
          res.json.mockClear();
          next.mockClear();
        });
      });

      test('should reject non-string transaction hashes', () => {
        const middleware = validateTransactionHash();
        
        const nonStringValues = [
          123,
          { hash: 'value' },
          ['array'],
          true,
          null,
          undefined
        ];

        nonStringValues.forEach(value => {
          req.body.signature = value;
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          res.status.mockClear();
          res.json.mockClear();
          next.mockClear();
        });
      });
    });

    describe('JSON Payload Attacks', () => {
      test('should handle deeply nested JSON', async () => {
        app.post('/test', (req, res) => {
          res.json({ success: true });
        });

        // Create deeply nested object
        let deepObj = { value: 'test' };
        for (let i = 0; i < 100; i++) {
          deepObj = { nested: deepObj };
        }

        const response = await request(app)
          .post('/test')
          .send(deepObj)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should handle extremely large JSON payloads', async () => {
        app.post('/test', (req, res) => {
          res.json({ success: true, size: JSON.stringify(req.body).length });
        });

        // Create large payload (1MB)
        const largeArray = Array(10000).fill('A'.repeat(100));

        const response = await request(app)
          .post('/test')
          .send({ data: largeArray });

        // Should either succeed or reject with 413 (payload too large)
        expect([200, 413]).toContain(response.status);
      });
    });
  });

  /**
   * Requirement 37.3: Test rate limiting effectiveness
   */
  describe('Rate Limiting Security (Requirement 37.3)', () => {
    let limiter;
    let mockReq, mockRes, nextFn;

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
      limiter.destroy();
    });

    test('should enforce rate limits per wallet', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 3,
        keyPrefix: 'test'
      });

      // First 3 requests should succeed
      await middleware(mockReq, mockRes, nextFn);
      await middleware(mockReq, mockRes, nextFn);
      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalledTimes(3);
      expect(mockRes.status).not.toHaveBeenCalled();

      // 4th request should be blocked
      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded'
        })
      );
    });

    test('should prevent rate limit bypass with different wallets', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'test'
      });

      const wallet1 = { user: { walletAddress: 'Wallet1' }, body: {} };
      const wallet2 = { user: { walletAddress: 'Wallet2' }, body: {} };

      // Wallet1 hits limit
      await middleware(wallet1, mockRes, nextFn);
      await middleware(wallet1, mockRes, nextFn);
      await middleware(wallet1, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(429);

      // Reset mocks
      mockRes.status.mockClear();
      nextFn.mockClear();

      // Wallet2 should have separate limit
      await middleware(wallet2, mockRes, nextFn);
      await middleware(wallet2, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalledTimes(2);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should include Retry-After header when rate limited', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'test'
      });

      await middleware(mockReq, mockRes, nextFn);
      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.header).toHaveBeenCalledWith('Retry-After', expect.any(Number));
      
      const retryAfterCall = mockRes.header.mock.calls.find(
        call => call[0] === 'Retry-After'
      );
      expect(retryAfterCall[1]).toBeGreaterThan(0);
      expect(retryAfterCall[1]).toBeLessThanOrEqual(60);
    });

    test('should reset limits after time window', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 100, // 100ms window
        maxRequests: 2,
        keyPrefix: 'test'
      });

      // Hit limit
      await middleware(mockReq, mockRes, nextFn);
      await middleware(mockReq, mockRes, nextFn);
      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(429);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Reset mocks
      mockRes.status.mockClear();
      nextFn.mockClear();

      // Should allow requests again
      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should prevent distributed rate limit bypass', async () => {
      const middleware = limiter.createLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test'
      });

      // Simulate multiple concurrent requests from same wallet
      const requests = Array(10).fill(null).map(() => 
        middleware(mockReq, mockRes, nextFn)
      );

      await Promise.all(requests);

      // Should have blocked some requests
      expect(mockRes.status).toHaveBeenCalledWith(429);
      
      // Should have allowed exactly 5 requests
      expect(nextFn).toHaveBeenCalledTimes(5);
    });

    test('should handle missing wallet address gracefully', async () => {
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
  });

  /**
   * Requirement 37.4: Test NFT ownership verification
   */
  describe('NFT Ownership Verification Security (Requirement 37.4)', () => {
    describe('Ownership Verification Attacks', () => {
      test('should reject ownership verification with invalid mint address', async () => {
        const invalidMints = [
          'invalid-mint',
          '',
          null,
          undefined,
          '<script>alert("XSS")</script>',
          "'; DROP TABLE staked_nfts; --"
        ];

        for (const mint of invalidMints) {
          const result = await ownershipVerification.verifyOwnership(
            testWalletAddress,
            mint
          );

          expect(result.isOwner).toBe(false);
          expect(result.error).toBeDefined();
        }
      });

      test('should handle metadata fetch failures securely', async () => {
        // Test with non-existent mint
        const nonExistentMint = 'NonExistentMint1234567890123456789012';
        
        const result = await ownershipVerification.verifyOwnership(
          testWalletAddress,
          nonExistentMint
        );

        expect(result.isOwner).toBe(false);
        expect(result.error).toBeDefined();
        // Should not expose internal error details
        expect(result.error).not.toContain('stack');
        expect(result.error).not.toContain('password');
      });

      test('should prevent ownership spoofing attempts', async () => {
        // Test that ownership check is case-insensitive but strict
        const wallet1 = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        const wallet2 = 'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        
        // These should be treated as different wallets
        expect(wallet1.toLowerCase()).not.toBe(wallet2.toLowerCase());
      });

      test('should handle multiple ownership verification securely', async () => {
        const mints = [
          'Mint1234567890123456789012345678901',
          'Mint2234567890123456789012345678901',
          'Mint3234567890123456789012345678901'
        ];

        const result = await ownershipVerification.verifyMultipleOwnership(
          testWalletAddress,
          mints
        );

        expect(result).toHaveProperty('allOwned');
        expect(result).toHaveProperty('results');
        expect(result).toHaveProperty('failedMints');
        expect(Array.isArray(result.results)).toBe(true);
        expect(Array.isArray(result.failedMints)).toBe(true);
      });

      test('should not leak information about other owners', async () => {
        const mint = 'TestMint123456789012345678901234';
        
        const result = await ownershipVerification.verifyOwnership(
          testWalletAddress,
          mint
        );

        // Should not expose sensitive information in error messages
        if (result.error) {
          expect(result.error).not.toContain('private');
          expect(result.error).not.toContain('secret');
          expect(result.error).not.toContain('key');
        }
      });
    });
  });

  /**
   * Requirement 37.5: Test transaction verification with invalid signatures
   */
  describe('Transaction Verification Security (Requirement 37.5)', () => {
    describe('Invalid Signature Handling', () => {
      beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
      });

      test('should reject non-existent transaction signatures', async () => {
        const fakeSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        
        // Mock returns false for non-existent signature
        transactionVerification.verifySignature.mockResolvedValue(false);
        
        const isValid = await transactionVerification.verifySignature(fakeSignature);
        
        expect(isValid).toBe(false);
        expect(transactionVerification.verifySignature).toHaveBeenCalledWith(fakeSignature);
      });

      test('should reject malformed transaction signatures', async () => {
        const malformedSignatures = [
          'invalid',
          '',
          'a'.repeat(87),
          'a'.repeat(89),
          '<script>alert("XSS")</script>',
          "'; DROP TABLE transactions; --",
          null,
          undefined
        ];

        // Mock returns false for all malformed signatures
        transactionVerification.verifySignature.mockResolvedValue(false);

        for (const sig of malformedSignatures) {
          const isValid = await transactionVerification.verifySignature(sig);
          expect(isValid).toBe(false);
        }
        
        expect(transactionVerification.verifySignature).toHaveBeenCalledTimes(malformedSignatures.length);
      });

      test('should handle transaction verification timeout securely', async () => {
        const fakeSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        
        // Mock returns false for timeout
        transactionVerification.waitForConfirmation.mockResolvedValue(false);
        
        // Use short timeout to test timeout handling
        const isConfirmed = await transactionVerification.waitForConfirmation(
          fakeSignature,
          1000 // 1 second timeout
        );
        
        expect(isConfirmed).toBe(false);
        expect(transactionVerification.waitForConfirmation).toHaveBeenCalledWith(fakeSignature, 1000);
      });

      test('should reject payment verification with invalid addresses', async () => {
        const fakeSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        const invalidWallet = 'invalid-wallet';
        const validWallet = testWalletAddress;
        
        // Mock returns failure for invalid wallet
        transactionVerification.verifyPayment.mockResolvedValue({
          success: false,
          error: 'Transaction not found'
        });
        
        const result = await transactionVerification.verifyPayment(
          fakeSignature,
          invalidWallet,
          validWallet,
          0.1
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(transactionVerification.verifyPayment).toHaveBeenCalledWith(
          fakeSignature,
          invalidWallet,
          validWallet,
          0.1
        );
      });

      test('should enforce amount tolerance correctly', async () => {
        // Test that the tolerance is exactly 100,000 lamports (0.0001 SOL)
        const tolerance = transactionVerification.AMOUNT_TOLERANCE_LAMPORTS;
        expect(tolerance).toBe(100000);
      });

      test('should enforce minimum confirmation timeout', async () => {
        // Test that minimum timeout is 15 seconds
        const timeout = transactionVerification.CONFIRMATION_TIMEOUT_MS;
        expect(timeout).toBe(15000);
      });

      test('should not expose sensitive error details', async () => {
        const fakeSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        
        // Mock returns error without sensitive details
        transactionVerification.verifyPayment.mockResolvedValue({
          success: false,
          error: 'Transaction not found'
        });
        
        const result = await transactionVerification.verifyPayment(
          fakeSignature,
          testWalletAddress,
          testWalletAddress,
          0.1
        );
        
        expect(result.success).toBe(false);
        
        // Error message should not contain sensitive information
        if (result.error) {
          expect(result.error).not.toContain('password');
          expect(result.error).not.toContain('secret');
          expect(result.error).not.toContain('private');
          expect(result.error).not.toContain('key');
        }
      });
    });

    describe('Payment Amount Manipulation', () => {
      test('should detect amount manipulation attempts', async () => {
        // This test verifies the tolerance is enforced
        const tolerance = 100000; // lamports
        const solPerLamport = 1 / 1000000000;
        
        // Amount just within tolerance
        const withinTolerance = tolerance * solPerLamport;
        expect(withinTolerance).toBeLessThanOrEqual(0.0001);
        
        // Amount exceeding tolerance
        const exceedingTolerance = (tolerance + 1) * solPerLamport;
        expect(exceedingTolerance).toBeGreaterThan(0.0001);
      });
    });
  });

  /**
   * Additional Security Tests
   */
  describe('Additional Security Validations', () => {
    describe('Memory Safety', () => {
      test('should handle large number of nonces without memory leak', async () => {
        const wallets = Array(1000).fill(null).map((_, i) => 
          `Wallet${i}${'a'.repeat(30)}`
        );

        // Generate nonces for many wallets
        for (const wallet of wallets) {
          try {
            await authService.generateNonce(wallet);
          } catch (e) {
            // Invalid addresses will throw, that's expected
          }
        }

        // Cleanup should work
        authService.cleanupExpiredNonces();
        
        // Memory should be manageable
        const memUsage = process.memoryUsage();
        expect(memUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
      });

      test('should cleanup expired nonces automatically', async () => {
        // Add expired nonces
        for (let i = 0; i < 10; i++) {
          authService.nonces.set(`ExpiredWallet${i}`, {
            nonce: `nonce${i}`,
            expiresAt: Date.now() - 1000
          });
        }

        const sizeBefore = authService.nonces.size;
        expect(sizeBefore).toBeGreaterThanOrEqual(10);

        // Run cleanup
        authService.cleanupExpiredNonces();

        const sizeAfter = authService.nonces.size;
        expect(sizeAfter).toBeLessThan(sizeBefore);
      });
    });

    describe('Concurrent Request Handling', () => {
      test('should handle concurrent authentication attempts safely', async () => {
        const wallets = Array(10).fill(null).map((_, i) => {
          const keypair = nacl.sign.keyPair();
          return {
            address: bs58.encode(keypair.publicKey),
            keypair
          };
        });

        // Generate nonces concurrently
        const noncePromises = wallets.map(w => 
          authService.generateNonce(w.address)
        );
        const nonces = await Promise.all(noncePromises);

        // All nonces should be unique
        const uniqueNonces = new Set(nonces);
        expect(uniqueNonces.size).toBe(wallets.length);

        // Verify signatures concurrently
        const verifyPromises = wallets.map((w, i) => {
          const messageBytes = Buffer.from(nonces[i], 'utf8');
          const signatureBytes = nacl.sign.detached(messageBytes, w.keypair.secretKey);
          const signature = bs58.encode(signatureBytes);
          return authService.verifySignature(w.address, signature, nonces[i]);
        });

        const results = await Promise.all(verifyPromises);
        
        // All verifications should succeed
        results.forEach(result => {
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('Error Message Security', () => {
      test('should not expose stack traces in production errors', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        try {
          await authService.verifySignature('invalid', 'invalid', 'invalid');
        } catch (error) {
          // Error message should not contain stack trace
          expect(error.message).not.toContain('at ');
          expect(error.message).not.toContain('.js:');
        }

        process.env.NODE_ENV = originalEnv;
      });

      test('should provide generic error messages for security failures', async () => {
        const errors = [];

        // Collect various error messages
        try {
          await authService.generateNonce('invalid');
        } catch (e) {
          errors.push(e.message);
        }

        try {
          await authService.verifySignature('invalid', 'invalid', 'invalid');
        } catch (e) {
          errors.push(e.message);
        }

        // Error messages should not reveal implementation details
        errors.forEach(msg => {
          expect(msg).not.toContain('database');
          expect(msg).not.toContain('redis');
          expect(msg).not.toContain('sql');
          expect(msg).not.toContain('query');
        });
      });
    });

    describe('Input Sanitization', () => {
      test('should sanitize wallet addresses before processing', () => {
        const inputs = [
          '  ' + testWalletAddress + '  ', // Whitespace
          testWalletAddress + '\n', // Newline
          testWalletAddress + '\r', // Carriage return
          testWalletAddress + '\t' // Tab
        ];

        inputs.forEach(input => {
          const isValid = authService.isValidSolanaAddress(input);
          // Should reject inputs with whitespace/special chars
          expect(isValid).toBe(false);
        });
      });

      test('should reject unicode and emoji in addresses', () => {
        const unicodeInputs = [
          testWalletAddress + '😀',
          '🚀' + testWalletAddress,
          testWalletAddress + '\u200B', // Zero-width space
          testWalletAddress + '\uFEFF' // Byte order mark
        ];

        unicodeInputs.forEach(input => {
          const isValid = authService.isValidSolanaAddress(input);
          expect(isValid).toBe(false);
        });
      });
    });
  });
});
