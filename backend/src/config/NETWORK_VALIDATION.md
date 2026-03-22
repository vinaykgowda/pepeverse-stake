# Network Configuration Validation

## Overview

The network configuration module now includes startup validation to ensure all required endpoints are reachable before the server starts accepting requests. This implements requirements 2.5 and 28.2.

## Features

### 1. Environment Variable Validation

On initialization, the module validates that all required environment variables are present:
- `MAINNET_RPC_PRIMARY` - Primary Solana RPC endpoint
- `MAINNET_RPC_FALLBACK` - Fallback Solana RPC endpoint  
- `HELIUS_MAINNET_ENDPOINT` - Helius API endpoint

If any are missing, the module throws an error with a descriptive message listing all missing variables.

### 2. Connectivity Validation

The `validateConnectivity()` method tests actual connectivity to all configured endpoints:

```javascript
const networkConfig = require('./src/config/network');

// Validate connectivity on startup
const results = await networkConfig.validateConnectivity();
```

#### Validation Process

1. **Primary RPC**: Attempts to call `getSlot()` on the primary RPC endpoint
2. **Fallback RPC**: Attempts to call `getSlot()` on the fallback RPC endpoint
3. **Helius**: Attempts to call the `getHealth` JSON-RPC method

#### Failure Handling

- **Critical Failure**: If BOTH RPC endpoints are unhealthy, the server fails to start with a descriptive error
- **Degraded Mode**: If only one RPC endpoint is unhealthy, a warning is logged but startup continues
- **Helius Failure**: If Helius is unhealthy, a warning is logged but startup continues (non-critical)

### 3. Fail-Fast Behavior

The validation is integrated into the server startup process in `server.js`:

```javascript
async function startServer() {
  try {
    // Validate network configuration and connectivity
    console.log('Validating network configuration...');
    const networkValidation = await networkConfig.validateConnectivity();
    console.log('Network validation results:');
    console.log(`  Primary RPC: ${networkValidation.primaryRpc.status}`);
    console.log(`  Fallback RPC: ${networkValidation.fallbackRpc.status}`);
    console.log(`  Helius: ${networkValidation.helius.status}`);
    
    // Continue with database initialization...
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}
```

## Error Messages

### Missing Environment Variables

```
Missing required network configuration: MAINNET_RPC_PRIMARY, HELIUS_MAINNET_ENDPOINT
Please ensure all required environment variables are set in Vercel.
```

### All RPC Endpoints Unhealthy

```
CRITICAL: No healthy RPC endpoints available.
Primary RPC (https://api.mainnet-beta.solana.com): Connection timeout
Fallback RPC (https://solana-api.projectserum.com): Connection timeout
Cannot start server without at least one working RPC endpoint.
```

### Primary RPC Unhealthy (Warning)

```
WARNING: Primary RPC endpoint is unhealthy (https://api.mainnet-beta.solana.com): Connection timeout
Falling back to secondary RPC endpoint.
```

### Helius Unhealthy (Warning)

```
WARNING: Helius endpoint is unhealthy (https://mainnet.helius-rpc.com): Connection timeout
Some NFT-related features may not work correctly.
```

## Testing

The validation functionality is fully tested in `network.test.js`:

```bash
npm test -- network.test.js
```

Tests cover:
- Successful validation when all endpoints are healthy
- Critical failure when all RPC endpoints are unhealthy
- Degraded mode when only one RPC endpoint is healthy
- Warning when Helius is unhealthy but RPC endpoints are healthy

## Requirements Satisfied

- **Requirement 2.5**: Platform validates that all network configurations match the target environment on startup
- **Requirement 28.2**: Backend validates environment variable formats (URLs) on startup
- **Requirement 28.5**: Backend validates RPC endpoint connectivity on startup

## Dependencies

The validation requires:
- `@solana/web3.js` - For testing RPC connectivity
- `axios` - For testing Helius API connectivity

Both are already included in the backend dependencies.
