/**
 * Audit Log Service
 * 
 * Provides audit logging functionality for administrative actions.
 * Logs are written to the audit_logs table with append-only behavior.
 * 
 * Requirements: 10.1, 10.2, 10.4, 10.5
 * 
 * Features:
 * - Logs all administrative actions
 * - Includes admin wallet, action, details, timestamp, IP address
 * - Append-only storage (no updates or deletes)
 * - 1-year retention policy
 */

const db = require('../config/database');
const logger = require('../utils/logger');

class AuditLogService {
  /**
   * Log an administrative action
   * 
   * @param {Object} params - Audit log parameters
   * @param {string} params.action - Action performed (e.g., 'COLLECTION_CREATED', 'REWARD_RATE_CHANGED')
   * @param {number} params.adminId - Admin ID performing the action
   * @param {string} params.entityType - Type of entity (e.g., 'collection', 'reward')
   * @param {number} params.entityId - ID of the entity (optional)
   * @param {Object} params.oldValue - Previous value (optional)
   * @param {Object} params.newValue - New value (optional)
   * @param {string} params.ipAddress - IP address of the admin (optional)
   * @param {string} params.userAgent - User agent string (optional)
   * @returns {Promise<number>} The ID of the created audit log entry
   */
  async log({ 
    action, 
    adminId, 
    entityType = null, 
    entityId = null, 
    oldValue = null, 
    newValue = null, 
    ipAddress = null,
    userAgent = null
  }) {
    try {
      // Validate required fields
      if (!action || typeof action !== 'string') {
        throw new Error('Action is required and must be a string');
      }
      
      if (!adminId || typeof adminId !== 'number') {
        throw new Error('Admin ID is required and must be a number');
      }
      
      // Insert audit log entry (append-only)
      const result = await db.query(
        `INSERT INTO audit_logs (
          admin_id, action, entity_type, entity_id, 
          old_value, new_value, ip_address, user_agent
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          adminId, 
          action, 
          entityType, 
          entityId,
          oldValue ? JSON.stringify(oldValue) : null,
          newValue ? JSON.stringify(newValue) : null,
          ipAddress,
          userAgent
        ]
      );
      
      const auditLogId = result.rows[0].id;
      
      // Log to application logger as well
      logger.info('Audit log created', {
        auditLogId,
        action,
        adminId,
        entityType,
        entityId,
        ipAddress
      });
      
      return auditLogId;
    } catch (error) {
      logger.error('Failed to create audit log', {
        error: error.message,
        action,
        adminId
      });
      
      // Don't throw - audit logging should not break the main operation
      // But log the error for investigation
      return null;
    }
  }
  
  /**
   * Log collection modification
   * 
   * @param {Object} params - Collection modification parameters
   * @param {number} params.adminId - Admin ID performing the action
   * @param {string} params.action - Action type ('CREATED', 'UPDATED', 'DELETED')
   * @param {number} params.collectionId - Collection ID
   * @param {Object} params.oldValue - Previous values (for updates)
   * @param {Object} params.newValue - New values
   * @param {string} params.ipAddress - IP address (optional)
   * @param {string} params.userAgent - User agent (optional)
   * @returns {Promise<number>} Audit log ID
   */
  async logCollectionModification({ 
    adminId, 
    action, 
    collectionId, 
    oldValue = null, 
    newValue = null, 
    ipAddress = null,
    userAgent = null
  }) {
    return await this.log({
      action: `COLLECTION_${action.toUpperCase()}`,
      adminId,
      entityType: 'collection',
      entityId: collectionId,
      oldValue,
      newValue,
      ipAddress,
      userAgent
    });
  }
  
  /**
   * Log reward rate change
   * 
   * @param {Object} params - Reward rate change parameters
   * @param {number} params.adminId - Admin ID performing the action
   * @param {number} params.rewardId - Reward ID
   * @param {number} params.collectionId - Collection ID
   * @param {number} params.oldRate - Previous daily rate
   * @param {number} params.newRate - New daily rate
   * @param {string} params.ipAddress - IP address (optional)
   * @param {string} params.userAgent - User agent (optional)
   * @returns {Promise<number>} Audit log ID
   */
  async logRewardRateChange({ 
    adminId, 
    rewardId, 
    collectionId, 
    oldRate, 
    newRate, 
    ipAddress = null,
    userAgent = null
  }) {
    return await this.log({
      action: 'REWARD_RATE_CHANGED',
      adminId,
      entityType: 'reward',
      entityId: rewardId,
      oldValue: { dailyRate: oldRate, collectionId },
      newValue: { dailyRate: newRate, collectionId },
      ipAddress,
      userAgent
    });
  }
  
  /**
   * Log trait reward modification
   * 
   * @param {Object} params - Trait reward modification parameters
   * @param {number} params.adminId - Admin ID performing the action
   * @param {string} params.action - Action type ('CREATED', 'UPDATED', 'DELETED')
   * @param {number} params.traitRewardId - Trait reward ID
   * @param {number} params.collectionId - Collection ID
   * @param {Object} params.oldValue - Previous values (for updates)
   * @param {Object} params.newValue - New values
   * @param {string} params.ipAddress - IP address (optional)
   * @param {string} params.userAgent - User agent (optional)
   * @returns {Promise<number>} Audit log ID
   */
  async logTraitRewardModification({ 
    adminId, 
    action, 
    traitRewardId, 
    collectionId, 
    oldValue = null, 
    newValue = null, 
    ipAddress = null,
    userAgent = null
  }) {
    return await this.log({
      action: `TRAIT_REWARD_${action.toUpperCase()}`,
      adminId,
      entityType: 'trait_reward',
      entityId: traitRewardId,
      oldValue: oldValue ? { ...oldValue, collectionId } : null,
      newValue: newValue ? { ...newValue, collectionId } : null,
      ipAddress,
      userAgent
    });
  }
  
  /**
   * Log settings change
   * 
   * @param {Object} params - Settings change parameters
   * @param {number} params.adminId - Admin ID performing the action
   * @param {string} params.settingKey - Setting key name
   * @param {*} params.oldValue - Previous value
   * @param {*} params.newValue - New value
   * @param {string} params.ipAddress - IP address (optional)
   * @param {string} params.userAgent - User agent (optional)
   * @returns {Promise<number>} Audit log ID
   */
  async logSettingsChange({ 
    adminId, 
    settingKey, 
    oldValue, 
    newValue, 
    ipAddress = null,
    userAgent = null
  }) {
    return await this.log({
      action: 'SETTINGS_CHANGED',
      adminId,
      entityType: 'setting',
      entityId: null,
      oldValue: { key: settingKey, value: oldValue },
      newValue: { key: settingKey, value: newValue },
      ipAddress,
      userAgent
    });
  }
  
  /**
   * Retrieve audit logs with filtering and pagination
   * 
   * @param {Object} options - Query options
   * @param {number} options.adminId - Filter by admin ID (optional)
   * @param {string} options.action - Filter by action (optional)
   * @param {string} options.entityType - Filter by entity type (optional)
   * @param {Date} options.startDate - Filter by start date (optional)
   * @param {Date} options.endDate - Filter by end date (optional)
   * @param {number} options.limit - Number of records to return (default: 100)
   * @param {number} options.offset - Offset for pagination (default: 0)
   * @returns {Promise<Array>} Array of audit log entries
   */
  async getLogs({ 
    adminId = null, 
    action = null,
    entityType = null,
    startDate = null, 
    endDate = null, 
    limit = 100, 
    offset = 0 
  } = {}) {
    try {
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (adminId) {
        conditions.push(`admin_id = $${paramIndex++}`);
        params.push(adminId);
      }
      
      if (action) {
        conditions.push(`action = $${paramIndex++}`);
        params.push(action);
      }
      
      if (entityType) {
        conditions.push(`entity_type = $${paramIndex++}`);
        params.push(entityType);
      }
      
      if (startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(startDate);
      }
      
      if (endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(endDate);
      }
      
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      params.push(limit, offset);
      
      const result = await db.query(
        `SELECT 
          id, admin_id, action, entity_type, entity_id,
          old_value, new_value, ip_address, user_agent, created_at
         FROM audit_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        params
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to retrieve audit logs', {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get audit log count with filtering
   * 
   * @param {Object} options - Query options
   * @returns {Promise<number>} Total count of matching audit logs
   */
  async getLogCount({ 
    adminId = null, 
    action = null,
    entityType = null,
    startDate = null, 
    endDate = null 
  } = {}) {
    try {
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (adminId) {
        conditions.push(`admin_id = $${paramIndex++}`);
        params.push(adminId);
      }
      
      if (action) {
        conditions.push(`action = $${paramIndex++}`);
        params.push(action);
      }
      
      if (entityType) {
        conditions.push(`entity_type = $${paramIndex++}`);
        params.push(entityType);
      }
      
      if (startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(startDate);
      }
      
      if (endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(endDate);
      }
      
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      const result = await db.query(
        `SELECT COUNT(*) as count
         FROM audit_logs
         ${whereClause}`,
        params
      );
      
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to get audit log count', {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Delete audit logs older than retention period (1 year)
   * This should be run as a scheduled job
   * 
   * @returns {Promise<number>} Number of deleted records
   */
  async cleanupOldLogs() {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const result = await db.query(
        `DELETE FROM audit_logs
         WHERE created_at < $1`,
        [oneYearAgo]
      );
      
      const deletedCount = result.rowCount || 0;
      
      logger.info('Cleaned up old audit logs', {
        deletedCount,
        cutoffDate: oneYearAgo
      });
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old audit logs', {
        error: error.message
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AuditLogService();
