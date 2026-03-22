# NFT Staking Platform - Critical Fixes & Mainnet Migration

## Overview
This document outlines all critical issues found in the codebase and provides a structured approach to fix them while migrating from devnet to mainnet.

---

## Phase 1: Critical Database & Security Fixes (MUST DO FIRST)

### Task 1.1: Database Schema Updates
**Priority**: CRITICAL
**Files**: `database/schema.sql`

- [ ] Add `last_claim_timestamp` column to `staked_nfts` table
- [ ] Add `collection_id` column to `transactions` table
- [ ] Add `nft_count` column to `transactions` table
- [ ] Add `error_message` column to `transactions` table
- [ ] Add proper ON DELETE CASCADE to foreign keys
- [ ] Create migration script for existing database

**SQL Migration**:
```sql
ALTER TABLE staked_nfts ADD COLUMN last_claim_timestamp TIMESTAMP NULL AFTER stake_timestamp;
ALTER TABLE transactions ADD COLUMN collection_id INT NULL AFTER token_address;
ALTER TABLE transactions ADD COLUMN nft_count INT NULL AFTER collection_id;
ALTER TABLE transactions ADD COLUMN error_message TEXT NULL AFTER status;
```

### Task 1.2: Security - Rotate Exposed Credentials
**Priority**: CRITICAL
**Files**: `frontend/.env`, `backend/.env`

- [ ] Rotate Helius API key (current key is exposed)
- [ ] Generate new JWT_SECRET
- [ ] Update database password
- [ ] Remove all credentials from version control
- [ ] Add `.env` to `.gitignore` if not already
- [ ] Create `.env.example` files with placeholder values

### Task 1.3: Security - Move Helius to Backend
**Priority**: HIGH
**Files**: `backend/src/helius.js` (new), `frontend/src/services/helius.js` (modify)

- [ ] Create backend Helius service
- [ ] Create backend API endpoint `/api/v1/nfts/fetch` to proxy Helius calls
- [ ] Update frontend to call backend instead of Helius directly
- [ ] Remove Helius API key from frontend .env

---

## Phase 2: Mainnet Migration

### Task 2.1: Update Solana Network Configuration
**Priority**: CRITICAL
**Files**: Multiple

**Backend Changes**:
- [ ] `backend/.env`: Change `SOLANA_RPC_URL` to mainnet RPC
- [ ] `backend/.env`: Change `SOLANA_NETWORK=mainnet-beta`
- [ ] `backend/src/solana-transaction-utils.js`: Update default RPC endpoint
- [ ] Consider using paid RPC (Helius, QuickNode) for reliability

**Frontend Changes**:
- [ ] `frontend/.env`: Change `VITE_SOLANA_RPC_URL` to mainnet
- [ ] `frontend/src/services/wallet.js`: Change wallet adapters to `WalletAdapterNetwork.Mainnet`
- [ ] `frontend/src/components/User/StakingPanel.jsx`: Update RPC URL
- [ ] `frontend/src/components/User/RewardsPanel.jsx`: Update RPC URL
- [ ] Update all Solscan links from `?cluster=devnet` to mainnet

### Task 2.2: Add Mainnet Safety Checks
**Priority**: CRITICAL
**Files**: `backend/src/solana-transaction-utils.js`, `backend/server.js`

- [ ] Add environment validation on startup
- [ ] Add confirmation prompts for mainnet operations
- [ ] Add transaction simulation before sending
- [ ] Add maximum transaction amount limits
- [ ] Add admin approval for large reward distributions

---

## Phase 3: Fix Missing Dependencies

### Task 3.1: Frontend Package Updates
**Priority**: HIGH
**Files**: `frontend/package.json`

- [ ] Add `@solana/wallet-adapter-phantom`: `^0.9.24`
- [ ] Add `@solana/wallet-adapter-solflare`: `^0.6.28`
- [ ] Add `@solana/wallet-adapter-base`: `^0.9.23`
- [ ] Update `@solana/web3.js` to `^1.95.0` (stable version)
- [ ] Update `@solana/spl-token` to `^0.4.8`
- [ ] Run `npm install` after updates

### Task 3.2: Backend Package Updates
**Priority**: HIGH
**Files**: `backend/package.json`

- [ ] Pin `@metaplex-foundation/mpl-token-metadata` to `^3.2.1`
- [ ] Update `@solana/web3.js` to `^1.95.0`
- [ ] Update `@solana/spl-token` to `^0.4.8`
- [ ] Add `winston` for logging: `^3.11.0`
- [ ] Run `npm install` after updates

---

## Phase 4: Code Quality & Bug Fixes

### Task 4.1: Remove Duplicate Code
**Priority**: MEDIUM
**Files**: `backend/src/solana-api-endpoints.js`

