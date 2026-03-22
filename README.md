# Solana NFT Staking Platform

A production-ready NFT staking platform built on Solana mainnet, enabling users to stake their NFTs and earn rewards based on staking duration and NFT traits.

## Overview

This platform allows NFT holders to:
- Stake their NFTs to earn rewards (non-custodial - NFTs stay in your wallet)
- Claim accumulated rewards
- Unstake their NFTs after a minimum 24-hour period
- View their staking history and statistics

The platform is built with security, performance, and user experience as top priorities, featuring comprehensive authentication, rate limiting, transaction verification, and error handling.

**Important**: This is NON-CUSTODIAL soft staking. Your NFTs never leave your wallet. The platform only tracks which NFTs are "staked" in its database and verifies ownership when you claim rewards or unstake.

## Architecture

### Frontend
- **Framework**: React with Vite
- **Wallet Integration**: Solana Wallet Adapter
- **Network**: Mainnet
- **Hosting**: Vercel

### Backend
- **Runtime**: Node.js with Express
- **Database**: Neon DB (Serverless PostgreSQL)
- **API Provider**: Helius (NFT metadata and ownership)
- **Hosting**: Vercel Serverless Functions

### Key Features
- **Non-Custodial**: NFTs never leave user wallets - platform only tracks staking status
- **Authentication**: Wallet signature-based authentication with nonce verification
- **Rate Limiting**: Per-wallet rate limits to prevent abuse
- **Ownership Verification**: Real-time NFT ownership checks via Helius
- **Transaction Verification**: On-chain transaction confirmation before database updates
- **Reward Calculation**: Time-based rewards with trait multipliers
- **Audit Logging**: Comprehensive logging of administrative actions
- **Error Handling**: Graceful error handling with user-friendly messages
- **Performance**: Optimized database queries and in-memory caching

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Solana wallet (Phantom, Solflare, etc.)
- Vercel account (for deployment)
- Neon DB account (for database)
- Helius API key (for NFT data)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd solana-nft-staking
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

3. **Configure environment variables**
   
   Backend (.env):
   ```bash
   DATABASE_URL=postgresql://user:password@host/database
   JWT_SECRET=your-jwt-secret-here
   HELIUS_API_KEY=your-helius-api-key
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   SOLANA_RPC_FALLBACK_URL=https://solana-api.projectserum.com
   ADMIN_WALLET_ADDRESS=your-admin-wallet-address
   PORT=3001
   ```
   
   Frontend (.env):
   ```bash
   VITE_API_URL=http://localhost:3001
   VITE_SOLANA_NETWORK=mainnet-beta
   VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   ```

4. **Set up the database**
   ```bash
   cd backend
   node scripts/setup-db.js
   node database/migrations/migrate.js
   ```

5. **Start development servers**
   ```bash
   # Backend (from backend directory)
   npm run dev
   
   # Frontend (from frontend directory)
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Documentation

### For Users
- **[User Guide](USER_GUIDE.md)** - Complete guide for staking, claiming rewards, and unstaking
- **[Mainnet Testing Guides](MAINNET_STAKE_FLOW_TESTING_GUIDE.md)** - Step-by-step testing procedures

### For Administrators
- **[Admin Guide](ADMIN_GUIDE.md)** - Platform management, collection configuration, and monitoring
- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference with examples

### For Developers
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Step-by-step Vercel deployment instructions
- **[Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)** - Common issues and solutions
- **[Neon DB Setup](NEON_DB_SETUP.md)** - Database configuration and migration procedures
- **[Environment Variables](backend/ENVIRONMENT_VARIABLES.md)** - Complete environment variable reference

## Project Structure

```
solana-nft-staking/
├── backend/                    # Express API server
│   ├── src/
│   │   ├── config/            # Network and database configuration
│   │   ├── services/          # Business logic services
│   │   └── utils/             # Utilities and helpers
│   ├── middleware/            # Express middleware
│   ├── routes/                # API route handlers
│   ├── scripts/               # Database and utility scripts
│   └── tests/                 # Test suites
├── frontend/                   # React application
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── contexts/          # React contexts
│   │   └── utils/             # Frontend utilities
│   └── public/                # Static assets
├── database/
│   └── migrations/            # Database migration scripts
└── docs/                      # Additional documentation
```

## Testing

### Run Unit Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Run Security Tests
```bash
cd backend
npm test -- tests/security.test.js
```

### Run Performance Tests
```bash
cd backend
npm test -- tests/performance.test.js
```

### Mainnet Testing
See the mainnet testing guides for detailed procedures:
- [Stake Flow Testing](MAINNET_STAKE_FLOW_TESTING_GUIDE.md)
- [Unstake Flow Testing](MAINNET_UNSTAKE_FLOW_TESTING_GUIDE.md)
- [Claim Rewards Testing](MAINNET_CLAIM_REWARDS_FLOW_TESTING_GUIDE.md)

## Deployment

See the [Deployment Guide](DEPLOYMENT_GUIDE.md) for complete instructions on deploying to Vercel.

Quick deployment steps:
1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Run database migrations on Neon DB
5. Deploy and verify

## Security Features

- **Wallet Authentication**: Signature-based authentication with single-use nonces
- **Rate Limiting**: Per-wallet rate limits on all critical endpoints
- **Input Validation**: Comprehensive validation of all user inputs
- **Ownership Verification**: Real-time NFT ownership checks before operations
- **Transaction Verification**: On-chain confirmation before database updates
- **Audit Logging**: Complete audit trail of administrative actions
- **CORS Protection**: Whitelist-based origin validation
- **Error Handling**: Secure error messages that don't leak sensitive information

## Performance Optimizations

- **Database Indexing**: Optimized indexes for frequent queries
- **Query Optimization**: Single-query reward calculations (no N+1 problems)
- **In-Memory Caching**: LRU cache for collection metadata
- **Connection Pooling**: Neon DB serverless pooling
- **Stale-While-Revalidate**: Background cache refresh for zero-latency reads

## Monitoring & Observability

- **Health Checks**: `/health` endpoint for uptime monitoring
- **Structured Logging**: JSON-formatted logs with Vercel integration
- **Audit Logs**: Database-backed audit trail with 1-year retention
- **Vercel Analytics**: Built-in performance and usage analytics

## Support

For issues, questions, or feature requests:
1. Check the [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)
2. Review the [API Documentation](API_DOCUMENTATION.md)
3. Consult the [Admin Guide](ADMIN_GUIDE.md) for platform management

## License

[Your License Here]

## Contributing

[Your Contributing Guidelines Here]
