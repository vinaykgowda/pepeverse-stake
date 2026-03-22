# Requirements Document: Production Readiness & Mainnet Migration

## Introduction

This document specifies requirements for migrating a Solana NFT staking platform from devnet to mainnet production environment using Vercel (hosting) and Neon DB (PostgreSQL). The platform is a non-custodial NFT staking system that requires security hardening, performance optimization, and infrastructure simplification for production deployment. This simplified approach eliminates AWS services and Redis dependencies in favor of Vercel's built-in features and in-memory solutions.

## Glossary

- **Platform**: The Solana NFT staking application system (frontend + backend + database)
- **Backend**: The Node.js Express server handling API requests and blockchain interactions
- **Frontend**: The React-based web application user interface
- **Database**: The Neon DB PostgreSQL database storing staking and transaction data
- **Vercel**: Serverless hosting platform for frontend and backend
- **Neon_DB**: Serverless PostgreSQL database with automatic connection pooling
- **Mainnet**: Solana's production blockchain network
- **Devnet**: Solana's development/testing blockchain network
- **NFT**: Non-Fungible Token on the Solana blockchain
- **Staking**: The process of locking NFTs to earn rewards
- **Helius**: Third-party Solana RPC and API service provider
- **Wallet_Adapter**: Solana wallet connection library for web applications
- **RPC_Endpoint**: Remote Procedure Call endpoint for blockchain communication
- **JWT**: JSON Web Token for authentication
- **Nonce**: Single-use random value for authentication security
- **In_Memory_Cache**: Temporary data storage in application memory
- **Transaction_Verification**: Process of confirming blockchain transaction validity
- **Reward_Calculation**: Algorithm determining staking rewards based on time and rate
- **Collection**: A group of related NFTs with shared characteristics
- **Hashlist**: List of verified NFT mint addresses for a collection
- **Metaplex**: Solana NFT standard and metadata protocol
- **CORS**: Cross-Origin Resource Sharing security mechanism
- **Rate_Limiter**: In-memory throttling mechanism to prevent API abuse
- **Audit_Log**: Immutable record of administrative actions
- **Error_Boundary**: React component for graceful error handling
- **Environment_Variable**: Configuration value stored in Vercel project settings

## Requirements

### Requirement 1: Database Schema Integrity

**User Story:** As a platform operator, I want complete and consistent database schema, so that all staking operations function correctly without data loss.

#### Acceptance Criteria

1. THE Database SHALL include a `last_claim_timestamp` column in the `staked_nfts` table with TIMESTAMP type
2. THE Database SHALL include a `collection_id` column in the `transactions` table with foreign key reference
3. THE Database SHALL include an `nft_count` column in the `transactions` table with INTEGER type
4. THE Database SHALL define CASCADE rules for all foreign key relationships
5. WHEN a parent record is deleted, THE Database SHALL automatically delete or update dependent records according to CASCADE rules

### Requirement 2: Network Configuration Consistency

**User Story:** As a developer, I want consistent network configuration across all components, so that the platform connects to the correct blockchain environment.

#### Acceptance Criteria

1. THE Backend SHALL use mainnet RPC endpoints for all Solana connections
2. THE Frontend SHALL use mainnet RPC endpoints for all Wallet_Adapter configurations
3. THE Backend SHALL use mainnet-compatible Solana program IDs
4. THE Frontend SHALL display mainnet transaction explorer links
5. WHEN the platform starts, THE Platform SHALL validate that all network configurations match the target environment

### Requirement 3: Dependency Management

**User Story:** As a developer, I want all required dependencies properly declared, so that the application builds and runs without missing modules.

#### Acceptance Criteria

1. THE Frontend SHALL include all Wallet_Adapter dependencies in package.json
2. THE Backend SHALL include Helius service dependencies in package.json
3. WHEN installing dependencies, THE Platform SHALL successfully install without errors
4. THE Platform SHALL import all required modules without runtime errors

