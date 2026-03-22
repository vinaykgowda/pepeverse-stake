// backend/routes/admin.cache-invalidation.test.js

/**
 * Integration tests for cache invalidation in admin endpoints
 * 
 * These tests verify that the collection cache is properly invalidated
 * when collection settings are modified through admin endpoints.
 * 
 * Requirements: 19.3 - Invalidate cache on settings changes
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
const mockCollectionCache = {
  invalidate: jest.fn()
};

const mockPool = {
  promise: jest.fn(() => ({
    query: jest.fn()
  }))
};

const mockVerifyJWT = jest.fn((req, res, next) => {
  req.user = { adminId: 1, isSuperAdmin: true };
  next();
});

const mockVerifyAdmin = jest.fn((req, res, next) => next());

jest.mock('../src/services/collectionCache', () => mockCollectionCache);
jest.mock('../src/db', () => ({
  getPool: () => mockPool
}));
jest.mock('../middleware/auth', () => ({
  verifyJWT: mockVerifyJWT,
  verifyAdmin: mockVerifyAdmin
}));
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true)
}));

const adminRouter = require('./admin');

describe('Admin Routes - Cache Invalidation', () => {
  let app;
  let mockConnection;

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRouter);

    // Setup mock connection
    mockConnection = {
      query: jest.fn()
    };
    mockPool.promise.mockReturnValue(mockConnection);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/v1/admin/collections', () => {
    it('should invalidate cache after adding collection', async () => {
      mockConnection.query.mockResolvedValue([{ insertId: 1 }]);

      const response = await request(app)
        .post('/api/v1/admin/collections')
        .field('name', 'Test Collection')
        .field('creator_address', 'creator123')
        .attach('hashlist', Buffer.from('mint1\nmint2\nmint3'), 'hashlist.txt');

      expect(response.status).toBe(200);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledWith();
      expect(mockCollectionCache.invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/v1/admin/collections/:id', () => {
    it('should invalidate cache after updating collection', async () => {
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

      const response = await request(app)
        .put('/api/v1/admin/collections/1')
        .field('name', 'Updated Collection')
        .field('creator_address', 'creator456');

      expect(response.status).toBe(200);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledWith('1');
      expect(mockCollectionCache.invalidate).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache when updating with hashlist', async () => {
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

      const response = await request(app)
        .put('/api/v1/admin/collections/2')
        .field('name', 'Updated Collection')
        .field('creator_address', 'creator789')
        .attach('hashlist', Buffer.from('mint4\nmint5'), 'hashlist.txt');

      expect(response.status).toBe(200);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledWith('2');
    });
  });

  describe('DELETE /api/v1/admin/collections/:id', () => {
    it('should invalidate cache after deleting collection', async () => {
      // Mock no staked NFTs
      mockConnection.query
        .mockResolvedValueOnce([[{ count: 0 }]])  // Check staked NFTs
        .mockResolvedValueOnce([{ affectedRows: 1 }])  // Delete rewards
        .mockResolvedValueOnce([{ affectedRows: 1 }])  // Delete trait rewards
        .mockResolvedValueOnce([{ affectedRows: 1 }]);  // Delete collection

      const response = await request(app)
        .delete('/api/v1/admin/collections/1');

      expect(response.status).toBe(200);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledWith('1');
      expect(mockCollectionCache.invalidate).toHaveBeenCalledTimes(1);
    });

    it('should not invalidate cache if deletion fails', async () => {
      // Mock staked NFTs exist
      mockConnection.query.mockResolvedValueOnce([[{ count: 5 }]]);

      const response = await request(app)
        .delete('/api/v1/admin/collections/1');

      expect(response.status).toBe(400);
      expect(mockCollectionCache.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/admin/rewards', () => {
    it('should invalidate cache after adding reward', async () => {
      mockConnection.query.mockResolvedValue([{ insertId: 1 }]);

      const response = await request(app)
        .post('/api/v1/admin/rewards')
        .send({
          collection_id: 1,
          token_address: 'token123',
          token_symbol: 'TEST',
          token_decimals: 9,
          daily_rate: 10.5
        });

      expect(response.status).toBe(200);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledWith(1);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/v1/admin/rewards/:id', () => {
    it('should invalidate cache after updating reward', async () => {
      // Mock getting collection_id
      mockConnection.query
        .mockResolvedValueOnce([[{ collection_id: 1 }]])  // Get collection_id
        .mockResolvedValueOnce([{ affectedRows: 1 }]);  // Update reward

      const response = await request(app)
        .put('/api/v1/admin/rewards/1')
        .send({
          daily_rate: 15.0,
          is_active: true
        });

      expect(response.status).toBe(200);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledWith(1);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledTimes(1);
    });

    it('should not invalidate cache if reward not found', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);  // Reward not found

      const response = await request(app)
        .put('/api/v1/admin/rewards/999')
        .send({ daily_rate: 15.0 });

      expect(response.status).toBe(404);
      expect(mockCollectionCache.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/admin/rewards/:id', () => {
    it('should invalidate cache after deleting reward', async () => {
      // Mock getting collection_id
      mockConnection.query
        .mockResolvedValueOnce([[{ collection_id: 2 }]])  // Get collection_id
        .mockResolvedValueOnce([{ affectedRows: 1 }]);  // Delete reward

      const response = await request(app)
        .delete('/api/v1/admin/rewards/1');

      expect(response.status).toBe(200);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledWith(2);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v1/admin/trait-rewards', () => {
    it('should invalidate cache after adding trait reward', async () => {
      mockConnection.query.mockResolvedValue([{ insertId: 1 }]);

      const response = await request(app)
        .post('/api/v1/admin/trait-rewards')
        .send({
          collection_id: 3,
          trait_type: 'Background',
          trait_value: 'Blue',
          token_address: 'token123',
          token_symbol: 'TEST',
          multiplier: 1.5
        });

      expect(response.status).toBe(200);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledWith(3);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/v1/admin/trait-rewards/:id', () => {
    it('should invalidate cache after updating trait reward', async () => {
      // Mock getting collection_id
      mockConnection.query
        .mockResolvedValueOnce([[{ collection_id: 3 }]])  // Get collection_id
        .mockResolvedValueOnce([{ affectedRows: 1 }]);  // Update trait reward

      const response = await request(app)
        .put('/api/v1/admin/trait-rewards/1')
        .send({
          multiplier: 2.0,
          is_active: true
        });

      expect(response.status).toBe(200);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledWith(3);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /api/v1/admin/trait-rewards/:id', () => {
    it('should invalidate cache after deleting trait reward', async () => {
      // Mock getting collection_id
      mockConnection.query
        .mockResolvedValueOnce([[{ collection_id: 4 }]])  // Get collection_id
        .mockResolvedValueOnce([{ affectedRows: 1 }]);  // Delete trait reward

      const response = await request(app)
        .delete('/api/v1/admin/trait-rewards/1');

      expect(response.status).toBe(200);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledWith(4);
      expect(mockCollectionCache.invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache invalidation on errors', () => {
    it('should not invalidate cache if database operation fails', async () => {
      mockConnection.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/admin/collections')
        .field('name', 'Test Collection')
        .field('creator_address', 'creator123')
        .attach('hashlist', Buffer.from('mint1\nmint2'), 'hashlist.txt');

      expect(response.status).toBe(500);
      expect(mockCollectionCache.invalidate).not.toHaveBeenCalled();
    });
  });
});
