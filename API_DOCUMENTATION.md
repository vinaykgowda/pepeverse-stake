# Solana NFT Staking Platform - API Documentation

## Overview

This document provides complete API reference for the Solana NFT Staking Platform. All endpoints use JSON for request and response bodies.

**Base URL:** `https://your-platform.com/api`

---

## Table of Contents

1. [Authentication](#authentication)
2. [NFT Endpoints](#nft-endpoints)
3. [Rewards Endpoints](#rewards-endpoints)
4. [Collection Endpoints](#collection-endpoints)
5. [Admin Endpoints](#admin-endpoints)
6. [Health & Status](#health--status)
7. [Error Handling](#error-handling)
8. [Rate Limits](#rate-limits)

---

## Authentication

### Generate Nonce

Generate a nonce for wallet signature authentication.

**Endpoint:** `POST /api/auth/nonce`

**Request:**
```json
{
  "walletAddress": "UserWalletAddress..."
}
```

**Response:**
```json
{
  "nonce": "base64-encoded-nonce",
  "expiresIn": 300
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid wallet address
- `429`: Rate limit exceeded (10 requests/min per wallet)

---

### Verify Signature

Verify wallet signature and receive JWT token.

**Endpoint:** `POST /api/auth/verify`

**Request:**
```json
{
  "walletAddress": "UserWalletAddress...",
  "signature": "base58-encoded-signature",
  "message": "nonce-from-previous-step"
}
```

**Response:**
```json
{
  "token": "JWT_TOKEN",
  "expiresIn": 3600,
  "walletAddress": "UserWalletAddress..."
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid signature or nonce
- `401`: Authentication failed
- `429`: Rate limit exceeded

---

## NFT Endpoints

All NFT endpoints require authentication. Include JWT token in header:
```
Authorization: Bearer JWT_TOKEN
```

### Get User's NFTs

Retrieve all NFTs owned by the authenticated user.

**Endpoint:** `GET /api/nfts`

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Response:**
```json
{
  "nfts": [
    {
      "mintAddress": "MintAddress...",
      "name": "NFT Name",
      "image": "https://...",
      "collection": "Collection Name",
      "collectionId": 123,
      "isEligible": true,
      "traits": [
        {
          "trait_type": "Background",
          "value": "Rare Blue",
          "multiplier": 1.5
        }
      ]
    }
  ],
  "total": 10
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `503`: Service unavailable (RPC or Helius error)

---

### Get Staked NFTs

Retrieve all NFTs currently staked by the authenticated user.

**Endpoint:** `GET /api/nfts/staked`

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Response:**
```json
{
  "stakedNfts": [
    {
      "id": 456,
      "mintAddress": "MintAddress...",
      "name": "NFT Name",
      "image": "https://...",
      "collection": "Collection Name",
      "collectionId": 123,
      "stakedAt": "2024-01-15T10:00:00Z",
      "lastClaimTimestamp": "2024-01-15T12:00:00Z",
      "accumulatedRewards": 25.5,
      "remainingLockTime": 3600,
      "canUnstake": false,
      "canClaim": true
    }
  ],
  "total": 5
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized

---

### Stake NFTs

Stake one or more NFTs to start earning rewards.

**Endpoint:** `POST /api/nfts/stake`

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Request:**
```json
{
  "nfts": [
    {
      "mintAddress": "MintAddress...",
      "collectionId": 123
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "NFTs staked successfully",
  "stakedNfts": [
    {
      "id": 789,
      "mintAddress": "MintAddress...",
      "stakedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "transactionSignature": "TransactionSignature..."
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request (max 10 NFTs, invalid addresses)
- `401`: Unauthorized
- `403`: Ownership verification failed
- `429`: Rate limit exceeded (20 requests/min per wallet)

**Validation:**
- Maximum 10 NFTs per transaction
- All NFTs must be owned by user
- All NFTs must be from eligible collections
- Wallet must have sufficient SOL for fees

---

### Unstake NFTs

Unstake NFTs after the 24-hour lock period.

**Endpoint:** `POST /api/nfts/unstake`

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Request:**
```json
{
  "nftIds": [456, 457, 458]
}
```

**Response:**
```json
{
  "success": true,
  "message": "NFTs unstaked successfully",
  "unstakedNfts": [
    {
      "id": 456,
      "mintAddress": "MintAddress...",
      "unstakedAt": "2024-01-16T10:00:00Z",
      "totalStakeDuration": 86400
    }
  ],
  "transactionSignature": "TransactionSignature..."
}
```

**Status Codes:**
- `200`: Success
- `400`: Lock period not expired, invalid NFT IDs
- `401`: Unauthorized
- `404`: NFT not found or not staked by user
- `429`: Rate limit exceeded (20 requests/min per wallet)

**Validation:**
- NFTs must be staked by authenticated user
- 24-hour lock period must have expired
- Maximum 10 NFTs per transaction

---

## Rewards Endpoints

### Calculate Rewards

Calculate accumulated rewards for staked NFTs.

**Endpoint:** `GET /api/rewards/calculate`

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Response:**
```json
{
  "totalRewards": 125.75,
  "nftRewards": [
    {
      "nftId": 456,
      "mintAddress": "MintAddress...",
      "rewards": 25.5,
      "stakedDuration": 86400,
      "rewardRate": 10,
      "traitMultipliers": [1.5, 1.2]
    }
  ]
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized

---

### Claim Rewards

Claim accumulated rewards for staked NFTs.

**Endpoint:** `POST /api/rewards/claim`

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Request:**
```json
{
  "nftIds": [456, 457]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Rewards claimed successfully",
  "totalRewardsClaimed": 51.0,
  "claimedNfts": [
    {
      "nftId": 456,
      "rewards": 25.5,
      "claimedAt": "2024-01-15T12:00:00Z"
    },
    {
      "nftId": 457,
      "rewards": 25.5,
      "claimedAt": "2024-01-15T12:00:00Z"
    }
  ],
  "transactionSignature": "TransactionSignature..."
}
```

**Status Codes:**
- `200`: Success
- `400`: 60-second cooldown not expired, no rewards to claim
- `401`: Unauthorized
- `404`: NFT not found or not staked by user
- `429`: Rate limit exceeded (5 requests/min per wallet)

**Validation:**
- NFTs must be staked by authenticated user
- 60 seconds must have passed since last claim
- Minimum reward threshold must be met

---

## Collection Endpoints

### Get All Collections

Retrieve all active collections.

**Endpoint:** `GET /api/collections`

**Response:**
```json
{
  "collections": [
    {
      "id": 123,
      "name": "Collection Name",
      "symbol": "SYMBOL",
      "creatorAddress": "CreatorAddress...",
      "isActive": true,
      "rewardRate": 10,
      "rewardToken": {
        "address": "TokenMintAddress...",
        "symbol": "REWARD",
        "decimals": 9
      },
      "totalStaked": 450,
      "uniqueStakers": 120
    }
  ],
  "total": 5
}
```

**Status Codes:**
- `200`: Success

---

### Get Collection Details

Get detailed information about a specific collection.

**Endpoint:** `GET /api/collections/:id`

**Response:**
```json
{
  "id": 123,
  "name": "Collection Name",
  "symbol": "SYMBOL",
  "creatorAddress": "CreatorAddress...",
  "description": "Collection description",
  "isActive": true,
  "rewardRate": 10,
  "rewardToken": {
    "address": "TokenMintAddress...",
    "symbol": "REWARD",
    "decimals": 9
  },
  "traitMultipliers": [
    {
      "traitName": "Rare Background",
      "multiplier": 1.5
    }
  ],
  "statistics": {
    "totalStaked": 450,
    "uniqueStakers": 120,
    "totalRewardsDistributed": 25000
  }
}
```

**Status Codes:**
- `200`: Success
- `404`: Collection not found

---

## Admin Endpoints

All admin endpoints require admin authentication.

### Admin Authentication

**Endpoint:** `POST /api/admin/auth`

**Request:**
```json
{
  "walletAddress": "AdminWalletAddress...",
  "signature": "SignedMessage...",
  "message": "Nonce..."
}
```

**Response:**
```json
{
  "token": "ADMIN_JWT_TOKEN",
  "expiresIn": 3600,
  "role": "admin"
}
```

---

### Create Collection

**Endpoint:** `POST /api/admin/collections`

**Headers:**
```
Authorization: Bearer ADMIN_JWT_TOKEN
```

**Request:**
```json
{
  "name": "New Collection",
  "symbol": "NEW",
  "creatorAddress": "CreatorAddress...",
  "description": "Collection description",
  "hashlist": ["Mint1...", "Mint2..."]
}
```

**Response:**
```json
{
  "success": true,
  "collectionId": 124,
  "message": "Collection created successfully"
}
```

---

### Update Collection

**Endpoint:** `PUT /api/admin/collections/:id`

**Headers:**
```
Authorization: Bearer ADMIN_JWT_TOKEN
```

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "collection": { ... }
}
```

---

### Configure Reward Rate

**Endpoint:** `POST /api/admin/rewards/rate`

**Headers:**
```
Authorization: Bearer ADMIN_JWT_TOKEN
```

**Request:**
```json
{
  "collectionId": 123,
  "dailyRate": 15.5,
  "tokenAddress": "TokenMintAddress...",
  "tokenSymbol": "REWARD",
  "tokenDecimals": 9,
  "effectiveDate": "2024-01-20T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "rewardConfig": {
    "id": 789,
    "collectionId": 123,
    "dailyRate": 15.5,
    "effectiveDate": "2024-01-20T00:00:00Z"
  }
}
```

---

### Get Audit Logs

**Endpoint:** `GET /api/admin/audit-logs`

**Headers:**
```
Authorization: Bearer ADMIN_JWT_TOKEN
```

**Query Parameters:**
- `limit`: Number of logs to return (default: 100, max: 1000)
- `offset`: Pagination offset
- `adminWallet`: Filter by admin wallet
- `action`: Filter by action type
- `startDate`: Filter by start date
- `endDate`: Filter by end date

**Response:**
```json
{
  "logs": [
    {
      "id": 1234,
      "adminWallet": "AdminWallet...",
      "action": "collection_updated",
      "details": {
        "collectionId": 123,
        "changes": {
          "rewardRate": { "old": 10, "new": 15 }
        }
      },
      "timestamp": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 1234,
  "limit": 100,
  "offset": 0
}
```

---

### Refresh NFT Metadata

Refresh metadata for all staked NFTs to pick up trait changes.

**Endpoint:** `POST /api/v1/admin/metadata/refresh`

**Headers:**
```
Authorization: Bearer ADMIN_JWT_TOKEN
```

**Request:**
```json
{
  "collectionId": "optional-collection-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Metadata refresh completed: 45 updated, 12 unchanged, 3 failed",
  "stats": {
    "total": 60,
    "updated": 45,
    "unchanged": 12,
    "failed": 3
  },
  "failedNFTs": [
    {
      "mintAddress": "NFT123...",
      "reason": "Metadata not found"
    }
  ]
}
```

**Use Cases:**
- After adding new trait multipliers
- After updating existing multipliers
- When user reports incorrect rewards
- Periodic maintenance

**Performance:**
- 10 NFTs: ~2 seconds
- 100 NFTs: ~15 seconds
- 1000 NFTs: ~2.5 minutes

---

### Refresh Single NFT Metadata

Refresh metadata for a specific staked NFT.

**Endpoint:** `POST /api/v1/admin/metadata/refresh/:mintAddress`

**Headers:**
```
Authorization: Bearer ADMIN_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Metadata refreshed successfully",
  "data": {
    "mintAddress": "NFT123...",
    "oldTraits": [
      { "trait_type": "Rarity", "value": "Common" }
    ],
    "newTraits": [
      { "trait_type": "Rarity", "value": "Legendary" }
    ]
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: NFT not staked
- `401`: Unauthorized
- `403`: Not admin
- `500`: Server error

---

## Health & Status

### Health Check

Check platform health status.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "checks": {
    "database": "healthy",
    "solana_rpc": "healthy"
  }
}
```

**Status Values:**
- `healthy`: All systems operational
- `degraded`: Some systems experiencing issues
- `unhealthy`: Critical systems down

**Status Codes:**
- `200`: Healthy
- `503`: Degraded or unhealthy

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "fieldName",
    "value": "providedValue"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_WALLET_ADDRESS` | Wallet address format invalid | 400 |
| `INVALID_SIGNATURE` | Signature verification failed | 401 |
| `NONCE_EXPIRED` | Authentication nonce expired | 401 |
| `UNAUTHORIZED` | Missing or invalid JWT token | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `VALIDATION_ERROR` | Input validation failed | 400 |
| `OWNERSHIP_VERIFICATION_FAILED` | NFT ownership could not be verified | 403 |
| `LOCK_PERIOD_NOT_EXPIRED` | Cannot unstake before 24 hours | 400 |
| `COOLDOWN_NOT_EXPIRED` | Cannot claim before 60 seconds | 400 |
| `DATABASE_ERROR` | Database operation failed | 503 |
| `RPC_ERROR` | Solana RPC request failed | 503 |
| `TRANSACTION_FAILED` | Blockchain transaction failed | 500 |

---

## Rate Limits

### Rate Limit Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 2024-01-15T10:01:00Z
```

### Rate Limit Rules

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/*` | 10 requests | per minute per wallet |
| `/api/nfts/stake` | 20 requests | per minute per wallet |
| `/api/nfts/unstake` | 20 requests | per minute per wallet |
| `/api/rewards/claim` | 5 requests | per minute per wallet |

### Rate Limit Exceeded Response

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 45
}
```

**Headers:**
```
Retry-After: 45
```

---

## Request Examples

### Example: Complete Stake Flow

#### 1. Generate Nonce

```bash
curl -X POST https://your-platform.com/api/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "YourWalletAddress..."
  }'
```

#### 2. Sign Message (in your app)

```javascript
const message = nonceResponse.nonce;
const signature = await wallet.signMessage(message);
```

#### 3. Verify Signature

```bash
curl -X POST https://your-platform.com/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "YourWalletAddress...",
    "signature": "SignedMessage...",
    "message": "nonce-from-step-1"
  }'
```

#### 4. Stake NFT

```bash
curl -X POST https://your-platform.com/api/nfts/stake \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN" \
  -d '{
    "nfts": [
      {
        "mintAddress": "MintAddress...",
        "collectionId": 123
      }
    ]
  }'
```

---

## Webhook Events (Future)

*Note: Webhooks are not currently implemented but planned for future releases.*

### Planned Webhook Events

- `nft.staked`: When NFT is staked
- `nft.unstaked`: When NFT is unstaked
- `rewards.claimed`: When rewards are claimed
- `collection.created`: When collection is added
- `reward_rate.changed`: When reward rate is updated

---

## Appendix

### API Versioning

Current API version: `v1`

Future versions will be accessible at:
- `/api/v2/...`
- `/api/v3/...`

### Deprecation Policy

- Deprecated endpoints supported for 6 months
- Deprecation notices in response headers
- Migration guides provided

### Support

For API support:
- Email: [api-support email]
- Documentation: [docs link]
- Discord: [dev channel]

---

*Last Updated: [Date]*  
*API Version: 1.0*  
*Platform: Solana NFT Staking*