### Requirement 4: API Route Integrity

**User Story:** As a backend developer, I want unique and properly implemented API routes, so that requests are handled correctly without conflicts.

#### Acceptance Criteria

1. THE Backend SHALL define each API route exactly once
2. THE Backend SHALL implement complete logic for all authentication routes including password verification
3. WHEN duplicate routes exist, THE Backend SHALL remove the duplicate and keep the correct implementation
4. THE Backend SHALL return appropriate HTTP status codes for all route handlers

### Requirement 5: Secrets Management

**User Story:** As a security engineer, I want secure secrets management using Vercel environment variables, so that sensitive credentials are not exposed or hardcoded.

#### Acceptance Criteria

1. THE Backend SHALL NOT include hardcoded fallback values for JWT secrets
2. THE Backend SHALL NOT include hardcoded fallback values for database credentials
3. THE Frontend SHALL NOT expose API keys in client-side environment files
4. WHEN required secrets are missing, THE Platform SHALL fail to start with a descriptive error message
5. THE Platform SHALL load all secrets from Vercel environment variables

### Requirement 6: Authentication Security

**User Story:** As a security engineer, I want secure wallet signature authentication with nonce validation, so that user sessions are secure.

#### Acceptance Criteria

1. THE Backend SHALL store nonces in an in-memory Map with automatic cleanup
2. THE Backend SHALL expire nonces after 5 minutes or single use
3. THE Backend SHALL validate wallet addresses using cryptographic signature verification
4. WHEN a nonce is reused, THE Backend SHALL reject the authentication attempt
5. THE Backend SHALL implement periodic cleanup of expired nonces from memory

### Requirement 7: CORS Security Configuration

**User Story:** As a security engineer, I want restrictive CORS policies, so that only authorized origins can access the API.

#### Acceptance Criteria

1. THE Backend SHALL define an explicit whitelist of allowed origins
2. THE Backend SHALL reject requests from origins not in the whitelist
3. THE Backend SHALL NOT use wildcard (*) for Access-Control-Allow-Origin in production
4. WHERE development mode is enabled, THE Backend SHALL allow localhost origins

### Requirement 8: Input Validation

**User Story:** As a security engineer, I want comprehensive input validation, so that malicious or malformed data is rejected.

#### Acceptance Criteria

1. WHEN a wallet address is received, THE Backend SHALL validate it matches Solana address format (base58, 32-44 characters)
2. WHEN numeric inputs are received, THE Backend SHALL validate they are within acceptable ranges
3. WHEN transaction hashes are received, THE Backend SHALL validate they match Solana signature format
4. IF invalid input is detected, THEN THE Backend SHALL return HTTP 400 with descriptive error message

### Requirement 9: Rate Limiting Protection

**User Story:** As a platform operator, I want in-memory rate limiting on sensitive endpoints, so that the platform is protected from abuse.

#### Acceptance Criteria

1. THE Backend SHALL implement in-memory rate limiting on the claim rewards endpoint with maximum 5 requests per minute per wallet
2. THE Backend SHALL implement in-memory rate limiting on stake endpoints with maximum 20 requests per minute per wallet
3. THE Backend SHALL implement in-memory rate limiting on unstake endpoints with maximum 20 requests per minute per wallet
4. WHEN rate limits are exceeded, THE Backend SHALL return HTTP 429 with retry-after header
5. THE Backend SHALL track rate limits per wallet address using in-memory sliding window algorithm

### Requirement 10: Administrative Audit Logging

**User Story:** As a compliance officer, I want comprehensive audit logs of administrative actions, so that all privileged operations are traceable.

#### Acceptance Criteria

1. WHEN an admin modifies collection settings, THE Backend SHALL log the action with timestamp, admin identifier, and changes made
2. WHEN an admin modifies reward rates, THE Backend SHALL log the action with old and new values
3. WHEN an admin accesses sensitive data, THE Backend SHALL log the access with timestamp and data accessed
4. THE Backend SHALL store audit logs in an append-only table
5. THE Backend SHALL retain audit logs for minimum 1 year

