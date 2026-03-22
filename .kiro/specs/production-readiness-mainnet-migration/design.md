# Design Document: Production Readiness & Mainnet Migration (Simplified)

## Overview

This design document outlines the simplified technical architecture for migrating a Solana NFT staking platform from devnet to mainnet production using Vercel (hosting) and Neon DB (PostgreSQL). This approach eliminates AWS services and Redis dependencies in favor of Vercel's built-in features and in-memory solutions.

The platform consists of three primary components:
- **Backend**: Node.js/Express API server (deployed on Vercel serverless functions)
- **Frontend**: React-based web application (deployed on Vercel)
- **Database**: Neon DB serverless PostgreSQL database

### Design Goals

1. **Simplicity**: Use managed services (Vercel, Neon DB) to minimize operational complexity
2. **Security**: Implement essential security controls without over-engineering
3. **Performance**: Optimize for sub-second response times with in-memory caching
4. **Reliability**: Handle errors gracefully with retry logic
5. **Maintainability**: Clean, well-documented code
6. **Fast Deployment**: Deploy in 4 weeks, not 10 weeks

### Architecture Principles

- **Serverless First**: Leverage Vercel's serverless platform
- **In-Memory Storage**: Use in-memory caching and rate limiting (no Redis)
- **Environment Variables**: Use Vercel environment variables (no AWS Secrets Manager)
- **Built-in Monitoring**: Use Vercel Analytics and Logs (no Prometheus/CloudWatch)
- **Fail Fast**: Validate configuration at startup
- **Explicit Over Implicit**: No fallback values for critical configuration

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  React Frontend  │         │  Wallet Adapter  │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (Vercel)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Express API (Serverless Functions)                  │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │ Rate       │  │ Auth       │  │ Validation │    │  │
│  │  │ Limiter    │  │ Middleware │  │ Middleware │    │  │
│  │  │ (In-Memory)│  │            │  │            │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Business Logic Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Stake   │  │  Reward  │  │   NFT    │  │   TX     │  │
│  │  Service │  │  Service │  │  Service │  │  Service │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  In-Memory Caches (LRU)                              │  │
│  │  - Nonce Storage (5 min TTL)                         │  │
│  │  - Collection Cache (5 min TTL, 1000 entries)       │  │
│  │  - Helius Cache (1 hour TTL, 10000 entries)         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────────┐                                       │
│  │  Neon DB         │                                       │
│  │  (PostgreSQL)    │                                       │
│  │  - Serverless    │                                       │
│  │  - Auto-pooling  │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Solana      │  │  Helius API  │  │  Vercel      │     │
│  │  Mainnet RPC │  │              │  │  Analytics   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Key Simplifications

1. **No Redis**: All caching and rate limiting uses in-memory storage with automatic cleanup
2. **No AWS**: Secrets stored in Vercel environment variables, no Secrets Manager
3. **No Custom CI/CD**: Vercel handles automatic deployments from Git
4. **No Prometheus**: Vercel Analytics provides performance monitoring
5. **No CloudWatch**: Vercel Logs provides centralized logging
6. **No Blue-Green Deployment**: Vercel handles zero-downtime deployments automatically

## Components and Interfaces

### 1. Database Schema (Neon DB)

#### Connection Configuration

```javascript
// backend/src/config/database.js
const { Pool } = require('pg');

class DatabaseManager {
  constructor() {
    // Neon DB connection string from Vercel environment
    this.connectionString = process.env.DATABASE_URL;
    
    if (!this.connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    // Neon DB handles connection pooling automatically for serverless
    this.pool = new Pool({
      connectionString: this.connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 10000,
      // Let Neon handle pooling
      max: 20
    });
    
    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }
  
  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Query executed', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Query error:', { text, error: error.message });
      throw error;
    }
  }
  
  async getClient() {
    return await this.pool.connect();
  }
  
  async healthCheck() {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new DatabaseManager();
```

#### Schema Migrations

The existing migration scripts (001-004) remain unchanged. They add:
- `last_claim_timestamp` to `staked_nfts`
- `collection_id` and `nft_count` to `transactions`
- CASCADE foreign key rules
- Performance indexes
- `audit_logs` table

### 2. Authentication with In-Memory Nonce Storage

