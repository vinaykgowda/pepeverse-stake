const { getPool } = require('../db');
const HeliusProxyService = require('./heliusProxy');
const auditLog = require('./auditLog');

// Create singleton instance
const heliusProxy = new HeliusProxyService();

const pool = getPool();

/**
 * Refresh metadata for all staked NFTs in a collection or wallet
 * Fetches fresh metadata from Helius and updates the traits column
 * 
 * @param {string} collectionId - Collection ID to refresh (optional, refreshes all if not provided)
 * @param {string} adminWallet - Admin wallet triggering the refresh (or user wallet for auto-refresh)
 * @param {string} walletAddress - User wallet to refresh (optional, for user-triggered refresh)
 * @returns {Promise<object>} Refresh results
 */
async function refreshStakedNFTMetadata(collectionId = null, adminWallet = null, walletAddress = null) {
  const connection = await pool.getClient();
  
  try {
    const refreshScope = walletAddress 
      ? `for wallet ${walletAddress}` 
      : collectionId 
        ? `for collection ${collectionId}` 
        : 'for all collections';
    console.log(`🔄 [METADATA_REFRESH] Starting metadata refresh ${refreshScope}`);
    
    // Get all staked NFTs (optionally filtered by collection or wallet)
    let query = 'SELECT id, mint_address, collection_id, traits FROM staked_nfts WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (walletAddress) {
      query += ` AND wallet_address = $${paramIndex++}`;
      params.push(walletAddress);
    } else if (collectionId) {
      query += ` AND collection_id = $${paramIndex++}`;
      params.push(collectionId);
    }
    
    const stakedNFTsResult = await connection.query(query, params);
    const stakedNFTs = stakedNFTsResult.rows;
    
    if (stakedNFTs.length === 0) {
      console.log(`ℹ️ [METADATA_REFRESH] No staked NFTs found`);
      return {
        success: true,
        message: 'No staked NFTs to refresh',
        stats: {
          total: 0,
          updated: 0,
          failed: 0,
          unchanged: 0
        }
      };
    }
    
    console.log(`📊 [METADATA_REFRESH] Found ${stakedNFTs.length} staked NFTs to refresh`);
    
    const stats = {
      total: stakedNFTs.length,
      updated: 0,
      failed: 0,
      unchanged: 0
    };
    
    const failedNFTs = [];
    
    // Process NFTs in batches to avoid overwhelming Helius API
    const BATCH_SIZE = 10;
    for (let i = 0; i < stakedNFTs.length; i += BATCH_SIZE) {
      const batch = stakedNFTs.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (nft) => {
        try {
          // Fetch fresh metadata from Helius
          const metadata = await heliusProxy.getAssetMetadata(nft.mint_address);
          
          if (!metadata) {
            console.warn(`⚠️ [METADATA_REFRESH] No metadata found for ${nft.mint_address}`);
            stats.failed++;
            failedNFTs.push({ mintAddress: nft.mint_address, reason: 'Metadata not found' });
            return;
          }
          
          // Extract traits from metadata
          const freshTraits = extractTraitsFromMetadata(metadata);
          const freshTraitsJSON = JSON.stringify(freshTraits);
          
          // Compare with existing traits
          const existingTraitsJSON = nft.traits;
          
          if (freshTraitsJSON === existingTraitsJSON) {
            console.log(`✓ [METADATA_REFRESH] ${nft.mint_address}: No changes`);
            stats.unchanged++;
            return;
          }
          
          // Update traits in database
          await connection.query(
            'UPDATE staked_nfts SET traits = $1 WHERE id = $2',
            [freshTraitsJSON, nft.id]
          );
          
          console.log(`✅ [METADATA_REFRESH] ${nft.mint_address}: Traits updated`);
          stats.updated++;
          
        } catch (error) {
          console.error(`❌ [METADATA_REFRESH] Error refreshing ${nft.mint_address}:`, error);
          stats.failed++;
          failedNFTs.push({ mintAddress: nft.mint_address, reason: error.message });
        }
      }));
      
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < stakedNFTs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ [METADATA_REFRESH] Completed: ${stats.updated} updated, ${stats.unchanged} unchanged, ${stats.failed} failed`);
    
    // Log to audit trail
    if (adminWallet) {
      await auditLog.log({
        adminWallet,
        action: 'METADATA_REFRESH',
        targetType: 'collection',
        targetId: collectionId || 'all',
        changes: stats,
        ipAddress: null
      });
    }
    
    return {
      success: true,
      message: `Metadata refresh completed: ${stats.updated} updated, ${stats.unchanged} unchanged, ${stats.failed} failed`,
      stats,
      failedNFTs: failedNFTs.length > 0 ? failedNFTs : undefined
    };
    
  } catch (error) {
    console.error('❌ [METADATA_REFRESH] Error during metadata refresh:', error);
    return {
      success: false,
      message: error.message || 'Failed to refresh metadata'
    };
  } finally {
    connection.release();
  }
}

/**
 * Extract traits from Helius metadata response
 * Handles both Metaplex standard and custom formats
 */
function extractTraitsFromMetadata(metadata) {
  const traits = [];
  
  try {
    // Check for attributes in content.metadata.attributes (Metaplex standard)
    if (metadata.content?.metadata?.attributes) {
      const attributes = metadata.content.metadata.attributes;
      
      if (Array.isArray(attributes)) {
        for (const attr of attributes) {
          if (attr.trait_type && attr.value !== undefined) {
            traits.push({
              trait_type: attr.trait_type,
              value: String(attr.value)
            });
          }
        }
      }
    }
    
    // Also check for traits in content.metadata.properties (alternative format)
    if (metadata.content?.metadata?.properties?.category) {
      traits.push({
        trait_type: 'Category',
        value: metadata.content.metadata.properties.category
      });
    }
    
  } catch (error) {
    console.error('Error extracting traits from metadata:', error);
  }
  
  return traits;
}

/**
 * Refresh metadata for a single staked NFT
 * Useful for targeted updates
 */
async function refreshSingleNFT(mintAddress, adminWallet = null) {
  const connection = await pool.getClient();
  
  try {
    // Get staked NFT
    const nftsResult = await connection.query(
      'SELECT id, mint_address, collection_id, traits FROM staked_nfts WHERE mint_address = $1',
      [mintAddress]
    );
    
    if (nftsResult.rows.length === 0) {
      return {
        success: false,
        message: 'NFT is not currently staked'
      };
    }
    
    const nft = nftsResult.rows[0];
    
    // Fetch fresh metadata
    const metadata = await heliusProxy.getAssetMetadata(mintAddress);
    
    if (!metadata) {
      return {
        success: false,
        message: 'Failed to fetch metadata from Helius'
      };
    }
    
    // Extract and update traits
    const freshTraits = extractTraitsFromMetadata(metadata);
    const freshTraitsJSON = JSON.stringify(freshTraits);
    
    await connection.query(
      'UPDATE staked_nfts SET traits = $1 WHERE id = $2',
      [freshTraitsJSON, nft.id]
    );
    
    // Log to audit trail
    if (adminWallet) {
      await auditLog.log({
        adminWallet,
        action: 'METADATA_REFRESH_SINGLE',
        targetType: 'nft',
        targetId: mintAddress,
        changes: { oldTraits: nft.traits, newTraits: freshTraitsJSON },
        ipAddress: null
      });
    }
    
    return {
      success: true,
      message: 'Metadata refreshed successfully',
      data: {
        mintAddress,
        oldTraits: JSON.parse(nft.traits || '[]'),
        newTraits: freshTraits
      }
    };
    
  } catch (error) {
    console.error(`Error refreshing metadata for ${mintAddress}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to refresh metadata'
    };
  } finally {
    connection.release();
  }
}

module.exports = {
  refreshStakedNFTMetadata,
  refreshSingleNFT,
  extractTraitsFromMetadata
};
