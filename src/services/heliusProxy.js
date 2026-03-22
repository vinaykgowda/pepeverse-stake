// backend/src/services/heliusProxy.js

const axios = require('axios');
const LRUCache = require('../utils/lruCache');

/**
 * Helius Proxy Service
 * 
 * Provides a backend proxy for Helius API calls with:
 * - In-memory LRU caching (10,000 entries, 1 hour TTL)
 * - Retry logic with exponential backoff
 * - Secure API key management
 * 
 * Requirements: 3.2, 11.2, 12.2, 12.3, 20.1, 20.2, 20.3, 20.4
 */
class HeliusProxyService {
  constructor() {
    this.apiKey = process.env.HELIUS_API_KEY;
    this.baseUrl = process.env.HELIUS_MAINNET_ENDPOINT;
    
    // Don't throw errors in constructor for serverless compatibility
    // Just log warnings and set disabled flag
    if (!this.apiKey) {
      console.warn('HELIUS_API_KEY environment variable is not set - Helius features will be disabled');
      this.disabled = true;
    }
    
    if (!this.baseUrl) {
      console.warn('HELIUS_MAINNET_ENDPOINT environment variable is not set - Helius features will be disabled');
      this.disabled = true;
    }
    
    // In-memory LRU cache: 10,000 entries, 1 hour TTL
    // Requirements: 20.1, 20.2, 20.3, 20.4
    this.cache = new LRUCache(10000, 60 * 60 * 1000);
    
    if (!this.disabled) {
      console.log('HeliusProxyService initialized with cache (10,000 entries, 1 hour TTL)');
    }
  }
  
  /**
   * Get NFTs owned by a wallet address
   * Requirement: 11.2
   * 
   * @param {string} ownerAddress - Wallet address
   * @param {object} options - Additional query options
   * @returns {Promise<object>} NFT data
   */
  async getAssetsByOwner(ownerAddress, options = {}) {
    if (this.disabled) {
      throw new Error('Helius service is not configured. Please set HELIUS_API_KEY and HELIUS_MAINNET_ENDPOINT environment variables.');
    }
    
    const cacheKey = `assets:${ownerAddress}:${JSON.stringify(options)}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for assets: ${ownerAddress}`);
      return cached;
    }
    
    console.log(`Cache miss for assets: ${ownerAddress}, fetching from Helius...`);
    
    // Call Helius API
    try {
      const response = await axios.post(
        `${this.baseUrl}`,
        {
          jsonrpc: '2.0',
          id: 'helius-proxy',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress,
            ...options
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          params: {
            'api-key': this.apiKey
          },
          timeout: 10000
        }
      );
      
      const data = response.data;
      
      if (data.error) {
        throw new Error(`Helius API error: ${data.error.message}`);
      }
      
      // Cache the result
      this.cache.set(cacheKey, data.result);
      
      return data.result;
    } catch (error) {
      console.error('Helius getAssetsByOwner error:', error.message);
      throw new Error(`Failed to fetch NFT data: ${error.message}`);
    }
  }
  
  /**
   * Get metadata for a specific NFT mint address
   * Includes retry logic with exponential backoff
   * Requirements: 12.2, 12.3
   * 
   * @param {string} mintAddress - NFT mint address
   * @returns {Promise<object>} NFT metadata
   */
  async getAssetMetadata(mintAddress) {
    if (this.disabled) {
      throw new Error('Helius service is not configured. Please set HELIUS_API_KEY and HELIUS_MAINNET_ENDPOINT environment variables.');
    }
    
    const cacheKey = `metadata:${mintAddress}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for metadata: ${mintAddress}`);
      return cached;
    }
    
    console.log(`Cache miss for metadata: ${mintAddress}, fetching from Helius...`);
    
    // Call Helius DAS API with retry (3 attempts with exponential backoff)
    // Requirement: 12.2, 12.3
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseUrl}`,
          {
            jsonrpc: '2.0',
            id: 'helius-proxy',
            method: 'getAsset',
            params: {
              id: mintAddress
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            params: {
              'api-key': this.apiKey
            },
            timeout: 10000
          }
        );
        
        const data = response.data;
        
        if (data.error) {
          throw new Error(`Helius API error: ${data.error.message}`);
        }
        
        if (!data.result) {
          throw new Error('Metadata not found');
        }
        
        // Cache the result
        this.cache.set(cacheKey, data.result);
        
        console.log(`Successfully fetched metadata for ${mintAddress} on attempt ${attempt + 1}`);
        return data.result;
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed for ${mintAddress}:`, error.message);
        
        if (attempt < 2) {
          // Exponential backoff: 1s, 2s
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    console.error(`Failed to fetch metadata for ${mintAddress} after 3 attempts`);
    throw new Error(`Failed to fetch metadata after 3 attempts: ${lastError.message}`);
  }
  
  /**
   * Clear the entire cache
   */
  clearCache() {
    this.cache.clear();
    console.log('Helius cache cleared');
  }
  
  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size(),
      maxSize: this.cache.maxSize,
      ttlMs: this.cache.ttlMs
    };
  }
}

// Export the class, not a singleton instance
// This prevents instantiation at import time in serverless environments
module.exports = HeliusProxyService;
