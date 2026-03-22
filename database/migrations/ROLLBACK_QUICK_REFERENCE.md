# Migration Rollback Quick Reference

Quick reference guide for rolling back database migrations. For detailed procedures, see [ROLLBACK_PROCEDURES.md](ROLLBACK_PROCEDURES.md).

## Quick Commands

```bash
# Check migration status
node migrate.js status

# Roll back last migration
node migrate.js down

# Roll back specific migration
node migrate.js down [migration-name]

# Test rollback (development only)
node test-rollback.js [migration-name]
```

## Emergency Rollback (Production Down)

```bash
# 1. Stop application
systemctl stop solana-nft-staking

# 2. Backup database
mysqldump -u root -p solana_nft_staking > emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Navigate to migrations
cd database/migrations

# 4. Roll back problematic migration
node migrate.js down [migration-name]

# 5. Verify
node migrate.js status

# 6. Restart application
systemctl start solana-nft-staking
```

## Pre-Rollback Checklist

- [ ] Backup database
- [ ] Stop application
- [ ] Identify problematic migration
- [ ] Notify team
- [ ] Test on staging (if time permits)

## Migration Rollback Summary

| Migration | Rollback Impact | Data Loss Risk |
|-----------|----------------|----------------|
| 001_add_missing_columns | Drops columns: `last_claim_timestamp`, `collection_id`, `nft_count` | **HIGH** - Data in these columns will be lost |
| 002_add_cascade_foreign_keys | Removes CASCADE rules from foreign keys | **NONE** - Only changes referential integrity behavior |
| 003_add_performance_indexes | Drops performance indexes | **NONE** - Only affects query performance |
| 004_create_audit_logs_table | Drops entire `audit_logs` table | **HIGH** - All audit log data will be lost |

## Verification Queries

```sql
-- Check migration status
SELECT * FROM migrations ORDER BY applied_at DESC;

-- Verify schema state
SHOW TABLES;
DESCRIBE staked_nfts;
DESCRIBE transactions;

-- Check foreign keys
SELECT TABLE_NAME, CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE();

-- Check indexes
SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME) as columns
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
GROUP BY TABLE_NAME, INDEX_NAME;
```

## Common Issues

### "Foreign key constraint fails"
```sql
SET FOREIGN_KEY_CHECKS = 0;
-- Run rollback
SET FOREIGN_KEY_CHECKS = 1;
```

### "Column doesn't exist"
- Check if already rolled back: `DESCRIBE table_name;`
- Update migrations table if needed:
  ```sql
  DELETE FROM migrations WHERE name = 'migration_name';
  ```

### Application won't start after rollback
1. Deploy previous application version
2. Check application logs for schema mismatches
3. Verify database schema matches application expectations

## Rollback Decision Matrix

| Severity | Action |
|----------|--------|
| **Critical** (Production down) | Immediate rollback |
| **High** (Major functionality broken) | Rollback within 1 hour |
| **Medium** (Minor functionality broken) | Evaluate and decide |
| **Low** (Performance issues) | Monitor and fix forward |

## Support

- Detailed procedures: [ROLLBACK_PROCEDURES.md](ROLLBACK_PROCEDURES.md)
- Migration guide: [README.md](README.md)
- Design document: `.kiro/specs/production-readiness-mainnet-migration/design.md`

---

**Remember**: Always backup before rollback!
