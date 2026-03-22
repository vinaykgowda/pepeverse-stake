// backend/src/services/ownershipVerification.test.js

// Mock environment variables before importing
process.env.HELIUS_API_KEY = 'test-api-key';
process.env.HELIUS_MAINNET_ENDPOINT = 'https://test-helius.com';

// Mock the heliusProxy module
jest.mock('./heliusProxy');

const ownershipVerification = require('./ownershipVerification');
const heliusProxy = require('./heliusProxy');

describe('OwnershipVerificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('verifyOwnership', () => {
    it('should verify ownership when wallet owns the NFT', async () => {
      const walletAddress = 'ABC123wallet';
      const mintAddress = 'XYZ789mint';
      
      // Mock Helius response with ownership data
      heliusProxy.getAssetMetadata.mockResolvedValue({
        ownership: {
          owner: 'ABC123wallet'
        }
      });
      
      const result = await ownershipVerification.verifyOwnership(walletAddress, mintAddress);
      
      expect(result.isOwner).toBe(true);
      expect(result.currentOwner).toBe('ABC123wallet');
      expect(heliusProxy.getAssetMetadata).toHaveBeenCalledWith(mintAddress);
    });
    
    it('should fail verification when wallet does not own the NFT', async () => {
      const walletAddress = 'ABC123wallet';
      const mintAddress = 'XYZ789mint';
      
      // Mock Helius response with different owner
      heliusProxy.getAssetMetadata.mockResolvedValue({
        ownership: {
          owner: 'DifferentOwner123'
        }
      });
      
      const result = await ownershipVerification.verifyOwnership(walletAddress, mintAddress);
      
      expect(result.isOwner).toBe(false);
      expect(result.currentOwner).toBe('DifferentOwner123');
    });
    
    it('should handle case-insensitive address comparison', async () => {
      const walletAddress = 'ABC123wallet';
      const mintAddress = 'XYZ789mint';
      
      // Mock Helius response with uppercase owner
      heliusProxy.getAssetMetadata.mockResolvedValue({
        ownership: {
          owner: 'abc123WALLET'
        }
      });
      
      const result = await ownershipVerification.verifyOwnership(walletAddress, mintAddress);
      
      expect(result.isOwner).toBe(true);
    });
    
    it('should return error when metadata not found', async () => {
      const walletAddress = 'ABC123wallet';
      const mintAddress = 'XYZ789mint';
      
      // Mock Helius returning null
      heliusProxy.getAssetMetadata.mockResolvedValue(null);
      
      const result = await ownershipVerification.verifyOwnership(walletAddress, mintAddress);
      
      expect(result.isOwner).toBe(false);
      expect(result.error).toBe('NFT metadata not found');
    });
    
    it('should return error when ownership information missing', async () => {
      const walletAddress = 'ABC123wallet';
      const mintAddress = 'XYZ789mint';
      
      // Mock Helius response without ownership field
      heliusProxy.getAssetMetadata.mockResolvedValue({
        id: mintAddress,
        content: {}
      });
      
      const result = await ownershipVerification.verifyOwnership(walletAddress, mintAddress);
      
      expect(result.isOwner).toBe(false);
      expect(result.error).toBe('Owner information not available');
    });
    
    it('should handle Helius API errors gracefully', async () => {
      const walletAddress = 'ABC123wallet';
      const mintAddress = 'XYZ789mint';
      
      // Mock Helius throwing an error
      heliusProxy.getAssetMetadata.mockRejectedValue(new Error('API timeout'));
      
      const result = await ownershipVerification.verifyOwnership(walletAddress, mintAddress);
      
      expect(result.isOwner).toBe(false);
      expect(result.error).toContain('Ownership verification failed');
    });
  });
  
  describe('verifyMultipleOwnership', () => {
    it('should verify ownership of multiple NFTs', async () => {
      const walletAddress = 'ABC123wallet';
      const mintAddresses = ['mint1', 'mint2', 'mint3'];
      
      // Mock all NFTs as owned
      heliusProxy.getAssetMetadata.mockImplementation((mintAddress) => {
        return Promise.resolve({
          ownership: {
            owner: 'ABC123wallet'
          }
        });
      });
      
      const result = await ownershipVerification.verifyMultipleOwnership(walletAddress, mintAddresses);
      
      expect(result.allOwned).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.failedMints).toHaveLength(0);
      expect(heliusProxy.getAssetMetadata).toHaveBeenCalledTimes(3);
    });
    
    it('should identify NFTs not owned by wallet', async () => {
      const walletAddress = 'ABC123wallet';
      const mintAddresses = ['mint1', 'mint2', 'mint3'];
      
      // Mock mint2 as not owned
      heliusProxy.getAssetMetadata.mockImplementation((mintAddress) => {
        if (mintAddress === 'mint2') {
          return Promise.resolve({
            ownership: {
              owner: 'DifferentOwner'
            }
          });
        }
        return Promise.resolve({
          ownership: {
            owner: 'ABC123wallet'
          }
        });
      });
      
      const result = await ownershipVerification.verifyMultipleOwnership(walletAddress, mintAddresses);
      
      expect(result.allOwned).toBe(false);
      expect(result.results).toHaveLength(3);
      expect(result.failedMints).toHaveLength(1);
      expect(result.failedMints[0].mintAddress).toBe('mint2');
      expect(result.failedMints[0].currentOwner).toBe('DifferentOwner');
    });
    
    it('should handle mixed success and failure cases', async () => {
      const walletAddress = 'ABC123wallet';
      const mintAddresses = ['mint1', 'mint2', 'mint3'];
      
      // Mock different scenarios
      heliusProxy.getAssetMetadata.mockImplementation((mintAddress) => {
        if (mintAddress === 'mint1') {
          return Promise.resolve({
            ownership: { owner: 'ABC123wallet' }
          });
        } else if (mintAddress === 'mint2') {
          return Promise.resolve(null); // Not found
        } else {
          return Promise.reject(new Error('API error')); // Error
        }
      });
      
      const result = await ownershipVerification.verifyMultipleOwnership(walletAddress, mintAddresses);
      
      expect(result.allOwned).toBe(false);
      expect(result.results).toHaveLength(3);
      expect(result.failedMints).toHaveLength(2);
    });
    
    it('should handle empty mint address array', async () => {
      const walletAddress = 'ABC123wallet';
      const mintAddresses = [];
      
      const result = await ownershipVerification.verifyMultipleOwnership(walletAddress, mintAddresses);
      
      expect(result.allOwned).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.failedMints).toHaveLength(0);
      expect(heliusProxy.getAssetMetadata).not.toHaveBeenCalled();
    });
  });
});
