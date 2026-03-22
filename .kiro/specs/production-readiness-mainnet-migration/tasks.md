# Implementation Plan: Production Readiness & Mainnet Migration (Simplified)

## Overview

This streamlined implementation plan addresses 39 requirements for migrating a Solana NFT staking platform from devnet to mainnet production using Vercel (hosting) and Neon DB (PostgreSQL). The plan focuses on essential security, functionality, and deployment tasks without AWS or Redis dependencies.

## Timeline

- Phase 1: Database Schema & Core Fixes (Week 1)
- Phase 2: Security Implementation (Week 1-2)
- Phase 3: Backend Services & Validation (Week 2-3)
- Phase 4: Frontend & Testing (Week 3-4)
- Phase 5: Deployment & Launch (Week 4)

**Total Duration: 4 weeks**

## Tasks

## Phase 0: Cleanup AWS/Redis Code (Week 1 - Day 1)

- [x] 0. Remove AWS and Redis implementations
  - [x] 0.1 Remove AWS Secrets Manager code
    - Delete `backend/src/config/secrets.js`
    - Delete `backend/src/config/secrets.test.js`
    - Remove AWS SDK dependency from package.json
    - _Requirements: 5.5_

  - [x] 0.2 Remove Redis implementation code
    - Delete `backend/src/config/redis.js`
    - Delete `backend/src/config/redis.test.js`
    - Delete `backend/src/config/redis-example.js`
    - Delete `backend/src/config/REDIS.md`
    - Delete `backend/src/config/REDIS_SETUP.md`
    - Remove Redis dependency from package.json
    - _Requirements: 6.1_

  - [x] 0.3 Update auth.js to remove Redis dependencies
    - Remove any Redis client imports
    - Prepare for in-memory nonce storage implementation
    - _Requirements: 6.1_

  - [x] 0.4 Update db.js to remove AWS Secrets Manager
    - Remove secrets.js import
    - Use process.env.DATABASE_URL directly
    - _Requirements: 5.5_

  - [x] 0.5 Clean up documentation
    - Update README.md to remove AWS/Redis references
    - Update any other docs mentioning AWS or Redis
    - _Requirements: 36.1_

## Phase 1: Database Schema & Core Fixes (Week 1)

- [x] 1. Database schema updates
  - [x] 1.1 Create migration script for missing columns
    - Add `last_claim_timestamp` to `staked_nfts` table
    - Add `collection_id` and `nft_count` to `transactions` table
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Update foreign key constraints with CASCADE rules
    - Update all foreign keys with ON DELETE CASCADE and ON UPDATE CASCADE
    - _Requirements: 1.4, 1.5_

  - [x] 1.3 Add performance indexes
    - Add indexes on frequently queried columns
    - Add composite indexes for reward calculations
    - _Requirements: 18.4_

  - [x] 1.4 Create audit_logs table
    - Create table for administrative action logging
    - Add indexes for efficient querying
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 1.5 Create rollback scripts and test migrations
    - Write down migrations for each up migration
    - Test on development database
    - _Requirements: 39.2_

- [x] 2. Network configuration
  - [x] 2.1 Create network configuration module
    - Define mainnet RPC endpoints (primary and fallback)
    - Define Helius mainnet endpoint
    - Define mainnet explorer URL
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Add network configuration validation
    - Validate all required endpoints on startup
    - Fail fast with descriptive errors
    - _Requirements: 2.5, 28.2_

- [x] 3. Fix API route integrity
  - Remove duplicate route definitions
  - Implement complete authentication route logic
  - Ensure proper HTTP status codes
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Remove hardcoded secrets
  - Remove JWT_SECRET fallback values
  - Remove DB_PASSWORD fallback values
  - Remove API key fallbacks
  - Add startup validation for required secrets
  - _Requirements: 5.1, 5.2, 5.5_

## Phase 2: Security Implementation (Week 1-2)

- [x] 5. Implement in-memory nonce storage
  - [x] 5.1 Create AuthService with in-memory nonce Map
    - Generate cryptographically secure nonces
    - Store with 5-minute TTL
    - Implement automatic cleanup of expired nonces
    - _Requirements: 6.1, 6.2_

  - [x] 5.2 Implement signature verification
    - Verify nonce matches message
    - Verify signature using nacl
    - Delete nonce after use (single use)
    - _Requirements: 6.3, 6.4_

  - [x] 5.3 Add periodic cleanup task
    - Clean expired nonces every minute
    - _Requirements: 6.5_

