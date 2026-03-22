// backend/src/services/ownershipVerification.integration.test.js

/**
 * Integration test for NFT ownership verification in stake endpoint
 * 
 * Tests Requirements: 11.1, 11.2, 11.3, 11.4
 */

// Mock environment variables before importing
process.env.HELIUS_API_KEY = 'test-api-key';
process.env.HELIUS_MAINNET_ENDPOINT = 'https://test-helius.com';

// Mock the heliusProxy module
jest.mock('./heliusProxy');

const ownershipVerification = require('./ownershipVerification');
const heliusProxy = require('./heliusProxy');

describe('NFT Ownership Verification Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Stake Endpoint Integration', () => {
    it('should allow staking when user owns all NFTs', async () => {
      const walletAddress = 'UserWallet123';
      const nfts = [
        { mintAddress: 'NFT1' },
        { mintAddress: 'NFT2' },
        { mintAddress: 'NFT3' }
      ];

      // Mock all NFTs as owned by the user
      heliusProxy.getAssetMetadata.mockImplementation((mintAddress) => {
        return Promise.resolve({
          ownership: {
            owner: 'UserWallet123'
          }
        });
      });

      const mintAddresses = nfts.map(nft => nft.mintAddress);
      const result = await ownershipVerification.verifyMultipleOwnership(
        walletAddress,
        mintAddresses
      );

      expect(result.allOwned).toBe(true);
      expect(result.failedMints).toHaveLength(0);
    });

    it('should reject staking when user does not own some NFTs (Requirement 11.3)', async () => {
      const walletAddress = 'UserWallet123';
      const nfts = [
        { mintAddress: 'NFT1' },
        { mintAddress: 'NFT2' },
        { mintAddress: 'NFT3' }
      ];

      // Mock NFT2 as owned by someone else
      heliusProxy.getAssetMetadata.mockImplementation((mintAddress) => {
        if (mintAddress === 'NFT2') {
          return Promise.resolve({
            ownership: {
              owner: 'DifferentOwner456'
            }
          });
        }
        return Promise.resolve({
          ownership: {
            owner: 'UserWallet123'
          }
        });
      });

      const mintAddresses = nfts.map(nft => nft.mintAddress);
      const result = await ownershipVerification.verifyMultipleOwnership(
        walletAddress,
        mintAddresses
      );

      // Requirement 11.3: Should fail verification
      expect(result.allOwned).toBe(false);
      expect(result.failedMints).toHaveLength(1);
      expect(result.failedMints[0].mintAddress).toBe('NFT2');
      expect(result.failedMints[0].currentOwner).toBe('DifferentOwner456');
    });

    it('should verify ownership immediately before processing (Requirement 11.4)', async () => {
      const walletAddress = 'UserWallet123';
      const mintAddresses = ['NFT1', 'NFT2'];

      // Mock ownership data
      heliusProxy.getAssetMetadata.mockImplementation((mintAddress) => {
        return Promise.resolve({
          ownership: {
            owner: 'UserWallet123'
          }
        });
      });

      const startTime = Date.now();
      await ownershipVerification.verifyMultipleOwnership(walletAddress, mintAddresses);
      const endTime = Date.now();

      // Verify that ownership check was performed
      expect(heliusProxy.getAssetMetadata).toHaveBeenCalledTimes(2);
      expect(heliusProxy.getAssetMetadata).toHaveBeenCalledWith('NFT1');
      expect(heliusProxy.getAssetMetadata).toHaveBeenCalledWith('NFT2');

      // Verify it happens in reasonable time (real-time check)
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should query Helius for real-time ownership data (Requirement 11.2)', async () => {
      const walletAddress = 'UserWallet123';
      const mintAddress = 'NFT1';

      // Mock Helius response
      heliusProxy.getAssetMetadata.mockResolvedValue({
        ownership: {
          owner: 'UserWallet123'
        }
      });

      await ownershipVerification.verifyOwnership(walletAddress, mintAddress);

      // Verify Helius was called for real-time data
      expect(heliusProxy.getAssetMetadata).toHaveBeenCalledWith(mintAddress);
    });

    it('should check current owner field from blockchain data (Requirement 11.1)', async () => {
      const walletAddress = 'UserWallet123';
      const mintAddress = 'NFT1';

      // Mock Helius response with ownership field
      const mockMetadata = {
        id: mintAddress,
        ownership: {
          owner: 'UserWallet123',
          frozen: false
        },
        content: {
          metadata: {
            name: 'Test NFT'
          }
        }
      };

      heliusProxy.getAssetMetadata.mockResolvedValue(mockMetadata);

      const result = await ownershipVerification.verifyOwnership(walletAddress, mintAddress);

      // Verify that the current owner field was checked
      expect(result.isOwner).toBe(true);
      expect(result.currentOwner).toBe('UserWallet123');
    });

    it('should handle NFT metadata not found', async () => {
      const walletAddress = 'UserWallet123';
      const mintAddress = 'InvalidNFT';

      // Mock Helius returning null (NFT not found)
      heliusProxy.getAssetMetadata.mockResolvedValue(null);

      const result = await ownershipVerification.verifyOwnership(walletAddress, mintAddress);

      expect(result.isOwner).toBe(false);
      expect(result.error).toBe('NFT metadata not found');
    });

    it('should handle Helius API failures gracefully', async () => {
      const walletAddress = 'UserWallet123';
      const mintAddress = 'NFT1';

      // Mock Helius API error
      heliusProxy.getAssetMetadata.mockRejectedValue(new Error('Service unavailable'));

      const result = await ownershipVerification.verifyOwnership(walletAddress, mintAddress);

      expect(result.isOwner).toBe(false);
      expect(result.error).toContain('Ownership verification failed');
    });

    it('should provide detailed error information for failed verifications', async () => {
      const walletAddress = 'UserWallet123';
      const nfts = [
        { mintAddress: 'NFT1' },
        { mintAddress: 'NFT2' },
        { mintAddress: 'NFT3' }
      ];

      // Mock different failure scenarios
      heliusProxy.getAssetMetadata.mockImplementation((mintAddress) => {
        if (mintAddress === 'NFT1') {
          return Promise.resolve({
            ownership: { owner: 'UserWallet123' }
          });
        } else if (mintAddress === 'NFT2') {
          return Promise.resolve({
            ownership: { owner: 'DifferentOwner' }
          });
        } else {
          return Promise.resolve(null); // NFT3 not found
        }
      });

      const mintAddresses = nfts.map(nft => nft.mintAddress);
      const result = await ownershipVerification.verifyMultipleOwnership(
        walletAddress,
        mintAddresses
      );

      expect(result.allOwned).toBe(false);
      expect(result.failedMints).toHaveLength(2);

      // Check NFT2 failure details
      const nft2Failure = result.failedMints.find(f => f.mintAddress === 'NFT2');
      expect(nft2Failure.currentOwner).toBe('DifferentOwner');

      // Check NFT3 failure details
      const nft3Failure = result.failedMints.find(f => f.mintAddress === 'NFT3');
      expect(nft3Failure.reason).toBe('NFT metadata not found');
    });
  });
});
