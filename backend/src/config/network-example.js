/**
 * Example usage of Network Configuration Module
 * 
 * This file demonstrates how to integrate the network configuration
 * into various parts of the application.
 */

const networkConfig = require('./network');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');

/**
 * Example 1: Create Solana connection with primary RPC
 */
function createSolanaConnection() {
  const connection = new Connection(
    networkConfig.getPrimaryRpc(),
    'confirmed'
  );
  
  console.log('✓ Solana connection created with primary RPC');
  return connection;
}

/**
 * Example 2: Create Solana connection with fallback RPC
 */
function createFallbackConnection() {
  const connection = new Connection(
    networkConfig.getFallbackRpc(),
    'confirmed'
  );
  
  console.log('✓ Fallback Solana connection created');
  return connection;
}

/**
 * Example 3: Initialize Helius client
 */
function createHeliusClient() {
  const heliusApiKey = process.env.HELIUS_API_KEY;
  
  if (!heliusApiKey) {
    throw new Error('HELIUS_API_KEY environment variable is required');
  }
  
  const client = axios.create({
    baseURL: networkConfig.getHeliusEndpoint(),
    headers: {
      'Authorization': `Bearer ${heliusApiKey}`
    },
    timeout: 10000
  });
  
  console.log('✓ Helius API client initialized');
  return client;
}

/**
 * Example 4: Get transaction with fallback
 */
async function getTransactionWithFallback(signature) {
  const primaryConnection = createSolanaConnection();
  const fallbackConnection = createFallbackConnection();
  
  try {
    console.log(`Fetching transaction ${signature} from primary RPC...`);
    const tx = await primaryConnection.getTransaction(signature);
    
    if (tx) {
      console.log('✓ Transaction fetched from primary RPC');
      return tx;
    }
  } catch (error) {
    console.warn('Primary RPC failed, trying fallback...', error.message);
  }
  
  try {
    const tx = await fallbackConnection.getTransaction(signature);
    console.log('✓ Transaction fetched from fallback RPC');
    return tx;
  } catch (error) {
    console.error('Both primary and fallback RPC failed:', error.message);
    throw new Error('Failed to fetch transaction from all RPC endpoints');
  }
}

/**
 * Example 5: Generate explorer URLs for API responses
 */
function formatTransactionResponse(signature, status) {
  return {
    signature,
    status,
    explorerUrl: networkConfig.getTransactionUrl(signature),
    network: networkConfig.getNetwork()
  };
}

/**
 * Example 6: Generate explorer URL for wallet address
 */
function formatWalletInfo(address, balance) {
  return {
    address,
    balance,
    explorerUrl: networkConfig.getAddressUrl(address),
    network: networkConfig.getNetwork()
  };
}

/**
 * Example 7: Validate network configuration on startup
 */
function validateNetworkConfig() {
  console.log('Validating network configuration...');
  
  const config = networkConfig.getConfig();
  
  console.log('Network Configuration:');
  console.log(`  Network: ${config.network}`);
  console.log(`  Primary RPC: ${config.rpc.primary}`);
  console.log(`  Fallback RPC: ${config.rpc.fallback}`);
  console.log(`  Helius Endpoint: ${config.helius.endpoint}`);
  console.log(`  Explorer: ${config.explorer.baseUrl}`);
  
  if (!networkConfig.isMainnet()) {
    console.warn('⚠ WARNING: Not configured for mainnet!');
    return false;
  }
  
  console.log('✓ Network configuration validated');
  return true;
}

/**
 * Example 8: Create a service class using network config
 */
class SolanaService {
  constructor() {
    this.primaryConnection = new Connection(
      networkConfig.getPrimaryRpc(),
      'confirmed'
    );
    
    this.fallbackConnection = new Connection(
      networkConfig.getFallbackRpc(),
      'confirmed'
    );
    
    console.log('✓ SolanaService initialized with network config');
  }
  
  async getBalance(address) {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.primaryConnection.getBalance(publicKey);
      
      return {
        address,
        balance,
        lamports: balance,
        sol: balance / 1e9,
        explorerUrl: networkConfig.getAddressUrl(address)
      };
    } catch (error) {
      console.warn('Primary RPC failed, trying fallback...');
      const publicKey = new PublicKey(address);
      const balance = await this.fallbackConnection.getBalance(publicKey);
      
      return {
        address,
        balance,
        lamports: balance,
        sol: balance / 1e9,
        explorerUrl: networkConfig.getAddressUrl(address)
      };
    }
  }
  
  async confirmTransaction(signature, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const confirmation = await this.primaryConnection.confirmTransaction(
          signature,
          'confirmed'
        );
        
        return {
          confirmed: !confirmation.value.err,
          signature,
          explorerUrl: networkConfig.getTransactionUrl(signature)
        };
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
}

/**
 * Example 9: Express route using network config
 */
function createStakeRoute() {
  return async (req, res) => {
    try {
      const { walletAddress, nftMint, signature } = req.body;
      
      // ... stake logic ...
      
      res.json({
        success: true,
        transaction: {
          signature,
          explorerUrl: networkConfig.getTransactionUrl(signature),
          network: networkConfig.getNetwork()
        },
        wallet: {
          address: walletAddress,
          explorerUrl: networkConfig.getAddressUrl(walletAddress)
        },
        nft: {
          mint: nftMint,
          explorerUrl: networkConfig.getAddressUrl(nftMint)
        }
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        network: networkConfig.getNetwork()
      });
    }
  };
}

/**
 * Example 10: Application startup with network validation
 */
async function startApplication() {
  console.log('Starting application...');
  
  try {
    // Validate network configuration
    console.log('\n1. Validating network configuration...');
    const isValid = validateNetworkConfig();
    
    if (!isValid) {
      throw new Error('Invalid network configuration');
    }
    
    // Create Solana connections
    console.log('\n2. Creating Solana connections...');
    const primaryConnection = createSolanaConnection();
    const fallbackConnection = createFallbackConnection();
    
    // Test primary connection
    console.log('\n3. Testing primary RPC connection...');
    const slot = await primaryConnection.getSlot();
    console.log(`✓ Primary RPC is responsive (current slot: ${slot})`);
    
    // Create Helius client
    console.log('\n4. Initializing Helius client...');
    const heliusClient = createHeliusClient();
    
    // Create service
    console.log('\n5. Initializing services...');
    const solanaService = new SolanaService();
    
    console.log('\n✓ Application started successfully!');
    console.log(`Network: ${networkConfig.getNetwork()}`);
    console.log(`Explorer: ${networkConfig.getExplorerUrl()}`);
    
    return {
      primaryConnection,
      fallbackConnection,
      heliusClient,
      solanaService
    };
  } catch (error) {
    console.error('\n✗ Failed to start application:', error.message);
    console.error('\nPlease ensure all required environment variables are set:');
    console.error('  - MAINNET_RPC_PRIMARY');
    console.error('  - MAINNET_RPC_FALLBACK');
    console.error('  - HELIUS_MAINNET_ENDPOINT');
    console.error('  - HELIUS_API_KEY');
    console.error('  - SOLANA_NETWORK (should be "mainnet")');
    process.exit(1);
  }
}

// Export examples
module.exports = {
  createSolanaConnection,
  createFallbackConnection,
  createHeliusClient,
  getTransactionWithFallback,
  formatTransactionResponse,
  formatWalletInfo,
  validateNetworkConfig,
  SolanaService,
  createStakeRoute,
  startApplication
};

// If running directly, demonstrate usage
if (require.main === module) {
  startApplication().catch(error => {
    console.error('Application failed to start:', error);
    process.exit(1);
  });
}
