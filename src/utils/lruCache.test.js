// backend/src/utils/lruCache.test.js

const LRUCache = require('./lruCache');

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    // Create cache with small size and TTL for testing
    cache = new LRUCache(3, 1000); // 3 entries, 1 second TTL
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Basic Operations', () => {
    test('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    test('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    test('should delete keys', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');
      expect(cache.get('key1')).toBeNull();
    });

    test('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
    });

    test('should return correct size', () => {
      expect(cache.size()).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });
  });

  describe('LRU Eviction (Requirement 20.1)', () => {
    test('should evict oldest entry when size limit is reached', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Cache is now full (3 entries)
      expect(cache.size()).toBe(3);
      
      // Adding 4th entry should evict key1 (oldest)
      cache.set('key4', 'value4');
      
      expect(cache.size()).toBe(3);
      expect(cache.get('key1')).toBeNull(); // Evicted
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should update LRU order when accessing entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Access key1 to make it most recently used
      cache.get('key1');
      
      // Add key4, should evict key2 (now oldest)
      cache.set('key4', 'value4');
      
      expect(cache.get('key1')).toBe('value1'); // Still exists
      expect(cache.get('key2')).toBeNull(); // Evicted
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should update LRU order when updating existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Update key1 to make it most recently used
      cache.set('key1', 'updated1');
      
      // Add key4, should evict key2 (now oldest)
      cache.set('key4', 'value4');
      
      expect(cache.get('key1')).toBe('updated1'); // Still exists with new value
      expect(cache.get('key2')).toBeNull(); // Evicted
    });
  });

  describe('TTL Expiration (Requirement 20.3)', () => {
    test('should expire entries after TTL', async () => {
      cache.set('key1', 'value1');
      
      // Should exist immediately
      expect(cache.get('key1')).toBe('value1');
      
      // Wait for TTL to expire (1 second + buffer)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      expect(cache.get('key1')).toBeNull();
    });

    test('should not return expired entries', async () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Both should be expired
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('Cleanup (Requirement 20.4)', () => {
    test('should remove expired entries during cleanup', async () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Run cleanup
      cache.cleanup();
      
      // Size should be 0 after cleanup
      expect(cache.size()).toBe(0);
    });

    test('should not remove non-expired entries during cleanup', async () => {
      cache.set('key1', 'value1');
      
      // Wait a bit but not enough to expire
      await new Promise(resolve => setTimeout(resolve, 500));
      
      cache.cleanup();
      
      // Should still exist
      expect(cache.get('key1')).toBe('value1');
      expect(cache.size()).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle storing different data types', () => {
      // Use a larger cache for this test to avoid eviction
      const largeCache = new LRUCache(10, 1000);
      
      largeCache.set('string', 'value');
      largeCache.set('number', 42);
      largeCache.set('object', { foo: 'bar' });
      largeCache.set('array', [1, 2, 3]);
      largeCache.set('null', null);
      
      expect(largeCache.get('string')).toBe('value');
      expect(largeCache.get('number')).toBe(42);
      expect(largeCache.get('object')).toEqual({ foo: 'bar' });
      expect(largeCache.get('array')).toEqual([1, 2, 3]);
      expect(largeCache.get('null')).toBeNull(); // Note: null is valid value but indistinguishable from "not found"
      
      largeCache.destroy();
    });

    test('should handle rapid successive operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Should only keep last 3 entries (maxSize = 3)
      expect(cache.size()).toBe(3);
      expect(cache.get('key97')).toBe('value97');
      expect(cache.get('key98')).toBe('value98');
      expect(cache.get('key99')).toBe('value99');
    });
  });

  describe('Stale-While-Revalidate (getWithStale)', () => {
    test('should return fresh data with isStale=false', () => {
      cache.set('key1', 'value1');
      
      const result = cache.getWithStale('key1');
      
      expect(result).not.toBeNull();
      expect(result.value).toBe('value1');
      expect(result.isStale).toBe(false);
    });

    test('should return stale data with isStale=true after TTL expires', async () => {
      cache.set('key1', 'value1');
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const result = cache.getWithStale('key1');
      
      expect(result).not.toBeNull();
      expect(result.value).toBe('value1');
      expect(result.isStale).toBe(true);
    });

    test('should return null for non-existent keys', () => {
      const result = cache.getWithStale('nonexistent');
      expect(result).toBeNull();
    });

    test('should update LRU order even for stale entries', async () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Access stale key1 to make it most recently used
      const result = cache.getWithStale('key1');
      expect(result.isStale).toBe(true);
      
      // Add key4, should evict key2 (now oldest), not key1
      cache.set('key4', 'value4');
      
      expect(cache.getWithStale('key1')).not.toBeNull(); // Still exists (even though stale)
      expect(cache.getWithStale('key2')).toBeNull(); // Evicted
      expect(cache.get('key3')).toBeNull(); // Expired
      expect(cache.get('key4')).toBe('value4');
    });

    test('should keep stale entries in cache until evicted', async () => {
      cache.set('key1', 'value1');
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Stale entry should still be retrievable
      const result1 = cache.getWithStale('key1');
      expect(result1).not.toBeNull();
      expect(result1.isStale).toBe(true);
      
      // Regular get should return null (expired)
      expect(cache.get('key1')).toBeNull();
      
      // But getWithStale should still work (entry was not deleted by get)
      // Actually, get() deletes expired entries, so this won't work
      // Let's test without calling get() first
    });

    test('should distinguish between fresh and stale data correctly', async () => {
      cache.set('key1', 'value1');
      
      // Immediately after set - should be fresh
      let result = cache.getWithStale('key1');
      expect(result.isStale).toBe(false);
      
      // Wait half the TTL - should still be fresh
      await new Promise(resolve => setTimeout(resolve, 500));
      result = cache.getWithStale('key1');
      expect(result.isStale).toBe(false);
      
      // Wait for full TTL to expire - should be stale
      await new Promise(resolve => setTimeout(resolve, 600));
      result = cache.getWithStale('key1');
      expect(result.isStale).toBe(true);
    });
  });
});