- [ ] Remove duplicate `/nfts/stake/quote` endpoint (lines 130-180)
- [ ] Keep only the first implementation
- [ ] Test quote endpoint after removal

### Task 4.2: Fix Auth Route
**Priority**: HIGH
**Files**: `backend/routes/auth.js`

- [ ] Complete password verification logic (line 100+)
- [ ] Ensure bcrypt comparison is properly implemented
- [ ] Add proper error handling
- [ ] Test admin login flow

### Task 4.3: Fix NFT Ownership Verification
**Priority**: HIGH
**Files**: `backend/src/solana-nft-staking.js`

- [ ] Rewrite `verifyNFTOwnership` function
- [ ] Properly parse SPL token account data
- [ ] Use `@solana/spl-token` `getAccount` function
- [ ] Add error handling for invalid mint addresses

### Task 4.4: Fix Metaplex Import
**Priority**: MEDIUM
**Files**: `backend/src/solana-nft-staking.js`

- [ ] Remove complex fallback logic
- [ ] Use single import from pinned version
- [ ] Update `getNFTMetadata` to use correct API
- [ ] Test metadata fetching on mainnet

### Task 4.5: Improve Reward Claim Protection
**Priority**: HIGH
**Files**: `backend/src/solana-rewards-handler.js`

- [ ] Increase claim cooldown from 5 seconds to 60 seconds
- [ ] Add database-level claim locking
- [ ] Add transaction to prevent concurrent claims
- [ ] Test rapid claim attempts

### Task 4.6: Reduce Payment Verification Tolerance
**Priority**: HIGH
**Files**: `backend/src/solana-nft-staking.js`, `backend/src/solana-rewards-handler.js`

- [ ] Change tolerance from 0.001 SOL to 0.0001 SOL
- [ ] Add exact lamport matching option
- [ ] Log all payment verification attempts
- [ ] Test with various payment amounts

### Task 4.7: Standardize Hashlist Format
**Priority**: MEDIUM
**Files**: `backend/src/solana-api-endpoints.js`, `frontend/src/components/Admin/CollectionManager.jsx`

- [ ] Always store as JSON array
- [ ] Update collection creation to validate format
- [ ] Update collection update to validate format
- [ ] Migrate existing hashlists to JSON format

### Task 4.8: Remove Backend Helius Dependency
**Priority**: MEDIUM
**Files**: `backend/src/solana-rewards-handler.js`

- [ ] Remove `require('./helius')` (line 750+)
- [ ] Use placeholder images for staked NFTs
- [ ] Let frontend handle image fetching
- [ ] Update `getStakedNFTs` function

---

## Phase 5: Infrastructure Improvements

### Task 5.1: Implement In-Memory Nonce Storage
**Priority**: HIGH
**Files**: `backend/routes/auth.js`, `backend/src/services/auth.js`

- [ ] Use in-memory Map for nonce storage
- [ ] Add TTL for nonces (5 minutes)
- [ ] Implement automatic cleanup of expired nonces
- [ ] Add error handling for nonce operations

### Task 5.2: Add Proper Logging
**Priority**: MEDIUM
**Files**: All backend files

- [ ] Install Winston logger
- [ ] Create logging configuration
- [ ] Replace console.log with logger
- [ ] Add log levels (error, warn, info, debug)
- [ ] Add log rotation
- [ ] Remove debug logs from production

### Task 5.3: Database Connection Improvements
**Priority**: MEDIUM
**Files**: `backend/server.js`, `backend/src/db.js`

- [ ] Add `queueLimit: 100` to pool config
- [ ] Add connection timeout
- [ ] Add connection retry logic
- [ ] Add health check endpoint
- [ ] Monitor connection pool usage

### Task 5.4: Add Caching Layer
**Priority**: LOW
**Files**: `backend/src/cache.js` (new)

- [ ] Create in-memory LRU cache module
- [ ] Cache collections data (5 min TTL)
- [ ] Cache reward rates (5 min TTL)
- [ ] Add cache invalidation on updates
- [ ] Add cache hit/miss metrics

---

## Phase 6: API Improvements

### Task 6.1: Add Input Validation
**Priority**: HIGH
**Files**: All route files

- [ ] Install `joi` or `express-validator`
- [ ] Validate wallet addresses (base58, 32-44 chars)
- [ ] Validate NFT mint addresses
- [ ] Validate numeric inputs (fees, amounts)
- [ ] Return 400 with clear error messages

### Task 6.2: Add Rate Limiting
**Priority**: HIGH
**Files**: `backend/server.js`, `backend/middleware/rateLimiter.js` (new)

