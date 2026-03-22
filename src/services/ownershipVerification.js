// backend/src/services/ownershipVerification.js

const HeliusProxyService = require('./heliusProxy');

// Create singleton instance
const heliusProxy = new HeliusProxyService();

/**
 * NFT Ownership Verification Service
 * 
 * Verifies that a wallet address owns specific NFTs by querying
 * real-time blockchain data through the Helius proxy service.
 * 
 * Requirements: 11.1, 11.2, 11.3
 */
class OwnershipVerificationService {
  /**
   * Verify that a wallet owns a specific NFT
   * 
   * @param {string} walletAddress - The wallet address to verify
   * @param {string} mintAddress - The NFT mint address to verify ownership of
   * @returns {Promise<{isOwner: boolean, error?: string}>}
   */
  async verifyOwnership(walletAddress, mintAddress) {
    try {
      console.log(`🔍 Verifying ownership: wallet=${walletAddress}, mint=${mintAddress}`);
      
      // Query Helius for the NFT metadata which includes current owner
      // Requirement: 11.1, 11.2
      const metadata = await heliusProxy.getAssetMetadata(mintAddress);
      
      if (!metadata) {
        console.error(`❌ Metadata not found for mint: ${mintAddress}`);
        return {
          isOwner: false,
          error: 'NFT metadata not found'
        };
      }
      
      // Check the ownership field from Helius DAS API
      // The ownership field contains the current owner address
      const currentOwner = metadata.ownership?.owner;
      
      if (!currentOwner) {
        console.error(`❌ Owner information not found in metadata for mint: ${mintAddress}`);
        return {
          isOwner: false,
          error: 'Owner information not available'
        };
      }
      
      // Compare the current owner with the wallet address
      const isOwner = currentOwner.toLowerCase() === walletAddress.toLowerCase();
      
      if (isOwner) {
        console.log(`✅ Ownership verified: ${walletAddress} owns ${mintAddress}`);
      } else {
        console.log(`❌ Ownership verification failed: ${walletAddress} does not own ${mintAddress} (owner: ${currentOwner})`);
      }
      
      return {
        isOwner,
        currentOwner
      };
      
    } catch (error) {
      console.error(`❌ Error verifying ownership for ${mintAddress}:`, error.message);
      return {
        isOwner: false,
        error: `Ownership verification failed: ${error.message}`
      };
    }
  }
  
  /**
   * Verify that a wallet owns multiple NFTs
   * 
   * @param {string} walletAddress - The wallet address to verify
   * @param {Array<string>} mintAddresses - Array of NFT mint addresses to verify
   * @returns {Promise<{allOwned: boolean, results: Array, failedMints: Array}>}
   */
  async verifyMultipleOwnership(walletAddress, mintAddresses) {
    console.log(`🔍 Verifying ownership of ${mintAddresses.length} NFTs for wallet: ${walletAddress}`);
    
    const results = [];
    const failedMints = [];
    
    // Verify each NFT
    for (const mintAddress of mintAddresses) {
      const result = await this.verifyOwnership(walletAddress, mintAddress);
      
      results.push({
        mintAddress,
        ...result
      });
      
      if (!result.isOwner) {
        failedMints.push({
          mintAddress,
          reason: result.error || 'Not owned by wallet',
          currentOwner: result.currentOwner
        });
      }
    }
    
    const allOwned = failedMints.length === 0;
    
    if (allOwned) {
      console.log(`✅ All ${mintAddresses.length} NFTs verified as owned by ${walletAddress}`);
    } else {
      console.log(`❌ Ownership verification failed for ${failedMints.length} NFTs`);
    }
    
    return {
      allOwned,
      results,
      failedMints
    };
  }
}

// Export singleton instance
module.exports = new OwnershipVerificationService();
