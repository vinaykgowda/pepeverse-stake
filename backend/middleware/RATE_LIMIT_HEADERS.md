# Rate Limit Headers Implementation

## Overview

Rate limit headers have been successfully implemented across all API endpoints that use the rate limiter middleware. These headers provide clients with information about their current rate limit status.

## Headers Added

All rate-limited endpoints now return the following headers:

### X-RateLimit-Limit
- **Description**: The maximum number of requests allowed in the time window
- **Example**: `X-RateLimit-Limit: 5`
- **Type**: Integer (as string)

### X-RateLimit-Remaining
- **Description**: The number of requests remaining in the current time window
- **Example**: `X-RateLimit-Remaining: 3`
- **Type**: Integer (as string)

### X-RateLimit-Reset
- **Description**: ISO 8601 timestamp indicating when the rate limit window resets
- **Example**: `X-RateLimit-Reset: 2024-01-15T10:30:00.000Z`
- **Type**: ISO 8601 date string

### Retry-After (when rate limit exceeded)
- **Description**: Number of seconds to wait before retrying (only present in 429 responses)
- **Example**: `Retry-After: 45`
- **Type**: Integer (as string)

## Endpoints with Rate Limiting

### Authentication Endpoints (10 req/min)
- `POST /auth/nonce` - Generate authentication nonce
- `POST /auth/verify` - Verify wallet signature
- `POST /auth/admin/login` - Admin login

### Stake Endpoints (20 req/min)
- `POST /nfts/stake` - Stake NFTs
- `POST /nfts/stake/execute` - Execute stake with payment

### Unstake Endpoints (20 req/min)
- `POST /nfts/unstake` - Unstake NFTs

### Claim Endpoints (5 req/min)
- `POST /rewards/claim` - Claim staking rewards

## Rate Limit Response

When a rate limit is exceeded, the API returns:

**Status Code**: `429 Too Many Requests`

**Headers**:
```
Retry-After: 45
```

**Body**:
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 45
}
```

## Implementation Details

The rate limiter uses an in-memory sliding window algorithm that:
1. Tracks requests per wallet address
2. Automatically cleans up old entries every 5 minutes
3. Calculates remaining requests in real-time
4. Provides accurate reset timestamps

## Client Usage Example

```javascript
async function makeRequest(endpoint, data) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  // Check rate limit headers
  const limit = response.headers.get('X-RateLimit-Limit');
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');

  console.log(`Rate limit: ${remaining}/${limit} remaining`);
  console.log(`Resets at: ${reset}`);

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return makeRequest(endpoint, data);
  }

  return response.json();
}
```

## Testing

Integration tests have been added in `backend/middleware/rateLimiter.integration.test.js` to verify:
- Headers are present on all rate-limited endpoints
- Headers update correctly with each request
- 429 responses include Retry-After header
- Rate limits are tracked separately per wallet
- Different endpoints have correct limits

Run tests with:
```bash
npm test -- rateLimiter.integration.test.js
```

## Requirements Satisfied

This implementation satisfies **Requirement 9.4**:
> WHEN rate limits are exceeded, THE Backend SHALL return HTTP 429 with retry-after header

All rate-limited endpoints now:
- ✅ Return HTTP 429 when limits are exceeded
- ✅ Include Retry-After header in 429 responses
- ✅ Include X-RateLimit-* headers in all responses
- ✅ Provide accurate rate limit information to clients
