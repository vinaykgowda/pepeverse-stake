// frontend/src/services/helius.js

/**
 * Helius Service - Frontend Client
 * 
 * Uses backend proxy for all Helius API calls to keep API keys secure
 * Backend handles caching and retry logic
 * 
 * Requirement: 5.3 - Remove Helius API keys from frontend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Cache for NFT data to avoid repeated API calls
// Note: Backend also has its own cache with longer TTL
let nftCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class HeliusService {

    constructor() {
        // Make cache publicly accessible
        this.nftCache = nftCache;
      }

  // Search for NFTs by owner and collection
  async searchAssets(ownerAddress, collectionAddress = null, limit = 1000) {
    const cacheKey = `${ownerAddress}-${collectionAddress || 'all'}-${limit}`;

    // Check cache first
    const cached = nftCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Using cached NFT data');
      return cached.data;
    }

    try {
      const options = {
        tokenType: "all",
        limit: limit
      };

      // Add collection filter if specified
      if (collectionAddress) {
        options.grouping = ["collection", collectionAddress];
      }

      // Call backend proxy instead of Helius directly
      const response = await fetch(`${API_BASE_URL}/helius/nfts/by-owner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerAddress,
          options
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch NFTs');
      }

      // Cache the result
      nftCache.set(cacheKey, {
        data: data.data,
        timestamp: Date.now()
      });

      return data.data;
    } catch (error) {
      console.error('Error fetching NFTs from backend proxy:', error);
      throw error;
    }
  }

  // Get NFTs for a specific collection
  async getNFTsForCollection(ownerAddress, collectionHashlist) {
    try {
      // Get all NFTs for the owner
      const allNFTs = await this.searchAssets(ownerAddress);

      if (!allNFTs || !allNFTs.items) {
        return [];
      }

      // Filter NFTs that match the collection hashlist
      const matchingNFTs = allNFTs.items.filter(nft => {
        return collectionHashlist.includes(nft.id);
      });

      // Transform to our expected format
      return matchingNFTs.map(nft => this.transformNFTData(nft));
    } catch (error) {
      console.error('Error getting NFTs for collection:', error);
      return [];
    }
  }

  // Get NFTs for multiple collections
  async getNFTsForCollections(ownerAddress, collections) {
    try {
      const allCollectionNFTs = [];

      for (const collection of collections) {
        try {
          let hashlist = [];

          // Parse hashlist - newline-separated format
          if (typeof collection.hashlist === 'string') {
            hashlist = collection.hashlist
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0);
          } else if (Array.isArray(collection.hashlist)) {
            hashlist = collection.hashlist;
          }

          let collectionNFTs = [];

          if (hashlist.length > 0) {
            // Filter by hashlist (mint addresses)
            collectionNFTs = await this.getNFTsForCollection(ownerAddress, hashlist);
          } else if (collection.creator_address) {
            // No hashlist — filter by on-chain collection ID (creator_address = group_value)
            console.log(`Collection "${collection.name}" has no hashlist, filtering by creator_address: ${collection.creator_address}`);
            const data = await this.searchAssets(ownerAddress, collection.creator_address);
            const items = data?.items || [];
            collectionNFTs = items.map(nft => this.transformNFTData(nft));
          }

          // Add collection info to each NFT
          const nftsWithCollection = collectionNFTs.map(nft => ({
            ...nft,
            collectionId: collection.id,
            collectionName: collection.name
          }));

          allCollectionNFTs.push(...nftsWithCollection);
        } catch (error) {
          console.error(`Error processing collection ${collection.name}:`, error);
        }
      }

      return allCollectionNFTs;
    } catch (error) {
      console.error('Error getting NFTs for collections:', error);
      return [];
    }
  }

  // Transform Helius NFT data to our expected format
  transformNFTData(heliusNFT) {
    const metadata = heliusNFT.content?.metadata;
    const jsonMetadata = heliusNFT.content?.json_uri ? heliusNFT.content.json_uri : null;

    return {
      mintAddress: heliusNFT.id,
      name: metadata?.name || heliusNFT.content?.metadata?.name || `NFT ${heliusNFT.id.substr(0, 6)}`,
      image: this.getImageUrl(heliusNFT),
      attributes: this.extractAttributes(heliusNFT),
      collection: heliusNFT.grouping?.find(g => g.group_key === 'collection')?.group_value || null,
      // Add original Helius data for reference
      _heliusData: heliusNFT
    };
  }

  // Extract image URL from Helius NFT data
  getImageUrl(heliusNFT) {
    // Try different possible image sources
    if (heliusNFT.content?.links?.image) {
      return heliusNFT.content.links.image;
    }

    if (heliusNFT.content?.files && heliusNFT.content.files.length > 0) {
      const imageFile = heliusNFT.content.files.find(file =>
        file.mime?.startsWith('image/') || file.uri?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );
      if (imageFile) {
        return imageFile.uri || imageFile.cdn_uri;
      }
    }

    // Fallback to placeholder
    return `https://via.placeholder.com/150?text=${heliusNFT.id.substr(0, 6)}`;
  }

  // Extract attributes from Helius NFT data
  extractAttributes(heliusNFT) {
    const attributes = [];

    // Try to get attributes from metadata
    if (heliusNFT.content?.metadata?.attributes) {
      return heliusNFT.content.metadata.attributes;
    }

    // Try to get from JSON metadata if available
    if (heliusNFT.content?.json_uri) {
      // This would require another API call to fetch the JSON metadata
      // For now, return empty array and could be enhanced later
    }

    return attributes;
  }

  // Clear cache (useful for force refresh)
  clearCache() {
    nftCache.clear();
  }

  // Get cache info for debugging
  getCacheInfo() {
    return {
      size: nftCache.size,
      keys: Array.from(nftCache.keys())
    };
  }
}

export default new HeliusService();