- [x] 6. Implement input validation middleware
  - [x] 6.1 Create wallet address validation
    - Validate Solana address format (base58, 32-44 characters)
    - Return HTTP 400 for invalid addresses
    - _Requirements: 8.1_

  - [x] 6.2 Create transaction hash validation
    - Validate Solana signature format (88 characters)
    - Return HTTP 400 for invalid hashes
    - _Requirements: 8.3_

  - [x] 6.3 Create numeric range validation
    - Validate number type and ranges
    - _Requirements: 8.2_

  - [x] 6.4 Create NFT array validation
    - Validate array type and size (max 10)
    - Validate each mint address
    - _Requirements: 26.1, 26.2_

- [x] 7. Implement in-memory rate limiting
  - [x] 7.1 Create WalletRateLimiter class
    - Use in-memory Map with sliding window algorithm
    - Track requests per wallet address
    - _Requirements: 9.5_

  - [x] 7.2 Create endpoint-specific rate limiters
    - Claim: 5 req/min per wallet
    - Stake: 20 req/min per wallet
    - Unstake: 20 req/min per wallet
    - Auth: 10 req/min per wallet
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 7.3 Add rate limit headers
    - X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
    - Return HTTP 429 with Retry-After when exceeded
    - _Requirements: 9.4_

- [x] 8. Configure CORS security
  - Create explicit whitelist of allowed origins
  - Reject non-whitelisted origins
  - Remove wildcard (*) from production
  - Allow localhost in development
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

## Phase 3: Backend Services & Validation (Week 2-3)

- [x] 9. Implement Helius proxy service
  - [x] 9.1 Create HeliusProxyService with in-memory LRU cache
    - Initialize with Helius API key from environment
    - Implement LRU cache with 10,000 entry limit
    - Set 1-hour TTL for cache entries
    - _Requirements: 3.2, 20.1, 20.2, 20.3, 20.4_

  - [x] 9.2 Implement getAssetsByOwner method
    - Call Helius API with caching
    - Handle errors with descriptive messages
    - _Requirements: 11.2_

  - [x] 9.3 Implement getAssetMetadata with retry logic
    - 3 retry attempts with exponential backoff
    - Cache successful responses
    - _Requirements: 12.2, 12.3_

  - [x] 9.4 Create proxy API endpoints
    - POST /api/helius/nfts/by-owner
    - POST /api/helius/nfts/metadata
    - _Requirements: 3.2_

  - [x] 9.5 Remove Helius API keys from frontend
    - Remove from environment files
    - Update frontend to use proxy
    - _Requirements: 5.3_

- [x] 10. Implement NFT ownership verification
  - [x] 10.1 Create ownership verification service
    - Query Helius for current owner
    - Return HTTP 403 if verification fails
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 10.2 Add to stake endpoint
    - Verify ownership before processing
    - _Requirements: 11.4_

- [x] 11. Implement secure reward calculation
  - [x] 11.1 Update calculation to use last_claim_timestamp
    - Calculate from last claim or stake time
    - Use 60-second minimum window
    - Record exact claim timestamp
    - _Requirements: 13.1, 13.3, 13.4_

  - [x] 11.2 Add database transaction isolation
    - Use locks to prevent race conditions
    - _Requirements: 13.2, 13.5_

- [x] 12. Implement transaction verification
  - [x] 12.1 Create verification service
    - Verify amounts with 100,000 lamport tolerance
    - Wait for confirmation before DB updates
    - Verify signatures using RPC
    - 15-second minimum timeout
    - _Requirements: 14.1, 14.2, 14.3, 14.5_

  - [x] 12.2 Add verification logging
    - Log failures with details
    - _Requirements: 14.4_

- [x] 13. Implement hashlist format standardization
  - [x] 13.1 Update to newline-separated format
    - Parse newline-separated addresses
    - Validate each address
    - Normalize to base58
    - _Requirements: 15.1, 15.2, 15.4_

  - [x] 13.2 Create migration tool
    - Convert JSON to newline format
    - _Requirements: 15.5_

- [x] 14. Add JSON parsing error handling
  - Add try-catch for all JSON parsing
  - Return HTTP 400 on parse failure
  - Validate JSON structure
  - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 15. Implement minimum stake duration
  - [x] 15.1 Add duration validation to unstake
    - Enforce 24-hour minimum
    - Return HTTP 400 if too early
    - _Requirements: 25.1, 25.2_

  - [x] 15.2 Add remaining lock time display
    - Calculate and return remaining time
    - _Requirements: 25.4_

- [x] 16. Implement transaction retry logic
  - [x] 16.1 Create retry service
    - 3 attempts with exponential backoff
    - Check status before retry
    - Increase priority fee on retry
    - _Requirements: 33.1, 33.2_

  - [x] 16.2 Add confirmation timeout
    - 60-second timeout
    - Check status on timeout
    - _Requirements: 33.3, 33.4_

  - [x] 16.3 Use recent blockhash
    - Fetch before each transaction
    - _Requirements: 33.5_

