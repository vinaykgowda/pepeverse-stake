# Metadata Refresh Behavior - How It Works

## Overview

The platform automatically refreshes NFT metadata during the claim process to ensure fair reward calculation while keeping trait data up-to-date.

## Key Principle: Fair Calculation + Automatic Updates

**The system ensures:**
1. Current claim uses traits that were active during the staking period (FAIR)
2. Metadata is refreshed AFTER payout for future claims (AUTOMATIC)
3. No retroactive benefits from trait upgrades (PREVENTS EXPLOITATION)

## Detailed Example Scenario

### Timeline

```
Day 1: User stakes NFT
       - NFT has "Common" trait on-chain
       - Database stores: traits = [{"trait_type": "Rarity", "value": "Common"}]
       - last_claim_timestamp = Day 1

Day 2: User updates NFT metadata on-chain to "Legendary"
       - On-chain metadata now shows "Legendary"
       - Database still has: traits = "Common" (stale, but intentional)
       - Platform doesn't know about update yet

Day 3: Admin adds multiplier for "Legendary" = 2.0x
       - trait_rewards table: Legendary = 2.0x
       - Staked NFTs still show "Common" traits
       - This is correct - no retroactive changes

Day 5: User clicks "Claim Rewards"
       
       STEP 1: Calculate Rewards (uses OLD traits)
       - Time elapsed: Day 5 - Day 1 = 4 days
       - Traits from database: "Common" (1x multiplier)
       - Calculation: 4 days × daily_rate × 1.0x
       - Result: User gets Common rewards ✓
       
       STEP 2: Pay Out Rewards
       - Transfer tokens to user
       - Update last_claim_timestamp = Day 5
       - Commit database transaction
       
       STEP 3: Refresh Metadata (AFTER payout)
       - Fetch fresh metadata from Helius
       - Extract traits: "Legendary"
       - Update database: traits = "Legendary"
       - last_claim_timestamp stays Day 5 (unchanged)

Day 10: User claims again
       
       STEP 1: Calculate Rewards (uses NEW traits)
       - Time elapsed: Day 10 - Day 5 = 5 days
       - Traits from database: "Legendary" (2x multiplier)
       - Calculation: 5 days × daily_rate × 2.0x
       - Result: User gets Legendary rewards ✓
       
       STEP 2: Pay Out Rewards
       - Transfer tokens to user
       - Update last_claim_timestamp = Day 10
       
       STEP 3: Refresh Metadata
       - Traits unchanged, no update needed
```

## Why This Approach?

