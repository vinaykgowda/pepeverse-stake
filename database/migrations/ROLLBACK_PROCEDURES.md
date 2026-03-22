# Migration Rollback Procedures

This document provides comprehensive procedures for rolling back database migrations in case of issues during deployment.

## Table of Contents

1. [Overview](#overview)
2. [Pre-Rollback Checklist](#pre-rollback-checklist)
3. [Rollback Testing](#rollback-testing)
4. [Rollback Execution](#rollback-execution)
5. [Migration-Specific Rollback Details](#migration-specific-rollback-details)
6. [Emergency Rollback Procedures](#emergency-rollback-procedures)
7. [Post-Rollback Verification](#post-rollback-verification)
8. [Troubleshooting](#troubleshooting)

## Overview

All migrations in this project include both `up()` and `down()` functions, making them fully reversible. The rollback system is designed to safely restore the database to its previous state if issues arise after applying migrations.

### Key Principles

- **Transaction Safety**: All rollbacks execute within database transactions
- **Idempotency**: Rollbacks can be safely re-run if they fail partway through
- **Verification**: Each rollback includes verification steps to ensure success
- **Data Preservation**: Rollbacks are designed to preserve existing data where possible

## Pre-Rollback Checklist

Before performing any rollback, complete this checklist:

- [ ] **Identify the Issue**: Clearly document what went wrong and why rollback is necessary
- [ ] **Backup Database**: Create a fresh backup before rollback
  ```bash
  mysqldump -u root -p solana_nft_staking > backup_pre_rollback_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] **Stop Application**: Ensure the application is not actively using the database
- [ ] **Notify Team**: Alert relevant team members about the rollback
- [ ] **Check Dependencies**: Verify no other systems depend on the new schema
- [ ] **Review Rollback Script**: Examine the down() function for the migration being rolled back
- [ ] **Test on Staging**: If possible, test the rollback on a staging environment first

## Rollback Testing

### Automated Rollback Testing

Use the automated rollback testing script to verify rollback functionality:

```bash
# Test all migrations
node test-rollback.js

# Test specific migration
node test-rollback.js 001_add_missing_columns
```

The test script will:
1. Capture the initial schema state
2. Apply the migration (up)
3. Capture the schema after migration
4. Roll back the migration (down)
5. Verify the schema is restored to initial state

### Manual Rollback Testing

For manual testing on a development database:

```bash
# 1. Check current migration status
node migrate.js status

# 2. Apply a migration
node migrate.js up 001_add_missing_columns

# 3. Verify the migration was applied
node migrate.js status

# 4. Roll back the migration
node migrate.js down 001_add_missing_columns

# 5. Verify the rollback was successful
node migrate.js status
```

## Rollback Execution

### Standard Rollback Process

#### Step 1: Prepare for Rollback

```bash
# 1. Navigate to migrations directory
cd database/migrations

# 2. Check which migrations are applied
node migrate.js status

# 3. Create backup
mysqldump -u root -p solana_nft_staking > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Step 2: Execute Rollback

```bash
# Roll back the last applied migration
node migrate.js down

# OR roll back a specific migration
node migrate.js down 004_create_audit_logs_table
```

#### Step 3: Verify Rollback

```bash
# Check migration status
node migrate.js status

# Verify schema changes were reverted (see verification section below)
```

### Rolling Back Multiple Migrations

To roll back multiple migrations in sequence:

```bash
# Roll back migrations one at a time, starting with the most recent
node migrate.js down  # Rolls back 004
node migrate.js down  # Rolls back 003
node migrate.js down  # Rolls back 002
node migrate.js down  # Rolls back 001
```

**Important**: Always roll back migrations in reverse order of application.

## Migration-Specific Rollback Details

### Migration 001: Add Missing Columns

**What it does (up)**:
- Adds `last_claim_timestamp` to `staked_nfts`
- Adds `collection_id` and `nft_count` to `transactions`
- Adds foreign key constraint for `transactions.collection_id`

**What rollback does (down)**:
- Drops foreign key constraint from `transactions.collection_id`
- Drops `collection_id` column from `transactions`
- Drops `nft_count` column from `transactions`
- Drops `last_claim_timestamp` column from `staked_nfts`

**Data Impact**: 
- Data in the dropped columns will be lost
- Ensure no critical data exists in these columns before rollback

**Verification**:
```sql
-- Verify columns are removed
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'staked_nfts' 
  AND COLUMN_NAME = 'last_claim_timestamp';
-- Should return 0 rows

SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'transactions' 
  AND COLUMN_NAME IN ('collection_id', 'nft_count');
-- Should return 0 rows
```

### Migration 002: Add CASCADE Foreign Keys

**What it does (up)**:
- Updates foreign keys to include CASCADE rules:
  - `staked_nfts.collection_id`: ON DELETE CASCADE, ON UPDATE CASCADE
  - `collection_rewards.collection_id`: ON DELETE CASCADE, ON UPDATE CASCADE
  - `trait_rewards.collection_id`: ON DELETE CASCADE, ON UPDATE CASCADE

**What rollback does (down)**:
- Removes CASCADE rules from foreign keys
- Restores original foreign key constraints without CASCADE

**Data Impact**: 
- No data loss
- Changes referential integrity behavior only

**Verification**:
```sql
-- Verify CASCADE rules are removed
SELECT 
  TABLE_NAME,
  CONSTRAINT_NAME,
  DELETE_RULE,
  UPDATE_RULE
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('staked_nfts', 'collection_rewards', 'trait_rewards')
  AND REFERENCED_TABLE_NAME = 'collections';
-- DELETE_RULE and UPDATE_RULE should not be 'CASCADE'
```

### Migration 003: Add Performance Indexes

**What it does (up)**:
- Adds indexes to `staked_nfts`: wallet_address, collection_id, stake_timestamp, last_claim_timestamp
- Adds indexes to `transactions`: wallet_address, transaction_type, status, created_at
- Adds composite indexes to `collection_rewards` and `trait_rewards`

**What rollback does (down)**:
- Drops all performance indexes added by the migration
- Preserves indexes required by foreign key constraints

**Data Impact**: 
- No data loss
- Query performance may degrade after rollback

**Verification**:
```sql
-- Verify indexes are removed
SELECT 
  TABLE_NAME,
  INDEX_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND INDEX_NAME LIKE 'idx_%'
  AND TABLE_NAME IN ('staked_nfts', 'transactions', 'collection_rewards', 'trait_rewards')
GROUP BY TABLE_NAME, INDEX_NAME;
-- Should show only indexes required by foreign keys
```

### Migration 004: Create Audit Logs Table

**What it does (up)**:
- Creates `audit_logs` table with all columns and indexes
- Adds foreign key to `admins` table

**What rollback does (down)**:
- Drops the entire `audit_logs` table

**Data Impact**: 
- **ALL audit log data will be lost**
- Ensure audit logs are backed up before rollback if needed for compliance

**Verification**:
```sql
-- Verify table is dropped
SELECT COUNT(*) as count
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'audit_logs';
-- Should return 0
```

## Emergency Rollback Procedures

### When to Use Emergency Rollback

Use emergency rollback procedures when:
- Production is down due to migration issues
- Data corruption is detected
- Application cannot start due to schema mismatch
- Critical bugs are discovered immediately after deployment

### Emergency Rollback Steps

#### 1. Immediate Actions (0-5 minutes)

```bash
# 1. Stop the application immediately
systemctl stop solana-nft-staking  # or your service name

# 2. Create emergency backup
mysqldump -u root -p solana_nft_staking > emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Navigate to migrations directory
cd database/migrations
```

#### 2. Execute Rollback (5-10 minutes)

```bash
# Roll back the problematic migration
node migrate.js down [migration-name]

# If multiple migrations need rollback, do them in reverse order
node migrate.js down 004_create_audit_logs_table
node migrate.js down 003_add_performance_indexes
# etc.
```

#### 3. Verify and Restart (10-15 minutes)

```bash
# Verify rollback success
node migrate.js status

# Run application tests
npm test  # or your test command

# Restart application
systemctl start solana-nft-staking
```

#### 4. Monitor (15-30 minutes)

- Check application logs for errors
- Verify critical functionality works
- Monitor error rates and response times
- Test key user flows manually

### If Rollback Fails

If the automated rollback fails:

1. **Check the error message** - The migration script will show what failed
2. **Review the down() function** - Look at the migration file to see what it's trying to do
3. **Manual intervention** - You may need to manually execute SQL commands:

```sql
-- Example: Manually drop a column if automated rollback fails
ALTER TABLE staked_nfts DROP COLUMN last_claim_timestamp;

-- Then update the migrations table
DELETE FROM migrations WHERE name = '001_add_missing_columns';
```

4. **Restore from backup** - If manual fixes don't work:

```bash
# Stop application
systemctl stop solana-nft-staking

# Restore from backup
mysql -u root -p solana_nft_staking < backup_file.sql

# Restart application
systemctl start solana-nft-staking
```

## Post-Rollback Verification

After rolling back migrations, perform these verification steps:

### 1. Schema Verification

```sql
-- Check that expected tables exist
SHOW TABLES;

-- Verify column structure for critical tables
DESCRIBE staked_nfts;
DESCRIBE transactions;
DESCRIBE collections;

-- Check foreign key constraints
SELECT 
  TABLE_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME,
  DELETE_RULE,
  UPDATE_RULE
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;

-- Check indexes
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('staked_nfts', 'transactions', 'collections')
GROUP BY TABLE_NAME, INDEX_NAME
ORDER BY TABLE_NAME, INDEX_NAME;
```

### 2. Data Integrity Verification

```sql
-- Check for orphaned records (if CASCADE was removed)
SELECT COUNT(*) FROM staked_nfts 
WHERE collection_id NOT IN (SELECT id FROM collections);

-- Verify critical data is intact
SELECT COUNT(*) FROM staked_nfts;
SELECT COUNT(*) FROM transactions;
SELECT COUNT(*) FROM collections;
```

### 3. Application Verification

```bash
# Run application tests
npm test

# Start application in test mode
NODE_ENV=development npm start

# Test critical endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/collections
```

### 4. Migration Status Verification

```bash
# Verify migration status is correct
node migrate.js status

# Should show the rolled-back migration as "Pending"
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Foreign key constraint fails" during rollback

**Cause**: Data exists that depends on the schema being rolled back

**Solution**:
```sql
-- Temporarily disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- Run the rollback
-- (execute the down() function manually or via migrate.js)

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
```

#### Issue: "Column doesn't exist" during rollback

**Cause**: Migration was partially applied or already rolled back

**Solution**:
- Check if the column actually exists: `DESCRIBE table_name;`
- If it doesn't exist, the rollback is already complete
- Update migrations table manually if needed:
  ```sql
  DELETE FROM migrations WHERE name = 'migration_name';
  ```

#### Issue: "Index doesn't exist" during rollback

**Cause**: Index was never created or already dropped

**Solution**:
- This is usually safe to ignore
- The rollback script checks for index existence before dropping
- Verify with: `SHOW INDEX FROM table_name;`

#### Issue: Rollback succeeds but application won't start

**Cause**: Application code expects new schema

**Solution**:
1. Deploy previous version of application code
2. Or apply the migration again and fix the issue differently
3. Check application logs for specific schema mismatch errors

#### Issue: Data loss after rollback

**Cause**: Rollback dropped columns containing data

**Solution**:
1. Restore from backup taken before rollback
2. Extract needed data from backup:
   ```bash
   # Extract specific table data
   mysqldump -u root -p solana_nft_staking table_name > table_backup.sql
   ```
3. Re-apply migration and address original issue differently

### Getting Help

If you encounter issues not covered here:

1. **Check migration logs** - Look for specific error messages
2. **Review migration code** - Examine the down() function in the migration file
3. **Check database logs** - MySQL error logs may have additional details
4. **Consult team** - Reach out to database administrator or senior developer
5. **Document the issue** - Add to this document for future reference

## Best Practices

1. **Always test rollbacks** on development/staging before production
2. **Create backups** before any rollback operation
3. **Roll back one migration at a time** to isolate issues
4. **Verify each step** before proceeding to the next
5. **Document everything** - Keep notes on what was done and why
6. **Monitor after rollback** - Watch for unexpected issues
7. **Plan ahead** - Have rollback procedures ready before deploying migrations
8. **Communicate** - Keep team informed throughout the process

## Rollback Decision Matrix

Use this matrix to decide whether to roll back:

| Severity | Impact | Action |
|----------|--------|--------|
| Critical | Production down | **Immediate rollback** |
| High | Major functionality broken | **Rollback within 1 hour** |
| Medium | Minor functionality broken | **Evaluate and decide** |
| Low | Performance degradation | **Monitor and fix forward** |
| Minimal | Cosmetic issues | **Fix forward** |

## Related Documentation

- [Migration README](README.md) - General migration documentation
- [Migration Guide](MIGRATION_001_GUIDE.md) - Detailed migration guide
- Design Document: `.kiro/specs/production-readiness-mainnet-migration/design.md`
- Requirements: `.kiro/specs/production-readiness-mainnet-migration/requirements.md`

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2024 | 1.0 | Initial rollback procedures documentation | System |

---

**Remember**: Rollbacks are a safety mechanism, not a failure. Having well-tested rollback procedures is a sign of mature deployment practices.