- [x] 17. Optimize database queries
  - [x] 17.1 Implement single-query reward calculation
    - Use JOINs to eliminate N+1 problem
    - Include trait multipliers
    - _Requirements: 18.1, 18.2_

  - [x] 17.2 Verify performance
    - Test with 100 staked NFTs
    - Ensure < 500ms completion
    - _Requirements: 18.3_

- [x] 18. Configure Neon DB connection
  - [x] 18.1 Set up connection with Neon's serverless pooling
    - Use connection string from environment
    - Configure 10-second timeout
    - _Requirements: 17.1, 17.2, 17.3_

  - [x] 18.2 Add connection error handling
    - Return HTTP 503 on failure
    - Implement retry logic
    - _Requirements: 17.4, 17.5_

- [x] 19. Implement in-memory collection cache
  - [x] 19.1 Create CollectionCache with LRU
    - 5-minute refresh interval
    - Background refresh
    - Max 1000 entries
    - _Requirements: 19.1, 19.2, 19.5_

  - [x] 19.2 Add cache invalidation
    - Invalidate on settings changes
    - _Requirements: 19.3_

  - [x] 19.3 Implement stale-while-revalidate
    - Serve stale while refreshing
    - _Requirements: 19.4_

- [x] 20. Implement production logging
  - [x] 20.1 Create structured logger
    - JSON format for production
    - Redact sensitive data
    - INFO level for production
    - _Requirements: 31.1, 31.2, 31.3_

  - [x] 20.2 Remove console.log statements
    - Replace with logger calls
    - _Requirements: 31.4_

  - [x] 20.3 Use Vercel's logging
    - Integrate with Vercel Logs
    - _Requirements: 31.5_

- [x] 21. Implement error handling
  - [x] 21.1 Create custom error classes
    - AppError, ValidationError, AuthenticationError, etc.
    - _Requirements: 30.4_

  - [x] 21.2 Create centralized error middleware
    - Consistent JSON format
    - Log with stack traces
    - Hide internal details in production
    - _Requirements: 30.1, 30.2, 30.3, 30.5_

- [x] 22. Implement health check endpoint
  - Create /health endpoint
  - Check database connectivity
  - Check RPC connectivity
  - Return 200 for healthy, 503 for degraded
  - _Requirements: 34.1, 34.2, 34.3_

- [x] 23. Implement audit logging
  - [x] 23.1 Create audit log service
    - Log to audit_logs table
    - Include all required fields
    - _Requirements: 10.1, 10.2_

  - [x] 23.2 Add to admin endpoints
    - Log collection modifications
    - Log reward rate changes
    - _Requirements: 10.3_

  - [x] 23.3 Configure retention
    - 1-year retention
    - Append-only storage
    - _Requirements: 10.4, 10.5_

## Phase 4: Frontend & Testing (Week 3-4)

- [x] 24. Update frontend network configuration
  - [x] 24.1 Create network config module
    - Define mainnet RPC from environment
    - Define mainnet explorer URL
    - _Requirements: 2.1, 2.4_

  - [x] 24.2 Update Wallet Adapter
    - Configure with mainnet RPC
    - _Requirements: 2.2, 23.2_

  - [x] 24.3 Add network indicator
    - Display "Mainnet" in UI
    - Warn if wrong network
    - _Requirements: 23.3, 23.4_

- [x] 25. Implement error boundaries
  - [x] 25.1 Create Error Boundary components
    - At route level
    - Around wallet components
    - _Requirements: 22.1, 22.2_

  - [x] 25.2 Add error UI
    - User-friendly messages
    - Retry and Go Home actions
    - _Requirements: 22.3, 22.4, 22.5_

- [x] 26. Fix React render stability
  - Memoize WalletContext value
  - Use stable dependencies in useEffect
  - Avoid new object references
  - _Requirements: 21.1, 21.2, 21.3, 21.4_

- [x] 27. Implement transaction loading states
  - [x] 27.1 Add loading indicators
    - Display spinner
    - Disable buttons during processing
    - Show estimated time
    - _Requirements: 24.1, 24.2, 24.3_

  - [x] 27.2 Add completion feedback
    - Success message with link
    - Error message with retry
    - _Requirements: 24.4, 24.5_

- [x] 28. Update frontend to use backend proxy
  - Update NFT fetching to use proxy endpoints
  - Remove direct Helius calls
  - _Requirements: 3.2, 5.3_

- [x] 29. Add remaining lock time display
  - Calculate and display for each staked NFT
  - _Requirements: 25.4_