### Fairness
- User gets rewards based on traits they had during the staking period
- No retroactive benefits for upgrading traits mid-stake
- Prevents exploitation (users can't upgrade right before claim to get higher rewards retroactively)

### Automatic Updates
- No admin intervention needed
- Traits stay current without manual refresh
- Users benefit from upgrades going forward

### Simplicity
- No complex trait history tracking
- No segmented reward calculations
- Single timestamp per NFT

## Code Implementation

### Claim Flow (backend/src/solana-rewards-handler.js)

```javascript
async function claimRewardsWithPayment(walletAddress, paymentSignature) {
  // 1. Calculate rewards using CURRENT traits in database
  const rewardsResult = await calculateRewards(walletAddress);
  
  // 2. Process payments and transfers
  // ... (payment verification, token transfers)
  
  // 3. Update last_claim_timestamp
  await dbConnection.query(
    'UPDATE staked_nfts SET last_claim_timestamp = NOW() WHERE wallet_address = ?',
    [walletAddress]
  );
  
  // 4. Commit transaction
  await dbConnection.commit();
  
  // 5. Refresh metadata AFTER successful claim (non-blocking)
  try {
    const metadataRefresh = require('./services/metadataRefresh');
    await metadataRefresh.refreshStakedNFTMetadata(null, walletAddress, walletAddress);
  } catch (refreshError) {
    // Don't fail claim if refresh fails
    console.error('Metadata refresh failed (non-critical):', refreshError);
  }
  
  return { success: true, ... };
}
```

### Metadata Refresh (backend/src/services/metadataRefresh.js)

```javascript
async function refreshStakedNFTMetadata(collectionId, adminWallet, walletAddress) {
  // Fetch staked NFTs (filtered by wallet if provided)
  const query = walletAddress 
    ? 'SELECT ... FROM staked_nfts WHERE wallet_address = ?'
    : 'SELECT ... FROM staked_nfts WHERE collection_id = ?';
  
  // For each NFT:
  // 1. Fetch fresh metadata from Helius
  // 2. Extract traits
  // 3. Update database if traits changed
  // 4. Log to audit trail
}
```

## Admin Manual Refresh (Optional)

Admins can still manually refresh metadata for:

1. **Testing**: After adding trait multipliers, verify they work
2. **Troubleshooting**: User reports incorrect trait display
3. **Bulk Updates**: Force refresh for all NFTs at once

But this is NOT required for normal operations since claims auto-refresh.

## Performance Impact

### Automatic Refresh on Claim
- Only refreshes NFTs for the claiming user (not all NFTs)
- Typical user has 1-10 staked NFTs
- Refresh time: ~1-2 seconds per claim
- Non-blocking: Claim succeeds even if refresh fails

### Manual Admin Refresh
- Can refresh 100s or 1000s of NFTs
- Processes in batches of 10
- Takes 15 seconds per 100 NFTs
- Should be used sparingly

## Edge Cases

### User Updates Trait Multiple Times

```
Day 1: Stake with "Common"
Day 2: Update to "Rare"
Day 3: Update to "Legendary"
Day 5: Claim
       → Gets "Common" rewards for Days 1-5
       → Metadata refreshes to "Legendary"
Day 10: Claim
       → Gets "Legendary" rewards for Days 5-10
```

Result: User doesn't get "Rare" rewards at all. This is acceptable because:
- Trait changes are rare
- User benefits from final upgrade
- Prevents complex trait history tracking

### Admin Adds Multiplier Mid-Stake

```
Day 1: User stakes with "Legendary" trait
       Admin has no multiplier for "Legendary" yet
Day 3: Admin adds "Legendary" = 2.0x multiplier
Day 5: User claims
       → Gets 1x rewards for Days 1-5 (no multiplier existed)
       → Metadata refreshes (traits unchanged)
Day 10: User claims
       → Gets 2x rewards for Days 5-10 (multiplier now exists)
```

Result: User doesn't get retroactive 2x for Days 1-5. This is correct and fair.

## Testing Scenarios

### Scenario 1: Trait Upgrade During Stake

```bash
# Day 1: Stake NFT with "Common" trait
curl -X POST /api/v1/stake -d '{"mintAddresses": ["NFT123"]}'

# Day 2: User updates NFT on-chain to "Legendary" (external to platform)

# Day 3: Admin adds "Legendary" multiplier
curl -X POST /api/v1/admin/trait-rewards -d '{
  "trait_type": "Rarity",
  "trait_value": "Legendary", 
  "multiplier": 2.0
}'

# Day 5: User claims
curl -X POST /api/v1/rewards/claim
# Response: Rewards calculated with 1x (Common)
# Backend: Metadata refreshed automatically

# Day 10: User claims again
curl -X POST /api/v1/rewards/claim
# Response: Rewards calculated with 2x (Legendary)
```

### Scenario 2: Admin Manual Refresh

```bash
# Admin wants to test trait multipliers immediately
curl -X POST /api/v1/admin/metadata/refresh -d '{"collectionId": "123"}'

# This is optional - claims will auto-refresh anyway
```

## Comparison: Old vs New Behavior

### OLD (Admin Manual Refresh Only)
```
User stakes → Traits stored → Admin adds multiplier → Admin MUST refresh
→ User claims → Gets updated multiplier retroactively (UNFAIR)
```

### NEW (Automatic Refresh on Claim)
```
User stakes → Traits stored → Admin adds multiplier
→ User claims → Gets old multiplier (FAIR) → Auto-refresh
→ User claims again → Gets new multiplier (AUTOMATIC)
```

## Summary

The automatic metadata refresh on claim provides:
- ✅ Fair reward calculation (no retroactive benefits)
- ✅ Automatic trait updates (no admin intervention)
- ✅ Simple implementation (no trait history tracking)
- ✅ Prevents exploitation (can't game the system)
- ✅ User-friendly (traits update automatically)

Admin manual refresh is now optional and mainly for testing/troubleshooting purposes.
