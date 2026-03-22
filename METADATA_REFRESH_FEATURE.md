# Metadata Refresh Feature - Implementation Summary

## Overview

Implemented admin-triggered metadata refresh functionality to update NFT trait data for staked NFTs. This solves the problem where traits become stale after users update their NFT metadata on-chain or when admins add new trait multipliers.

## Problem Statement

The platform stores NFT traits at staking time in the `staked_nfts.traits` column. This creates issues:

1. **Stale Traits**: If a user updates their NFT metadata after staking, the platform doesn't know
2. **New Multipliers**: When admin adds a trait multiplier, already-staked NFTs still use old trait data
3. **No Refresh Mechanism**: There was no way to update traits for already-staked NFTs

## Solution

Admin-triggered metadata refresh that:
- Fetches fresh metadata from Helius for all staked NFTs
- Extracts current traits from metadata
- Updates the `staked_nfts.traits` column in database
- Logs the operation to audit trail
- Processes in batches to avoid API rate limits

## Files Created

### Backend Service
- **`backend/src/services/metadataRefresh.js`** - Core service implementation
  - `refreshStakedNFTMetadata()` - Refresh all or collection-specific NFTs
  - `refreshSingleNFT()` - Refresh a single NFT
  - `extractTraitsFromMetadata()` - Extract traits from Helius response

### API Endpoints
- **`backend/routes/admin.js`** - Added two new endpoints:
  - `POST /api/v1/admin/metadata/refresh` - Refresh all/collection NFTs
  - `POST /api/v1/admin/metadata/refresh/:mintAddress` - Refresh single NFT

### Tests
- **`backend/src/services/metadataRefresh.test.js`** - Unit tests for service

### Documentation
- **`backend/src/services/METADATA_REFRESH.md`** - Technical documentation
- **`ADMIN_GUIDE.md`** - Updated with refresh instructions
- **`API_DOCUMENTATION.md`** - Updated with new endpoints

## API Usage

### Refresh All Staked NFTs

```bash
curl -X POST https://your-domain.vercel.app/api/v1/admin/metadata/refresh \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json"
```

### Refresh Specific Collection

```bash
curl -X POST https://your-domain.vercel.app/api/v1/admin/metadata/refresh \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"collectionId": "YOUR_COLLECTION_ID"}'
```

### Refresh Single NFT

```bash
curl -X POST https://your-domain.vercel.app/api/v1/admin/metadata/refresh/NFT_MINT_ADDRESS \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

## Response Format

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

## Automatic Metadata Refresh on Claim

**IMPORTANT**: Metadata is automatically refreshed AFTER every successful claim. This ensures:

1. **Fair Reward Calculation**: Current claim uses the traits that were active during the staking period
2. **Automatic Updates**: Future claims automatically use updated traits without admin intervention
3. **No Retroactive Changes**: Users don't get retroactive benefits for trait upgrades

### Example Timeline

```
Day 1: User stakes NFT with "Common" trait (1x multiplier)
Day 2: User updates NFT metadata on-chain to "Legendary"
Day 3: Admin adds "Legendary" multiplier (2x) to system
Day 5: User claims rewards
       → Calculation uses "Common" (1x) for Days 1-5
       → User receives: 4 days × daily_rate × 1.0x
       → System refreshes metadata AFTER payout
       → Database now has "Legendary" trait
Day 10: User claims again
       → Calculation uses "Legendary" (2x) for Days 5-10
       → User receives: 5 days × daily_rate × 2.0x
```

## Manual Admin Refresh (Optional)

Admins can still manually refresh metadata if needed:

1. **Bulk Refresh for Testing**:
   - After adding trait multipliers
   - To verify metadata is being fetched correctly
   - For troubleshooting purposes

2. **Single NFT Refresh**:
   - When user reports incorrect trait display
   - For debugging specific NFT issues

3. **Periodic Maintenance**:
   - Optional weekly/monthly refresh
   - Not required since claims auto-refresh

## Performance

| Staked NFTs | Estimated Time |
|-------------|----------------|
| 10 | ~2 seconds |
| 100 | ~15 seconds |
| 1000 | ~2.5 minutes |

- Processes in batches of 10 NFTs
- 100ms delay between batches
- Respects Helius API rate limits

## Security

- **Admin-Only**: Requires admin JWT token
- **Audit Logging**: All refresh operations logged with admin wallet, timestamp, and results
- **Rate Limiting**: Consider adding rate limiting (max 1 bulk refresh per minute)

## Technical Details

### Batch Processing

```javascript
const BATCH_SIZE = 10;
for (let i = 0; i < stakedNFTs.length; i += BATCH_SIZE) {
  const batch = stakedNFTs.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(async (nft) => {
    // Fetch and update metadata
  }));
  // 100ms delay between batches
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