```javascript
// backend/src/services/auth.js
const crypto = require('crypto');
const nacl = require('tweetnacl');
const bs58 = require('bs58');

class AuthService {
  constructor() {
    // In-memory nonce storage: Map<walletAddress, {nonce, expiresAt}>
    this.nonces = new Map();
    
    // Cleanup expired nonces every minute
    setInterval(() => this.cleanupExpiredNonces(), 60000);
  }
  
  async generateNonce(walletAddress) {
    // Validate wallet address format
    if (!this.isValidSolanaAddress(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }
    
    // Generate cryptographically secure nonce
    const nonce = crypto.randomBytes(32).toString('base64');
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
    
    // Store in memory
    this.nonces.set(walletAddress, { nonce, expiresAt });
    
    return nonce;
  }
  
  async verifySignature(walletAddress, signature, message) {
    // Retrieve nonce from memory
    const stored = this.nonces.get(walletAddress);
    
    if (!stored) {
      throw new Error('Nonce not found or expired');
    }
    
    if (Date.now() > stored.expiresAt) {
      this.nonces.delete(walletAddress);
      throw new Error('Nonce expired');
    }
    
    if (stored.nonce !== message) {
      throw new Error('Nonce mismatch');
    }
    
    // Verify signature
    const publicKey = bs58.decode(walletAddress);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = Buffer.from(message, 'utf8');
    
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey
    );
    
    if (!isValid) {
      throw new Error('Invalid signature');
    }
    
    // Delete nonce (single use)
    this.nonces.delete(walletAddress);
    
    return true;
  }
  
  cleanupExpiredNonces() {
    const now = Date.now();
    for (const [wallet, data] of this.nonces.entries()) {
      if (now > data.expiresAt) {
        this.nonces.delete(wallet);
      }
    }
  }
  
  isValidSolanaAddress(address) {
    try {
      const decoded = bs58.decode(address);
      return decoded.length === 32;
    } catch {
      return false;
    }
  }
}

module.exports = new AuthService();
```

### 3. In-Memory Rate Limiting

```javascript
// backend/middleware/rateLimiter.js

class WalletRateLimiter {
  constructor() {
    // In-memory storage: Map<key, Array<timestamp>>
    this.requests = new Map();
    
    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  createLimiter(options) {
    const { 
      windowMs = 60000, // 1 minute
      maxRequests = 10,
      keyPrefix = 'ratelimit'
    } = options;
    
    return async (req, res, next) => {
      // Extract wallet address from JWT or request
      const walletAddress = req.user?.walletAddress || req.body?.walletAddress;
      
      if (!walletAddress) {
        return res.status(400).json({ 
          error: 'Wallet address required' 
        });
      }
      
      const key = `${keyPrefix}:${walletAddress}`;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Get or create request array
      let timestamps = this.requests.get(key) || [];
      
      // Remove old timestamps outside the window
      timestamps = timestamps.filter(ts => ts > windowStart);
      
      if (timestamps.length >= maxRequests) {
        const oldestRequest = timestamps[0];
        const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
        
        return res.status(429)
          .header('Retry-After', retryAfter)
          .json({
            error: 'Rate limit exceeded',
            retryAfter: retryAfter
          });
      }
      
      // Add current request
      timestamps.push(now);
      this.requests.set(key, timestamps);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - timestamps.length);
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
      
      next();
    };
  }
  
  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, timestamps] of this.requests.entries()) {
      // Remove entries with no recent requests
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] < now - maxAge) {
        this.requests.delete(key);
      }
    }
  }
}

const rateLimiter = new WalletRateLimiter();

// Export specific limiters
module.exports = {
  claimLimiter: rateLimiter.createLimiter({
    windowMs: 60000,
    maxRequests: 5,
    keyPrefix: 'claim'
  }),
  
  stakeLimiter: rateLimiter.createLimiter({
    windowMs: 60000,
    maxRequests: 20,
    keyPrefix: 'stake'
  }),
  
  unstakeLimiter: rateLimiter.createLimiter({
    windowMs: 60000,
    maxRequests: 20,
    keyPrefix: 'unstake'
  }),
  
  authLimiter: rateLimiter.createLimiter({
    windowMs: 60000,
    maxRequests: 10,
    keyPrefix: 'auth'
  })
};
```

