// backend/src/services/heliusProxy.test.js

const axios = require('axios');

// Mock axios
jest.mock('axios');

// Mock environment variables
process.env.HELIUS_API_KEY = 'test-api-key';
process.env.HELIUS_MAINNET_ENDPOINT = 'https://test-helius.com';

// Import after mocking
const HeliusProxyService = require('./heliusProxy');

describe('HeliusProxyService', () => {
  beforeEach(() => {
    // Clear cache before each test
    HeliusProxyService.clearCache();
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Destroy cache to stop cleanup interval
    if (HeliusProxyService.cache) {
      HeliusProxyService.cache.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with environment variables', () => {
      expect(HeliusProxyService.apiKey).toBe('test-api-key');
      expect(HeliusProxyService.baseUrl).toBe('https://test-helius.com');
    });

    test('should have cache configured correctly (Requirements 20.1, 20.2, 20.3)', () => {
      const stats = HeliusProxyService.getCacheStats();
      expect(stats.maxSize).toBe(10000); // Requirement 20.2
      expect(stats.ttlMs).toBe(60 * 60 * 1000); // 1 hour - Requirement 20.3
    });
  });

  describe('getAssetsByOwner (Requirement 11.2)', () => {
    const mockOwnerAddress = 'TestWallet123456789';
    const mockResponse = {
      data: {
        result: {
          items: [
            { id: 'nft1', name: 'NFT 1' },
            { id: 'nft2', name: 'NFT 2' }
          ]
        }
      }
    };

    test('should fetch assets from Helius API', async () => {
      axios.post.mockResolvedValue(mockResponse);

      const result = await HeliusProxyService.getAssetsByOwner(mockOwnerAddress);

      expect(axios.post).toHaveBeenCalledWith(
        'https://test-helius.com',
        expect.objectContaining({
          method: 'getAssetsByOwner',
          params: expect.objectContaining({
            ownerAddress: mockOwnerAddress
          })
        }),
        expect.objectContaining({
          params: { 'api-key': 'test-api-key' },
          timeout: 10000
        })
      );

      expect(result).toEqual(mockResponse.data.result);
    });

    test('should cache successful responses', async () => {
      axios.post.mockResolvedValue(mockResponse);

      // First call
      await HeliusProxyService.getAssetsByOwner(mockOwnerAddress);
      expect(axios.post).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result = await HeliusProxyService.getAssetsByOwner(mockOwnerAddress);
      expect(axios.post).toHaveBeenCalledTimes(1); // Still 1, not called again
      expect(result).toEqual(mockResponse.data.result);
    });

    test('should handle API errors with descriptive messages', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      await expect(
        HeliusProxyService.getAssetsByOwner(mockOwnerAddress)
      ).rejects.toThrow('Failed to fetch NFT data: Network error');
    });

    test('should handle Helius API error responses', async () => {
      axios.post.mockResolvedValue({
        data: {
          error: { message: 'Invalid owner address' }
        }
      });

      await expect(
        HeliusProxyService.getAssetsByOwner(mockOwnerAddress)
      ).rejects.toThrow('Helius API error: Invalid owner address');
    });

    test('should pass options to API call', async () => {
      axios.post.mockResolvedValue(mockResponse);

      const options = { limit: 100, page: 2 };
      await HeliusProxyService.getAssetsByOwner(mockOwnerAddress, options);

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            ownerAddress: mockOwnerAddress,
            limit: 100,
            page: 2
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('getAssetMetadata with Retry Logic (Requirements 12.2, 12.3)', () => {
    const mockMintAddress = 'TestMint123456789';
    const mockMetadata = {
      data: {
        result: {
          id: mockMintAddress,
          content: {
            metadata: { name: 'Test NFT' }
          }
        }
      }
    };

    test('should fetch metadata from Helius API', async () => {
      axios.post.mockResolvedValue(mockMetadata);

      const result = await HeliusProxyService.getAssetMetadata(mockMintAddress);

      expect(axios.post).toHaveBeenCalledWith(
        'https://test-helius.com',
        expect.objectContaining({
          method: 'getAsset',
          params: { id: mockMintAddress }
        }),
        expect.objectContaining({
          params: { 'api-key': 'test-api-key' },
          timeout: 10000
        })
      );

      expect(result).toEqual(mockMetadata.data.result);
    });

    test('should cache successful metadata responses', async () => {
      axios.post.mockResolvedValue(mockMetadata);

      // First call
      await HeliusProxyService.getAssetMetadata(mockMintAddress);
      expect(axios.post).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result = await HeliusProxyService.getAssetMetadata(mockMintAddress);
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockMetadata.data.result);
    });

    test('should retry 3 times with exponential backoff (Requirement 12.2)', async () => {
      axios.post
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(mockMetadata);

      const result = await HeliusProxyService.getAssetMetadata(mockMintAddress);

      expect(axios.post).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockMetadata.data.result);
    }, 10000); // Increase timeout for retry delays

    test('should fail after 3 retry attempts (Requirement 12.3)', async () => {
      axios.post.mockRejectedValue(new Error('Persistent error'));

      await expect(
        HeliusProxyService.getAssetMetadata(mockMintAddress)
      ).rejects.toThrow('Failed to fetch metadata after 3 attempts');

      expect(axios.post).toHaveBeenCalledTimes(3);
    }, 10000);

    test('should handle metadata not found error', async () => {
      axios.post.mockResolvedValue({
        data: {
          result: null
        }
      });

      await expect(
        HeliusProxyService.getAssetMetadata(mockMintAddress)
      ).rejects.toThrow('Metadata not found');
    });

    test('should handle Helius API error in metadata fetch', async () => {
      axios.post.mockResolvedValue({
        data: {
          error: { message: 'Invalid mint address' }
        }
      });

      await expect(
        HeliusProxyService.getAssetMetadata(mockMintAddress)
      ).rejects.toThrow('Helius API error: Invalid mint address');
    });
  });

  describe('Cache Management', () => {
    test('should clear cache', async () => {
      axios.post.mockResolvedValue({
        data: { result: { items: [] } }
      });

      await HeliusProxyService.getAssetsByOwner('wallet1');
      expect(HeliusProxyService.getCacheStats().size).toBeGreaterThan(0);

      HeliusProxyService.clearCache();
      expect(HeliusProxyService.getCacheStats().size).toBe(0);
    });

    test('should return cache statistics', () => {
      const stats = HeliusProxyService.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('ttlMs');
      expect(typeof stats.size).toBe('number');
      expect(stats.maxSize).toBe(10000);
      expect(stats.ttlMs).toBe(60 * 60 * 1000);
    });
  });

  describe('Cache Key Generation', () => {
    test('should use different cache keys for different parameters', async () => {
      axios.post.mockResolvedValue({
        data: { result: { items: [] } }
      });

      await HeliusProxyService.getAssetsByOwner('wallet1', { limit: 10 });
      await HeliusProxyService.getAssetsByOwner('wallet1', { limit: 20 });

      // Should make 2 API calls (different cache keys)
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    test('should use same cache key for identical requests', async () => {
      axios.post.mockResolvedValue({
        data: { result: { items: [] } }
      });

      await HeliusProxyService.getAssetsByOwner('wallet1', { limit: 10 });
      await HeliusProxyService.getAssetsByOwner('wallet1', { limit: 10 });

      // Should make only 1 API call (same cache key)
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
  });
});