### Requirement 11: NFT Ownership Verification

**User Story:** As a platform operator, I want accurate NFT ownership verification, so that users can only stake NFTs they actually own.

#### Acceptance Criteria

1. WHEN verifying NFT ownership, THE Backend SHALL check the current owner field from blockchain data
2. THE Backend SHALL query Helius or RPC for real-time ownership data
3. IF ownership verification fails, THEN THE Backend SHALL reject the stake request with HTTP 403
4. THE Backend SHALL verify ownership immediately before processing stake transactions

### Requirement 12: Metaplex Metadata Handling

**User Story:** As a developer, I want proper Metaplex metadata handling, so that NFT data is accurately retrieved and displayed.

#### Acceptance Criteria

1. WHEN Metaplex metadata cannot be fetched, THE Backend SHALL return an error instead of creating placeholder data
2. THE Backend SHALL retry metadata fetches up to 3 times with exponential backoff
3. IF metadata fetch fails after retries, THEN THE Backend SHALL log the error and return HTTP 503
4. THE Backend SHALL validate Metaplex metadata structure before processing

### Requirement 13: Reward Calculation Security

**User Story:** As a platform operator, I want secure reward calculations, so that users cannot exploit timing windows to claim excess rewards.

#### Acceptance Criteria

1. THE Backend SHALL use a minimum 60-second window for reward calculation updates
2. WHEN calculating rewards, THE Backend SHALL use database transaction isolation to prevent race conditions
3. THE Backend SHALL record the exact timestamp of each claim in the Database
4. THE Backend SHALL calculate rewards based on time since last claim, not current time minus arbitrary window
5. WHEN concurrent claim requests occur, THE Backend SHALL process them serially using database locks

### Requirement 14: Transaction Verification Accuracy

**User Story:** As a platform operator, I want strict transaction verification, so that only legitimate transactions are accepted.

#### Acceptance Criteria

1. THE Backend SHALL verify transaction amounts with tolerance no greater than 0.0001 SOL (100,000 lamports)
2. THE Backend SHALL wait for transaction confirmation before updating database state
3. THE Backend SHALL verify transaction signatures using Solana RPC
4. WHEN a transaction fails verification, THE Backend SHALL log the failure details and reject the operation
5. THE Backend SHALL implement minimum 15-second timeout for transaction confirmation waits

### Requirement 15: Hashlist Format Consistency

**User Story:** As a developer, I want consistent hashlist format handling, so that collection verification works reliably.

#### Acceptance Criteria

1. THE Backend SHALL support exactly one hashlist format: newline-separated mint addresses
2. WHEN loading hashlists, THE Backend SHALL validate each line is a valid Solana address
3. THE Backend SHALL reject hashlists containing invalid addresses with descriptive error
4. THE Backend SHALL normalize all addresses to base58 format
5. THE Backend SHALL provide a migration tool to convert JSON hashlists to newline format

### Requirement 16: JSON Data Integrity

**User Story:** As a developer, I want explicit JSON parsing error handling, so that data corruption is detected and reported.

#### Acceptance Criteria

1. WHEN parsing traits JSON, THE Backend SHALL catch and log parsing errors
2. IF JSON parsing fails, THEN THE Backend SHALL return HTTP 400 with error details
3. THE Backend SHALL validate JSON structure matches expected schema before processing
4. THE Backend SHALL NOT silently ignore malformed JSON data

### Requirement 17: Database Connection Management

**User Story:** As a platform operator, I want reliable database connections using Neon DB's serverless pooling, so that the platform handles connections efficiently.

#### Acceptance Criteria

1. THE Backend SHALL use Neon DB's built-in connection pooling for serverless environments
2. THE Backend SHALL configure connection timeout of 10 seconds
3. THE Backend SHALL handle connection errors gracefully with retry logic
4. WHEN database connection fails, THE Backend SHALL return HTTP 503 with retry-after header
5. THE Backend SHALL use Neon DB's connection string from Vercel environment variables

