# Configuration Module

This directory contains configuration modules for the backend application.

## Available Modules

### Network Configuration (`network.js`)
Centralized management of Solana mainnet network settings including RPC endpoints, Helius configuration, and explorer URLs.

**Documentation:** See [NETWORK_CONFIG.md](./NETWORK_CONFIG.md) for detailed usage and API reference.

**Key Features:**
- Primary and fallback mainnet RPC endpoints
- Helius mainnet endpoint configuration
- Solana explorer URL generation
- Startup validation with fail-fast behavior
- Singleton pattern for consistent configuration

**Usage:**
```javascript
const networkConfig = require('./config/network');

// Get RPC endpoints
const primaryRpc = networkConfig.getPrimaryRpc();
const fallbackRpc = networkConfig.getFallbackRpc();

// Generate explorer URLs
const txUrl = networkConfig.getTransactionUrl(signature);
```

## Environment Variables

All configuration is managed through environment variables. For production deployment on Vercel, configure all required variables in the Vercel project settings.

### Required Environment Variables

#### Database
- `DATABASE_URL` - Neon DB PostgreSQL connection string

#### Solana Network
- `MAINNET_RPC_PRIMARY` - Primary Solana mainnet RPC endpoint
- `MAINNET_RPC_FALLBACK` - Fallback Solana mainnet RPC endpoint
- `SOLANA_NETWORK` - Network identifier (mainnet-beta)

#### Authentication
- `JWT_SECRET` - Secret key for JWT token signing

#### External Services
- `HELIUS_API_KEY` - Helius API key for NFT data
- `HELIUS_MAINNET_ENDPOINT` - Helius mainnet endpoint URL

#### Rewards
- `REWARDS_WALLET_PRIVATE_KEY` - Private key for rewards distribution wallet

#### Server
- `PORT` - Server port number
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

### Development Setup

Create a `.env` file in the backend directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Solana Network
MAINNET_RPC_PRIMARY=https://api.mainnet-beta.solana.com
MAINNET_RPC_FALLBACK=https://solana-api.projectserum.com
SOLANA_NETWORK=mainnet-beta

# Authentication
JWT_SECRET=your-jwt-secret-here

# External Services
HELIUS_API_KEY=your-helius-api-key
HELIUS_MAINNET_ENDPOINT=https://mainnet.helius-rpc.com

# Rewards
REWARDS_WALLET_PRIVATE_KEY=your-wallet-private-key

# Server
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Production Deployment (Vercel)

Configure all environment variables in Vercel project settings:
1. Go to Project Settings → Environment Variables
2. Add each required variable
3. Set appropriate environment (Production, Preview, Development)
4. Vercel automatically injects these at runtime

### Environment Validation

The application validates all required environment variables on startup. If any required variable is missing, the application will:
- Print a clear error message listing missing variables
- Exit with code 1
- NOT start the server

This fail-fast behavior prevents running with insecure defaults or missing configuration.