- [ ] Create per-wallet rate limiter
- [ ] Limit claim endpoint: 1 per minute per wallet
- [ ] Limit stake endpoint: 10 per hour per wallet
- [ ] Limit auth endpoints: 5 per minute per IP
- [ ] Return 429 with retry-after header

### Task 6.3: Add Minimum Stake Duration
**Priority**: MEDIUM
**Files**: `backend/src/solana-nft-staking.js`

- [ ] Add 24-hour minimum stake duration
- [ ] Check duration on unstake
- [ ] Return error if too early
- [ ] Add override for admin testing

### Task 6.4: Add Maximum Limits
**Priority**: MEDIUM
**Files**: `backend/src/solana-api-endpoints.js`

- [ ] Limit stake to 50 NFTs per transaction
- [ ] Limit total staked NFTs per wallet (optional)
- [ ] Add configuration for limits
- [ ] Return clear error messages

### Task 6.5: Improve CORS Configuration
**Priority**: HIGH
**Files**: `backend/server.js`

- [ ] Remove permissive fallback
- [ ] Reject unknown origins
- [ ] Add production domain to allowed origins
- [ ] Test CORS with frontend

### Task 6.6: Add Environment Validation
**Priority**: HIGH
**Files**: `backend/server.js`, `backend/src/config.js` (new)

- [ ] Create config validation module
- [ ] Check all required env vars on startup
- [ ] Fail fast if missing critical config
- [ ] Log configuration (hide secrets)
- [ ] Add config validation tests

---

## Phase 7: Frontend Improvements

### Task 7.1: Fix Wallet Context Re-renders
**Priority**: MEDIUM
**Files**: `frontend/src/context/WalletContext.jsx`

- [ ] Simplify dependency arrays
- [ ] Use more refs to prevent re-renders
- [ ] Memoize expensive calculations
- [ ] Test for infinite loops
- [ ] Add React DevTools profiling

### Task 7.2: Add Error Boundaries
**Priority**: MEDIUM
**Files**: `frontend/src/components/ErrorBoundary.jsx` (new)

- [ ] Create ErrorBoundary component
- [ ] Wrap App with ErrorBoundary
- [ ] Add fallback UI for errors
- [ ] Log errors to backend
- [ ] Test error scenarios

### Task 7.3: Improve Loading States
**Priority**: LOW
**Files**: All frontend components

- [ ] Add skeleton loaders
- [ ] Show transaction progress
- [ ] Add estimated time remaining
- [ ] Show transaction confirmation status
- [ ] Improve UX during long operations

### Task 7.4: Consistent RPC Usage
**Priority**: HIGH
**Files**: All frontend files using Solana connection

- [ ] Create single connection utility
- [ ] Use env variable for RPC URL
- [ ] Remove hardcoded RPC URLs
- [ ] Add connection error handling
- [ ] Add RPC fallback URLs

---

## Phase 8: Testing & Documentation

### Task 8.1: Add API Documentation
**Priority**: MEDIUM
**Files**: `docs/API.md` (new)

- [ ] Document all endpoints
- [ ] Add request/response examples
- [ ] Document error codes
- [ ] Add authentication flow
- [ ] Consider Swagger/OpenAPI

### Task 8.2: Add Admin Audit Logging
**Priority**: MEDIUM
**Files**: `backend/src/audit.js` (new), database schema

- [ ] Create audit_logs table
- [ ] Log all admin actions
- [ ] Log configuration changes
- [ ] Add audit log viewer in admin panel
- [ ] Add audit log retention policy

### Task 8.3: Create Testing Suite
**Priority**: LOW
**Files**: `backend/tests/` (new), `frontend/tests/` (new)

- [ ] Add Jest for backend tests
- [ ] Add unit tests for critical functions
- [ ] Add integration tests for API
- [ ] Add frontend component tests
- [ ] Add E2E tests with Playwright

### Task 8.4: Clean Up Dead Code
**Priority**: LOW
**Files**: `frontend.old/` directory

- [ ] Review old code for anything useful
- [ ] Extract any needed components
- [ ] Delete `frontend.old` directory
- [ ] Remove unused imports
- [ ] Remove commented code

---

## Phase 9: Performance Optimization

### Task 9.1: Fix N+1 Query Problem
**Priority**: MEDIUM
**Files**: `backend/src/solana-rewards-handler.js`

- [ ] Rewrite reward calculation query
- [ ] Use JOINs instead of loops
- [ ] Fetch all data in single query
- [ ] Test performance improvement
- [ ] Add query execution time logging

### Task 9.2: Optimize Helius Cache
**Priority**: LOW
**Files**: `frontend/src/services/helius.js`