### Requirement 18: Query Performance Optimization

**User Story:** As a platform operator, I want optimized database queries, so that reward calculations complete quickly even with many staked NFTs.

#### Acceptance Criteria

1. THE Backend SHALL calculate rewards using a single aggregated query per wallet
2. THE Backend SHALL NOT execute separate queries for each staked NFT (N+1 problem)
3. WHEN calculating rewards for a wallet, THE Backend SHALL complete within 500ms for up to 100 staked NFTs
4. THE Backend SHALL use database indexes on `wallet_address` and `staked_at` columns

### Requirement 19: Collection Data Caching

**User Story:** As a platform operator, I want in-memory cached collection data, so that frequently accessed data loads quickly without repeated database queries.

#### Acceptance Criteria

1. THE Backend SHALL cache collection configuration data using in-memory LRU cache
2. THE Backend SHALL refresh cache every 5 minutes
3. THE Backend SHALL invalidate cache when collection settings are modified
4. WHEN cache is stale, THE Backend SHALL serve stale data while refreshing in background
5. THE Backend SHALL implement cache with maximum 1000 entries using LRU eviction

### Requirement 20: Helius Cache Management

**User Story:** As a platform operator, I want bounded in-memory cache for Helius API responses, so that memory usage remains stable over time.

#### Acceptance Criteria

1. THE Backend SHALL implement LRU (Least Recently Used) eviction for in-memory Helius cache
2. THE Backend SHALL limit Helius cache to maximum 10,000 entries
3. THE Backend SHALL expire Helius cache entries after 1 hour
4. WHEN cache size exceeds limit, THE Backend SHALL evict oldest entries first using LRU algorithm

### Requirement 21: Frontend Render Stability

**User Story:** As a frontend developer, I want stable React components, so that the UI does not experience infinite re-renders.

#### Acceptance Criteria

1. THE Frontend SHALL memoize WalletContext value using useMemo
2. THE Frontend SHALL include stable dependencies in useEffect hooks
3. THE Frontend SHALL NOT create new object references on every render in context providers
4. WHEN wallet state changes, THE Frontend SHALL re-render only affected components

### Requirement 22: Error Boundary Implementation

**User Story:** As a user, I want graceful error handling, so that application errors display helpful messages instead of blank screens.

#### Acceptance Criteria

1. THE Frontend SHALL implement Error_Boundary components at route level
2. THE Frontend SHALL implement Error_Boundary around wallet connection components
3. WHEN an error occurs, THE Frontend SHALL display user-friendly error message with recovery options
4. THE Frontend SHALL log errors to monitoring service
5. THE Frontend SHALL provide "Retry" and "Go Home" actions in error states

### Requirement 23: RPC Configuration Consistency

**User Story:** As a user, I want consistent wallet connections, so that transactions are submitted to the correct network.

#### Acceptance Criteria

1. THE Frontend SHALL configure Wallet_Adapter with mainnet RPC_Endpoint
2. THE Frontend SHALL configure transaction submission with same RPC_Endpoint as wallet connection
3. THE Frontend SHALL display network indicator showing "Mainnet" in UI
4. WHEN wallet connects to wrong network, THE Frontend SHALL display warning and prevent transactions

### Requirement 24: Transaction Loading States

**User Story:** As a user, I want clear loading indicators, so that I know when transactions are processing.

#### Acceptance Criteria

1. WHEN a transaction is submitted, THE Frontend SHALL display loading spinner
2. THE Frontend SHALL disable action buttons during transaction processing
3. THE Frontend SHALL display estimated transaction time
4. WHEN transaction completes, THE Frontend SHALL display success message with transaction link
5. IF transaction fails, THEN THE Frontend SHALL display error message with retry option

### Requirement 25: Stake Duration Enforcement

