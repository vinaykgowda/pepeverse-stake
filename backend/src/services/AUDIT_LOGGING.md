# Audit Logging System

## Overview

The audit logging system provides comprehensive tracking of all administrative actions performed on the platform. All audit logs are stored in an append-only table with a 1-year retention policy.

## Features

- **Append-Only Storage**: Audit logs cannot be modified or deleted (except by automated retention cleanup)
- **Comprehensive Tracking**: Logs all collection modifications, reward rate changes, and administrative actions
- **IP Address Tracking**: Records the IP address of the admin performing the action
- **User Agent Tracking**: Records the browser/client information
- **1-Year Retention**: Automatically cleans up logs older than 1 year

## Database Schema

The `audit_logs` table has the following structure:

```sql
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT,
  old_value JSON,
  new_value JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  INDEX idx_audit_logs_admin (admin_id),
  INDEX idx_audit_logs_created (created_at),
  INDEX idx_audit_logs_entity (entity_type, entity_id)
);
```

## Logged Actions

### Collection Actions

- **COLLECTION_CREATED**: When a new collection is added
- **COLLECTION_UPDATED**: When collection details are modified
- **COLLECTION_DELETED**: When a collection is removed

### Reward Actions

- **REWARD_RATE_CHANGED**: When the daily reward rate is modified
- **REWARD_STATUS_CHANGED**: When a reward is activated or deactivated

### Trait Reward Actions

- **TRAIT_REWARD_CREATED**: When a new trait reward is added
- **TRAIT_REWARD_UPDATED**: When trait reward multiplier is modified
- **TRAIT_REWARD_DELETED**: When a trait reward is removed

### Settings Actions

- **SETTINGS_CHANGED**: When platform settings are modified

## Usage

### Basic Logging

```javascript
const auditLog = require('../services/auditLog');

// Log a generic action
await auditLog.log({
  action: 'CUSTOM_ACTION',
  adminId: req.user.adminId,
  entityType: 'entity_type',
  entityId: 123,
  oldValue: { field: 'old_value' },
  newValue: { field: 'new_value' },
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});
```

### Collection Modification

```javascript
// Log collection creation
await auditLog.logCollectionModification({
  adminId: req.user.adminId,
  action: 'CREATED',
  collectionId: 123,
  newValue: { name: 'New Collection', creator_address: 'Creator123' },
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});

// Log collection update
await auditLog.logCollectionModification({
  adminId: req.user.adminId,
  action: 'UPDATED',
  collectionId: 123,
  oldValue: { name: 'Old Name' },
  newValue: { name: 'New Name' },
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});

// Log collection deletion
await auditLog.logCollectionModification({
  adminId: req.user.adminId,
  action: 'DELETED',
  collectionId: 123,
  oldValue: { name: 'Deleted Collection' },
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});
```

### Reward Rate Change

```javascript
await auditLog.logRewardRateChange({
  adminId: req.user.adminId,
  rewardId: 456,
  collectionId: 123,
  oldRate: 10.5,
  newRate: 15.75,
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});
```

### Trait Reward Modification

```javascript
await auditLog.logTraitRewardModification({
  adminId: req.user.adminId,
  action: 'CREATED',
  traitRewardId: 789,
  collectionId: 123,
  newValue: { traitType: 'Background', traitValue: 'Blue', multiplier: 1.5 },
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});
```

### Settings Change

```javascript
await auditLog.logSettingsChange({
  adminId: req.user.adminId,
  settingKey: 'maintenance_mode',
  oldValue: false,
  newValue: true,
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});
```

## Querying Audit Logs

### Get Logs with Filtering

```javascript
// Get all logs
const logs = await auditLog.getLogs();

// Filter by admin ID
const adminLogs = await auditLog.getLogs({
  adminId: 1
});

// Filter by action
const collectionLogs = await auditLog.getLogs({
  action: 'COLLECTION_CREATED'
});

// Filter by entity type
const rewardLogs = await auditLog.getLogs({
  entityType: 'reward'
});

// Filter by date range
const recentLogs = await auditLog.getLogs({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});

// Pagination
const paginatedLogs = await auditLog.getLogs({
  limit: 50,
  offset: 100
});
```

