# Environment Variables Reference

## Overview

This application requires all environment variables to be explicitly set. There are **NO fallback values** for security-sensitive configuration. The application will fail to start with a descriptive error message if any required variables are missing.

## Required Environment Variables

### Database Configuration

#### `DATABASE_URL`
- **Description**: Neon DB PostgreSQL connection string
- **Format**: `postgresql://user:password@host.neon.tech/dbname?sslmode=require`
- **Example**: `postgresql://myuser:mypass@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`
- **Where to get it**: Neon DB dashboard → Connection Details
- **Validation**: Must start with `postgresql://` or `postgres://`

### Authentication & Security

#### `JWT_SECRET`
- **Description**: Secret key for signing JWT authentication tokens
- **Format**: Random string, minimum 32 characters
- **Example**: `your-super-secure-random-jwt-secret-at-least-32-chars-long`
- **How to generate**: 
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Validation**: Must be at least 32 characters long
- **⚠️ CRITICAL**: Never commit this to version control

#### `REWARDS_WALLET_PRIVATE_KEY`
- **Description**: Private key for the wallet that distributes staking rewards
- **Format**: Base58-encoded Solana private key
- **Example**: `5J7W...` (base58 string)
- **How to generate**: Use Solana CLI or wallet software
- **Validation**: Must not be empty
- **⚠️ CRITICAL**: Never commit this to version control, never share

### Solana Network Configuration

#### `MAINNET_RPC_PRIMARY`
- **Description**: Primary Solana mainnet RPC endpoint
- **Format**: HTTPS URL
- **Example**: `https://api.mainnet-beta.solana.com`
- **Alternatives**: 
  - `https://solana-api.projectserum.com`
  - `https://rpc.ankr.com/solana`
- **Validation**: Must start with `http://` or `https://`

#### `MAINNET_RPC_FALLBACK`
- **Description**: Fallback Solana mainnet RPC endpoint (used if primary fails)
- **Format**: HTTPS URL
- **Example**: `https://solana-api.projectserum.com`
- **Validation**: Must start with `http://` or `https://`

#### `SOLANA_NETWORK`
- **Description**: Solana network identifier
- **Format**: String
- **Example**: `mainnet`
- **Valid values**: `mainnet`, `devnet`, `testnet`
- **Default**: `mainnet` (if not set)
- **Production**: Must be set to `mainnet`

### Helius API Configuration

#### `HELIUS_MAINNET_ENDPOINT`
- **Description**: Helius API endpoint for NFT data
- **Format**: HTTPS URL
- **Example**: `https://mainnet.helius-rpc.com`
- **Where to get it**: Helius dashboard
- **Validation**: Must start with `http://` or `https://`

#### `HELIUS_API_KEY`
- **Description**: API key for Helius service
- **Format**: String
- **Example**: `abc123-def456-ghi789`
- **Where to get it**: Helius dashboard → API Keys
- **Validation**: Must not be empty
- **⚠️ SENSITIVE**: Do not expose in client-side code

### Server Configuration

#### `PORT`
- **Description**: Port number for the Express server
- **Format**: Integer between 1 and 65535
- **Example**: `3000`
- **Validation**: Must be a valid port number
- **Vercel**: Automatically set by Vercel, use `3000` for local development

#### `API_BASE_URL`
- **Description**: Base URL path for all API routes
- **Format**: String starting with `/`
- **Example**: `/api`
- **Validation**: Must start with `/`

## Optional Environment Variables

These variables have default values but can be overridden:

### `NODE_ENV`
- **Description**: Node.js environment
- **Default**: `development`
- **Valid values**: `development`, `production`, `test`
- **Production**: Set to `production`

### `ALLOWED_ORIGINS`
- **Description**: Comma-separated list of allowed CORS origins
- **Default**: Empty string (no origins allowed)
- **Example**: `https://yourdomain.com,https://www.yourdomain.com`
- **Production**: Must be set to your frontend domain(s)
- **Development**: Can include `http://localhost:3000`

## Setting Environment Variables

### Local Development (.env file)

Create a `.env` file in the `backend` directory:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require

# Authentication
JWT_SECRET=your-super-secure-random-jwt-secret-at-least-32-chars-long

# Solana Network
MAINNET_RPC_PRIMARY=https://api.mainnet-beta.solana.com
MAINNET_RPC_FALLBACK=https://solana-api.projectserum.com
SOLANA_NETWORK=mainnet

# Helius
HELIUS_MAINNET_ENDPOINT=https://mainnet.helius-rpc.com
HELIUS_API_KEY=your-helius-api-key

# Rewards
REWARDS_WALLET_PRIVATE_KEY=your-rewards-wallet-private-key

# Server
PORT=3000
API_BASE_URL=/api

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with its value
4. Select the appropriate environments (Production, Preview, Development)
5. Save changes
6. Redeploy your application

**Vercel CLI:**
```bash
vercel env add DATABASE_URL
vercel env add JWT_SECRET
# ... add all required variables
```

## Validation

The application validates all environment variables on startup. If any required variables are missing or invalid, you'll see:

```
❌ STARTUP VALIDATION FAILED

The following required environment variables are missing or invalid:

1. Missing required environment variable: JWT_SECRET
   Description: Secret key for JWT token signing
   Example: your-secure-random-jwt-secret-here

Please ensure all required environment variables are set in your Vercel
project settings or in your .env file for local development.
```

## Security Best Practices

1. **Never commit secrets to version control**
   - Add `.env` to `.gitignore`
   - Use `.env.example` as a template (without actual values)

2. **Use strong, random values**
   - Generate JWT_SECRET with cryptographic randomness
   - Use at least 32 characters for secrets

3. **Rotate secrets regularly**
   - Change JWT_SECRET periodically
   - Update API keys when compromised

4. **Limit access**
   - Only give Vercel environment variable access to trusted team members
   - Use separate keys for development and production

5. **Monitor usage**
   - Check Helius API usage regularly
   - Monitor for unauthorized access attempts

## Troubleshooting

### Application won't start

**Error**: "Missing required environment variable: X"
- **Solution**: Add the missing variable to your `.env` file or Vercel settings

**Error**: "JWT_SECRET must be at least 32 characters long"
- **Solution**: Generate a longer secret using the command provided above

**Error**: "Invalid value for PORT"
- **Solution**: Ensure PORT is a number between 1 and 65535

### Database connection fails

**Error**: "Failed to connect to database"
- **Solution**: Verify DATABASE_URL is correct and Neon DB is accessible
- Check that the connection string includes `?sslmode=require`
- Verify your Neon project is not suspended (free tier limitation)
- Check Neon DB dashboard for database status

### RPC connection fails

**Error**: "Failed to connect to Solana RPC"
- **Solution**: Verify RPC endpoints are accessible
- Try alternative RPC providers if current one is down

## Testing Configuration

To test if your environment is properly configured:

```bash
# Run validation tests
cd backend
npm test -- startup-validation.test.js

# Try starting the server
npm start

# If successful, you should see:
# ✓ Environment validation passed
# ✓ Connected to Neon DB (PostgreSQL)
# ✓ Network configuration validated successfully
# Server running on port 3000
```

## Related Documentation

- [Secrets Removal Summary](./SECRETS_REMOVED_SUMMARY.md) - Details on hardcoded secrets removal
- [Deployment Guide](../README.md) - Full deployment instructions
- [Neon DB Setup](../database/README.md) - Database setup guide
