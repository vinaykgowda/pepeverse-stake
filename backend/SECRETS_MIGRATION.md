# Secrets Migration Documentation

## Overview

This document tracks the removal of hardcoded secrets from the codebase as part of Task 3.2 (Production Readiness & Mainnet Migration).

## Changes Made

### 1. JWT_SECRET Hardcoded Fallbacks Removed

**Files Modified:**
- `backend/routes/auth.js` (2 locations)
- `backend/middleware/auth.js` (1 location)

**Changes:**
- Removed fallback value `'your-secret-key'`
- Added validation to throw error if JWT_SECRET is not configured
- Application will now fail fast on startup if JWT_SECRET is missing

**Before:**
```javascript
jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', options)
```

**After:**
```javascript
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET is not configured');
}
jwt.sign(payload, jwtSecret, options)
```

### 2. Database Credential Fallbacks Removed

**Files Modified:**
- `backend/src/db.js`
- `backend/server.js`

**Changes:**
- Removed fallback values for DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
- Added startup validation to check all required database environment variables
- Application will exit with descriptive error if any database variable is missing

**Before:**
```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'solana_nft_staking',
  // ...
});
```

**After:**
```javascript
// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('ERROR: Missing required database environment variables:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // ...
});
```

### 3. Solana RPC URL Fallback Removed

**Files Modified:**
- `backend/src/solana-transaction-utils.js`

**Changes:**
- Removed hardcoded devnet fallback URL
- Application will throw error if SOLANA_RPC_URL is not configured

**Before:**
```javascript
const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
```

**After:**
```javascript
const endpoint = process.env.SOLANA_RPC_URL;
if (!endpoint) {
  throw new Error('SOLANA_RPC_URL environment variable is required');
}
```

### 4. Server Configuration Fallbacks Removed

**Files Modified:**
- `backend/server.js`

**Changes:**
- Removed fallback for PORT (was 3001)
- Removed fallback for API_BASE_URL (was '/api/v1')
- Added validation for ALLOWED_ORIGINS with warning if empty

**Before:**
```javascript
const PORT = process.env.PORT || 3001;
const apiBaseUrl = process.env.API_BASE_URL || '/api/v1';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
```

**After:**
```javascript
const PORT = process.env.PORT;
if (!PORT) {
  console.error('ERROR: PORT environment variable is required');
  process.exit(1);
}

const apiBaseUrl = process.env.API_BASE_URL;
if (!apiBaseUrl) {
  console.error('ERROR: API_BASE_URL environment variable is required');
  process.exit(1);
}

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
if (allowedOrigins.length === 0) {
  console.warn('WARNING: ALLOWED_ORIGINS is not configured. CORS will reject all cross-origin requests.');
}
```

### 5. Frontend Helius API Key (Documented for Future Fix)

**Files Modified:**
- `frontend/src/services/helius.js`

**Changes:**
- Added security warning comment
- Documented that this needs to be moved to backend proxy (Task 9 - Phase 3)

**Note:** The Helius API key is still exposed in the frontend. This will be fixed in Phase 3 when the backend Helius proxy service is implemented.

### 6. .env File Documentation

**Files Modified:**
- `backend/.env`

**Changes:**
- Added security warnings and production deployment notes
- Documented that secrets should be configured in Vercel environment variables for production

## Required Environment Variables

After these changes, the following environment variables are **REQUIRED** for the application to start:

### Backend Required Variables:
- `PORT` - Server port number
- `NODE_ENV` - Environment (development/production)
- `API_BASE_URL` - Base URL for API routes
- `JWT_SECRET` - Secret key for JWT token signing
- `DB_HOST` - Database host
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `SOLANA_RPC_URL` - Solana RPC endpoint URL
- `ENCRYPTION_KEY` - Key for encrypting/decrypting private keys

### Backend Optional Variables:
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (warning if empty)
- `JWT_EXPIRY` - JWT token expiration time (defaults in code)

## Secrets Management with Vercel

All secrets are managed through Vercel environment variables for production deployment.

### Development Mode:
- Secrets are loaded from environment variables
- Use `.env` file for local development
- Never commit `.env` with real credentials

### Production Mode:
1. Configure all secrets in Vercel project settings under Environment Variables:
   - `JWT_SECRET`
   - `DATABASE_URL` (Neon DB connection string)
   - `HELIUS_API_KEY`
   - `REWARDS_WALLET_PRIVATE_KEY`
   - `MAINNET_RPC_PRIMARY`
   - `MAINNET_RPC_FALLBACK`

2. Vercel automatically injects these variables at runtime
3. No additional secret management infrastructure needed

## Testing

### Verify Fail-Fast Behavior:

1. **Test missing JWT_SECRET:**
```bash
# Remove JWT_SECRET from .env
# Start server - should fail with error message
npm start
```

2. **Test missing database credentials:**
```bash
# Remove DB_PASSWORD from .env
# Start server - should fail with descriptive error
npm start
```

3. **Test missing PORT:**
```bash
# Remove PORT from .env
# Start server - should fail immediately
npm start
```

### Verify Normal Operation:

```bash
# With all required variables in .env
npm start
# Should start successfully
```

## Migration Scripts Not Updated

The following files still contain fallback values for development/testing purposes:
- `backend/scripts/setup-db.js`
- `backend/scripts/encrypt-existing-private-keys.js`
- `database/migrations/*.js`

These are utility scripts and migration tools that are run manually, not part of the main application. They retain fallbacks for convenience during development and testing. However, they should be updated to use environment variables in production environments.

## Security Checklist

- [x] Remove JWT_SECRET fallback values
- [x] Remove DB_PASSWORD fallback values
- [x] Remove hardcoded RPC endpoints
- [x] Add startup validation for required secrets
- [x] Document secrets in .env file
- [x] Add security warnings to .env file
- [ ] Implement backend Helius proxy (Task 9 - Phase 3)
- [ ] Remove HELIUS_API_KEY from frontend (Task 10 - Phase 3)
- [ ] Configure Vercel environment variables for production
- [ ] Update deployment documentation with Vercel setup

## Requirements Satisfied

This task satisfies the following requirements from the spec:

- **Requirement 5.1:** Backend SHALL NOT include hardcoded fallback values for JWT secrets ✓
- **Requirement 5.2:** Backend SHALL NOT include hardcoded fallback values for database credentials ✓
- **Requirement 5.3:** Frontend SHALL NOT expose API keys in client-side environment files (Documented, to be fixed in Phase 3)
- **Requirement 5.4:** WHEN required secrets are missing, Platform SHALL fail to start with descriptive error message ✓
- **Requirement 5.5:** Platform SHALL load all secrets from secure environment variables or secret management systems ✓

## Next Steps

1. **Phase 3 - Task 9:** Implement backend Helius proxy service
2. **Phase 3 - Task 10:** Remove Helius API key from frontend
3. **Phase 5 - Deployment:** Configure Vercel environment variables for production
4. **Phase 5 - Deployment:** Verify all environment variables are properly configured in Vercel
