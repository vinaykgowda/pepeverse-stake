# Staging Database Migration Testing Guide

This guide explains how to test database migrations on a staging environment before deploying to production.

## Overview

The `test-staging.js` script provides comprehensive testing of database migrations on a staging database by:

1. **Creating a backup** of the staging database
2. **Running all pending migrations** 
3. **Verifying schema changes** were applied correctly
4. **Testing rollback procedures** to ensure migrations can be reversed
5. **Optionally restoring** from backup after testing

## Prerequisites

### Required Tools

- Node.js (v14 or higher)
- MySQL client tools (`mysql` and `mysqldump` commands)
- Access to staging database

### Environment Configuration

Create a `.env.staging` file in the `backend` directory with staging database credentials:

```env
DB_HOST=staging-db.example.com
DB_PORT=3306
DB_USER=staging_user
DB_PASSWORD=your_staging_password
DB_NAME=solana_nft_staking_staging
NODE_ENV=staging
```

**IMPORTANT:** Never use production credentials with this script!

## Usage

### Basic Usage

Run the full test suite (recommended):

```bash
node test-staging.js
```

This will:
- Create a backup
- Run all pending migrations
- Verify schema changes
- Test rollback procedures
- Keep the migrated state

### Command Line Options

#### `--skip-backup`

Skip the backup step (not recommended):

```bash
node test-staging.js --skip-backup
```

**Warning:** Only use this if you have a recent backup or are testing on a disposable database.

#### `--skip-rollback`

Skip the rollback testing step:

```bash
node test-staging.js --skip-rollback
```

Use this if you only want to verify that migrations apply successfully.

#### `--restore`

Restore the database from backup after testing:

```bash
node test-staging.js --restore
```

This is useful for testing migrations without permanently changing the staging database.

#### `--backup-only`

Only create a backup without running migrations:

```bash
node test-staging.js --backup-only
```

Use this to create a backup before manually running migrations.

### Combined Options

You can combine multiple options:

```bash
# Test migrations and restore after (safe testing)
node test-staging.js --restore

# Quick test without backup or rollback (fast, but risky)
node test-staging.js --skip-backup --skip-rollback
```

## Test Process Details

### Step 1: Database Backup

The script creates a full database backup using `mysqldump`:

- Backup location: `database/migrations/backups/`
- Filename format: `staging_backup_YYYY-MM-DD_HHMMSS.sql`
- Includes: tables, data, routines, triggers, events
- Options: single-transaction (for consistency)

**Backup file contents:**
- Complete schema definitions
- All table data
- Foreign key constraints
- Indexes
- Stored procedures and functions
- Triggers and events

### Step 2: Run Migrations

The script applies all pending migrations in order:

1. Creates `migrations` tracking table if needed
2. Identifies pending migrations
3. Applies each migration's `up()` function
4. Records successful migrations in tracking table
5. Reports duration for each migration

**Output includes:**
- Total migrations available
- Number already applied
- Number pending
- Success/failure status for each
- Execution time per migration

### Step 3: Verify Schema Changes

The script captures and compares schema state before and after migrations:

**Verification checks:**
- New tables created
- New columns added to existing tables
- New foreign key constraints
- Modified foreign key CASCADE rules
- New indexes created
- Index types (UNIQUE vs regular)

**Example output:**
```
New tables created:
  ✓ audit_logs

staked_nfts - New columns:
  ✓ last_claim_timestamp (timestamp)

transactions - New columns:
  ✓ collection_id (int)
  ✓ nft_count (int)

transactions - New foreign keys:
  ✓ transactions_ibfk_1: collection_id -> collections.id
    ON DELETE SET NULL, ON UPDATE CASCADE

staked_nfts - New indexes:
  ✓ idx_owner_wallet (INDEX) on (owner_wallet)
  ✓ idx_collection_id (INDEX) on (collection_id)
```

### Step 4: Test Rollback Procedures

The script tests that migrations can be safely rolled back:

1. Captures schema state before rollback
2. Executes the last migration's `down()` function
3. Removes migration from tracking table
4. Captures schema state after rollback
5. Re-applies the migration to restore state
6. Verifies final state matches original

**This ensures:**
- Rollback functions work correctly
- Schema is properly restored
- No data corruption occurs
- Migrations are reversible

### Step 5: Optional Restore

If `--restore` flag is used, the script restores the database from the backup created in Step 1.

## Test Report

After completion, the script generates a comprehensive report:

```
======================================================================
STAGING MIGRATION TEST REPORT
======================================================================

Test Configuration:
  Database: solana_nft_staking_staging
  Host: staging-db.example.com
  Timestamp: 2024-01-15T10:30:00.000Z

Backup:
  ✓ Created: database/migrations/backups/staging_backup_2024-01-15_103000.sql

Migrations:
  Applied: 4
  Skipped: 0

  Details:
    ✓ 001_add_missing_columns (245ms)
    ✓ 002_add_cascade_foreign_keys (189ms)
    ✓ 003_add_performance_indexes (156ms)
    ✓ 004_create_audit_logs_table (198ms)

Schema Verification:
  Changes detected: 15

Rollback Test:
  Migrations tested: 1
  Status: ✓ Passed
  Migration: 004_create_audit_logs_table

Overall Status: ✓ All tests passed

======================================================================
```

## Backup Management

### Backup Location

Backups are stored in: `database/migrations/backups/`

### Backup Naming

Format: `staging_backup_YYYY-MM-DD_HHMMSS.sql`

Example: `staging_backup_2024-01-15_103000.sql`

### Manual Restore

To manually restore from a backup:

