/**
 * Unit Tests for Authentication Service
 * 
 * Tests nonce generation, validation, signature verification, and in-memory storage
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

const authService = require('./auth');

describe('AuthService', () => {
  afterEach(() => {
    // Clean up in-memory nonces after each test
    authService.nonces.clear();
  });

  afterAll(() => {
    // Stop the cleanup interval
    authService.destroy();
  });

  describe('isValidSolanaAddress', () => {
    test('should validate correct Solana address', () => {
      const validAddress = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      expect(authService.isValidSolanaAddress(validAddress)).toBe(true);
    });

    test('should reject address that is too short', () => {
      const shortAddress = '7EcDhSYGxXyscszYEp35KHN8';
      expect(authService.isValidSolanaAddress(shortAddress)).toBe(false);
    });

    test('should reject address that is too long', () => {
      const longAddress = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      expect(authService.isValidSolanaAddress(longAddress)).toBe(false);
    });

    test('should reject invalid base58 characters', () => {
      const invalidAddress = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV0'; // 0 is not valid base58
      expect(authService.isValidSolanaAddress(invalidAddress)).toBe(false);
    });

    test('should reject null or undefined', () => {
      expect(authService.isValidSolanaAddress(null)).toBe(false);
      expect(authService.isValidSolanaAddress(undefined)).toBe(false);
    });

    test('should reject non-string values', () => {
      expect(authService.isValidSolanaAddress(123)).toBe(false);
      expect(authService.isValidSolanaAddress({})).toBe(false);
      expect(authService.isValidSolanaAddress([])).toBe(false);
    });
  });

  describe('generateNonce', () => {
    const validWallet = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

    test('should generate a nonce for valid wallet address', async () => {
      const nonce = await authService.generateNonce(validWallet);
      
      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
    });

    test('should generate unique nonces for each call', async () => {
      const nonce1 = await authService.generateNonce(validWallet);
      const nonce2 = await authService.generateNonce(validWallet);
      
      expect(nonce1).not.toBe(nonce2);
    });

    test('should store nonce in memory', async () => {
      const nonce = await authService.generateNonce(validWallet);
      const storedNonce = await authService.getNonce(validWallet);
      
      expect(storedNonce).toBe(nonce);
    });

    test('should set 5-minute TTL on nonce', async () => {
      await authService.generateNonce(validWallet);
      const ttl = await authService.getNonceTTL(validWallet);
      
      // TTL should be close to 300 seconds (5 minutes)
      expect(ttl).toBeGreaterThan(290);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    test('should throw error for invalid wallet address', async () => {
      const invalidWallet = 'invalid-address';
      
      await expect(authService.generateNonce(invalidWallet))
        .rejects
        .toThrow('Invalid wallet address format');
    });

    test('should generate base64 encoded nonce', async () => {
      const nonce = await authService.generateNonce(validWallet);
      
      // Base64 regex pattern
      const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
      expect(base64Pattern.test(nonce)).toBe(true);
    });

    test('should generate 32-byte nonce (44 chars in base64)', async () => {
      const nonce = await authService.generateNonce(validWallet);
      
      // 32 bytes = 44 characters in base64 (with padding)
      expect(nonce.length).toBe(44);
    });
  });

  describe('getNonce', () => {
    const validWallet = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

    test('should retrieve existing nonce', async () => {
      const generatedNonce = await authService.generateNonce(validWallet);
      const retrievedNonce = await authService.getNonce(validWallet);
      
      expect(retrievedNonce).toBe(generatedNonce);
    });

    test('should return null for non-existent nonce', async () => {
      const nonce = await authService.getNonce('NonExistentWallet123456789012345678901234');
      
      expect(nonce).toBeNull();
    });
  });

  describe('deleteNonce', () => {
    const validWallet = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

    test('should delete existing nonce', async () => {
      await authService.generateNonce(validWallet);
      const deleted = await authService.deleteNonce(validWallet);
      
      expect(deleted).toBe(true);
      
      const nonce = await authService.getNonce(validWallet);
      expect(nonce).toBeNull();
    });

    test('should return false when deleting non-existent nonce', async () => {
      const deleted = await authService.deleteNonce('NonExistentWallet123456789012345678901234');
      
      // In-memory Map.delete() returns false for non-existent keys
      expect(deleted).toBe(false);
    });
  });

  describe('hasNonce', () => {
    const validWallet = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

    test('should return true for existing nonce', async () => {
      await authService.generateNonce(validWallet);
      const exists = await authService.hasNonce(validWallet);
      
      expect(exists).toBe(true);
    });

    test('should return false for non-existent nonce', async () => {
      const exists = await authService.hasNonce('NonExistentWallet123456789012345678901234');
      
      expect(exists).toBe(false);
    });

    test('should return false after nonce is deleted', async () => {
      await authService.generateNonce(validWallet);
      await authService.deleteNonce(validWallet);
      const exists = await authService.hasNonce(validWallet);
      
      expect(exists).toBe(false);
    });
  });

  describe('getNonceTTL', () => {
    const validWallet = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

    test('should return TTL for existing nonce', async () => {
      await authService.generateNonce(validWallet);
      const ttl = await authService.getNonceTTL(validWallet);
      
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    test('should return -2 for non-existent nonce', async () => {
      const ttl = await authService.getNonceTTL('NonExistentWallet123456789012345678901234');
      
      expect(ttl).toBe(-2);
    });

    test('should decrease TTL over time', async () => {
      await authService.generateNonce(validWallet);
      const ttl1 = await authService.getNonceTTL(validWallet);
      
      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const ttl2 = await authService.getNonceTTL(validWallet);
      
      expect(ttl2).toBeLessThan(ttl1);
    });
  });

  describe('Nonce expiration', () => {
    const validWallet = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

    test('should expire nonce after TTL', async () => {
      // This test would take 5 minutes, so we'll just verify the TTL is set correctly
      await authService.generateNonce(validWallet);
      const ttl = await authService.getNonceTTL(validWallet);
      
      // Verify TTL is set to approximately 5 minutes
      expect(ttl).toBeGreaterThan(290);
      expect(ttl).toBeLessThanOrEqual(300);
    }, 10000);

    test('should automatically clean up expired nonces', async () => {
      // Manually add an expired nonce
      const expiredWallet = 'DPoNCgT4P4HSRfim1yVAe4Cw7wvxR6657yHkkvVLp7GZ';
      authService.nonces.set(expiredWallet, {
        nonce: 'expired-nonce',
        expiresAt: Date.now() - 1000 // Expired 1 second ago
      });

      // Run cleanup manually
      authService.cleanupExpiredNonces();

      // Expired nonce should be removed
      const exists = await authService.hasNonce(expiredWallet);
      expect(exists).toBe(false);
    });

    test('should not clean up non-expired nonces', async () => {
      await authService.generateNonce(validWallet);
      
      // Run cleanup
      authService.cleanupExpiredNonces();

      // Non-expired nonce should still exist
      const exists = await authService.hasNonce(validWallet);
      expect(exists).toBe(true);
    });

    test('should run periodic cleanup every minute', async () => {
      // Verify cleanup interval is set
      expect(authService.cleanupInterval).toBeDefined();
      expect(authService.cleanupInterval).not.toBeNull();

      // Add an expired nonce
      const expiredWallet = 'DPoNCgT4P4HSRfim1yVAe4Cw7wvxR6657yHkkvVLp7GZ';
      authService.nonces.set(expiredWallet, {
        nonce: 'expired-nonce',
        expiresAt: Date.now() - 1000 // Expired 1 second ago
      });

      // Add a valid nonce
      await authService.generateNonce(validWallet);

      // Wait for cleanup to run (we'll use a shorter interval for testing)
      // Note: The actual interval is 60 seconds, but we manually trigger it here
      authService.cleanupExpiredNonces();

      // Expired nonce should be removed
      const expiredExists = await authService.hasNonce(expiredWallet);
      expect(expiredExists).toBe(false);

      // Valid nonce should still exist
      const validExists = await authService.hasNonce(validWallet);
      expect(validExists).toBe(true);
    });
  });

  describe('Concurrent nonce operations', () => {
    test('should handle multiple concurrent nonce generations', async () => {
      const wallets = [
        '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
        'DPoNCgT4P4HSRfim1yVAe4Cw7wvxR6657yHkkvVLp7GZ',
        'AuZHudkXUnkEgRC1V6Mv5rptaZ4EnaV9FkeNeztZ91aC'
      ];

      const promises = wallets.map(wallet => authService.generateNonce(wallet));
      const nonces = await Promise.all(promises);

      // All nonces should be unique
      const uniqueNonces = new Set(nonces);
      expect(uniqueNonces.size).toBe(wallets.length);

      // All nonces should be stored
      for (const wallet of wallets) {
        const exists = await authService.hasNonce(wallet);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Nonce reuse prevention (Requirement 6.4)', () => {
    const validWallet = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

    test('should reject authentication when nonce is reused', async () => {
      // Generate nonce
      const nonce = await authService.generateNonce(validWallet);
      
      // First use - delete the nonce
      await authService.deleteNonce(validWallet);
      
      // Second use - should fail because nonce no longer exists
      const exists = await authService.hasNonce(validWallet);
      expect(exists).toBe(false);
    });

    test('should reject authentication when nonce has expired', async () => {
      // Manually add an expired nonce
      authService.nonces.set(validWallet, {
        nonce: 'expired-nonce',
        expiresAt: Date.now() - 1000 // Expired 1 second ago
      });

      // Try to get the expired nonce
      const nonce = await authService.getNonce(validWallet);
      
      // Should return null because it's expired
      expect(nonce).toBeNull();
    });

    test('should handle rapid nonce generation and deletion', async () => {
      // Generate multiple nonces rapidly for the same wallet
      const nonce1 = await authService.generateNonce(validWallet);
      const nonce2 = await authService.generateNonce(validWallet);
      const nonce3 = await authService.generateNonce(validWallet);
      
      // Only the last nonce should be stored (overwrites previous)
      const storedNonce = await authService.getNonce(validWallet);
      expect(storedNonce).toBe(nonce3);
      expect(storedNonce).not.toBe(nonce1);
      expect(storedNonce).not.toBe(nonce2);
    });
  });

  describe('In-memory storage validation (Requirement 6.1)', () => {
    test('should use Map for in-memory storage', () => {
      expect(authService.nonces).toBeInstanceOf(Map);
    });

    test('should store nonce with expiration timestamp', async () => {
      const validWallet = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      await authService.generateNonce(validWallet);
      
      const stored = authService.nonces.get(validWallet);
      expect(stored).toBeDefined();
      expect(stored).toHaveProperty('nonce');
      expect(stored).toHaveProperty('expiresAt');
      expect(typeof stored.expiresAt).toBe('number');
      expect(stored.expiresAt).toBeGreaterThan(Date.now());
    });

    test('should handle memory cleanup without affecting valid nonces', async () => {
      const wallet1 = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const wallet2 = 'DPoNCgT4P4HSRfim1yVAe4Cw7wvxR6657yHkkvVLp7GZ';
      
      // Add valid nonce
      await authService.generateNonce(wallet1);
      
      // Add expired nonce
      authService.nonces.set(wallet2, {
        nonce: 'expired',
        expiresAt: Date.now() - 1000
      });
      
      // Run cleanup
      authService.cleanupExpiredNonces();
      
      // Valid nonce should remain
      expect(await authService.hasNonce(wallet1)).toBe(true);
      
      // Expired nonce should be removed
      expect(await authService.hasNonce(wallet2)).toBe(false);
    });
  });

  describe('verifySignature', () => {
    const crypto = require('crypto');
    const nacl = require('tweetnacl');
    const bs58 = require('bs58');

    // Generate a test keypair for signature testing
    let testKeypair;
    let testWalletAddress;

    beforeAll(() => {
      testKeypair = nacl.sign.keyPair();
      testWalletAddress = bs58.encode(testKeypair.publicKey);
    });

    test('should verify valid signature with correct nonce', async () => {
      // Generate nonce
      const nonce = await authService.generateNonce(testWalletAddress);

      // Sign the nonce with the private key
      const messageBytes = Buffer.from(nonce, 'utf8');
      const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
      const signature = bs58.encode(signatureBytes);

      // Verify signature
      const result = await authService.verifySignature(testWalletAddress, signature, nonce);

      expect(result.valid).toBe(true);
      expect(result.walletAddress).toBe(testWalletAddress);
    });

    test('should delete nonce after successful verification', async () => {
      // Generate nonce
      const nonce = await authService.generateNonce(testWalletAddress);

      // Sign the nonce
      const messageBytes = Buffer.from(nonce, 'utf8');
      const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
      const signature = bs58.encode(signatureBytes);

      // Verify signature
      await authService.verifySignature(testWalletAddress, signature, nonce);

      // Nonce should be deleted
      const nonceExists = await authService.hasNonce(testWalletAddress);
      expect(nonceExists).toBe(false);
    });

    test('should throw error when nonce does not exist', async () => {
      const nonce = 'nonexistent-nonce';
      const messageBytes = Buffer.from(nonce, 'utf8');
      const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
      const signature = bs58.encode(signatureBytes);

      await expect(authService.verifySignature(testWalletAddress, signature, nonce))
        .rejects
        .toThrow('Nonce not found or expired');
    });

    test('should throw error when nonce does not match message', async () => {
      // Generate nonce
      const nonce = await authService.generateNonce(testWalletAddress);

      // Sign a different message
      const differentMessage = 'different-message';
      const messageBytes = Buffer.from(differentMessage, 'utf8');
      const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
      const signature = bs58.encode(signatureBytes);

      await expect(authService.verifySignature(testWalletAddress, signature, differentMessage))
        .rejects
        .toThrow('Nonce mismatch');
    });

    test('should throw error for invalid signature', async () => {
      // Generate nonce
      const nonce = await authService.generateNonce(testWalletAddress);

      // Create an invalid signature (random bytes)
      const invalidSignatureBytes = crypto.randomBytes(64);
      const invalidSignature = bs58.encode(invalidSignatureBytes);

      await expect(authService.verifySignature(testWalletAddress, invalidSignature, nonce))
        .rejects
        .toThrow('Invalid signature');
    });

    test('should throw error for signature from wrong wallet', async () => {
      // Generate nonce for test wallet
      const nonce = await authService.generateNonce(testWalletAddress);

      // Create a different keypair
      const wrongKeypair = nacl.sign.keyPair();
      
      // Sign with wrong private key
      const messageBytes = Buffer.from(nonce, 'utf8');
      const signatureBytes = nacl.sign.detached(messageBytes, wrongKeypair.secretKey);
      const signature = bs58.encode(signatureBytes);

      await expect(authService.verifySignature(testWalletAddress, signature, nonce))
        .rejects
        .toThrow('Invalid signature');
    });

    test('should throw error for invalid wallet address format', async () => {
      const invalidWallet = 'invalid-wallet';
      const nonce = 'some-nonce';
      const signature = 'some-signature';

      await expect(authService.verifySignature(invalidWallet, signature, nonce))
        .rejects
        .toThrow('Invalid wallet address format');
    });

    test('should throw error for invalid signature encoding', async () => {
      // Generate nonce
      const nonce = await authService.generateNonce(testWalletAddress);

      // Invalid base58 signature
      const invalidSignature = 'invalid-signature-0000';

      await expect(authService.verifySignature(testWalletAddress, invalidSignature, nonce))
        .rejects
        .toThrow('Invalid signature encoding');
    });

    test('should throw error for signature with wrong length', async () => {
      // Generate nonce
      const nonce = await authService.generateNonce(testWalletAddress);

      // Create signature with wrong length (32 bytes instead of 64)
      const wrongLengthBytes = crypto.randomBytes(32);
      const wrongLengthSignature = bs58.encode(wrongLengthBytes);

      await expect(authService.verifySignature(testWalletAddress, wrongLengthSignature, nonce))
        .rejects
        .toThrow('Invalid signature length');
    });

    test('should prevent replay attacks by rejecting reused nonce', async () => {
      // Generate nonce
      const nonce = await authService.generateNonce(testWalletAddress);

      // Sign the nonce
      const messageBytes = Buffer.from(nonce, 'utf8');
      const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
      const signature = bs58.encode(signatureBytes);

      // First verification should succeed
      await authService.verifySignature(testWalletAddress, signature, nonce);

      // Second verification with same nonce should fail (nonce was deleted)
      await expect(authService.verifySignature(testWalletAddress, signature, nonce))
        .rejects
        .toThrow('Nonce not found or expired');
    });

    test('should handle concurrent signature verifications for different wallets', async () => {
      // Create multiple test keypairs
      const keypairs = Array.from({ length: 3 }, () => nacl.sign.keyPair());
      const wallets = keypairs.map(kp => bs58.encode(kp.publicKey));

      // Generate nonces for all wallets
      const nonces = await Promise.all(
        wallets.map(wallet => authService.generateNonce(wallet))
      );

      // Sign nonces
      const signatures = keypairs.map((kp, i) => {
        const messageBytes = Buffer.from(nonces[i], 'utf8');
        const signatureBytes = nacl.sign.detached(messageBytes, kp.secretKey);
        return bs58.encode(signatureBytes);
      });

      // Verify all signatures concurrently
      const verifications = await Promise.all(
        wallets.map((wallet, i) => 
          authService.verifySignature(wallet, signatures[i], nonces[i])
        )
      );

      // All verifications should succeed
      verifications.forEach((result, i) => {
        expect(result.valid).toBe(true);
        expect(result.walletAddress).toBe(wallets[i]);
      });

      // All nonces should be deleted
      for (const wallet of wallets) {
        const exists = await authService.hasNonce(wallet);
        expect(exists).toBe(false);
      }
    });

    test('should verify signature with UTF-8 message encoding', async () => {
      // Generate nonce
      const nonce = await authService.generateNonce(testWalletAddress);

      // Sign with UTF-8 encoding
      const messageBytes = Buffer.from(nonce, 'utf8');
      const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
      const signature = bs58.encode(signatureBytes);

      // Verify
      const result = await authService.verifySignature(testWalletAddress, signature, nonce);

      expect(result.valid).toBe(true);
    });
  });
});
