# Task 11: Secure Reward Calculation Implementation Summary

## Overview
This document summarizes the implementation of Task 11 from the production-readiness-mainnet-migration spec, which focuses on implementing secure reward calculation with proper timestamp handling and database transaction isolation.

## Changes Made

### 1. Updated Minimum Window (Subtask 11.1)

**File**: `backend/src/solana-rewards-handler.js`

**Change**: Updated the minimum window from 5 seconds to 60 seconds

**Before**:
```javascript
// FIXED: Only skip rewards if claimed within the last 5 seconds (to prevent double claims)
if (secondsSinceLastClaim < 5) {
  console.log(`⏰ [REWARDS] NFT ${nft.mint_address}: Claimed within last 5 seconds...`);
  continue;
}
```

**After**:
```javascript
// Use 60-second minimum window for reward calculation updates (Requirement 13.1)
// This prevents exploitation of timing windows to claim excess rewards
if (secondsSinceLastClaim < 60) {
  console.log(`⏰ [REWARDS] NFT ${nft.mint_address}: Claimed within last 60 seconds (${secondsSinceLastClaim}s ago), minimum window not met`);
  continue;
}
```

**Requirements Addressed**:
- 13.1: Use minimum 60-second window for reward calculation updates
- 13.3: Calculate rewards based on time since last claim
- 13.4: Calculate from last claim or stake time

**Implementation Details**:
- The code already uses `COALESCE(s.last_claim_timestamp, s.stake_timestamp)` in the SQL query to calculate from either last claim time or stake time
- The code already records exact claim timestamp using `NOW()` in the UPDATE statement
- Changed the minimum window from 5 seconds to 60 seconds to prevent timing exploitation

### 2. Added Database Transaction Isolation (Subtask 11.2)

**File**: `backend/src/solana-rewards-handler.js`

**Changes**:
1. Added documentation comment explaining the transaction isolation strategy
2. Added `FOR UPDATE` clause to lock rows during claim operations
3. Added `FOR UPDATE` to timestamp verification query

**Before**:
```javascript
dbConnection = await pool.promise().getConnection();
await dbConnection.beginTransaction();

// Get staked NFTs with their collection info, including claim fees
const [stakedNFTs] = await dbConnection.query(
  `SELECT s.id, s.mint_address, s.collection_id, s.wallet_address,
          c.name as collection_name, c.claim_fee
   FROM staked_nfts s
   JOIN collections c ON s.collection_id = c.id
   WHERE s.wallet_address = ?`,
  [walletAddress]
);
```

**After**:
```javascript
dbConnection = await pool.promise().getConnection();

// Use database transaction with row-level locking to prevent race conditions
// This ensures concurrent claim requests are processed serially (Requirements 13.2, 13.5)
await dbConnection.beginTransaction();

// Get staked NFTs with their collection info, including claim fees
// Use FOR UPDATE to lock rows and prevent race conditions (Requirement 13.2, 13.5)
const [stakedNFTs] = await dbConnection.query(
  `SELECT s.id, s.mint_address, s.collection_id, s.wallet_address,
          c.name as collection_name, c.claim_fee
   FROM staked_nfts s
   JOIN collections c ON s.collection_id = c.id
   WHERE s.wallet_address = ?
   FOR UPDATE`,
  [walletAddress]
);
```

Also added locking to the timestamp verification query:
```javascript
// Check current timestamps BEFORE update (with lock to ensure consistency)
const [beforeUpdate] = await dbConnection.query(
  'SELECT mint_address, wallet_address, last_claim_timestamp, NOW() as current_server_time FROM staked_nfts WHERE wallet_address = ? FOR UPDATE',
  [walletAddress]
);
```

**Requirements Addressed**:
- 13.2: Use database transaction isolation to prevent race conditions
- 13.5: Process concurrent claim requests serially using database locks

**Implementation Details**:
- `FOR UPDATE` creates a row-level lock on the selected rows
- The lock is held until the transaction is committed or rolled back
- This ensures that concurrent claim requests for the same wallet are processed serially
- The existing transaction structure (beginTransaction, commit, rollback) provides the isolation

## Testing

**File**: `backend/src/solana-rewards-handler.test.js`

Created comprehensive unit tests that validate:

1. **Requirement 13.1**: 60-second minimum window enforcement
2. **Requirements 13.2 & 13.5**: Database transaction isolation with `FOR UPDATE` locks
3. **Requirement 13.3**: Exact timestamp recording with `NOW()`
4. **Requirement 13.4**: Calculation from last claim or stake time using `COALESCE`
5. **Reward calculation logic**: Time-based calculations, minimum window enforcement, trait multipliers

All 14 tests pass successfully.

## Requirements Compliance

### Requirement 13.1: Minimum 60-second window
✅ **Implemented**: Changed minimum window from 5 seconds to 60 seconds

### Requirement 13.2: Database transaction isolation
✅ **Implemented**: Added `FOR UPDATE` clause to lock rows during claim operations

### Requirement 13.3: Record exact claim timestamp
✅ **Already Implemented**: Code uses `NOW()` to record exact timestamp

### Requirement 13.4: Calculate from last claim or stake time
✅ **Already Implemented**: Code uses `COALESCE(s.last_claim_timestamp, s.stake_timestamp)` in SQL query

### Requirement 13.5: Process concurrent requests serially
✅ **Implemented**: Row-level locks with `FOR UPDATE` ensure serial processing

## Database Schema

The implementation relies on the `last_claim_timestamp` column added in migration 001:

```sql
ALTER TABLE staked_nfts 
ADD COLUMN last_claim_timestamp TIMESTAMP NULL 
AFTER stake_timestamp
```

This column is:
- Updated with `NOW()` after each successful claim
- Used in conjunction with `stake_timestamp` via `COALESCE` to calculate rewards
- Locked during claim operations to prevent race conditions

## Security Benefits

1. **Prevents timing exploitation**: 60-second minimum window prevents users from exploiting small timing windows to claim excess rewards
2. **Prevents race conditions**: Row-level locks ensure that concurrent claim requests are processed serially, preventing double-claims
3. **Accurate reward calculation**: Using exact timestamps ensures rewards are calculated precisely based on actual time elapsed
4. **Data consistency**: Transaction isolation ensures that all database operations succeed or fail together

## Performance Considerations

- Row-level locks (`FOR UPDATE`) only lock the specific rows being claimed, not the entire table
- Locks are held only for the duration of the transaction, which includes reward calculation and blockchain operations
- The 60-second minimum window reduces the frequency of claims, reducing database load

## Future Improvements

1. Consider adding a claim history table to track all claim attempts (successful and failed)
2. Add monitoring/alerting for claim failures due to race conditions
3. Consider implementing optimistic locking as an alternative to pessimistic locking for better performance under high concurrency
