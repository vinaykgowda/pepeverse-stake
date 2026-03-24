/**
 * Frontend Network Configuration Module
 * 
 * Centralized network configuration for Solana mainnet connections.
 * All RPC endpoints and network-related settings are defined here.
 * 
 * Requirements: 2.1, 2.4
 */

class NetworkConfig {
  constructor() {
    // Mainnet RPC endpoint from environment variable
    this.rpcEndpoint = import.meta.env.VITE_SOLANA_RPC_URL;
    
    // Mainnet explorer URL
    this.explorerUrl = 'https://explorer.solana.com';
    
    // Network identifier
    this.network = 'mainnet-beta';
    
    // Validate configuration on initialization
    this._validateConfig();
  }
  
  /**
   * Validate that all required network configuration is present
   * @private
   */
  _validateConfig() {
    if (!this.rpcEndpoint) {
      // Not required anymore — RPC calls are proxied through the backend
      console.warn('VITE_SOLANA_RPC_URL is not set. RPC calls will be routed through the backend proxy.');
      this.rpcEndpoint = 'https://api.mainnet-beta.solana.com'; // fallback, not used directly
    }
    
    if (this.rpcEndpoint.includes('devnet')) {
      console.warn('⚠️ WARNING: Using devnet RPC endpoint.');
    }
  }
  
  /**
   * Get the mainnet RPC endpoint
   * @returns {string} RPC endpoint URL
   */
  getRpcEndpoint() {
    return this.rpcEndpoint;
  }
  
  /**
   * Get the network identifier
   * @returns {string} Network name
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
    return !this.rpcEndpoint.includes('devnet') && 
           !this.rpcEndpoint.includes('testnet');
  }
  
  /**
   * Get all network configuration as an object
   * @returns {Object} Complete network configuration
   */
  getConfig() {
    return {
      network: this.network,
      rpcEndpoint: this.rpcEndpoint,
      explorerUrl: this.explorerUrl,
      isMainnet: this.isMainnet()
    };
  }
}

// Export singleton instance
export default new NetworkConfig();
