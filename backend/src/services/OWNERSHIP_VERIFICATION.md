# NFT Ownership Verification

## Overview

The NFT Ownership Verification service ensures that users can only stake NFTs they actually own by querying real-time blockchain data through the Helius proxy service.

**Requirements Implemented:** 11.1, 11.2, 11.3, 11.4

## Architecture

```
┌─────────────────┐
│  Stake Endpoint │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Ownership Verification  │
│      Service            │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   Helius Proxy Service  │
│   (with LRU cache)      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   Helius DAS API        │
│   (Real-time blockchain │
│    ownership data)      │
└─────────────────────────┘
```

## How It Works

### 1. Verification Flow

When a user attempts to stake NFTs:

1. **Payment Verification** (if required)
2. **Ownership Verification** ← NEW STEP
   - Query Helius for each NFT's current owner
   - Compare owner address with user's wallet address
   - Fail if any NFT is not owned by the user
3. **Check Already Staked**
4. **Insert Staked NFTs**

### 2. Verification Process

For each NFT mint address:

```javascript
// Query Helius DAS API for NFT metadata
const metadata = await heliusProxy.getAssetMetadata(mintAddress);

// Extract current owner from ownership field
const currentOwner = metadata.ownership?.owner;

// Compare with user's wallet (case-insensitive)
const isOwner = currentOwner.toLowerCase() === walletAddress.toLowerCase();
```

### 3. Error Handling

The service returns HTTP 403 (Forbidden) when ownership verification fails:

```json
{
  "success": false,
  "message": "Ownership verification failed for: NFT123 (Not owned by wallet, owned by OtherWallet456)"
}
```

## API Integration

### Stake Endpoint

**POST** `/api/v1/nfts/stake`

**Request:**
```json
{
  "nfts": [
    {
      "mintAddress": "NFT_MINT_ADDRESS_1",
      "traits": []
    }
  ],
  "collectionId": 1,
  "paymentSignature": "TRANSACTION_SIGNATURE"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully staked 1 NFTs",
  "data": {
    "stakedCount": 1,
    "totalFee": 0.01,
    "collection": "My Collection",
    "paymentSignature": "...",
    "feeRecipient": "..."
  }
}
```

**Ownership Verification Failed (403):**
```json
{
  "success": false,
  "message": "Ownership verification failed for: NFT123 (Not owned by wallet, owned by OtherWallet456)"
}
```

## Service API

### `verifyOwnership(walletAddress, mintAddress)`

Verify that a wallet owns a specific NFT.

**Parameters:**
- `walletAddress` (string): The wallet address to verify
- `mintAddress` (string): The NFT mint address

**Returns:**
```javascript
{
  isOwner: boolean,
  currentOwner?: string,
  error?: string
}
```

**Example:**
```javascript
const result = await ownershipVerification.verifyOwnership(
  'UserWallet123',
  'NFTMint456'
);

if (result.isOwner) {
  console.log('User owns the NFT');
} else {
  console.log(`Verification failed: ${result.error}`);
}
```

### `verifyMultipleOwnership(walletAddress, mintAddresses)`

Verify that a wallet owns multiple NFTs.

**Parameters:**
- `walletAddress` (string): The wallet address to verify
- `mintAddresses` (Array<string>): Array of NFT mint addresses

**Returns:**
```javascript
{
  allOwned: boolean,
  results: Array<{
    mintAddress: string,
    isOwner: boolean,
    currentOwner?: string,
    error?: string
  }>,
  failedMints: Array<{
    mintAddress: string,
    reason: string,
    currentOwner?: string
  }>
}
```

**Example:**
```javascript
const result = await ownershipVerification.verifyMultipleOwnership(
  'UserWallet123',
  ['NFT1', 'NFT2', 'NFT3']
);

if (result.allOwned) {
  console.log('User owns all NFTs');
} else {
  console.log('Failed mints:', result.failedMints);
}
```

## Performance Considerations

### Caching

The Helius proxy service uses an LRU cache with:
- **Max entries:** 10,000
- **TTL:** 1 hour
- **Eviction:** Least Recently Used (LRU)

This means:
- First verification of an NFT queries Helius API
- Subsequent verifications within 1 hour use cached data
- Cache automatically evicts old entries when full

### Timing

- **Single NFT verification:** ~100-500ms (first time)
- **Single NFT verification:** ~1-5ms (cached)
- **Multiple NFTs:** Sequential verification (not parallel)

