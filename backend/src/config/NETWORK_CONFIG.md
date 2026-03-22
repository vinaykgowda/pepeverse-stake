# Network Configuration Module

## Overview

The Network Configuration module provides centralized management of Solana mainnet network settings for the NFT staking platform. It ensures consistent network configuration across all backend components and validates that all required endpoints are properly configured.

**Requirements:** 2.1, 2.2, 2.3, 2.4

## Features

- Centralized mainnet RPC endpoint configuration (primary and fallback)
- Helius mainnet endpoint management
- Solana explorer URL generation
- Startup validation of required configuration
- Fail-fast behavior when configuration is missing

## Environment Variables

The following environment variables must be configured in Vercel:

| Variable | Description | Example |
|----------|-------------|---------|
| `MAINNET_RPC_PRIMARY` | Primary Solana mainnet RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `MAINNET_RPC_FALLBACK` | Fallback Solana mainnet RPC endpoint | `https://solana-api.projectserum.com` |
| `HELIUS_MAINNET_ENDPOINT` | Helius mainnet API endpoint | `https://mainnet.helius-rpc.com` |
| `SOLANA_NETWORK` | Network identifier (optional, defaults to 'mainnet') | `mainnet` |

## Usage

### Basic Usage

```javascript
const networkConfig = require('./config/network');

// Get RPC endpoints
const primaryRpc = networkConfig.getPrimaryRpc();
const fallbackRpc = networkConfig.getFallbackRpc();

// Get Helius endpoint
const heliusEndpoint = networkConfig.getHeliusEndpoint();

// Get network identifier
const network = networkConfig.getNetwork(); // 'mainnet'

// Check if mainnet
if (networkConfig.isMainnet()) {
  console.log('Running on mainnet');
}
```

### Solana Connection

```javascript
const { Connection } = require('@solana/web3.js');
const networkConfig = require('./config/network');

// Create connection with primary RPC
const connection = new Connection(
  networkConfig.getPrimaryRpc(),
  'confirmed'
);

// Create connection with fallback RPC
const fallbackConnection = new Connection(
  networkConfig.getFallbackRpc(),
  'confirmed'
);
```

### Explorer URLs

```javascript
const networkConfig = require('./config/network');

// Get transaction explorer URL
const txSignature = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';
const txUrl = networkConfig.getTransactionUrl(txSignature);
// Returns: https://explorer.solana.com/tx/5j7s6NiJS3...

// Get address explorer URL
const address = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
const addressUrl = networkConfig.getAddressUrl(address);
// Returns: https://explorer.solana.com/address/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK
```

### Complete Configuration

```javascript
const networkConfig = require('./config/network');

// Get all configuration as an object
const config = networkConfig.getConfig();
console.log(config);
// {
//   network: 'mainnet',
//   rpc: {
//     primary: 'https://api.mainnet-beta.solana.com',
//     fallback: 'https://solana-api.projectserum.com'
//   },
//   helius: {
//     endpoint: 'https://mainnet.helius-rpc.com'
//   },
//   explorer: {
//     baseUrl: 'https://explorer.solana.com'
//   }
// }
```

## API Reference

### Methods

#### `getPrimaryRpc()`
Returns the primary mainnet RPC endpoint URL.

**Returns:** `string`

#### `getFallbackRpc()`
Returns the fallback mainnet RPC endpoint URL.

**Returns:** `string`

#### `getHeliusEndpoint()`
Returns the Helius mainnet endpoint URL.

**Returns:** `string`

#### `getNetwork()`
Returns the network identifier (should be 'mainnet' for production).

**Returns:** `string`

#### `getExplorerUrl()`
Returns the Solana explorer base URL.

**Returns:** `string`

#### `getTransactionUrl(signature)`
Generates a full explorer URL for a transaction.

**Parameters:**
- `signature` (string): Transaction signature

**Returns:** `string` - Full explorer URL

#### `getAddressUrl(address)`
Generates a full explorer URL for an address.

