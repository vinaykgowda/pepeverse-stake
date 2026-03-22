# Helius Proxy Service Implementation

## Overview

This document describes the implementation of the Helius proxy service, which provides a secure backend proxy for Helius API calls with in-memory caching and retry logic.

## Requirements Addressed

- **Requirement 3.2**: Backend includes Helius service dependencies
- **Requirement 5.3**: Frontend does not expose API keys in client-side environment files
- **Requirement 11.2**: Backend queries Helius for real-time ownership data
- **Requirement 12.2**: Backend retries metadata fetches up to 3 times with exponential backoff
- **Requirement 12.3**: Backend returns HTTP 503 if metadata fetch fails after retries
- **Requirement 20.1**: Backend implements LRU eviction for in-memory Helius cache
- **Requirement 20.2**: Backend limits Helius cache to maximum 10,000 entries
- **Requirement 20.3**: Backend expires Helius cache entries after 1 hour
- **Requirement 20.4**: Backend evicts oldest entries first using LRU algorithm

## Architecture

### Components

1. **LRUCache** (`backend/src/utils/lruCache.js`)
   - Generic in-memory LRU cache implementation
   - Configurable max size and TTL
   - Automatic cleanup of expired entries
   - Used by HeliusProxyService

2. **HeliusProxyService** (`backend/src/services/heliusProxy.js`)
   - Singleton service for Helius API calls
   - In-memory LRU cache (10,000 entries, 1 hour TTL)
   - Retry logic with exponential backoff (3 attempts)
   - Methods:
     - `getAssetsByOwner(ownerAddress, options)` - Get NFTs by owner
     - `getAssetMetadata(mintAddress)` - Get NFT metadata with retry
     - `clearCache()` - Clear all cached entries
     - `getCacheStats()` - Get cache statistics

3. **Helius Routes** (`backend/routes/helius.js`)
   - POST `/api/helius/nfts/by-owner` - Get NFTs by owner
   - POST `/api/helius/nfts/metadata` - Get NFT metadata
   - GET `/api/helius/cache/stats` - Get cache statistics
   - POST `/api/helius/cache/clear` - Clear cache

4. **Frontend Service** (`frontend/src/services/helius.js`)
   - Updated to use backend proxy instead of direct Helius API calls
   - Removed VITE_HELIUS_API_KEY usage
   - Maintains local cache for additional performance

5. **Frontend Component** (`frontend/src/components/Admin/RewardsManager.jsx`)
   - Updated to use backend proxy for token metadata fetching
   - Removed direct Helius API calls

## Configuration

### Backend Environment Variables

Required in Vercel environment variables:

```bash
HELIUS_API_KEY=your-helius-api-key
HELIUS_MAINNET_ENDPOINT=https://mainnet.helius-rpc.com
```

### Frontend Environment Variables

The `VITE_HELIUS_API_KEY` has been removed from `frontend/.env` as it's no longer needed.

## API Endpoints

### POST /api/helius/nfts/by-owner

Get NFTs owned by a wallet address.

**Request:**
```json
{
  "ownerAddress": "wallet_address",
  "options": {
    "limit": 1000,
    "tokenType": "all"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...]
  }
}
```

### POST /api/helius/nfts/metadata

Get metadata for a specific NFT mint address.

**Request:**
```json
{
  "mintAddress": "nft_mint_address"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "mint_address",
    "content": {
      "metadata": {...}
    }
  }
}
```

**Error Response (after 3 retries):**
```json
{
  "error": "Failed to fetch metadata after 3 attempts: ...",
  "code": "HELIUS_PROXY_ERROR"
}
```
Status: 503 Service Unavailable

## Caching Strategy

### Backend Cache (LRU)
- **Size**: 10,000 entries maximum
- **TTL**: 1 hour
- **Eviction**: LRU (Least Recently Used)
- **Cleanup**: Automatic every 60 seconds

### Frontend Cache
- **Size**: Unlimited (Map)
- **TTL**: 5 minutes
- **Purpose**: Additional layer to reduce backend calls

### Cache Keys

Backend cache keys are generated based on:
- Method name (assets/metadata)
- Owner address or mint address
- Options (serialized as JSON)

Example: `assets:wallet123:{"limit":1000}`

## Retry Logic

The `getAssetMetadata` method implements retry logic:

1. **Attempt 1**: Immediate
2. **Attempt 2**: After 1 second delay
3. **Attempt 3**: After 2 second delay (total 3 seconds)

If all attempts fail, returns HTTP 503 with error message.

## Testing

### Unit Tests

1. **LRUCache Tests** (`backend/src/utils/lruCache.test.js`)
   - Basic operations (set, get, delete, clear)
   - LRU eviction behavior
   - TTL expiration
   - Automatic cleanup
   - Edge cases

2. **HeliusProxyService Tests** (`backend/src/services/heliusProxy.test.js`)
   - Initialization
   - getAssetsByOwner with caching
   - getAssetMetadata with retry logic
   - Error handling
   - Cache management
   - Cache key generation

### Running Tests

```bash
cd backend
npm test -- lruCache.test.js
npm test -- heliusProxy.test.js
```

All tests pass successfully.

## Security Improvements

1. **API Key Protection**: Helius API key is now only stored in backend environment variables, never exposed to frontend
2. **Input Validation**: All endpoints use validation middleware to check wallet addresses
3. **Error Handling**: Descriptive error messages without exposing internal details
4. **Rate Limiting**: Can be added to proxy endpoints if needed

## Performance Benefits

1. **Reduced API Calls**: In-memory cache reduces calls to Helius API
2. **Faster Response Times**: Cached responses return immediately
3. **Cost Savings**: Fewer API calls = lower Helius API costs
4. **Retry Logic**: Automatic retries improve reliability

## Migration Notes

### Frontend Changes Required

1. Update all code that uses `VITE_HELIUS_API_KEY` to use the proxy endpoints
2. Change API calls from direct Helius to backend proxy
3. Remove `VITE_HELIUS_API_KEY` from `.env` files

### Backend Changes Required

1. Add `HELIUS_API_KEY` and `HELIUS_MAINNET_ENDPOINT` to Vercel environment variables
2. Ensure helius routes are registered in `server.js`

## Monitoring

### Cache Statistics

Get cache statistics via:
```bash
GET /api/helius/cache/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "size": 150,
    "maxSize": 10000,
    "ttlMs": 3600000
  }
}
```

### Cache Management

Clear cache via:
```bash
POST /api/helius/cache/clear
```

Note: This endpoint should be protected with admin authentication in production.

## Future Enhancements

1. Add rate limiting to proxy endpoints
2. Add admin authentication to cache management endpoints
3. Add metrics/logging for cache hit/miss rates
4. Consider Redis for distributed caching if scaling beyond single instance
5. Add circuit breaker pattern for Helius API failures

## References

- Design Document: `.kiro/specs/production-readiness-mainnet-migration/design.md`
- Requirements: `.kiro/specs/production-readiness-mainnet-migration/requirements.md`
- Tasks: `.kiro/specs/production-readiness-mainnet-migration/tasks.md`
