# Staging Migration Testing - Quick Reference

## Quick Start

```bash
# Full test (recommended)
node test-staging.js

# Test and restore (safe testing)
node test-staging.js --restore

# Backup only
node test-staging.js --backup-only
```

## Command Options

| Option | Description | Use Case |
|--------|-------------|----------|
| (none) | Full test with backup | Standard testing |
| `--restore` | Test and restore after | Safe testing without permanent changes |
| `--skip-backup` | Skip backup step | Quick test (not recommended) |
| `--skip-rollback` | Skip rollback test | Only verify migrations apply |
| `--backup-only` | Only create backup | Pre-deployment backup |

## Pre-Flight Checklist

- [ ] Verify `.env.staging` exists with correct credentials
- [ ] Confirm NOT connected to production database
- [ ] Review pending migrations
- [ ] Notify team if using shared staging
- [ ] Ensure sufficient disk space for backup

## Test Process

1. **Backup** - Creates timestamped SQL dump
2. **Migrate** - Applies pending migrations
3. **Verify** - Checks schema changes
4. **Rollback Test** - Tests reversibility
5. **Restore** (optional) - Restores from backup

## Common Commands

### Test migrations safely
```bash
node test-staging.js --restore
```

### Create backup before manual migration
```bash
node test-staging.js --backup-only
```

### Quick migration test (no rollback)
```bash
node test-staging.js --skip-rollback
```

### Manual restore from backup
```bash
mysql -h <host> -u <user> -p <database> < backups/staging_backup_YYYY-MM-DD_HHMMSS.sql
```

## Expected Output

### Success
```
✓ Backup created successfully
✓ All migrations completed successfully
✓ Verified X schema change(s)
✓ Rollback procedures verified
✓ All tests passed
```

### Failure Indicators
```
✗ Migration failed
✗ Schema verification failed
✗ Rollback test failed
```

## Troubleshooting Quick Fixes

### Connection Issues
```bash
# Test connection
mysql -h <host> -u <user> -p

# Check .env.staging
cat backend/.env.staging
```

### Permission Issues
```sql
-- Grant permissions
GRANT ALL PRIVILEGES ON database_name.* TO 'user'@'%';
FLUSH PRIVILEGES;
```

### Restore from Backup
```bash
# Find latest backup
ls -lt database/migrations/backups/

# Restore
mysql -h <host> -u <user> -p <database> < backups/staging_backup_YYYY-MM-DD_HHMMSS.sql
```

## Backup Location

```
database/migrations/backups/staging_backup_YYYY-MM-DD_HHMMSS.sql
```

## Safety Rules

1. ✅ Always create backup before testing
2. ✅ Test on staging before production
3. ✅ Verify you're NOT on production
4. ✅ Review migration code first
5. ❌ Never skip backup on shared staging
6. ❌ Never use production credentials

## Post-Test Validation

- [ ] Review test report
- [ ] Verify schema changes are correct
- [ ] Test application functionality
- [ ] Check API endpoints
- [ ] Validate data integrity
- [ ] Document any issues

## Emergency Rollback

If migrations cause issues:

```bash
# Option 1: Restore from backup
mysql -h <host> -u <user> -p <database> < backups/staging_backup_YYYY-MM-DD_HHMMSS.sql

# Option 2: Use migration rollback
node migrate.js down
```

## Next Steps After Successful Test

1. Document test results
2. Update deployment plan
3. Schedule production deployment
4. Prepare production rollback plan
5. Notify stakeholders

## Support

- Full guide: `STAGING_TEST_GUIDE.md`
- Migration docs: `README.md`
- Rollback guide: `ROLLBACK_PROCEDURES.md`

## Example Test Session

```bash
$ node test-staging.js --restore

╔════════════════════════════════════════════════════════════════════╗
║       Staging Database Migration Testing Script                   ║
╚════════════════════════════════════════════════════════════════════╝

Configuration:
  Database: solana_nft_staking_staging
  Host: staging-db.example.com
  Skip Backup: No
  Skip Rollback: No
  Restore After: Yes

======================================================================
STEP 1: Creating Database Backup
======================================================================

Creating backup...
  Database: solana_nft_staking_staging
  Backup file: backups/staging_backup_2024-01-15_103000.sql

✓ Backup created successfully
  File size: 12.45 MB
  Location: backups/staging_backup_2024-01-15_103000.sql

======================================================================
STEP 2: Running Migrations
======================================================================

Total migrations: 4
Applied: 0
Pending: 4

Pending migrations:
  - 001_add_missing_columns
  - 002_add_cascade_foreign_keys
  - 003_add_performance_indexes
  - 004_create_audit_logs_table

Applying migration: 001_add_missing_columns
----------------------------------------------------------------------
✓ Migration 001_add_missing_columns completed in 245ms

[... more migrations ...]

✓ All migrations completed successfully

======================================================================
STEP 3: Verifying Schema Changes
======================================================================

New tables created:
  ✓ audit_logs

staked_nfts - New columns:
  ✓ last_claim_timestamp (timestamp)

[... more changes ...]

✓ Verified 15 schema change(s)

======================================================================
STEP 4: Testing Rollback Procedures
======================================================================

Testing rollback of: 004_create_audit_logs_table

1. Capturing schema state before rollback...
   ✓ State captured

2. Executing rollback...
   ✓ Rollback completed in 156ms

3. Capturing schema state after rollback...
   ✓ State captured

4. Re-applying migration to restore state...
   ✓ Migration re-applied

5. Verifying final state...
   ✓ Rollback test successful

✓ Rollback procedures verified

======================================================================
STEP 5: Restoring from Backup
======================================================================

Restoring database...
  Backup file: backups/staging_backup_2024-01-15_103000.sql
  Database: solana_nft_staking_staging

✓ Database restored successfully

======================================================================
STAGING MIGRATION TEST REPORT
======================================================================

[... report details ...]

Overall Status: ✓ All tests passed

======================================================================

✓ Staging migration test completed successfully!
```