**User Story:** As a platform operator, I want minimum stake duration, so that users cannot exploit instant stake/unstake cycles.

#### Acceptance Criteria

1. THE Backend SHALL enforce minimum stake duration of 24 hours
2. WHEN unstake is requested before minimum duration, THE Backend SHALL reject with HTTP 400
3. THE Backend SHALL calculate stake duration from `staked_at` timestamp
4. THE Frontend SHALL display remaining lock time for each staked NFT

### Requirement 26: Transaction Limits

**User Story:** As a platform operator, I want transaction size limits, so that large transactions do not fail or cause performance issues.

#### Acceptance Criteria

1. THE Backend SHALL enforce maximum 10 NFTs per stake transaction
2. THE Backend SHALL enforce maximum 10 NFTs per unstake transaction
3. WHEN limits are exceeded, THE Backend SHALL return HTTP 400 with limit information
4. THE Frontend SHALL validate transaction size before submission

### Requirement 27: Deployment Configuration

**User Story:** As a DevOps engineer, I want simple Vercel deployment configuration, so that the platform deploys automatically from Git.

#### Acceptance Criteria

1. THE Platform SHALL include vercel.json configuration file
2. THE Platform SHALL configure Vercel environment variables for all secrets
3. THE Platform SHALL configure Neon DB connection string in Vercel
4. THE Platform SHALL use Vercel's automatic deployments from Git
5. THE Platform SHALL include deployment documentation in README

### Requirement 28: Environment Validation

**User Story:** As a developer, I want startup environment validation, so that configuration errors are caught immediately.

#### Acceptance Criteria

1. WHEN the Backend starts, THE Backend SHALL validate all required environment variables are present
2. WHEN the Backend starts, THE Backend SHALL validate environment variable formats (URLs, numbers, etc.)
3. IF validation fails, THEN THE Backend SHALL log specific missing or invalid variables and exit with code 1
4. THE Backend SHALL validate Database connection on startup
5. THE Backend SHALL validate RPC_Endpoint connectivity on startup

### Requirement 29: Environment Configuration

**User Story:** As a DevOps engineer, I want explicit environment configuration in Vercel, so that deployment environments are properly configured.

#### Acceptance Criteria

1. THE Backend SHALL read all configuration from Vercel environment variables
2. THE Frontend SHALL read API URL from Vercel environment variables
3. IF required environment variables are missing, THEN THE Platform SHALL fail to start with descriptive error
4. THE Platform SHALL NOT use hardcoded fallback values for production configuration
5. THE Platform SHALL document all required environment variables in README

### Requirement 30: Error Handling Consistency

**User Story:** As a developer, I want consistent error handling patterns, so that errors are handled predictably throughout the codebase.

#### Acceptance Criteria

1. THE Backend SHALL use a centralized error handling middleware
2. THE Backend SHALL return errors in consistent JSON format: `{"error": "message", "code": "ERROR_CODE"}`
3. THE Backend SHALL log all errors with stack traces to logging service
4. THE Backend SHALL distinguish between client errors (4xx) and server errors (5xx)
5. THE Backend SHALL NOT expose internal error details to clients in production

### Requirement 31: Production Logging

**User Story:** As a platform operator, I want production-appropriate logging using Vercel's built-in logging, so that logs are useful without exposing sensitive data.

#### Acceptance Criteria

1. THE Backend SHALL use structured logging with JSON format
2. THE Backend SHALL NOT log sensitive data (private keys, full wallet addresses, API keys)
3. THE Backend SHALL log at INFO level or higher in production
4. THE Backend SHALL remove all console.log statements and use proper logger
5. THE Backend SHALL use Vercel's built-in logging infrastructure

### Requirement 32: Code Cleanup

**User Story:** As a developer, I want clean codebase, so that maintenance is easier and deployment size is minimized.

#### Acceptance Criteria