### Get Log Count

```javascript
// Get total count
const totalCount = await auditLog.getLogCount();

// Get filtered count
const filteredCount = await auditLog.getLogCount({
  adminId: 1,
  action: 'COLLECTION_CREATED'
});
```

## Retention Policy

### 1-Year Retention

Audit logs are retained for **1 year** from the date of creation. After 1 year, logs are automatically deleted by the cleanup process.

### Automated Cleanup

The `cleanupOldLogs()` method should be run as a scheduled job (e.g., daily cron job) to remove logs older than 1 year:

```javascript
const auditLog = require('../services/auditLog');

// Run cleanup (returns number of deleted records)
const deletedCount = await auditLog.cleanupOldLogs();
console.log(`Deleted ${deletedCount} old audit logs`);
```

### Scheduled Cleanup (Vercel Cron)

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

Create endpoint at `backend/routes/cron.js`:

```javascript
const express = require('express');
const router = express.Router();
const auditLog = require('../src/services/auditLog');
const logger = require('../src/utils/logger');

// Cleanup old audit logs (runs daily at 2 AM)
router.get('/cleanup-audit-logs', async (req, res) => {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = req.headers['x-vercel-cron-secret'];
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const deletedCount = await auditLog.cleanupOldLogs();
    
    logger.info('Audit log cleanup completed', { deletedCount });
    
    res.json({
      success: true,
      deletedCount
    });
  } catch (error) {
    logger.error('Audit log cleanup failed', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

## Append-Only Behavior

The audit logs table is designed to be **append-only**:

1. **No UPDATE operations**: The audit log service does not provide any methods to update existing logs
2. **No DELETE operations**: Individual logs cannot be deleted (only automated cleanup of old logs)
3. **Database constraints**: Consider adding database triggers to prevent updates/deletes:

```sql
-- Prevent updates to audit logs
DELIMITER //
CREATE TRIGGER prevent_audit_log_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'Audit logs cannot be modified';
END//
DELIMITER ;

-- Prevent manual deletes (except by cleanup process)
DELIMITER //
CREATE TRIGGER prevent_audit_log_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
  -- Allow deletes only from cleanup process (check connection user or other identifier)
  IF @allow_audit_cleanup IS NULL OR @allow_audit_cleanup != 1 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit logs cannot be manually deleted';
  END IF;
END//
DELIMITER ;
```

## Security Considerations

1. **Access Control**: Only authenticated admins can trigger actions that create audit logs
2. **IP Address Logging**: Helps track the source of administrative actions
3. **User Agent Logging**: Helps identify the client/browser used
4. **Immutability**: Append-only design ensures audit trail integrity
5. **Retention**: 1-year retention balances compliance needs with storage costs

## Compliance

The audit logging system helps meet compliance requirements:

- **Requirement 10.1**: Logs collection modifications with timestamp and admin identifier
- **Requirement 10.2**: Logs reward rate changes with old and new values
- **Requirement 10.3**: Logs sensitive data access (can be extended)
- **Requirement 10.4**: Append-only table design
- **Requirement 10.5**: 1-year retention policy

## Monitoring

Monitor audit log health:

```javascript
// Check recent audit log activity
const recentLogs = await auditLog.getLogs({
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  limit: 100
});

// Check for suspicious activity
const suspiciousActions = await auditLog.getLogs({
  action: 'COLLECTION_DELETED',
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
});

// Monitor specific admin activity
const adminActivity = await auditLog.getLogs({
  adminId: suspiciousAdminId,
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
});
```

## Error Handling

The audit logging service is designed to **not break the main operation** if logging fails:

```javascript
// Audit logging errors are caught and logged, but don't throw
await auditLog.log({
  action: 'SOME_ACTION',
  adminId: 1
  // ... other params
});
// If this fails, it returns null and logs the error, but doesn't throw
```

This ensures that administrative operations can still complete even if audit logging temporarily fails.

## Testing

Run audit log tests:

```bash
npm test -- auditLog.test.js
```

Run admin route audit integration tests:

```bash
npm test -- admin.audit.test.js
```
