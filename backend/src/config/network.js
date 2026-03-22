/**
 * Network Configuration Module
 * 
 * Centralized network configuration for Solana mainnet connections.
 * All RPC endpoints and network-related settings are defined here.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

class NetworkConfig {
  constructor() {
    // Mainnet RPC endpoints
    this.mainnetRpcPrimary = process.env.MAINNET_RPC_PRIMARY;
    this.mainnetRpcFallback = process.env.MAINNET_RPC_FALLBACK;
    
    // Helius mainnet endpoint
    this.heliusMainnetEndpoint = process.env.HELIUS_MAINNET_ENDPOINT;
    
    // Network identifier - NO FALLBACK, must be explicitly set
    this.network = process.env.SOLANA_NETWORK;
    if (!this.network) {
      throw new Error('SOLANA_NETWORK environment variable is required');
    }
    
    // Mainnet explorer URL
    this.explorerUrl = 'https://explorer.solana.com';
    
    // Validate configuration on initialization
    this._validateConfig();
  }
  
  /**
   * Validate that all required network configuration is present
   * @private
   */
  _validateConfig() {
    const missing = [];
    
    if (!this.mainnetRpcPrimary) {
      missing.push('MAINNET_RPC_PRIMARY');
    }
    
    if (!this.mainnetRpcFallback) {
      missing.push('MAINNET_RPC_FALLBACK');
    }
    
    if (!this.heliusMainnetEndpoint) {
      missing.push('HELIUS_MAINNET_ENDPOINT');
    }
    
    if (missing.length > 0) {
      throw new Error(
        `Missing required network configuration: ${missing.join(', ')}\n` +
        'Please ensure all required environment variables are set in Vercel.'
      );
    }
    
    // Validate network is set to mainnet
    if (this.network !== 'mainnet') {
      console.warn(
        `Warning: SOLANA_NETWORK is set to "${this.network}" but should be "mainnet" for production`
      );
    }
  }
  
  /**
   * Get the primary mainnet RPC endpoint
   * @returns {string} Primary RPC endpoint URL
   */
  getPrimaryRpc() {
    return this.mainnetRpcPrimary;
  }
  
  /**
   * Get the fallback mainnet RPC endpoint
   * @returns {string} Fallback RPC endpoint URL
   */
  getFallbackRpc() {
    return this.mainnetRpcFallback;
  }
  
  /**
   * Get the Helius mainnet endpoint
   * @returns {string} Helius endpoint URL
   */
  getHeliusEndpoint() {
    return this.heliusMainnetEndpoint;
  }
  
  /**
   * Get the network identifier
   * @returns {string} Network name (should be 'mainnet')
   */
  getNetwork() {
    return this.network;
  }
  
  /**
   * Get the Solana explorer base URL
   * @returns {string} Explorer URL
   */
  getExplorerUrl() {
    return this.explorerUrl;
  }
  
  /**
   * Get the full explorer URL for a transaction
   * @param {string} signature - Transaction signature
   * @returns {string} Full explorer URL for the transaction
   */
  getTransactionUrl(signature) {
    return `${this.explorerUrl}/tx/${signature}`;
  }
  
  /**
   * Get the full explorer URL for an address
   * @param {string} address - Wallet or account address
   * @returns {string} Full explorer URL for the address
   */
  getAddressUrl(address) {
    return `${this.explorerUrl}/address/${address}`;
  }
  
  /**
   * Check if the configuration is for mainnet
   * @returns {boolean} True if configured for mainnet
   */
  isMainnet() {
    return this.network === 'mainnet';
  }
  
  /**
   * Get all network configuration as an object
   * @returns {Object} Complete network configuration
   */
  getConfig() {
    return {
      network: this.network,
      rpc: {
        primary: this.mainnetRpcPrimary,
        fallback: this.mainnetRpcFallback
      },
      helius: {
        endpoint: this.heliusMainnetEndpoint
      },
      explorer: {
        baseUrl: this.explorerUrl
      }
    };
  }
  
  /**
   * Validate network connectivity on startup
   * Tests that all configured endpoints are reachable
   * @returns {Promise<Object>} Validation results with status for each endpoint
   * @throws {Error} If critical endpoints are unreachable
   */
  async validateConnectivity() {
    const { Connection } = require('@solana/web3.js');
    const axios = require('axios');
    
    const results = {
      primaryRpc: { url: this.mainnetRpcPrimary, status: 'unknown', error: null },
      fallbackRpc: { url: this.mainnetRpcFallback, status: 'unknown', error: null },
      helius: { url: this.heliusMainnetEndpoint, status: 'unknown', error: null }
    };
    
    // Test primary RPC
    try {
      const primaryConnection = new Connection(this.mainnetRpcPrimary, 'confirmed');
      await primaryConnection.getSlot();
      results.primaryRpc.status = 'healthy';
    } catch (error) {
      results.primaryRpc.status = 'unhealthy';
      results.primaryRpc.error = error.message;
    }
    
    // Test fallback RPC
    try {
      const fallbackConnection = new Connection(this.mainnetRpcFallback, 'confirmed');
      await fallbackConnection.getSlot();
      results.fallbackRpc.status = 'healthy';
    } catch (error) {
      results.fallbackRpc.status = 'unhealthy';
      results.fallbackRpc.error = error.message;
    }
    
    // Test Helius endpoint
    try {
      const response = await axios.post(
        this.heliusMainnetEndpoint,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth'
        },
        { timeout: 10000 }
      );
      
      if (response.status === 200) {
        results.helius.status = 'healthy';
      } else {
        results.helius.status = 'unhealthy';
        results.helius.error = `Unexpected status code: ${response.status}`;
      }
    } catch (error) {
      results.helius.status = 'unhealthy';
      results.helius.error = error.message;
    }
    
    // Check if at least one RPC endpoint is healthy
    const hasHealthyRpc = results.primaryRpc.status === 'healthy' || 
                          results.fallbackRpc.status === 'healthy';
    
    if (!hasHealthyRpc) {
      throw new Error(
        'CRITICAL: No healthy RPC endpoints available.\n' +
        `Primary RPC (${this.mainnetRpcPrimary}): ${results.primaryRpc.error}\n` +
        `Fallback RPC (${this.mainnetRpcFallback}): ${results.fallbackRpc.error}\n` +
        'Cannot start server without at least one working RPC endpoint.'
      );
    }
    
    // Warn if Helius is unhealthy but don't fail startup
    if (results.helius.status === 'unhealthy') {
      console.warn(
        `WARNING: Helius endpoint is unhealthy (${this.heliusMainnetEndpoint}): ${results.helius.error}\n` +
        'Some NFT-related features may not work correctly.'
      );
    }
    
    // Warn if primary RPC is unhealthy
    if (results.primaryRpc.status === 'unhealthy') {
      console.warn(
        `WARNING: Primary RPC endpoint is unhealthy (${this.mainnetRpcPrimary}): ${results.primaryRpc.error}\n` +
        'Falling back to secondary RPC endpoint.'
      );
    }
    
    return results;
  }
}

// Export singleton instance
module.exports = new NetworkConfig();