1. THE Platform SHALL remove the `frontend.old` directory
2. THE Backend SHALL remove all commented-out code blocks
3. THE Backend SHALL remove all unused imports and variables
4. THE Platform SHALL pass linting with zero warnings
5. THE Platform SHALL include .gitignore entries for build artifacts and dependencies

### Requirement 33: Mainnet Transaction Handling

**User Story:** As a platform operator, I want robust mainnet transaction handling, so that transactions succeed despite network congestion.

#### Acceptance Criteria

1. THE Backend SHALL implement transaction retry logic with exponential backoff up to 3 attempts
2. THE Backend SHALL increase transaction priority fee during congestion
3. THE Backend SHALL implement 60-second timeout for transaction confirmation
4. WHEN transaction times out, THE Backend SHALL check transaction status before retrying
5. THE Backend SHALL use recent blockhash for all transactions

### Requirement 34: Monitoring and Health Checks

**User Story:** As a platform operator, I want health checks and basic monitoring using Vercel Analytics, so that issues are detected quickly.

#### Acceptance Criteria

1. THE Backend SHALL expose health check endpoint at `/health` returning JSON status
2. THE Backend SHALL check database connectivity in health endpoint
3. THE Backend SHALL check Solana RPC connectivity in health endpoint
4. THE Platform SHALL use Vercel Analytics for performance monitoring
5. THE Platform SHALL use Vercel Logs for error tracking and debugging

### Requirement 35: Payment Flow Testing

**User Story:** As a platform operator, I want verified payment flows, so that real SOL transactions work correctly on mainnet.

#### Acceptance Criteria

1. THE Platform SHALL complete end-to-end testing of stake flow with real SOL on mainnet
2. THE Platform SHALL complete end-to-end testing of unstake flow with real SOL on mainnet
3. THE Platform SHALL complete end-to-end testing of reward claim flow with real SOL on mainnet
4. THE Platform SHALL verify transaction fees are calculated correctly
5. THE Platform SHALL verify wallet balance updates correctly after each transaction type

### Requirement 36: Documentation Updates

**User Story:** As a team member, I want updated documentation, so that deployment and operation procedures are clear.

#### Acceptance Criteria

1. THE Platform SHALL include README with Vercel deployment instructions
2. THE Platform SHALL include environment variable documentation with all required Vercel variables
3. THE Platform SHALL include API endpoint documentation
4. THE Platform SHALL include troubleshooting guide for common issues
5. THE Platform SHALL include Neon DB setup instructions

### Requirement 37: Security Testing

**User Story:** As a security engineer, I want security testing completed, so that vulnerabilities are identified and remediated before mainnet launch.

#### Acceptance Criteria

1. THE Platform SHALL complete security testing of authentication flow
2. THE Platform SHALL test input validation with malformed data
3. THE Platform SHALL test rate limiting effectiveness
4. THE Platform SHALL test NFT ownership verification
5. THE Platform SHALL test transaction verification with invalid signatures

### Requirement 38: Performance Testing

**User Story:** As a platform operator, I want verified performance testing, so that the platform meets scalability requirements.

#### Acceptance Criteria

1. THE Backend SHALL handle 50 concurrent requests with average response time under 500ms
2. THE Backend SHALL calculate rewards for 100 staked NFTs in under 500ms
3. THE Database SHALL handle 20 concurrent connections without performance degradation
4. THE Frontend SHALL achieve Lighthouse performance score above 85
5. THE Platform SHALL test with realistic mainnet transaction volumes

### Requirement 39: Deployment Process

**User Story:** As a DevOps engineer, I want streamlined Vercel deployment process, so that mainnet deployments are simple and reliable.

#### Acceptance Criteria

1. THE Platform SHALL use Vercel's automatic Git deployments
2. THE Platform SHALL include database migration scripts with rollback capability
3. THE Platform SHALL include smoke tests to verify deployment success
4. THE Platform SHALL document deployment process in README
5. THE Platform SHALL configure Vercel production environment variables