- [ ] Implement LRU cache
- [ ] Add max cache size (100 entries)
- [ ] Add periodic cleanup
- [ ] Add cache statistics
- [ ] Consider IndexedDB for persistence

---

## Phase 10: Production Readiness

### Task 10.1: Add Health Checks
**Priority**: HIGH
**Files**: `backend/server.js`

- [ ] Add `/health` endpoint with detailed status
- [ ] Check database connectivity
- [ ] Check Solana RPC connectivity
- [ ] Return 503 if unhealthy

### Task 10.2: Add Monitoring
**Priority**: HIGH
**Files**: Multiple

- [ ] Add application metrics
- [ ] Track transaction success/failure rates
- [ ] Track API response times
- [ ] Add error tracking (Sentry)
- [ ] Set up alerts for critical errors

### Task 10.3: Add Backup Strategy
**Priority**: HIGH
**Files**: Documentation

- [ ] Document database backup procedure
- [ ] Set up automated daily backups
- [ ] Test restore procedure
- [ ] Document disaster recovery plan
- [ ] Backup encryption keys securely

### Task 10.4: Security Hardening
**Priority**: CRITICAL
**Files**: Multiple

- [ ] Add SQL injection protection (use parameterized queries everywhere)
- [ ] Add XSS protection headers
- [ ] Add CSRF protection
- [ ] Implement request signing for sensitive operations
- [ ] Add IP whitelisting for admin endpoints
- [ ] Enable HTTPS only
- [ ] Add security headers (helmet.js)

### Task 10.5: Load Testing
**Priority**: MEDIUM
**Files**: `tests/load/` (new)

- [ ] Create load testing scripts
- [ ] Test with 100 concurrent users
- [ ] Test stake/unstake under load
- [ ] Test claim under load
- [ ] Identify bottlenecks
- [ ] Optimize based on results

---

## Execution Order

### Week 1: Critical Fixes (Cannot skip)
1. Task 1.1: Database Schema Updates
2. Task 1.2: Security - Rotate Credentials
3. Task 2.1: Mainnet Migration
4. Task 2.2: Mainnet Safety Checks
5. Task 3.1: Frontend Dependencies
6. Task 3.2: Backend Dependencies

### Week 2: Core Functionality
7. Task 4.1: Remove Duplicate Code
8. Task 4.2: Fix Auth Route
9. Task 4.3: Fix NFT Ownership
10. Task 4.5: Improve Claim Protection
11. Task 4.6: Payment Verification
12. Task 6.1: Input Validation
13. Task 6.5: CORS Configuration

### Week 3: Infrastructure
14. Task 5.1: In-Memory Storage Implementation
15. Task 5.2: Proper Logging
16. Task 6.2: Rate Limiting
17. Task 6.6: Environment Validation
18. Task 10.1: Health Checks

### Week 4: Polish & Production
19. Task 1.3: Move Helius to Backend
20. Task 7.4: Consistent RPC
21. Task 10.4: Security Hardening
22. Task 10.2: Monitoring
23. Task 10.3: Backup Strategy
24. Remaining tasks as time permits

---

## Testing Checklist Before Mainnet Launch

- [ ] All database migrations applied successfully
- [ ] All environment variables set correctly
- [ ] Wallet connection works on mainnet
- [ ] Stake flow works end-to-end
- [ ] Unstake flow works end-to-end
- [ ] Claim flow works end-to-end
- [ ] Payment verification works correctly
- [ ] Reward calculation is accurate
- [ ] Admin panel fully functional
- [ ] All API endpoints return correct responses
- [ ] Error handling works properly
- [ ] Rate limiting prevents abuse
- [ ] Logging captures all important events
- [ ] Health checks pass
- [ ] Backup and restore tested
- [ ] Security audit completed
- [ ] Load testing passed

---

## Emergency Rollback Plan

If issues occur after mainnet deployment:

1. **Immediate Actions**:
   - Switch RPC back to devnet in .env
   - Restart backend server
   - Notify users of maintenance

2. **Investigation**:
   - Check logs for errors
   - Check database for data corruption
   - Check Solana transactions on explorer
   - Identify root cause

3. **Recovery**:
   - Fix identified issues
   - Test on devnet first
   - Deploy fix to mainnet
   - Verify all systems operational

---

## Notes

- **Backup before starting**: Create full database backup before any changes
- **Test on devnet first**: Test each change on devnet before mainnet
- **One task at a time**: Don't rush, complete and test each task
- **Document changes**: Update this file as you complete tasks
- **Ask for help**: If stuck on any task, seek assistance

---

## Completion Tracking

**Started**: [DATE]
**Target Completion**: [DATE + 4 weeks]
**Actual Completion**: [DATE]

**Progress**: 0/100 tasks completed (0%)
