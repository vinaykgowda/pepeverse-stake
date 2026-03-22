/**
 * Unit tests for Audit Log Service
 */

// Mock the database module BEFORE importing anything else
jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  healthCheck: jest.fn()
}));

// Mock the logger module
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const auditLogService = require('./auditLog');
const db = require('../config/database');

describe('AuditLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('log', () => {
    it('should create audit log entry with all fields', async () => {
      const mockResult = {
        rows: [{ id: 1 }]
      };
      
      db.query.mockResolvedValue(mockResult);
      
      const params = {
        action: 'COLLECTION_CREATED',
        adminId: 1,
        entityType: 'collection',
        entityId: 123,
        oldValue: null,
        newValue: { name: 'Test Collection' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };
      
      const result = await auditLogService.log(params);
      
      expect(result).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        [
          1,
          'COLLECTION_CREATED',
          'collection',
          123,
          null,
          JSON.stringify({ name: 'Test Collection' }),
          '192.168.1.1',
          'Mozilla/5.0'
        ]
      );
    });
    
    it('should create audit log entry without optional fields', async () => {
      const mockResult = {
        rows: [{ id: 2 }]
      };
      
      db.query.mockResolvedValue(mockResult);
      
      const params = {
        action: 'REWARD_RATE_CHANGED',
        adminId: 1,
        entityType: 'reward',
        entityId: 456
      };
      
      const result = await auditLogService.log(params);
      
      expect(result).toBe(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        [
          1,
          'REWARD_RATE_CHANGED',
          'reward',
          456,
          null,
          null,
          null,
          null
        ]
      );
    });
    
    it('should return null if action is missing', async () => {
      const params = {
        adminId: 1
      };
      
      const result = await auditLogService.log(params);
      
      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });
    
    it('should return null if adminId is missing', async () => {
      const params = {
        action: 'TEST_ACTION'
      };
      
      const result = await auditLogService.log(params);
      
      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });
    
    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database connection failed'));
      
      const params = {
        action: 'TEST_ACTION',
        adminId: 1
      };
      
      const result = await auditLogService.log(params);
      
      expect(result).toBeNull();
    });
  });
  
  describe('logCollectionModification', () => {
    it('should log collection creation', async () => {
      const mockResult = {
        rows: [{ id: 1 }]
      };
      
      db.query.mockResolvedValue(mockResult);
      
      const params = {
        adminId: 1,
        action: 'CREATED',
        collectionId: 123,
        newValue: { name: 'New Collection', creator: 'Creator123' },
        ipAddress: '192.168.1.1'
      };
      
      const result = await auditLogService.logCollectionModification(params);
      
      expect(result).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          1,
          'COLLECTION_CREATED'
        ])
      );
    });
    
    it('should log collection update with old and new values', async () => {
      const mockResult = {
        rows: [{ id: 2 }]
      };
      
      db.query.mockResolvedValue(mockResult);
      
      const params = {
        adminId: 1,
        action: 'UPDATED',
        collectionId: 123,
        oldValue: { name: 'Old Name' },
        newValue: { name: 'New Name' },
        ipAddress: '192.168.1.1'
      };
      
      const result = await auditLogService.logCollectionModification(params);
      
      expect(result).toBe(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          1,
          'COLLECTION_UPDATED'
        ])
      );
    });
    
    it('should log collection deletion', async () => {
      const mockResult = {
        rows: [{ id: 3 }]
      };
      
      db.query.mockResolvedValue(mockResult);
      
      const params = {
        adminId: 1,
        action: 'DELETED',
        collectionId: 123,
        oldValue: { name: 'Deleted Collection' }
      };
      
      const result = await auditLogService.logCollectionModification(params);
      
      expect(result).toBe(3);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          1,
          'COLLECTION_DELETED'
        ])
      );
    });
  });
  
  describe('logRewardRateChange', () => {
    it('should log reward rate change with old and new rates', async () => {
      const mockResult = {
        rows: [{ id: 1 }]
      };
      
      db.query.mockResolvedValue(mockResult);
      
      const params = {
        adminId: 1,
        rewardId: 456,
        collectionId: 123,
        oldRate: 10.5,
        newRate: 15.75,
        ipAddress: '192.168.1.1'
      };
      
      const result = await auditLogService.logRewardRateChange(params);
      
      expect(result).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          1,
          'REWARD_RATE_CHANGED'
        ])
      );
      
      const oldValueArg = JSON.parse(db.query.mock.calls[0][1][4]);
      const newValueArg = JSON.parse(db.query.mock.calls[0][1][5]);
      expect(oldValueArg.dailyRate).toBe(10.5);
      expect(newValueArg.dailyRate).toBe(15.75);
    });
  });
  
  describe('logTraitRewardModification', () => {
    it('should log trait reward creation', async () => {
      const mockResult = {
        rows: [{ id: 1 }]
      };
      
      db.query.mockResolvedValue(mockResult);
      
      const params = {
        adminId: 1,
        action: 'CREATED',
        traitRewardId: 789,
        collectionId: 123,
        newValue: { traitType: 'Background', traitValue: 'Blue', multiplier: 1.5 }
      };
      
      const result = await auditLogService.logTraitRewardModification(params);
      
      expect(result).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          1,
          'TRAIT_REWARD_CREATED'
        ])
      );
    });
  });
  
  describe('logSettingsChange', () => {
    it('should log settings change', async () => {
      const mockResult = {
        rows: [{ id: 1 }]
      };
      
      db.query.mockResolvedValue(mockResult);
      
      const params = {
        adminId: 1,
        settingKey: 'maintenance_mode',
        oldValue: false,
        newValue: true,
        ipAddress: '192.168.1.1'
      };
      
      const result = await auditLogService.logSettingsChange(params);
      
      expect(result).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          1,
          'SETTINGS_CHANGED'
        ])
      );
    });
  });
  
  describe('getLogs', () => {
    it('should retrieve all logs with default pagination', async () => {
      const mockLogs = [
        {
          id: 1,
          admin_id: 1,
          action: 'COLLECTION_CREATED',
          entity_type: 'collection',
          entity_id: 123,
          old_value: null,
          new_value: { name: 'Test' },
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          created_at: new Date()
        }
      ];
      
      db.query.mockResolvedValue({ rows: mockLogs });
      
      const result = await auditLogService.getLogs();
      
      expect(result).toEqual(mockLogs);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [100, 0]
      );
    });
    
    it('should filter logs by admin ID', async () => {
      const mockLogs = [];
      db.query.mockResolvedValue({ rows: mockLogs });
      
      await auditLogService.getLogs({
        adminId: 1
      });
      
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE admin_id = $1'),
        expect.arrayContaining([1])
      );
    });
    
    it('should filter logs by action', async () => {
      const mockLogs = [];
      db.query.mockResolvedValue({ rows: mockLogs });
      
      await auditLogService.getLogs({
        action: 'REWARD_RATE_CHANGED'
      });
      
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE action = $1'),
        expect.arrayContaining(['REWARD_RATE_CHANGED'])
      );
    });
    
    it('should filter logs by entity type', async () => {
      const mockLogs = [];
      db.query.mockResolvedValue({ rows: mockLogs });
      
      await auditLogService.getLogs({
        entityType: 'collection'
      });
      
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE entity_type = $1'),
        expect.arrayContaining(['collection'])
      );
    });
    
    it('should filter logs by date range', async () => {
      const mockLogs = [];
      db.query.mockResolvedValue({ rows: mockLogs });
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      await auditLogService.getLogs({
        startDate,
        endDate
      });
      
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE created_at >= $1 AND created_at <= $2'),
        expect.arrayContaining([startDate, endDate])
      );
    });
    
    it('should support custom pagination', async () => {
      const mockLogs = [];
      db.query.mockResolvedValue({ rows: mockLogs });
      
      await auditLogService.getLogs({
        limit: 50,
        offset: 100
      });
      
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [50, 100]
      );
    });
  });
  
  describe('getLogCount', () => {
    it('should return total count of logs', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '42' }] });
      
      const result = await auditLogService.getLogCount();
      
      expect(result).toBe(42);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count'),
        []
      );
    });
    
    it('should return filtered count', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '10' }] });
      
      const result = await auditLogService.getLogCount({
        adminId: 1,
        action: 'COLLECTION_CREATED'
      });
      
      expect(result).toBe(10);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE admin_id = $1 AND action = $2'),
        expect.arrayContaining([
          1,
          'COLLECTION_CREATED'
        ])
      );
    });
  });
  
  describe('cleanupOldLogs', () => {
    it('should delete logs older than 1 year', async () => {
      db.query.mockResolvedValue({ rowCount: 15 });
      
      const result = await auditLogService.cleanupOldLogs();
      
      expect(result).toBe(15);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM audit_logs'),
        expect.any(Array)
      );
      
      // Verify the date is approximately 1 year ago
      const cutoffDate = db.query.mock.calls[0][1][0];
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      // Allow 1 second difference for test execution time
      expect(Math.abs(cutoffDate - oneYearAgo)).toBeLessThan(1000);
    });
  });
});
