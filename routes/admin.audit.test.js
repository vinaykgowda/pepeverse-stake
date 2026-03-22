/**
 * Integration tests for Admin Routes with Audit Logging
 * 
 * Tests that audit logs are created when admin actions are performed
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
const mockPool = {
  promise: jest.fn(() => ({
    query: jest.fn()
  }))
};

const mockGetPool = jest.fn(() => mockPool);

const mockVerifyJWT = jest.fn((req, res, next) => {
  req.user = { adminId: 1, isSuperAdmin: true };
  next();
});

const mockVerifyAdmin = jest.fn((req, res, next) => next());

const mockCollectionCache = {
  invalidate: jest.fn()
};

const mockAuditLog = {
  logCollectionModification: jest.fn().mockResolvedValue(1),
  logRewardRateChange: jest.fn().mockResolvedValue(1),
  log: jest.fn().mockResolvedValue(1)
};

jest.mock('../src/db', () => ({
  getPool: mockGetPool
}));

jest.mock('../middleware/auth', () => ({
  verifyJWT: mockVerifyJWT,
  verifyAdmin: mockVerifyAdmin
}));

jest.mock('../src/services/collectionCache', () => mockCollectionCache);
jest.mock('../src/services/auditLog', () => mockAuditLog);
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true)
}));

const adminRouter = require('./admin');

describe('Admin Routes - Audit Logging', () => {
  let app;
  let connection;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    
    connection = {
      query: jest.fn()
    };
    
    mockPool.promise.mockReturnValue(connection);
    
    jest.clearAllMocks();
  });

  describe('POST /api/admin/collections', () => {
    it('should log audit entry when collection is created', async () => {
      connection.query.mockResolvedValue([{ insertId: 123 }]);

      const response = await request(app)
        .post('/api/admin/collections')
        .field('name', 'Test Collection')
        .field('creator_address', 'Creator123')
        .attach('hashlist', Buffer.from('mint1\nmint2\nmint3'), 'hashlist.txt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(mockAuditLog.logCollectionModification).toHaveBeenCalledWith({
        adminId: 1,
        action: 'CREATED',
        collectionId: 123,
        newValue: {
          name: 'Test Collection',
          creator_address: 'Creator123'
        },
        ipAddress: '::ffff:127.0.0.1',
        userAgent: undefined
      });
    });
  });

  describe('PUT /api/admin/collections/:id', () => {
    it('should log audit entry when collection is updated', async () => {
      connection.query
        .mockResolvedValueOnce([[{ 
          name: 'Old Name', 
          creator_address: 'OldCreator' 
        }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app)
        .put('/api/admin/collections/123')
        .field('name', 'New Name')
        .field('creator_address', 'NewCreator');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(mockAuditLog.logCollectionModification).toHaveBeenCalledWith({
        adminId: 1,
        action: 'UPDATED',
        collectionId: 123,
        oldValue: {
          name: 'Old Name',
          creator_address: 'OldCreator'
        },
        newValue: {
          name: 'New Name',
          creator_address: 'NewCreator'
        },
        ipAddress: '::ffff:127.0.0.1',
        userAgent: undefined
      });
    });
  });

  describe('DELETE /api/admin/collections/:id', () => {
    it('should log audit entry when collection is deleted', async () => {
      connection.query
        .mockResolvedValueOnce([[{ count: 0 }]]) // No staked NFTs
        .mockResolvedValueOnce([[{ 
          name: 'Deleted Collection', 
          creator_address: 'DeletedCreator' 
        }]])
        .mockResolvedValueOnce([{ affectedRows: 0 }]) // Delete rewards
        .mockResolvedValueOnce([{ affectedRows: 0 }]) // Delete trait rewards
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // Delete collection

      const response = await request(app)
        .delete('/api/admin/collections/123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(mockAuditLog.logCollectionModification).toHaveBeenCalledWith({
        adminId: 1,
        action: 'DELETED',
        collectionId: 123,
        oldValue: {
          name: 'Deleted Collection',
          creator_address: 'DeletedCreator'
        },
        ipAddress: '::ffff:127.0.0.1',
        userAgent: undefined
      });
    });

    it('should not log audit entry when collection has staked NFTs', async () => {
      connection.query.mockResolvedValueOnce([[{ count: 5 }]]); // Has staked NFTs

      const response = await request(app)
        .delete('/api/admin/collections/123');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(mockAuditLog.logCollectionModification).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/admin/rewards/:id', () => {
    it('should log audit entry when reward rate is changed', async () => {
      connection.query
        .mockResolvedValueOnce([[{ 
          collection_id: 123, 
          daily_rate: 10.5,
          is_active: true
        }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app)
        .put('/api/admin/rewards/456')
        .send({ daily_rate: 15.75 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(mockAuditLog.logRewardRateChange).toHaveBeenCalledWith({
        adminId: 1,
        rewardId: 456,
        collectionId: 123,
        oldRate: 10.5,
        newRate: 15.75,
        ipAddress: '::ffff:127.0.0.1',
        userAgent: undefined
      });
    });

    it('should log audit entry when reward status is changed', async () => {
      connection.query
        .mockResolvedValueOnce([[{ 
          collection_id: 123, 
          daily_rate: 10.5,
          is_active: true
        }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app)
        .put('/api/admin/rewards/456')
        .send({ is_active: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(mockAuditLog.log).toHaveBeenCalledWith({
        adminId: 1,
        action: 'REWARD_STATUS_CHANGED',
        entityType: 'reward',
        entityId: 456,
        oldValue: { is_active: true, collectionId: 123 },
        newValue: { is_active: false, collectionId: 123 },
        ipAddress: '::ffff:127.0.0.1',
        userAgent: undefined
      });
    });

    it('should log both rate and status changes when both are updated', async () => {
      connection.query
        .mockResolvedValueOnce([[{ 
          collection_id: 123, 
          daily_rate: 10.5,
          is_active: true
        }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app)
        .put('/api/admin/rewards/456')
        .send({ 
          daily_rate: 15.75,
          is_active: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(mockAuditLog.logRewardRateChange).toHaveBeenCalled();
      expect(mockAuditLog.log).toHaveBeenCalled();
    });

    it('should not log audit entry when rate is unchanged', async () => {
      connection.query
        .mockResolvedValueOnce([[{ 
          collection_id: 123, 
          daily_rate: 10.5,
          is_active: true
        }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app)
        .put('/api/admin/rewards/456')
        .send({ daily_rate: 10.5 }); // Same rate

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(mockAuditLog.logRewardRateChange).not.toHaveBeenCalled();
    });
  });
});