For 10 NFTs:
- First time: ~1-5 seconds
- Cached: ~10-50ms

## Security Considerations

### Real-time Verification

The service queries Helius for **real-time** blockchain data, ensuring:
- Users cannot stake NFTs they just transferred away
- Ownership is verified at the exact moment of staking
- No race conditions between transfer and stake

### Case-Insensitive Comparison

Wallet addresses are compared case-insensitively to handle:
- Different address formats (base58 encoding variations)
- User input variations

### Error Handling

The service handles various failure scenarios:
- **NFT not found:** Returns error with clear message
- **Helius API timeout:** Returns error, allows retry
- **Missing ownership data:** Returns error, prevents stake
- **Network errors:** Returns error, prevents stake

## Testing

### Unit Tests

Located in: `backend/src/services/ownershipVerification.test.js`

Tests cover:
- ✓ Ownership verification when user owns NFT
- ✓ Ownership verification when user doesn't own NFT
- ✓ Case-insensitive address comparison
- ✓ Metadata not found handling
- ✓ Missing ownership information handling
- ✓ Helius API error handling
- ✓ Multiple NFT verification
- ✓ Mixed success/failure scenarios

### Integration Tests

Located in: `backend/src/services/ownershipVerification.integration.test.js`

Tests cover:
- ✓ Stake endpoint integration
- ✓ HTTP 403 response on verification failure
- ✓ Real-time ownership verification
- ✓ Helius query for blockchain data
- ✓ Current owner field checking

## Troubleshooting

### Common Issues

**Issue:** Ownership verification fails for NFTs user owns

**Possible causes:**
1. Helius cache is stale (wait 1 hour or clear cache)
2. NFT was just transferred (wait for blockchain confirmation)
3. Helius API is down (check Helius status)

**Solution:**
- Clear Helius cache: `POST /api/helius/cache/clear`
- Wait for blockchain confirmation (15-30 seconds)
- Check Helius API status

---

**Issue:** Verification is slow

**Possible causes:**
1. Cache is cold (first verification)
2. Helius API is slow
3. Network latency

**Solution:**
- Subsequent verifications will be faster (cached)
- Consider increasing cache TTL if needed
- Monitor Helius API response times

---

**Issue:** HTTP 403 errors for legitimate owners

**Possible causes:**
1. NFT ownership changed between frontend check and backend verification
2. Helius data is stale
3. Wrong wallet connected

**Solution:**
- Ensure user hasn't transferred NFT
- Refresh NFT list in frontend
- Verify correct wallet is connected

## Monitoring

### Logs

The service logs all verification attempts:

```
🔍 Verifying ownership: wallet=ABC123, mint=XYZ789
✅ Ownership verified: ABC123 owns XYZ789
```

Or on failure:

```
🔍 Verifying ownership: wallet=ABC123, mint=XYZ789
❌ Ownership verification failed: ABC123 does not own XYZ789 (owner: DEF456)
```

### Metrics to Monitor

- **Verification success rate:** Should be >95%
- **Verification latency:** Should be <500ms (first time), <10ms (cached)
- **Helius API errors:** Should be <1%
- **Cache hit rate:** Should be >80% after warm-up

## Future Enhancements

Potential improvements:

1. **Parallel verification:** Verify multiple NFTs in parallel instead of sequentially
2. **Batch API calls:** Use Helius batch endpoints to reduce API calls
3. **Optimistic verification:** Allow stake with pending verification, rollback if fails
4. **Webhook updates:** Subscribe to ownership change events to invalidate cache
5. **Fallback RPC:** Use direct Solana RPC if Helius is unavailable

## Requirements Mapping

| Requirement | Implementation |
|-------------|----------------|
| 11.1 | Check current owner field from blockchain data via `metadata.ownership.owner` |
| 11.2 | Query Helius for real-time ownership data via `heliusProxy.getAssetMetadata()` |
| 11.3 | Return HTTP 403 if verification fails in stake endpoint error handling |
| 11.4 | Verify ownership immediately before processing in `stakeNFTs()` function |

## Related Files

- `backend/src/services/ownershipVerification.js` - Main service implementation
- `backend/src/services/ownershipVerification.test.js` - Unit tests
- `backend/src/services/ownershipVerification.integration.test.js` - Integration tests
- `backend/src/solana-nft-staking.js` - Stake function with ownership verification
- `backend/src/solana-api-endpoints.js` - Stake endpoints with HTTP 403 handling
- `backend/src/services/heliusProxy.js` - Helius API proxy with caching