**Parameters:**
- `address` (string): Wallet or account address

**Returns:** `string` - Full explorer URL

#### `isMainnet()`
Checks if the configuration is for mainnet.

**Returns:** `boolean` - True if configured for mainnet

#### `getConfig()`
Returns the complete network configuration as an object.

**Returns:** `Object` - Complete configuration

## Validation

The module performs validation on initialization:

1. **Required Variables:** Throws an error if any required environment variables are missing
2. **Network Check:** Warns if `SOLANA_NETWORK` is not set to 'mainnet'
3. **Fail Fast:** Application will not start if configuration is invalid

### Error Messages

```
Missing required network configuration: MAINNET_RPC_PRIMARY, HELIUS_MAINNET_ENDPOINT
Please ensure all required environment variables are set in Vercel.
```

### Warning Messages

```
Warning: SOLANA_NETWORK is set to "devnet" but should be "mainnet" for production
```

## Testing

Run the test suite:

```bash
npm test -- network.test.js
```

The test suite covers:
- Initialization with valid configuration
- Missing environment variable detection
- Default values
- RPC endpoint retrieval
- Explorer URL generation
- Network checks
- Complete configuration retrieval

## Integration

### With Solana Services

```javascript
const { Connection } = require('@solana/web3.js');
const networkConfig = require('./config/network');

class SolanaService {
  constructor() {
    this.connection = new Connection(
      networkConfig.getPrimaryRpc(),
      'confirmed'
    );
    
    this.fallbackConnection = new Connection(
      networkConfig.getFallbackRpc(),
      'confirmed'
    );
  }
  
  async getTransaction(signature) {
    try {
      return await this.connection.getTransaction(signature);
    } catch (error) {
      // Try fallback
      return await this.fallbackConnection.getTransaction(signature);
    }
  }
}
```

### With Helius Service

```javascript
const axios = require('axios');
const networkConfig = require('./config/network');

class HeliusService {
  constructor() {
    this.client = axios.create({
      baseURL: networkConfig.getHeliusEndpoint(),
      headers: {
        'Authorization': `Bearer ${process.env.HELIUS_API_KEY}`
      }
    });
  }
  
  async getAssets(owner) {
    const response = await this.client.post('/v0/addresses/balances', {
      owner
    });
    return response.data;
  }
}
```

### With API Responses

```javascript
const networkConfig = require('./config/network');

router.post('/api/stake', async (req, res) => {
  // ... stake logic ...
  
  res.json({
    success: true,
    transaction: {
      signature: txSignature,
      explorerUrl: networkConfig.getTransactionUrl(txSignature)
    }
  });
});
```

## Best Practices

1. **Import Once:** The module exports a singleton instance, so import it wherever needed
2. **Validate Early:** The module validates on first import, ensuring fail-fast behavior
3. **Use Methods:** Always use the provided methods rather than accessing properties directly
4. **Environment Variables:** Set all required variables in Vercel project settings
5. **Network Check:** Use `isMainnet()` to verify production configuration

## Troubleshooting

### Application Won't Start

**Problem:** Application fails to start with "Missing required network configuration" error

**Solution:** Ensure all required environment variables are set in Vercel:
- `MAINNET_RPC_PRIMARY`
- `MAINNET_RPC_FALLBACK`
- `HELIUS_MAINNET_ENDPOINT`

### Wrong Network Warning

**Problem:** Warning about SOLANA_NETWORK not being 'mainnet'

**Solution:** Set `SOLANA_NETWORK=mainnet` in Vercel environment variables

### RPC Connection Failures

**Problem:** Cannot connect to Solana RPC

**Solution:** 
1. Verify RPC endpoints are correct and accessible
2. Check if RPC endpoints are rate-limited
3. Try using the fallback RPC endpoint
4. Consider using a paid RPC provider for production

## Related Documentation

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Solana RPC Endpoints](https://docs.solana.com/cluster/rpc-endpoints)
- [Helius API Documentation](https://docs.helius.xyz/)
