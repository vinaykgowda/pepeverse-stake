// backend/src/services/collectionCache.js
const LRUCache = require('../utils/lruCache');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * CollectionCacheService - In-memory cache for collection configuration data
 * 
 * Features:
 * - LRU cache with 1000 entry maximum
 * - 5-minute TTL with automatic refresh
 * - Background refresh every 5 minutes
 * - Cache invalidation on settings changes
 * - Stale-while-revalidate: serves stale data immediately while refreshing in background
 * 
 * Requirements: 19.1, 19.2, 19.4, 19.5
 */
class CollectionCacheService {
  constructor() {
    // In-memory LRU cache: 1000 entries, 5 minute TTL
    this.cache = new LRUCache(1000, 5 * 60 * 1000);
    
    // Background refresh every 5 minutes
    this.refreshInterval = setInterval(() => this.refreshCache(), 5 * 60 * 1000);
    
    logger.info('CollectionCacheService initialized', { 
      maxEntries: 1000, 
      ttlMinutes: 5 
    });
  }
  
  /**
   * Get collection configuration by ID
   * Implements stale-while-revalidate: serves stale data immediately while refreshing in background
   * @param {number} collectionId - Collection ID
   * @returns {Promise<Object|null>} Collection data or null if not found
   */
  async getCollection(collectionId) {
    const cacheKey = `collection:${collectionId}`;
    
    // Check cache with stale support
    const cached = this.cache.getWithStale(cacheKey);
    
    if (cached) {
      // If stale, trigger background refresh but return stale data immediately
      if (cached.isStale) {
        // Trigger background refresh without waiting
        this._refreshCollectionInBackground(collectionId, cacheKey);
      }
      return cached.value;
    }
    
    // No cached data at all - fetch from database synchronously
    return await this._fetchCollection(collectionId, cacheKey);
  }
  
  /**
   * Fetch collection from database and cache it
   * @private
   */
  async _fetchCollection(collectionId, cacheKey) {
    try {
      const result = await db.query(
        `SELECT c.*, 
                cr.daily_rate, 
                cr.token_address, 
                cr.token_symbol, 
                cr.token_decimals,
                cr.is_active as reward_active
         FROM collections c
         LEFT JOIN collection_rewards cr ON c.id = cr.collection_id AND cr.is_active = TRUE
         WHERE c.id = $1`,
        [collectionId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const data = result.rows[0];
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      logger.error('Error fetching collection from database', { error });
      throw error;
    }
  }
  
  /**
   * Refresh collection data in background (fire-and-forget)
   * @private
   */
  _refreshCollectionInBackground(collectionId, cacheKey) {
    // Fire-and-forget: don't await, don't block
    this._fetchCollection(collectionId, cacheKey).catch(error => {
      console.error(`Background refresh failed for collection ${collectionId}:`, error);
      // Silently fail - stale data is still being served
    });
  }
  
  /**
   * Get all active collections
   * Implements stale-while-revalidate: serves stale data immediately while refreshing in background
   * @returns {Promise<Array>} Array of active collection data
   */
  async getAllActiveCollections() {
    const cacheKey = 'collections:active';
    
    // Check cache with stale support
    const cached = this.cache.getWithStale(cacheKey);
    
    if (cached) {
      // If stale, trigger background refresh but return stale data immediately
      if (cached.isStale) {
        // Trigger background refresh without waiting
        this._refreshActiveCollectionsInBackground(cacheKey);
      }
      return cached.value;
    }
    
    // No cached data at all - fetch from database synchronously
    return await this._fetchActiveCollections(cacheKey);
  }
  
  /**
   * Fetch active collections from database and cache them
   * @private
   */
  async _fetchActiveCollections(cacheKey) {
    try {
      const result = await db.query(
        `SELECT c.*, 
                cr.daily_rate, 
                cr.token_address, 
                cr.token_symbol, 
                cr.token_decimals,
                cr.is_active as reward_active
         FROM collections c
         LEFT JOIN collection_rewards cr ON c.id = cr.collection_id AND cr.is_active = TRUE
         WHERE c.is_active = TRUE
         ORDER BY c.name`
      );
      
      const data = result.rows;
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching active collections from database:', error);
      throw error;
    }
  }
  
  /**
   * Refresh active collections in background (fire-and-forget)
   * @private
   */
  _refreshActiveCollectionsInBackground(cacheKey) {
    // Fire-and-forget: don't await, don't block
    this._fetchActiveCollections(cacheKey).catch(error => {
      console.error('Background refresh failed for active collections:', error);
      // Silently fail - stale data is still being served
    });
  }
  
  /**
   * Invalidate cache for a specific collection or all collections
   * Call this when collection settings are modified
   * @param {number|null} collectionId - Collection ID to invalidate, or null for all
   */
  invalidate(collectionId = null) {
    if (collectionId) {
      const cacheKey = `collection:${collectionId}`;
      this.cache.delete(cacheKey);
      console.log(`Cache invalidated for collection ${collectionId}`);
    }
    
    // Always invalidate the active collections list
    this.cache.delete('collections:active');
    console.log('Active collections cache invalidated');
  }
  
  /**
   * Background refresh of all active collections
   * Runs every 5 minutes to keep cache warm
   */
  async refreshCache() {
    try {
      console.log('Starting background cache refresh...');
      
      // Refresh all active collections
      await this.getAllActiveCollections();
      
      console.log('Background cache refresh completed');
    } catch (error) {
      console.error('Error during background cache refresh:', error);
      // Don't throw - background refresh failures shouldn't break the service
    }
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      size: this.cache.size(),
      maxSize: this.cache.maxSize,
      ttlMs: this.cache.ttlMs
    };
  }
  
  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    console.log('Collection cache cleared');
  }
  
  /**
   * Destroy the service and cleanup intervals
   */
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.cache.destroy();
    console.log('CollectionCacheService destroyed');
  }
}

// Export singleton instance
module.exports = new CollectionCacheService();