### Trait Extraction

Supports multiple metadata formats:
- **Metaplex Standard**: `content.metadata.attributes[]`
- **Properties Format**: `content.metadata.properties.category`
- **Custom Formats**: Extensible for new formats

### Error Handling

- Individual NFT failures don't stop the entire refresh
- Failed NFTs are logged with reasons
- Partial success is reported (e.g., "45 of 60 updated")

## Example Workflow

1. **Admin adds trait multiplier**:
   ```
   Trait: "Legendary"
   Multiplier: 2.0x
   ```

2. **Admin clicks "Refresh Metadata"**:
   - Selects collection (or all collections)
   - Clicks "Refresh" button
   - Waits for completion

3. **System processes**:
   - Fetches 100 staked NFTs
   - Queries Helius for each NFT's metadata
   - Extracts traits from metadata
   - Compares with stored traits
   - Updates database for changed NFTs

4. **Results displayed**:
   ```
   Total: 100
   Updated: 45 (had trait changes)
   Unchanged: 52 (same traits)
   Failed: 3 (API errors)
   ```

5. **Rewards now use updated traits**:
   - NFTs with "Legendary" trait now get 2.0x multiplier
   - Calculated on next reward claim

## Integration with Existing Code

### Automatic Refresh on Claim

The claim flow in `backend/src/solana-rewards-handler.js` now automatically refreshes metadata AFTER successful claims:

```javascript
// After successful claim and database commit
const metadataRefresh = require('./services/metadataRefresh');
const refreshResult = await metadataRefresh.refreshStakedNFTMetadata(null, walletAddress);
```

This ensures:
- Current claim uses traits that were active during staking period (fair calculation)
- Metadata is updated for future claims (automatic updates)
- No retroactive benefit from trait upgrades (prevents exploitation)

### Reward Calculation

The existing reward calculation in `backend/src/solana-rewards-handler.js` reads traits from the database:

```javascript
const traits = safeParseJSONLegacy(nft.traits, []);
if (Array.isArray(traits) && traits.length > 0) {
  for (const trait of traits) {
    const key = `${trait.trait_type}:${trait.value}`;
    if (traitMultipliers[key]) {
      reward *= traitMultipliers[key];
    }
  }
}
```

After metadata refresh (either manual or automatic), the next reward calculation will use the updated traits.

## Testing

### Manual Testing Steps

1. **Setup**:
   - Stake an NFT with trait "Common"
   - Add trait multiplier for "Legendary" = 2.0x
   - Update NFT metadata on-chain to "Legendary" (if possible)

2. **Refresh**:
   - Call refresh endpoint
   - Verify response shows 1 updated

3. **Verify**:
   - Calculate rewards
   - Should now use "Legendary" multiplier (2.0x)

### Unit Tests

Run tests:
```bash
cd backend
npm test -- src/services/metadataRefresh.test.js
```

## Future Enhancements

Potential improvements:
1. **Automatic Refresh**: Trigger refresh automatically when trait multipliers change
2. **Scheduled Refresh**: Cron job to refresh metadata daily/weekly
3. **Webhook Integration**: Helius webhooks for real-time metadata updates
4. **Progress Tracking**: WebSocket updates for long-running refreshes
5. **Selective Refresh**: Only refresh NFTs with specific traits

## Deployment Checklist

Before deploying to production:

- [ ] Test refresh with small collection (10 NFTs)
- [ ] Test refresh with large collection (100+ NFTs)
- [ ] Verify audit logging works
- [ ] Test error handling (invalid NFT, API failure)
- [ ] Document admin workflow
- [ ] Add rate limiting if needed
- [ ] Monitor Helius API usage
- [ ] Set up alerts for high failure rates

## Support

For issues or questions:
- Review `backend/src/services/METADATA_REFRESH.md` for technical details
- Check `ADMIN_GUIDE.md` for admin instructions
- Review `API_DOCUMENTATION.md` for API reference
- Check Helius API status if high failure rates