### 4. In-Memory LRU Cache

```javascript
// backend/src/utils/lruCache.js

class LRUCache {
  constructor(maxSize = 1000, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }
  
  set(key, value) {
    const entry = {
      value,
      expiresAt: Date.now() + this.ttlMs
    };
    
    // If key exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Add to end (most recently used)
    this.cache.set(key, entry);
    
    // Evict oldest if over size limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
  
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }
  
  has(key) {
    return this.get(key) !== null;
  }
  
  delete(key) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  size() {
    return this.cache.size;
  }
}

module.exports = LRUCache;
```

### 5. Helius Proxy Service with In-Memory Cache

```javascript
// backend/src/services/heliusProxy.js
const axios = require('axios');
const LRUCache = require('../utils/lruCache');

class HeliusProxyService {
  constructor() {
    this.baseUrl = process.env.HELIUS_MAINNET_ENDPOINT;
    this.apiKey = process.env.HELIUS_API_KEY;
    
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Helius configuration missing');
    }
    
    // In-memory LRU cache: 10,000 entries, 1 hour TTL
    this.cache = new LRUCache(10000, 60 * 60 * 1000);
  }
  
  async getAssetsByOwner(ownerAddress, options = {}) {
    const cacheKey = `assets:${ownerAddress}:${JSON.stringify(options)}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Call Helius API
    try {
      const response = await axios.post(
        `${this.baseUrl}/v0/addresses/${ownerAddress}/balances`,
        options,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 10000
        }
      );
      
      const data = response.data;
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error('Helius API error:', error);
      throw new Error('Failed to fetch NFT data');
    }
  }
  
  async getAssetMetadata(mintAddress) {
    const cacheKey = `metadata:${mintAddress}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Call Helius DAS API with retry
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseUrl}/v0/token-metadata`,
          { mintAccounts: [mintAddress] },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            },
            timeout: 10000
          }
        );
        
        const data = response.data[0];
        
        if (!data) {
          throw new Error('Metadata not found');
        }
        
        // Cache the result
        this.cache.set(cacheKey, data);
        
        return data;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          // Exponential backoff: 1s, 2s
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }
    
    throw new Error(`Failed to fetch metadata after 3 attempts: ${lastError.message}`);
  }
  
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new HeliusProxyService();
```

### 6. Collection Cache Service

```javascript
// backend/src/services/collectionCache.js
const LRUCache = require('../utils/lruCache');
const db = require('../config/database');

class CollectionCacheService {
  constructor() {
    // In-memory LRU cache: 1000 entries, 5 minute TTL
    this.cache = new LRUCache(1000, 5 * 60 * 1000);
    
    // Background refresh every 5 minutes
    setInterval(() => this.refreshCache(), 5 * 60 * 1000);
  }
  
  async getCollection(collectionId) {
    const cacheKey = `collection:${collectionId}`;
    
    // Check cache
    let cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch from database
    const result = await db.query(
      `SELECT c.*, cr.daily_rate, cr.token_address, cr.token_symbol, cr.token_decimals
       FROM collections c
       LEFT JOIN collection_rewards cr ON c.id = cr.collection_id AND cr.is_active = TRUE
       WHERE c.id = $1`,
      [collectionId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const data = result.rows[0];
    
    // Cache the result
    this.cache.set(cacheKey, data);
    
    return data;
  }
  
  async getAllActiveCollections() {
    const cacheKey = 'collections:active';
    
    // Check cache
    let cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch from database
    const result = await db.query(
      `SELECT c.*, cr.daily_rate, cr.token_address, cr.token_symbol, cr.token_decimals
       FROM collections c
       LEFT JOIN collection_rewards cr ON c.id = cr.collection_id AND cr.is_active = TRUE
       WHERE c.is_active = TRUE`
    );
    
    const data = result.rows;
    
    // Cache the result
    this.cache.set(cacheKey, data);
    
    return data;
  }
  
  invalidate(collectionId) {
    if (collectionId) {
      this.cache.delete(`collection:${collectionId}`);
    }
    this.cache.delete('collections:active');
  }
  
  async refreshCache() {
    // Refresh all active collections in background
    try {
      await this.getAllActiveCollections();
    } catch (error) {
      console.error('Cache refresh error:', error);
    }
  }
}

module.exports = new CollectionCacheService();
```

### 7. Health Check Endpoint

```javascript
// backend/routes/health.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { Connection } = require('@solana/web3.js');

router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {}
  };
  
