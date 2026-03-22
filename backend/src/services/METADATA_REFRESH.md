# Metadata Refresh Service

## Overview

The Metadata Refresh Service allows administrators to update NFT trait data for staked NFTs by fetching fresh metadata from Helius. This is essential when:
- Admin adds new trait multipliers
- Users update their NFT metadata on-chain
- Trait data becomes stale

## Architecture

### Non-Custodial Context

Since this is a **non-custodial staking platform**, NFTs remain in users' wallets at all times. The platform only tracks staking status in the database. When NFTs are staked, their traits are captured and stored in the `staked_nfts.traits` column.

### The Problem

Traits are stored at staking time and become stale if:
1. User updates NFT metadata on-chain after staking
2. Admin adds new trait multipliers for existing traits
3. NFT collection updates trait definitions

### The Solution

Admin-triggered metadata refresh that:
1. Fetches fresh metadata from Helius for all staked NFTs
2. Extracts current traits from metadata
3. Updates the `staked_nfts.traits` column in database
4. Logs the operation to audit trail

## API Endpoints

### Refresh All Staked NFTs

**Endpoint**: `POST /api/v1/admin/metadata/refresh`

**Authentication**: Admin JWT required

**Request Body**:
```json
{
  "collectionId": "optional-collection-id"
}
```

**Response**:
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

### Refresh Single NFT

**Endpoint**: `POST /api/v1/admin/metadata/refresh/:mintAddress`

**Authentication**: Admin JWT required

**Response**:
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

## Usage Workflow

### When to Refresh Metadata

1. **After Adding Trait Multipliers**:
   - Admin adds new trait multiplier (e.g., "Legendary" = 2.0x)
   - Click "Refresh Metadata" to update all staked NFTs
   - New multipliers will apply to NFTs with matching traits

2. **After User Reports Incorrect Rewards**:
   - User claims their NFT has "Legendary" trait but gets "Common" rewards
   - Admin refreshes metadata for that specific NFT
   - Rewards will use updated traits on next calculation

3. **Periodic Maintenance**:
   - Refresh metadata weekly or monthly
   - Ensures trait data stays current
   - Catches any on-chain metadata updates

### Admin Dashboard Integration

The admin dashboard should include:

1. **Bulk Refresh Button**:
   - "Refresh All Metadata" button in collection management
   - Shows progress indicator during refresh
   - Displays results (updated/unchanged/failed counts)

2. **Collection-Specific Refresh**:
   - "Refresh Metadata" button for each collection
   - Only refreshes NFTs from that collection
   - Faster than bulk refresh

3. **Single NFT Refresh**:
   - "Refresh" button on individual staked NFT view
   - Useful for troubleshooting specific cases
   - Shows before/after trait comparison

## Implementation Details

### Batch Processing

The service processes NFTs in batches of 10 to:
- Avoid overwhelming Helius API
- Prevent rate limiting
- Provide better error isolation

### Rate Limiting

- 100ms delay between batches
- Respects Helius API rate limits
- Can be adjusted based on Helius plan tier

### Trait Extraction

Supports multiple metadata formats:
- **Metaplex Standard**: `content.metadata.attributes[]`
- **Properties Format**: `content.metadata.properties.category`
- **Custom Formats**: Extensible for new formats

### Error Handling

- Individual NFT failures don't stop the entire refresh
- Failed NFTs are logged with reasons
- Partial success is reported (e.g., "45 of 60 updated")

### Audit Logging

All refresh operations are logged:
- Admin wallet address
- Action type (METADATA_REFRESH or METADATA_REFRESH_SINGLE)
- Target (collection ID or mint address)
- Results (stats or trait changes)
- Timestamp

## Performance Considerations

### Helius API Calls

- Each NFT requires 1 API call to Helius
- 100 staked NFTs = 100 API calls
- Cached responses reduce duplicate calls
- Batch processing spreads load over time

### Database Updates

- Only updates NFTs with changed traits
- Uses prepared statements for efficiency
- Single UPDATE per changed NFT
- No transaction overhead (independent updates)

### Estimated Duration

| Staked NFTs | Estimated Time |
|-------------|----------------|
| 10 | ~2 seconds |
| 100 | ~15 seconds |
| 1000 | ~2.5 minutes |

## Testing

### Unit Tests

Run tests:
```bash
npm test -- src/services/metadataRefresh.test.js
```

### Manual Testing

1. **Setup**:
   - Stake an NFT with trait "Common"
   - Add trait multiplier for "Legendary" = 2.0x
   - Update NFT metadata on-chain to "Legendary"

2. **Refresh**:
   - Call refresh endpoint
   - Verify response shows 1 updated

3. **Verify**:
   - Calculate rewards
   - Should now use "Legendary" multiplier (2.0x)

## Security

### Admin-Only Access

- Requires admin JWT token
- Verified via `verifyAdmin` middleware
- Only configured admin wallets can trigger

### Audit Trail

- All refresh operations logged
- Includes admin wallet, timestamp, results
- 1-year retention for compliance

### Rate Limiting

Consider adding rate limiting:
- Max 1 bulk refresh per minute
- Prevents accidental spam
- Protects Helius API quota

## Troubleshooting

### Issue: High Failure Rate

**Symptoms**: Many NFTs fail to refresh

**Solutions**:
1. Check Helius API status
2. Verify Helius API key is valid
3. Check Helius plan limits
4. Review failed NFT reasons in response

### Issue: Slow Refresh

**Symptoms**: Refresh takes too long

**Solutions**:
1. Reduce batch size (currently 10)
2. Increase delay between batches
3. Refresh specific collection instead of all
4. Upgrade Helius plan for higher rate limits

### Issue: Traits Not Updating

**Symptoms**: Refresh succeeds but traits unchanged

**Solutions**:
1. Verify NFT metadata was actually updated on-chain
2. Check metadata format matches expected structure
3. Review Helius cache (may take 1-2 minutes to update)
4. Try single NFT refresh to see detailed before/after

## Future Enhancements

Potential improvements:
1. **Automatic Refresh**: Trigger refresh automatically when trait multipliers change
2. **Scheduled Refresh**: Cron job to refresh metadata daily/weekly
3. **Webhook Integration**: Helius webhooks for real-time metadata updates
4. **Progress Tracking**: WebSocket updates for long-running refreshes
5. **Selective Refresh**: Only refresh NFTs with specific traits

## Related Files

- `backend/src/services/metadataRefresh.js` - Service implementation
- `backend/src/services/metadataRefresh.test.js` - Unit tests
- `backend/routes/admin.js` - Admin API endpoints
- `backend/src/services/heliusProxy.js` - Helius API integration
- `backend/src/services/auditLog.js` - Audit logging