- [x] 30. Write unit tests
  - [x] 30.1 Authentication tests
    - Nonce generation and validation
    - Signature verification
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 30.2 Validation middleware tests
    - Wallet address validation
    - Transaction hash validation
    - Numeric range validation
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 30.3 Rate limiting tests
    - Enforcement
    - Headers
    - Per-wallet tracking
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 30.4 Reward calculation tests
    - Time-based calculation
    - Trait multipliers
    - Timestamp recording
    - _Requirements: 13.1, 13.3, 13.4_

  - [x] 30.5 Transaction verification tests
    - Amount verification
    - Confirmation waiting
    - Signature verification
    - _Requirements: 14.1, 14.2, 14.3_

- [x] 31. Perform security testing
  - Test authentication flow
  - Test input validation with malformed data
  - Test rate limiting effectiveness
  - Test NFT ownership verification
  - Test transaction verification
  - _Requirements: 37.1, 37.2, 37.3, 37.4, 37.5_

- [x] 32. Perform end-to-end mainnet testing
  - [x] 32.1 Test stake flow with real SOL
    - Use small amount (0.01 SOL)
    - Verify fees and balance updates
    - _Requirements: 35.1, 35.4, 35.5_

  - [x] 32.2 Test unstake flow
    - Complete full transaction
    - Verify updates
    - _Requirements: 35.2, 35.4, 35.5_

  - [x] 32.3 Test claim rewards flow
    - Complete full transaction
    - Verify calculation and updates
    - _Requirements: 35.3, 35.4, 35.5_

- [x] 33. Perform performance testing
  - [x] 33.1 Test concurrent requests
    - 50 concurrent users
    - Measure response times
    - _Requirements: 38.1_

  - [x] 33.2 Test reward calculation performance
    - 100 staked NFTs per wallet
    - Verify < 500ms completion
    - _Requirements: 38.2_

  - [x] 33.3 Test database connections
    - 20 concurrent connections
    - _Requirements: 38.3_

  - [x] 33.4 Run Lighthouse audit
    - Achieve score > 85
    - _Requirements: 38.4_

## Phase 5: Deployment & Launch (Week 4)

- [x] 34. Prepare Vercel deployment
  - [x] 34.1 Create vercel.json configuration
    - Configure build settings
    - Configure routes
    - _Requirements: 27.1_

  - [x] 34.2 Configure environment variables
    - Set all required secrets in Vercel
    - Configure Neon DB connection string
    - _Requirements: 27.2, 27.3, 29.1, 29.2, 29.5_

  - [x] 34.3 Set up Vercel Analytics
    - Enable analytics
    - Configure monitoring
    - _Requirements: 34.4_

- [x] 35. Code cleanup
  - Remove frontend.old directory
  - Remove commented-out code
  - Remove unused imports
  - Pass linting with zero warnings
  - Update .gitignore
  - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5_

- [x] 36. Update documentation
  - [x] 36.1 Update README
    - Vercel deployment instructions
    - Environment variable documentation
    - _Requirements: 36.1, 36.2_

  - [x] 36.2 Document API endpoints
    - List all endpoints with examples
    - _Requirements: 36.3_

  - [x] 36.3 Create troubleshooting guide
    - Common issues and solutions
    - _Requirements: 36.4_

  - [x] 36.4 Document Neon DB setup
    - Connection setup
    - Migration procedures
    - _Requirements: 36.5_

- [x] 37. Deploy to Vercel
  - [x] 37.1 Connect Git repository
    - Link to Vercel project
    - _Requirements: 39.1_

  - [x] 37.2 Run database migrations
    - Execute on Neon DB
    - Verify success
    - _Requirements: 39.2_

  - [x] 37.3 Deploy to production
    - Trigger deployment
    - Monitor build logs
    - _Requirements: 39.1_

  - [x] 37.4 Run smoke tests
    - Verify health endpoint
    - Test basic functionality
    - _Requirements: 39.3_

  - [x] 37.5 Monitor initial traffic
    - Check Vercel Logs
    - Check Vercel Analytics
    - Verify no errors
    - _Requirements: 34.5, 39.4_

## Summary

This streamlined plan reduces the original 59 tasks to 37 focused tasks by:
- Removing AWS Secrets Manager (use Vercel environment variables)
- Removing Redis (use in-memory storage with cleanup)
- Removing TypeScript migration (optional, not critical)
- Removing property-based tests (focus on essential unit tests)
- Removing complex CI/CD setup (use Vercel's built-in deployments)
- Removing Prometheus/CloudWatch (use Vercel Analytics and Logs)
- Simplifying deployment to Vercel's automatic Git deployments

The result is a secure, working staking portal that can be deployed in 4 weeks instead of 10 weeks.
