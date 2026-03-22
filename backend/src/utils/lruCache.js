// backend/src/utils/lruCache.js

/**
 * In-memory LRU (Least Recently Used) Cache
 * 
 * Features:
 * - Automatic eviction of oldest entries when size limit is reached
 * - TTL (Time To Live) support for automatic expiration
 * - Periodic cleanup of expired entries
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4
 */
class LRUCache {
  constructor(maxSize = 1000, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }
  
  /**
   * Set a value in the cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  set(key, value) {
    const entry = {
      value,
      expiresAt: Date.now() + this.ttlMs
    };
    
    // If key exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Add to end (most recently used)
    this.cache.set(key, entry);
    
    // Evict oldest if over size limit (LRU eviction)
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
  
  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }
  
  /**
   * Get a value from the cache, including stale entries
   * Used for stale-while-revalidate pattern
   * @param {string} key - Cache key
   * @returns {Object|null} Object with {value, isStale} or null if not found
   */
  getWithStale(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    const isStale = now > entry.expiresAt;
    
    // Move to end (most recently used) even if stale
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return {
      value: entry.value,
      isStale
    };
  }
  
  /**
   * Check if a key exists in the cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is not expired
   */
  has(key) {
    return this.get(key) !== null;
  }
  
  /**
   * Delete a key from the cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }
  
  /**
   * Clear all entries from the cache
   */
  clear() {
    this.cache.clear();
  }
  
  /**
   * Remove expired entries from the cache
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Get the current size of the cache
   * @returns {number} Number of entries in cache
   */
  size() {
    return this.cache.size;
  }
  
  /**
   * Destroy the cache and cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

module.exports = LRUCache;
