# Audit Log Retention Policy

## Policy Summary

**Retention Period**: 1 year (365 days)  
**Storage Type**: Append-only  
**Cleanup Method**: Automated scheduled job

## Retention Details

### What is Retained

All audit logs are retained for **1 year** from the date of creation (`created_at` timestamp). This includes:

- Collection modifications (create, update, delete)
- Reward rate changes
- Trait reward modifications
- Settings changes
- All other administrative actions

### What Happens After 1 Year

Audit logs older than 1 year are automatically deleted by the cleanup process. The cleanup:

- Runs daily via scheduled cron job
- Deletes records where `created_at < (current_date - 1 year)`
- Logs the number of deleted records
- Does not affect logs within the 1-year window

### Append-Only Storage

The audit logs table is **append-only**, meaning:

- ✅ **INSERT**: New audit logs can be created
- ❌ **UPDATE**: Existing audit logs cannot be modified
- ❌ **DELETE**: Individual audit logs cannot be manually deleted
- ✅ **AUTOMATED DELETE**: Only the automated cleanup process can delete old logs

This ensures the integrity of the audit trail.

## Implementation

### Automated Cleanup

The cleanup is implemented in the `AuditLogService.cleanupOldLogs()` method:

```javascript
async cleanupOldLogs() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const result = await db.query(
    `DELETE FROM audit_logs WHERE created_at < $1`,
    [oneYearAgo]
  );
  
  return result.rowCount;
}
```

### Scheduled Execution

#### Option 1: Vercel Cron (Recommended for Vercel deployment)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-audit-logs",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs daily at 2:00 AM UTC.

#### Option 2: Manual Cron Job

If not using Vercel Cron, set up a system cron job:

```bash
# Run daily at 2 AM
0 2 * * * curl -X GET https://your-domain.com/api/cron/cleanup-audit-logs \
  -H "x-vercel-cron-secret: YOUR_CRON_SECRET"
```

#### Option 3: Database Scheduled Event (PostgreSQL)

For Neon DB or PostgreSQL, you can use a scheduled event:

```sql
-- Create a function to cleanup old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule it to run daily (requires pg_cron extension)
-- Note: pg_cron may not be available on all PostgreSQL providers
SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT cleanup_old_audit_logs()');
```

**Note**: Neon DB may not support pg_cron, so Vercel Cron or manual cron is recommended.

## Monitoring Retention

### Check Oldest Log

```sql
SELECT MIN(created_at) as oldest_log FROM audit_logs;
```

### Check Log Count by Age

```sql
SELECT 
  CASE 
    WHEN created_at >= NOW() - INTERVAL '30 days' THEN 'Last 30 days'
    WHEN created_at >= NOW() - INTERVAL '90 days' THEN '30-90 days'
    WHEN created_at >= NOW() - INTERVAL '180 days' THEN '90-180 days'
    WHEN created_at >= NOW() - INTERVAL '365 days' THEN '180-365 days'
    ELSE 'Over 1 year (should be cleaned up)'
  END as age_range,
  COUNT(*) as log_count
FROM audit_logs
GROUP BY age_range
ORDER BY MIN(created_at);
```

### Check Storage Size

```sql
SELECT 
  pg_size_pretty(pg_total_relation_size('audit_logs')) as total_size,
  COUNT(*) as total_logs,
  MIN(created_at) as oldest_log,
  MAX(created_at) as newest_log
FROM audit_logs;
```

## Compliance

This retention policy helps meet compliance requirements:

- **Requirement 10.5**: Minimum 1-year retention for audit logs
- **SOC 2**: Audit trail retention for security monitoring
- **GDPR**: Reasonable retention period for security logs
- **PCI DSS**: Audit log retention for payment-related systems

## Extending Retention Period

If you need to extend the retention period beyond 1 year:

1. Update the `cleanupOldLogs()` method:

```javascript
async cleanupOldLogs(retentionYears = 1) {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);
  
  const result = await db.query(
    `DELETE FROM audit_logs WHERE created_at < $1`,
    [cutoffDate]
  );
  
  return result.rowCount;
}
```

2. Call with custom retention:

```javascript
// Retain for 2 years instead of 1
const deletedCount = await auditLog.cleanupOldLogs(2);
```

## Backup Considerations

Before the automated cleanup runs, consider:

1. **Archive to Cold Storage**: Export logs older than 1 year to S3/archive storage
2. **Compliance Requirements**: Some regulations may require longer retention in archives
3. **Legal Hold**: Implement a mechanism to prevent deletion of logs under legal hold

### Example Archive Script

```javascript
async function archiveOldLogs() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  // Get logs to archive
  const logsToArchive = await db.query(
    `SELECT * FROM audit_logs WHERE created_at < $1`,
    [oneYearAgo]
  );
  
  // Export to JSON
  const archiveData = {
    exportDate: new Date().toISOString(),
    logCount: logsToArchive.rows.length,
    logs: logsToArchive.rows
  };
  
  // Save to file or upload to S3
  fs.writeFileSync(
    `audit-logs-archive-${oneYearAgo.toISOString().split('T')[0]}.json`,
    JSON.stringify(archiveData, null, 2)
  );
  
  return logsToArchive.rows.length;
}
```

## Troubleshooting

### Cleanup Not Running

1. Check cron job configuration in `vercel.json`
2. Verify `CRON_SECRET` environment variable is set
3. Check Vercel cron logs in dashboard
4. Manually trigger cleanup endpoint to test

### Too Many Logs

If audit logs are growing too quickly:

1. Review what actions are being logged
2. Consider reducing retention period (with compliance approval)
3. Implement log sampling for high-frequency actions
4. Archive old logs to cold storage before deletion

### Performance Issues

If cleanup is slow:

1. Ensure index on `created_at` exists: `CREATE INDEX idx_audit_logs_created ON audit_logs(created_at)`
2. Run cleanup during off-peak hours
3. Consider batched deletion for very large tables
4. Monitor database performance during cleanup

## Summary

- **Retention**: 1 year from creation date
- **Storage**: Append-only (no updates or manual deletes)
- **Cleanup**: Automated daily via cron job
- **Compliance**: Meets Requirement 10.5
- **Monitoring**: Check oldest log and storage size regularly
- **Backup**: Consider archiving before deletion for long-term compliance
