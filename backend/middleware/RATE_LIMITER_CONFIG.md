# Rate Limiter Configuration

## Overview

The rate limiter uses an in-memory sliding window algorithm to track requests per wallet address. This prevents API abuse while maintaining simplicity without requiring Redis.

## Endpoint-Specific Rate Limiters

All rate limiters are configured with a 60-second (1 minute) window and track requests per wallet address.

### Configuration

| Endpoint | Limiter | Max Requests | Window | Requirement |
|----------|---------|--------------|--------|-------------|
| Claim Rewards | `claimLimiter` | 5 req/min | 60s | 9.1 |
| Stake NFTs | `stakeLimiter` | 20 req/min | 60s | 9.2 |
| Unstake NFTs | `unstakeLimiter` | 20 req/min | 60s | 9.3 |
| Authentication | `authLimiter` | 10 req/min | 60s | - |

### Implementation Details

- **Algorithm**: Sliding window (not fixed window)
- **Storage**: In-memory Map (no Redis required)
- **Tracking**: Per wallet address
- **Cleanup**: Automatic cleanup every 5 minutes
- **Headers**: Returns standard rate limit headers (X-RateLimit-*)
- **Response**: HTTP 429 with Retry-After header when exceeded

## Usage

### Import the limiters

```javascript
const { claimLimiter, stakeLimiter, unstakeLimiter, authLimiter } = require('./middleware/rateLimiter');
```

### Apply to routes

```javascript
// Claim rewards endpoint
router.post('/api/rewards/claim', claimLimiter, async (req, res) => {
  // Handler code
});

// Stake endpoint
router.post('/api/stake', stakeLimiter, async (req, res) => {
  // Handler code
});

// Unstake endpoint
router.post('/api/unstake', unstakeLimiter, async (req, res) => {
  // Handler code
});

// Auth endpoints
router.post('/api/auth/nonce', authLimiter, async (req, res) => {
  // Handler code
});

router.post('/api/auth/verify', authLimiter, async (req, res) => {
  // Handler code
});
```

## Response Headers

When a request is processed, the following headers are added:

- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Number of requests remaining in current window
- `X-RateLimit-Reset`: ISO timestamp when the window resets

When rate limit is exceeded (HTTP 429):

- `Retry-After`: Number of seconds until the client can retry

## Wallet Address Extraction

The rate limiter extracts the wallet address from:

1. `req.user.walletAddress` (from JWT authentication)
2. `req.body.walletAddress` (from request body)

If no wallet address is found, it returns HTTP 400.

## Memory Management

- Automatic cleanup runs every 5 minutes
- Removes entries with no requests in the last 5 minutes
- Prevents memory leaks in long-running processes
- No manual intervention required

## Testing

All rate limiters are fully tested in `rateLimiter.test.js`:

- Request limiting enforcement
- Per-wallet tracking
- Sliding window algorithm
- Rate limit headers
- Cleanup functionality
- Multiple endpoint isolation

Run tests:

```bash
npm test -- rateLimiter.test.js
```

## Current Status

### ✅ Completed (Task 7.1)
- Rate limiter class implementation
- Endpoint-specific limiter exports
- Comprehensive test coverage
- Documentation

### Configuration Verification

✅ Claim limiter: 5 req/min per wallet (Requirement 9.1)
✅ Stake limiter: 20 req/min per wallet (Requirement 9.2)
✅ Unstake limiter: 20 req/min per wallet (Requirement 9.3)
✅ Auth limiter: 10 req/min per wallet
✅ HTTP 429 with Retry-After header (Requirement 9.4)
✅ Per-wallet tracking with sliding window (Requirement 9.5)

### ⏳ Pending (Task 7.3)
- Apply rate limiters to actual API endpoints
- Integration testing with real routes

## Next Steps

To complete the rate limiting implementation (Task 7.3), the exported limiters need to be applied to the actual API endpoints:

1. Import limiters in `backend/src/solana-api-endpoints.js`
2. Apply `claimLimiter` to `/rewards/claim` endpoint
3. Apply `stakeLimiter` to `/nfts/stake` and `/nfts/stake/execute` endpoints
4. Apply `unstakeLimiter` to `/nfts/unstake` endpoint
5. Import limiters in `backend/routes/auth.js`
6. Apply `authLimiter` to `/nonce` and `/verify` endpoints