  // Check database
  try {
    const dbHealthy = await db.healthCheck();
    health.checks.database = dbHealthy ? 'healthy' : 'unhealthy';
  } catch (error) {
    health.checks.database = 'unhealthy';
    health.status = 'degraded';
  }
  
  // Check Solana RPC
  try {
    const connection = new Connection(process.env.MAINNET_RPC_PRIMARY);
    await connection.getSlot();
    health.checks.solana_rpc = 'healthy';
  } catch (error) {
    health.checks.solana_rpc = 'unhealthy';
    health.status = 'degraded';
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
```

### 8. Vercel Configuration

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/server.js",
      "use": "@vercel/node"
    },
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 9. Environment Variables (Vercel)

Required environment variables to configure in Vercel project settings:

```bash
# Database
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# Solana Network
MAINNET_RPC_PRIMARY=https://api.mainnet-beta.solana.com
MAINNET_RPC_FALLBACK=https://solana-api.projectserum.com
SOLANA_NETWORK=mainnet

# Helius
HELIUS_MAINNET_ENDPOINT=https://mainnet.helius-rpc.com
HELIUS_API_KEY=your-helius-api-key

# Authentication
JWT_SECRET=your-jwt-secret-here

# Rewards Wallet
REWARDS_WALLET_PRIVATE_KEY=your-rewards-wallet-private-key

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## Deployment Process

### 1. Initial Setup

1. Create Vercel project and link Git repository
2. Create Neon DB database
3. Configure environment variables in Vercel
4. Run database migrations on Neon DB

### 2. Automatic Deployments

Vercel automatically deploys on Git push:
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployment
- Vercel runs build, tests, and deploys
- Zero-downtime deployments handled automatically

### 3. Monitoring

- **Vercel Analytics**: Track performance metrics, page views, Core Web Vitals
- **Vercel Logs**: View application logs, errors, and request traces
- **Health Endpoint**: Monitor `/health` endpoint for service status

## Testing Strategy

### Unit Tests
- Authentication (nonce generation, signature verification)
- Input validation (wallet addresses, transaction hashes, numeric ranges)
- Rate limiting (enforcement, headers, per-wallet tracking)
- Reward calculation (time-based, trait multipliers)
- Transaction verification (amounts, confirmations, signatures)

### Integration Tests
- Auth flow with in-memory nonce storage
- Helius proxy with caching
- Reward calculation with database
- Error handling across layers

### End-to-End Tests
- Stake flow with real SOL (0.01 SOL test)
- Unstake flow with real SOL
- Claim rewards flow with real SOL
- Verify fees and balance updates

### Performance Tests
- 50 concurrent requests (< 500ms response time)
- Reward calculation for 100 staked NFTs (< 500ms)
- 20 concurrent database connections
- Lighthouse score > 85

### Security Tests
- Authentication flow testing
- Input validation with malformed data
- Rate limiting effectiveness
- NFT ownership verification
- Transaction verification with invalid signatures

## Summary

This simplified design eliminates unnecessary complexity while maintaining security and performance:

**Removed:**
- AWS Secrets Manager → Use Vercel environment variables
- Redis → Use in-memory storage with automatic cleanup
- Prometheus/CloudWatch → Use Vercel Analytics and Logs
- Custom CI/CD → Use Vercel's automatic Git deployments
- Blue-green deployment → Vercel handles zero-downtime deployments
- TypeScript migration → Optional, not critical for launch

**Kept:**
- All essential security controls (authentication, validation, rate limiting)
- Performance optimizations (query optimization, caching)
- Error handling and retry logic
- Health checks and monitoring
- Database migrations and audit logging

**Result:**
- 4-week deployment timeline (vs 10 weeks)
- 37 tasks (vs 59 tasks)
- Simpler operations and maintenance
- Lower infrastructure costs
- Faster iteration and debugging
