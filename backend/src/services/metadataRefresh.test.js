// Mock environment variables before imports
process.env.HELIUS_API_KEY = 'test-key';
process.env.HELIUS_MAINNET_ENDPOINT = 'https://test.helius.com';
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

const metadataRefresh = require('./metadataRefresh');
const heliusProxy = require('./heliusProxy');
const auditLog = require('./auditLog');

jest.mock('./heliusProxy');
jest.mock('./auditLog');
jest.mock('../db', () => ({
  getPool: jest.fn(() => ({
    promise: jest.fn(() => ({
      getConnection: jest.fn()
    }))
  }))
}));

const { getPool } = require('../db');

describe('Metadata Refresh Service', () => {
  let mockConnection;
  let mockPool;
  
  beforeEach(() => {
    mockConnection = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockPool = {
      promise: jest.fn(() => ({
        getConnection: jest.fn(() => Promise.resolve(mockConnection))
      }))
    };
    
    getPool.mockReturnValue(mockPool);
    auditLog.log = jest.fn();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('refreshStakedNFTMetadata', () => {
    test('should refresh metadata for all staked NFTs', async () => {
      const stakedNFTs = [
        {
          id: 1,
          mint_address: 'NFT1',
          collection_id: 'COL1',
          traits: JSON.stringify([{ trait_type: 'Rarity', value: 'Common' }])
        },
        {
          id: 2,
          mint_address: 'NFT2',
          collection_id: 'COL1',
          traits: JSON.stringify([{ trait_type: 'Rarity', value: 'Rare' }])
        }
      ];
      
      mockConnection.query
        .mockResolvedValueOnce([stakedNFTs]) // Get staked NFTs
        .mockResolvedValue([{ affectedRows: 1 }]); // Update queries
      
      heliusProxy.getAssetMetadata.mockImplementation((mintAddress) => {
        if (mintAddress === 'NFT1') {
          return Promise.resolve({
            content: {
              metadata: {
                attributes: [
                  { trait_type: 'Rarity', value: 'Legendary' } // Updated trait
                ]
              }
            }
          });
        }
        return Promise.resolve({
          content: {
            metadata: {
              attributes: [
                { trait_type: 'Rarity', value: 'Rare' } // Unchanged
              ]
            }
          }
        });
      });
      
      const result = await metadataRefresh.refreshStakedNFTMetadata(null, 'AdminWallet');
      
      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(2);
      expect(result.stats.updated).toBe(1); // NFT1 updated
      expect(result.stats.unchanged).toBe(1); // NFT2 unchanged
      expect(result.stats.failed).toBe(0);
      
      // Verify audit log was called
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminWallet: 'AdminWallet',
          action: 'METADATA_REFRESH'
        })
      );
    });
    
    test('should refresh metadata for specific collection only', async () => {
      const stakedNFTs = [
        {
          id: 1,
          mint_address: 'NFT1',
          collection_id: 'COL1',
          traits: JSON.stringify([{ trait_type: 'Rarity', value: 'Common' }])
        }
      ];
      
      mockConnection.query.mockResolvedValueOnce([stakedNFTs]);
      
      heliusProxy.getAssetMetadata.mockResolvedValue({
        content: {
          metadata: {
            attributes: [{ trait_type: 'Rarity', value: 'Common' }]
          }
        }
      });
      
      await metadataRefresh.refreshStakedNFTMetadata('COL1', 'AdminWallet');
      
      // Verify query was filtered by collection
      expect(mockConnection.query).toHaveBeenCalledWith(
        'SELECT id, mint_address, collection_id, traits FROM staked_nfts WHERE collection_id = ?',
        ['COL1']
      );
    });
    
    test('should handle Helius API failures gracefully', async () => {
      const stakedNFTs = [
        {
          id: 1,
          mint_address: 'NFT1',
          collection_id: 'COL1',
          traits: JSON.stringify([{ trait_type: 'Rarity', value: 'Common' }])
        }
      ];
      
      mockConnection.query.mockResolvedValueOnce([stakedNFTs]);
      heliusProxy.getAssetMetadata.mockRejectedValue(new Error('API timeout'));
      
      const result = await metadataRefresh.refreshStakedNFTMetadata(null, 'AdminWallet');
      
      expect(result.success).toBe(true);
      expect(result.stats.failed).toBe(1);
      expect(result.failedNFTs).toHaveLength(1);
      expect(result.failedNFTs[0].mintAddress).toBe('NFT1');
    });
    
    test('should return early if no staked NFTs found', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);
      
      const result = await metadataRefresh.refreshStakedNFTMetadata();
      
      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(0);
      expect(heliusProxy.getAssetMetadata).not.toHaveBeenCalled();
    });
  });
  
  describe('refreshSingleNFT', () => {
    test('should refresh metadata for a single NFT', async () => {
      const nft = {
        id: 1,
        mint_address: 'NFT1',
        collection_id: 'COL1',
        traits: JSON.stringify([{ trait_type: 'Rarity', value: 'Common' }])
      };
      
      mockConnection.query
        .mockResolvedValueOnce([[nft]]) // Get NFT
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // Update
      
      heliusProxy.getAssetMetadata.mockResolvedValue({
        content: {
          metadata: {
            attributes: [
              { trait_type: 'Rarity', value: 'Legendary' }
            ]
          }
        }
      });
      
      const result = await metadataRefresh.refreshSingleNFT('NFT1', 'AdminWallet');
      
      expect(result.success).toBe(true);
      expect(result.data.newTraits).toEqual([
        { trait_type: 'Rarity', value: 'Legendary' }
      ]);
      
      // Verify audit log
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'METADATA_REFRESH_SINGLE',
          targetId: 'NFT1'
        })
      );
    });
    
    test('should return error if NFT is not staked', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);
      
      const result = await metadataRefresh.refreshSingleNFT('NFT1');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('NFT is not currently staked');
    });
    
    test('should handle Helius API failure', async () => {
      const nft = {
        id: 1,
        mint_address: 'NFT1',
        collection_id: 'COL1',
        traits: JSON.stringify([])
      };
      
      mockConnection.query.mockResolvedValueOnce([[nft]]);
      heliusProxy.getAssetMetadata.mockResolvedValue(null);
      
      const result = await metadataRefresh.refreshSingleNFT('NFT1');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to fetch metadata from Helius');
    });
  });
  
  describe('extractTraitsFromMetadata', () => {
    test('should extract traits from Metaplex standard format', () => {
      const metadata = {
        content: {
          metadata: {
            attributes: [
              { trait_type: 'Rarity', value: 'Legendary' },
              { trait_type: 'Background', value: 'Blue' }
            ]
          }
        }
      };
      
      const traits = metadataRefresh.extractTraitsFromMetadata(metadata);
      
      expect(traits).toEqual([
        { trait_type: 'Rarity', value: 'Legendary' },
        { trait_type: 'Background', value: 'Blue' }
      ]);
    });
    
    test('should handle missing attributes', () => {
      const metadata = {
        content: {
          metadata: {}
        }
      };
      
      const traits = metadataRefresh.extractTraitsFromMetadata(metadata);
      
      expect(traits).toEqual([]);
    });
    
    test('should handle malformed metadata', () => {
      const metadata = null;
      
      const traits = metadataRefresh.extractTraitsFromMetadata(metadata);
      
      expect(traits).toEqual([]);
    });
  });
});
