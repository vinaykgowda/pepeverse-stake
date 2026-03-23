/**
 * Authentication Service
 * 
 * Handles wallet-based authentication with nonce generation and signature verification.
 * Uses in-memory storage for nonce management with 5-minute TTL.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

const crypto = require('crypto');
const bs58 = require('bs58');
const nacl = require('tweetnacl');

class AuthService {
  constructor() {
    this.NONCE_TTL = 300; // 5 minutes in seconds
    
    // In-memory nonce storage: Map<walletAddress, {nonce, expiresAt}>
    this.nonces = new Map();
    
    // Start automatic cleanup of expired nonces every minute
    this.cleanupInterval = setInterval(() => this.cleanupExpiredNonces(), 60000);
  }

  /**
   * Initialize the auth service
   * Already initialized in constructor with in-memory Map
   */
  async initialize() {
    // In-memory storage is initialized in constructor
    console.log('AuthService initialized with in-memory nonce storage');
  }

  /**
   * Clean up expired nonces from memory
   * Runs automatically every minute via setInterval
   */
  cleanupExpiredNonces() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [walletAddress, data] of this.nonces.entries()) {
      if (now > data.expiresAt) {
        this.nonces.delete(walletAddress);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired nonces`);
    }
  }

  /**
   * Stop the cleanup interval (for testing or shutdown)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Validate Solana wallet address format
   * @param {string} address - Wallet address to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  isValidSolanaAddress(address) {
    if (!address || typeof address !== 'string') {
      return false;
    }

    // Solana addresses are base58 encoded and 32-44 characters
    if (address.length < 32 || address.length > 44) {
      return false;
    }

    try {
      const decoded = bs58.decode(address);
      // Solana public keys are exactly 32 bytes
      return decoded.length === 32;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a cryptographically secure nonce for wallet authentication
   * @param {string} walletAddress - The wallet address requesting a nonce
   * @returns {Promise<string>} - The generated nonce
   * @throws {Error} - If wallet address is invalid or storage operation fails
   */
  async generateNonce(walletAddress) {
    // Validate wallet address format before generating nonce
    if (!this.isValidSolanaAddress(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    // Generate cryptographically secure random nonce (32 bytes)
    const nonceBytes = crypto.randomBytes(32);
    const nonce = nonceBytes.toString('base64');
    
    // Calculate expiration time (5 minutes from now)
    const expiresAt = Date.now() + (this.NONCE_TTL * 1000);
    
    // Store in memory with expiration timestamp
    this.nonces.set(walletAddress, { nonce, expiresAt });

    console.log(`Nonce generated for wallet: ${walletAddress.substring(0, 8)}... (expires in ${this.NONCE_TTL}s)`);
    return nonce;
  }

  /**
   * Retrieve a nonce from storage
   * @param {string} walletAddress - The wallet address
   * @returns {Promise<string|null>} - The nonce if found and not expired, null otherwise
   */
  async getNonce(walletAddress) {
    const stored = this.nonces.get(walletAddress);
    
    if (!stored) {
      return null;
    }
    
    // Check if nonce has expired
    if (Date.now() > stored.expiresAt) {
      this.nonces.delete(walletAddress);
      return null;
    }
    
    return stored.nonce;
  }

  /**
   * Delete a nonce from storage (for single-use enforcement)
   * @param {string} walletAddress - The wallet address
   * @returns {Promise<boolean>} - True if deleted, false otherwise
   */
  async deleteNonce(walletAddress) {
    return this.nonces.delete(walletAddress);
  }

  /**
   * Check if a nonce exists for a wallet address
   * @param {string} walletAddress - The wallet address
   * @returns {Promise<boolean>} - True if nonce exists and not expired, false otherwise
   */
  async hasNonce(walletAddress) {
    const nonce = await this.getNonce(walletAddress);
    return nonce !== null;
  }

  /**
   * Get remaining TTL for a nonce
   * @param {string} walletAddress - The wallet address
   * @returns {Promise<number>} - Remaining TTL in seconds, -2 if key doesn't exist, -1 if no expiry
   */
  async getNonceTTL(walletAddress) {
    const stored = this.nonces.get(walletAddress);
    
    if (!stored) {
      return -2; // Key doesn't exist
    }
    
    const now = Date.now();
    
    // Check if already expired
    if (now > stored.expiresAt) {
      this.nonces.delete(walletAddress);
      return -2;
    }
    
    // Calculate remaining TTL in seconds
    const remainingMs = stored.expiresAt - now;
    return Math.ceil(remainingMs / 1000);
  }

  /**
   * Verify a signature against a wallet's public key and validate nonce
   * @param {string} walletAddress - The wallet address (public key)
   * @param {string} signature - The base58 encoded signature
   * @param {string} message - The message that was signed (should be the nonce)
   * @returns {Promise<{valid: boolean, walletAddress: string}>} - Verification result with wallet address
   * @throws {Error} - If validation fails or nonce issues occur
   * 
   * Requirements: 6.3, 6.4
   */
  async verifySignature(walletAddress, signature, message) {
    // Validate wallet address format
    if (!this.isValidSolanaAddress(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    // Retrieve nonce from storage (will be implemented in task 5.1)
    const storedNonce = await this.getNonce(walletAddress);
    
    if (!storedNonce) {
      throw new Error('Nonce not found or expired');
    }

    // Validate that the message matches the stored nonce
    if (storedNonce !== message) {
      throw new Error('Nonce mismatch');
    }

    // Decode the wallet address (public key) from base58
    let publicKeyBytes;
    try {
      publicKeyBytes = bs58.decode(walletAddress);
      if (publicKeyBytes.length !== 32) {
        throw new Error('Invalid public key length');
      }
    } catch (error) {
      throw new Error('Invalid wallet address encoding');
    }

    // Decode the signature — accept base58 (standard) or base64 (legacy)
    let signatureBytes;
    try {
      // Try base58 first (standard Solana encoding)
      const decoded = bs58.decode(signature);
      if (decoded.length === 64) {
        signatureBytes = decoded;
      } else {
        // Fall back to base64
        const buf = Buffer.from(signature, 'base64');
        if (buf.length !== 64) throw new Error('wrong length');
        signatureBytes = buf;
      }
    } catch (error) {
      throw new Error('Invalid signature encoding');
    }
    
    // Convert message to bytes
    const messageBytes = Buffer.from(message, 'utf8');

    // Verify the Ed25519 signature
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Delete the nonce to prevent replay attacks (single use)
    await this.deleteNonce(walletAddress);
    
    console.log(`Signature verified for wallet: ${walletAddress.substring(0, 8)}...`);

    return {
      valid: true,
      walletAddress: walletAddress
    };
  }
}

// Export singleton instance
const authService = new AuthService();
module.exports = authService;
