# Database Migrations

This directory contains database migration scripts for the Solana NFT Staking platform.

## Overview

Migrations are used to manage database schema changes in a controlled, versioned manner. Each migration file contains both an `up` function (to apply changes) and a `down` function (to rollback changes).

## Migration Files

- `001_add_missing_columns.js` - Adds missing columns for production readiness:
  - `last_claim_timestamp` to `staked_nfts` table
  - `collection_id` and `nft_count` to `transactions` table
  - Foreign key constraint for `transactions.collection_id` with ON DELETE SET NULL

- `002_add_cascade_foreign_keys.js` - Updates foreign key constraints with CASCADE rules:
  - `staked_nfts.collection_id`: ON DELETE CASCADE, ON UPDATE CASCADE
  - `collection_rewards.collection_id`: ON DELETE CASCADE, ON UPDATE CASCADE
  - `trait_rewards.collection_id`: ON DELETE CASCADE, ON UPDATE CASCADE

## Prerequisites

Before running migrations, ensure:

1. Node.js is installed
2. MySQL database is running
3. Environment variables are configured in `backend/.env`:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=solana_nft_staking
   ```

## Usage

### Test Migration (Recommended First Step)

Before running migrations, test them to see what changes will be made:

```bash
node test-migration.js
```

This will:
- Verify database connectivity
- Check current schema state
- Validate migration file structure
- Report what changes would be applied
- Not make any actual changes to the database

For migration 002 specifically, you can run:

```bash
node validate-002.js
```

This validates the CASCADE foreign key migration and shows the current state of all foreign key constraints.

### Check Migration Status

View which migrations have been applied:

```bash
node migrate.js status
```

### Run Migrations

Run all pending migrations:

```bash
node migrate.js up
```

Run a specific migration:

```bash
node migrate.js up 001_add_missing_columns
```

### Rollback Migrations

Rollback the last applied migration:

```bash
node migrate.js down
```

Rollback a specific migration:

```bash
node migrate.js down 001_add_missing_columns
```

### Test Rollback Functionality

Test rollback functionality on development database:

```bash
# Test all migrations
node test-rollback.js

# Test specific migration
node test-rollback.js 001_add_missing_columns
```

For detailed rollback procedures and emergency rollback steps, see [ROLLBACK_PROCEDURES.md](ROLLBACK_PROCEDURES.md).

### Test on Staging Database

Before deploying to production, test migrations on staging:

```bash
# Full staging test (recommended)
node test-staging.js

# Test and restore (safe testing)
node test-staging.js --restore

# Backup only
node test-staging.js --backup-only
```

The staging test script will:
- Create a backup of the staging database
- Run all pending migrations
- Verify schema changes
- Test rollback procedures
- Optionally restore from backup

For detailed staging testing procedures, see [STAGING_TEST_GUIDE.md](STAGING_TEST_GUIDE.md) and [STAGING_TEST_QUICK_REFERENCE.md](STAGING_TEST_QUICK_REFERENCE.md).

## Migration Features

### Idempotency

All migrations are idempotent, meaning they can be safely run multiple times without causing errors or duplicate changes. The migration script checks if columns/constraints already exist before attempting to create them.

### Transaction Safety

Each migration runs within a database transaction. If any step fails, all changes are automatically rolled back, ensuring the database remains in a consistent state.

### Error Handling

Migrations include comprehensive error handling:
- Automatic rollback on failure
- Detailed error messages
- Verification of changes after application

### Tracking

The migration system automatically tracks which migrations have been applied using a `migrations` table in the database. This ensures migrations are only run once and in the correct order.

## Creating New Migrations

To create a new migration:

1. Create a new file in this directory with the naming pattern: `XXX_description.js`
   - Use sequential numbering (e.g., `002_`, `003_`)
   - Use descriptive names (e.g., `add_audit_logs_table`)

2. Export `up` and `down` functions:

```javascript
async function up(connection) {
  await connection.beginTransaction();
  
  try {
    // Apply changes here
    await connection.query('ALTER TABLE ...');
    
    await connection.commit();
    return { success: true, message: 'Migration completed' };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function down(connection) {
  await connection.beginTransaction();
  
  try {
    // Rollback changes here
    await connection.query('ALTER TABLE ...');
    
    await connection.commit();
    return { success: true, message: 'Rollback completed' };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

module.exports = { up, down };
```

3. Make migrations idempotent by checking if changes already exist:

```javascript
// Check if column exists before adding
const [columns] = await connection.query(`
  SELECT COLUMN_NAME 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'your_table' 
    AND COLUMN_NAME = 'your_column'
`);

if (columns.length === 0) {
  await connection.query('ALTER TABLE your_table ADD COLUMN your_column ...');
}
```

## Best Practices

1. **Always test migrations** on a development database before running in production
2. **Backup your database** before running migrations in production
3. **Review migration output** carefully for any warnings or errors
4. **Keep migrations small** - one logical change per migration
5. **Never modify existing migrations** that have been applied to production
6. **Write reversible migrations** - always implement the `down` function
7. **Use transactions** to ensure atomicity
8. **Make migrations idempotent** to allow safe re-runs

## Troubleshooting

### Connection Errors

If you get connection errors, verify:
- Database is running
- Environment variables are correct
- Database user has necessary permissions

### Migration Fails Midway

If a migration fails:
1. Check the error message for details
2. The transaction will automatically rollback
3. Fix the issue in the migration file
4. Run the migration again

### Manual Intervention Required

If you need to manually fix the database:
1. Make the necessary changes
2. Update the `migrations` table to reflect the current state:
   ```sql
   INSERT INTO migrations (name) VALUES ('migration_name');
   ```

## Staging and Production Deployment

### Staging Deployment

Before deploying to production, always test on staging:

1. **Configure staging environment**:
   - Create `backend/.env.staging` with staging database credentials
   - Verify you're NOT connected to production

2. **Run staging tests**:
   ```bash
   node test-staging.js --restore
   ```
   This creates a backup, runs migrations, verifies changes, tests rollback, and restores the database.

3. **Validate application functionality**:
   - Test critical user flows
   - Verify API endpoints
   - Check data integrity

4. **Review test report** and document results

For detailed staging procedures, see [STAGING_TEST_GUIDE.md](STAGING_TEST_GUIDE.md).

### Production Deployment

For production deployments:

1. **Pre-deployment checklist**:
   - [ ] All staging tests passed
   - [ ] Application functionality verified on staging
   - [ ] Team notified of deployment
   - [ ] Rollback plan prepared
   - [ ] Backup procedures tested

2. **Backup the database**:
   ```bash
   mysqldump -u root -p solana_nft_staking > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Schedule deployment**:
   - Choose low-traffic period
   - Plan for potential downtime
   - Have team available for monitoring

4. **Run migrations**:
   ```bash
   node migrate.js up
   ```

5. **Verify deployment**:
   - Check migration status
   - Test critical functionality
   - Monitor error rates

6. **Keep rollback ready** in case issues arise:
   ```bash
   node migrate.js down
   ```
   Or restore from backup if needed.

7. **Monitor** the application for 24 hours after deployment

## Support

For issues or questions about migrations, refer to:
- Design document: `.kiro/specs/production-readiness-mainnet-migration/design.md`
- Requirements: `.kiro/specs/production-readiness-mainnet-migration/requirements.md`
