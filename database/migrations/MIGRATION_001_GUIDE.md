# Migration 001: Add Missing Columns - Quick Reference

## What This Migration Does

This migration adds three missing columns to support proper reward tracking and transaction history:

1. **`staked_nfts.last_claim_timestamp`** (TIMESTAMP NULL)
   - Tracks when rewards were last claimed for each staked NFT
   - Enables accurate reward calculation based on time since last claim
   - Prevents users from claiming rewards multiple times in short succession

2. **`transactions.collection_id`** (INT with foreign key)
   - Links transactions to specific collections
   - Enables collection-level transaction reporting and analytics
   - Foreign key ensures referential integrity with collections table

3. **`transactions.nft_count`** (INT DEFAULT 1)
   - Records the number of NFTs involved in batch operations
   - Supports multi-NFT stake/unstake transactions
   - Defaults to 1 for single NFT operations

## Requirements Addressed

This migration satisfies the following requirements from the spec:

- **Requirement 1.1**: Database SHALL include `last_claim_timestamp` column in `staked_nfts` table
- **Requirement 1.2**: Database SHALL include `collection_id` column in `transactions` table with foreign key
- **Requirement 1.3**: Database SHALL include `nft_count` column in `transactions` table

## Pre-Migration Checklist

Before running this migration in production:

- [ ] Backup the database
- [ ] Test on staging environment
- [ ] Verify database user has ALTER TABLE permissions
- [ ] Schedule maintenance window if needed
- [ ] Notify team of migration timing
- [ ] Review rollback procedure

## Running the Migration

### Step 1: Test (No Changes Made)

```bash
cd backend
npm run migrate:test
```

This validates the migration without making changes.

### Step 2: Check Status

```bash
npm run migrate:status
```

Shows which migrations have been applied.

### Step 3: Apply Migration

```bash
npm run migrate:up
```

Or run directly:

```bash
cd database/migrations
node migrate.js up 001_add_missing_columns
```

### Step 4: Verify

After migration, verify the changes:

```sql
-- Check staked_nfts table
DESCRIBE staked_nfts;

-- Check transactions table
DESCRIBE transactions;

-- Check foreign key constraint
SELECT 
  CONSTRAINT_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_NAME = 'transactions'
  AND COLUMN_NAME = 'collection_id'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
```

## Rollback Procedure

If you need to rollback this migration:

```bash
cd backend
npm run migrate:down
```

Or run directly:

```bash
cd database/migrations
node migrate.js down 001_add_missing_columns
```

This will:
1. Drop the foreign key constraint
2. Remove `collection_id` column from transactions
3. Remove `nft_count` column from transactions
4. Remove `last_claim_timestamp` column from staked_nfts

## Impact Analysis

### Data Impact
- **No data loss**: This migration only adds columns, doesn't modify or delete existing data
- **NULL values**: `last_claim_timestamp` will be NULL for existing staked NFTs (expected behavior)
- **Default values**: `nft_count` will default to 1 for existing transactions

### Performance Impact
- **Minimal downtime**: ALTER TABLE operations are fast on small-to-medium tables
- **No index rebuilds**: New columns don't require existing index updates
- **Estimated time**: < 1 second for tables with < 100k rows

### Application Impact
- **Backward compatible**: Existing queries will continue to work
- **New features enabled**: 
  - Accurate reward tracking per NFT
  - Collection-level transaction analytics
  - Batch operation support

## Post-Migration Tasks

After successful migration:

1. **Update Application Code**
   - Modify reward calculation to use `last_claim_timestamp`
   - Update transaction creation to include `collection_id` and `nft_count`
   - Add validation for new fields

2. **Update Existing Data** (if needed)
   ```sql
   -- Set last_claim_timestamp to stake_timestamp for existing NFTs
   UPDATE staked_nfts 
   SET last_claim_timestamp = stake_timestamp 
   WHERE last_claim_timestamp IS NULL;
   ```

3. **Monitor Application**
   - Check logs for any errors related to new columns
   - Verify reward calculations are working correctly
   - Confirm transaction history displays properly

4. **Update Documentation**
   - Update API documentation with new fields
   - Update database schema documentation
   - Update developer guides

## Troubleshooting

### Migration Fails with "Column already exists"

This is expected if the migration has already been run. The migration is idempotent and will skip existing columns.

### Foreign Key Constraint Error

If you get a foreign key error:
1. Verify the `collections` table exists
2. Check that `collection_id` values in transactions reference valid collections
3. Ensure no orphaned records exist

### Permission Denied

If you get permission errors:
```sql
-- Grant necessary permissions
GRANT ALTER, REFERENCES ON solana_nft_staking.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### Rollback Fails

If rollback fails:
1. Check if any foreign key constraints depend on the columns
2. Manually drop constraints first:
   ```sql
   ALTER TABLE transactions DROP FOREIGN KEY transactions_collection_fk;
   ```
3. Then run rollback again

## Testing Recommendations

After migration, test these scenarios:

1. **Stake NFT**: Verify `last_claim_timestamp` is NULL initially
2. **Claim Rewards**: Verify `last_claim_timestamp` is updated
3. **Create Transaction**: Verify `collection_id` and `nft_count` are recorded
4. **Batch Operations**: Verify `nft_count` reflects actual NFT count
5. **Collection Deletion**: Verify foreign key CASCADE behavior

## Support

For issues or questions:
- Review the main README: `database/migrations/README.md`
- Check the design document: `.kiro/specs/production-readiness-mainnet-migration/design.md`
- Review requirements: `.kiro/specs/production-readiness-mainnet-migration/requirements.md`
