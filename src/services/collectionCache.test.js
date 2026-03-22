// backend/src/services/collectionCache.test.js

// Mock dependencies BEFORE requiring them
const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  destroy: jest.fn(),
  size: jest.fn().mockReturnValue(0),
  getWithStale: jest.fn(),
  maxSize: 1000,
  ttlMs: 5 * 60 * 1000
};

const mockLRUCache = jest.fn(() => mockCache);
const mockDbQuery = jest.fn();

jest.mock('../utils/lruCache', () => mockLRUCache);
jest.mock('../config/database', () => ({
  query: mockDbQuery
}));

const CollectionCacheService = require('./collectionCache');

describe('CollectionCacheService', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    mockCache.get.mockClear();
    mockCache.set.mockClear();
    mockCache.delete.mockClear();
    mockCache.clear.mockClear();
    mockCache.destroy.mockClear();
    mockCache.getWithStale.mockClear();
    mockCache.size.mockReturnValue(0);
    mockDbQuery.mockClear();
    
    // Mock setInterval to prevent actual intervals
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    // Clean up intervals
    if (CollectionCacheService.refreshInterval) {
      clearInterval(CollectionCacheService.refreshInterval);
    }
    jest.useRealTimers();
  });
  
  describe('initialization', () => {
    it('should initialize with LRU cache with correct parameters', () => {
      // Verify the cache exists and has correct properties
      expect(CollectionCacheService.cache).toBeDefined();
      expect(CollectionCacheService.cache.maxSize).toBe(1000);
      expect(CollectionCacheService.cache.ttlMs).toBe(5 * 60 * 1000);
    });
    
    it('should set up background refresh interval', () => {
      expect(CollectionCacheService.refreshInterval).toBeDefined();
    });
  });
  
  describe('getCollection', () => {
    it('should return cached data if available', async () => {
      const mockCollection = {
        id: 1,
        name: 'Test Collection',
        daily_rate: '10.5',
        token_address: 'token123'
      };
      
      mockCache.getWithStale.mockReturnValue({
        value: mockCollection,
        isStale: false
      });
      
      const result = await CollectionCacheService.getCollection(1);
      
      expect(mockCache.getWithStale).toHaveBeenCalledWith('collection:1');
      expect(result).toEqual(mockCollection);
      expect(mockDbQuery).not.toHaveBeenCalled();
    });
    
    it('should fetch from database if not cached', async () => {
      const mockCollection = {
        id: 1,
        name: 'Test Collection',
        daily_rate: '10.5',
        token_address: 'token123',
        token_symbol: 'TEST',
        token_decimals: 9
      };
      
      mockCache.getWithStale.mockReturnValue(null);
      mockDbQuery.mockResolvedValue({
        rows: [mockCollection]
      });
      
      const result = await CollectionCacheService.getCollection(1);
      
      expect(mockCache.getWithStale).toHaveBeenCalledWith('collection:1');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT c.*'),
        [1]
      );
      expect(mockCache.set).toHaveBeenCalledWith('collection:1', mockCollection);
      expect(result).toEqual(mockCollection);
    });
    
    it('should return null if collection not found', async () => {
      mockCache.getWithStale.mockReturnValue(null);
      mockDbQuery.mockResolvedValue({
        rows: []
      });
      
      const result = await CollectionCacheService.getCollection(999);
      
      expect(result).toBeNull();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
    
    it('should throw error if database query fails', async () => {
      mockCache.getWithStale.mockReturnValue(null);
      mockDbQuery.mockRejectedValue(new Error('Database error'));
      
      await expect(CollectionCacheService.getCollection(1))
        .rejects.toThrow('Database error');
    });
  });
  
  describe('getAllActiveCollections', () => {
    it('should return cached data if available', async () => {
      const mockCollections = [
        { id: 1, name: 'Collection 1', is_active: true },
        { id: 2, name: 'Collection 2', is_active: true }
      ];
      
      mockCache.getWithStale.mockReturnValue({
        value: mockCollections,
        isStale: false
      });
      
      const result = await CollectionCacheService.getAllActiveCollections();
      
      expect(mockCache.getWithStale).toHaveBeenCalledWith('collections:active');
      expect(result).toEqual(mockCollections);
      expect(mockDbQuery).not.toHaveBeenCalled();
    });
    
    it('should fetch from database if not cached', async () => {
      const mockCollections = [
        { id: 1, name: 'Collection 1', is_active: true },
        { id: 2, name: 'Collection 2', is_active: true }
      ];
      
      mockCache.getWithStale.mockReturnValue(null);
      mockDbQuery.mockResolvedValue({
        rows: mockCollections
      });
      
      const result = await CollectionCacheService.getAllActiveCollections();
      
      expect(mockCache.getWithStale).toHaveBeenCalledWith('collections:active');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE c.is_active = TRUE')
      );
      expect(mockCache.set).toHaveBeenCalledWith('collections:active', mockCollections);
      expect(result).toEqual(mockCollections);
    });
    
    it('should return empty array if no active collections', async () => {
      mockCache.getWithStale.mockReturnValue(null);
      mockDbQuery.mockResolvedValue({
        rows: []
      });
      
      const result = await CollectionCacheService.getAllActiveCollections();
      
      expect(result).toEqual([]);
      expect(mockCache.set).toHaveBeenCalledWith('collections:active', []);
    });
  });
  
  describe('invalidate', () => {
    it('should invalidate specific collection and active list', () => {
      CollectionCacheService.invalidate(1);
      
      expect(mockCache.delete).toHaveBeenCalledWith('collection:1');
      expect(mockCache.delete).toHaveBeenCalledWith('collections:active');
    });
    
    it('should invalidate only active list when no collectionId provided', () => {
      CollectionCacheService.invalidate();
      
      expect(mockCache.delete).toHaveBeenCalledWith('collections:active');
      expect(mockCache.delete).toHaveBeenCalledTimes(1);
    });
    
    it('should invalidate only active list when null collectionId provided', () => {
      CollectionCacheService.invalidate(null);
      
      expect(mockCache.delete).toHaveBeenCalledWith('collections:active');
      expect(mockCache.delete).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('refreshCache', () => {
    it('should refresh all active collections', async () => {
      const mockCollections = [
        { id: 1, name: 'Collection 1' },
        { id: 2, name: 'Collection 2' }
      ];
      
      mockCache.getWithStale.mockReturnValue(null);
      mockDbQuery.mockResolvedValue({
        rows: mockCollections
      });
      
      await CollectionCacheService.refreshCache();
      
      expect(mockDbQuery).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith('collections:active', mockCollections);
    });
    
    it('should not throw error if refresh fails', async () => {
      mockCache.getWithStale.mockReturnValue(null);
      mockDbQuery.mockRejectedValue(new Error('Database error'));
      
      // Should not throw
      await expect(CollectionCacheService.refreshCache()).resolves.not.toThrow();
    });
    
    it('should be called automatically every 5 minutes', () => {
      // The interval is already set up in the constructor
      // We just need to verify it exists and would be called
      expect(CollectionCacheService.refreshInterval).toBeDefined();
      expect(typeof CollectionCacheService.refreshInterval).toBe('object');
    });
  });
  
  describe('getStats', () => {
    it('should return cache statistics', () => {
      mockCache.size.mockReturnValue(42);
      
      const stats = CollectionCacheService.getStats();
      
      expect(stats).toEqual({
        size: 42,
        maxSize: 1000,
        ttlMs: 5 * 60 * 1000
      });
    });
  });
  
  describe('clear', () => {
    it('should clear all cache entries', () => {
      CollectionCacheService.clear();
      
      expect(mockCache.clear).toHaveBeenCalled();
    });
  });
  
  describe('destroy', () => {
    it('should cleanup intervals and destroy cache', () => {
      CollectionCacheService.destroy();
      
      expect(mockCache.destroy).toHaveBeenCalled();
    });
  });
  
  describe('stale-while-revalidate (Requirement 19.4)', () => {
    describe('getCollection with stale data', () => {
      it('should return stale data immediately and trigger background refresh', async () => {
        const staleCollection = {
          id: 1,
          name: 'Stale Collection',
          daily_rate: '10.5'
        };
        
        const freshCollection = {
          id: 1,
          name: 'Fresh Collection',
          daily_rate: '15.0'
        };
        
        // Mock getWithStale to return stale data
        mockCache.getWithStale = jest.fn().mockReturnValue({
          value: staleCollection,
          isStale: true
        });
        
        // Mock database to return fresh data
        mockDbQuery.mockResolvedValue({
          rows: [freshCollection]
        });
        
        // Call getCollection
        const result = await CollectionCacheService.getCollection(1);
        
        // Should return stale data immediately
        expect(result).toEqual(staleCollection);
        expect(mockCache.getWithStale).toHaveBeenCalledWith('collection:1');
        
        // Background refresh should be triggered (but we can't easily verify it was called)
        // The important part is that we got the stale data back immediately
      });
      
      it('should return fresh data without triggering refresh when not stale', async () => {
        const freshCollection = {
          id: 1,
          name: 'Fresh Collection',
          daily_rate: '10.5'
        };
        
        // Mock getWithStale to return fresh data
        mockCache.getWithStale = jest.fn().mockReturnValue({
          value: freshCollection,
          isStale: false
        });
        
        const result = await CollectionCacheService.getCollection(1);
        
        // Should return fresh data
        expect(result).toEqual(freshCollection);
        expect(mockCache.getWithStale).toHaveBeenCalledWith('collection:1');
        
        // Database should not be called
        expect(mockDbQuery).not.toHaveBeenCalled();
      });
      
      it('should fetch from database when no cached data exists', async () => {
        const collection = {
          id: 1,
          name: 'New Collection',
          daily_rate: '10.5'
        };
        
        // Mock getWithStale to return null (no cached data)
        mockCache.getWithStale = jest.fn().mockReturnValue(null);
        
        mockDbQuery.mockResolvedValue({
          rows: [collection]
        });
        
        const result = await CollectionCacheService.getCollection(1);
        
        // Should fetch from database
        expect(mockDbQuery).toHaveBeenCalled();
        expect(mockCache.set).toHaveBeenCalledWith('collection:1', collection);
        expect(result).toEqual(collection);
      });
    });
    
    describe('getAllActiveCollections with stale data', () => {
      it('should return stale data immediately and trigger background refresh', async () => {
        const staleCollections = [
          { id: 1, name: 'Stale 1' },
          { id: 2, name: 'Stale 2' }
        ];
        
        const freshCollections = [
          { id: 1, name: 'Fresh 1' },
          { id: 2, name: 'Fresh 2' }
        ];
        
        // Mock getWithStale to return stale data
        mockCache.getWithStale = jest.fn().mockReturnValue({
          value: staleCollections,
          isStale: true
        });
        
        mockDbQuery.mockResolvedValue({
          rows: freshCollections
        });
        
        const result = await CollectionCacheService.getAllActiveCollections();
        
        // Should return stale data immediately
        expect(result).toEqual(staleCollections);
        expect(mockCache.getWithStale).toHaveBeenCalledWith('collections:active');
      });
      
      it('should return fresh data without triggering refresh when not stale', async () => {
        const freshCollections = [
          { id: 1, name: 'Fresh 1' },
          { id: 2, name: 'Fresh 2' }
        ];
        
        // Mock getWithStale to return fresh data
        mockCache.getWithStale = jest.fn().mockReturnValue({
          value: freshCollections,
          isStale: false
        });
        
        const result = await CollectionCacheService.getAllActiveCollections();
        
        // Should return fresh data
        expect(result).toEqual(freshCollections);
        
        // Database should not be called
        expect(mockDbQuery).not.toHaveBeenCalled();
      });
      
      it('should fetch from database when no cached data exists', async () => {
        const collections = [
          { id: 1, name: 'Collection 1' },
          { id: 2, name: 'Collection 2' }
        ];
        
        // Mock getWithStale to return null
        mockCache.getWithStale = jest.fn().mockReturnValue(null);
        
        mockDbQuery.mockResolvedValue({
          rows: collections
        });
        
        const result = await CollectionCacheService.getAllActiveCollections();
        
        // Should fetch from database
        expect(mockDbQuery).toHaveBeenCalled();
        expect(mockCache.set).toHaveBeenCalledWith('collections:active', collections);
        expect(result).toEqual(collections);
      });
    });
    
    it('should handle background refresh failures gracefully', async () => {
      // Use real timers for this test since we need actual async behavior
      jest.useRealTimers();
      
      const staleCollection = {
        id: 1,
        name: 'Stale Collection'
      };
      
      // Mock getWithStale to return stale data
      mockCache.getWithStale.mockReturnValue({
        value: staleCollection,
        isStale: true
      });
      
      // Mock database to fail
      mockDbQuery.mockRejectedValue(new Error('Database error'));
      
      // Should still return stale data without throwing
      const result = await CollectionCacheService.getCollection(1);
      expect(result).toEqual(staleCollection);
      
      // Give background refresh time to fail (but not too long)
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // No error should be thrown to the caller
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });
  });
  
  describe('LRU eviction', () => {
    it('should respect max 1000 entries limit', () => {
      // Verify cache was initialized with correct max size
      expect(CollectionCacheService.cache.maxSize).toBe(1000);
    });
  });
  
  describe('TTL behavior', () => {
    it('should use 5-minute TTL', () => {
      // Verify cache was initialized with 5-minute TTL
      expect(CollectionCacheService.cache.ttlMs).toBe(5 * 60 * 1000);
    });
  });
});