```bash
mysql -h staging-db.example.com -u staging_user -p solana_nft_staking_staging < database/migrations/backups/staging_backup_2024-01-15_103000.sql
```

### Backup Retention

- Keep backups for at least 30 days
- Store critical backups off-server
- Test restore procedures regularly
- Document backup locations in runbook

## Troubleshooting

### Connection Refused

**Error:** `ECONNREFUSED`

**Solutions:**
- Verify database server is running
- Check `DB_HOST` and `DB_PORT` in `.env.staging`
- Verify firewall allows connections
- Test connection: `mysql -h <host> -u <user> -p`

### Access Denied

**Error:** `ER_ACCESS_DENIED_ERROR`

**Solutions:**
- Verify `DB_USER` and `DB_PASSWORD` are correct
- Check user has necessary permissions:
  - SELECT, INSERT, UPDATE, DELETE
  - CREATE, ALTER, DROP
  - INDEX, REFERENCES
- Grant permissions if needed:
  ```sql
  GRANT ALL PRIVILEGES ON solana_nft_staking_staging.* TO 'staging_user'@'%';
  FLUSH PRIVILEGES;
  ```

### Database Not Found

**Error:** `ER_BAD_DB_ERROR`

**Solutions:**
- Verify `DB_NAME` is correct in `.env.staging`
- Create database if needed:
  ```sql
  CREATE DATABASE solana_nft_staking_staging 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;
  ```

### mysqldump Not Found

**Error:** `mysqldump: command not found`

**Solutions:**
- Install MySQL client tools:
  - Ubuntu/Debian: `sudo apt-get install mysql-client`
  - macOS: `brew install mysql-client`
  - Windows: Install MySQL Workbench or MySQL Shell

### Migration Failed

**Error:** Migration fails during execution

**Solutions:**
1. Check error message for specific issue
2. Verify database schema state
3. Check migration SQL syntax
4. Test migration on local database first
5. Restore from backup if needed:
   ```bash
   node test-staging.js --restore
   ```

### Rollback Test Failed

**Error:** Rollback test fails

**Solutions:**
1. Review rollback error message
2. Verify `down()` function in migration
3. Check for data dependencies
4. Test rollback on local database
5. Update migration's `down()` function if needed

## Best Practices

### Before Running Tests

1. **Verify environment configuration**
   - Confirm `.env.staging` has correct credentials
   - Test database connection manually
   - Verify you're NOT connected to production

2. **Review pending migrations**
   - Check migration files for correctness
   - Review SQL statements
   - Verify migration order

3. **Communicate with team**
   - Notify team before testing on shared staging
   - Schedule testing during low-usage periods
   - Document any expected downtime

### During Testing

1. **Monitor the output**
   - Watch for errors or warnings
   - Verify schema changes match expectations
   - Check execution times

2. **Keep logs**
   - Save test output to file:
     ```bash
     node test-staging.js 2>&1 | tee staging-test-$(date +%Y%m%d-%H%M%S).log
     ```

### After Testing

1. **Review the test report**
   - Verify all migrations applied successfully
   - Check schema changes are correct
   - Confirm rollback test passed

2. **Validate application functionality**
   - Test critical user flows
   - Verify data integrity
   - Check API endpoints

3. **Document results**
   - Record test date and results
   - Note any issues encountered
   - Update deployment documentation

4. **Plan production deployment**
   - Schedule deployment window
   - Prepare rollback plan
   - Notify stakeholders

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Test Staging Migrations

on:
  push:
    branches: [staging]
    paths:
      - 'database/migrations/*.js'

jobs:
  test-migrations:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Create .env.staging
        run: |
          echo "DB_HOST=${{ secrets.STAGING_DB_HOST }}" >> backend/.env.staging
          echo "DB_PORT=${{ secrets.STAGING_DB_PORT }}" >> backend/.env.staging
          echo "DB_USER=${{ secrets.STAGING_DB_USER }}" >> backend/.env.staging
          echo "DB_PASSWORD=${{ secrets.STAGING_DB_PASSWORD }}" >> backend/.env.staging
          echo "DB_NAME=${{ secrets.STAGING_DB_NAME }}" >> backend/.env.staging
          echo "NODE_ENV=staging" >> backend/.env.staging
      
      - name: Test migrations
        run: |
          cd database/migrations
          node test-staging.js --restore
      
      - name: Upload backup
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: staging-backup
          path: database/migrations/backups/*.sql
          retention-days: 30
```

## Security Considerations

### Credential Management

- **Never commit** `.env.staging` to version control
- Use secrets management for CI/CD (GitHub Secrets, AWS Secrets Manager)
- Rotate staging credentials regularly
- Use different credentials for staging and production

### Access Control

- Limit who can run staging tests
- Require approval for staging deployments
- Log all staging database access
- Monitor for unauthorized changes

### Data Protection

- Ensure staging data is anonymized
- Don't use production data in staging
- Encrypt backups at rest
- Secure backup storage location

## Related Documentation

- [Migration Guide](./README.md) - General migration documentation
- [Rollback Procedures](./ROLLBACK_PROCEDURES.md) - Detailed rollback guide
- [Rollback Quick Reference](./ROLLBACK_QUICK_REFERENCE.md) - Quick rollback commands

## Support

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review migration logs for specific errors
3. Test on local database first
4. Consult with database administrator
5. Review MySQL error codes: https://dev.mysql.com/doc/mysql-errors/8.0/en/

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial release
- Support for backup, migration, verification, and rollback testing
- Comprehensive error handling and reporting
- Command line options for flexible testing
