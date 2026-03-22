// Fixed NFTDisplay.jsx with better name handling
import React, { useMemo, useState, useEffect } from 'react';

const NFTDisplay = ({
  nfts,
  stakedNFTs = [],
  selectedNFTs,
  setSelectedNFTs,
  collectionFilter,
  isStakedView = false,
  loading = false,
  collections = []
}) => {
  // State to trigger re-renders for lock time updates
  const [, setUpdateTrigger] = useState(0);

  // Update remaining lock time display every minute
  useEffect(() => {
    if (!isStakedView) return;

    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isStakedView]);

  // Memoize staked addresses to prevent infinite loops
  const stakedMintAddresses = useMemo(() =>
    new Set(stakedNFTs.map(nft => nft.mintAddress || nft.mint_address)),
    [stakedNFTs]
  );

  // Compute filtered NFTs using useMemo instead of useEffect
  const filteredNFTs = useMemo(() => {
    if (!nfts) return [];

    let result = [...nfts];

    // Filter by staking status
    if (isStakedView) {
      result = result.filter(nft =>
        stakedMintAddresses.has(nft.mintAddress || nft.mint_address)
      );
    } else {
      result = result.filter(nft =>
        !stakedMintAddresses.has(nft.mintAddress || nft.mint_address)
      );
    }

    // Filter by collection
    if (collectionFilter && collectionFilter !== '') {
      result = result.filter(nft => nft.collectionId === parseInt(collectionFilter));
    }

    return result;
  }, [nfts, stakedMintAddresses, collectionFilter, isStakedView]);

  // Handle select all
  const handleSelectAll = () => {
    if (selectedNFTs.length === filteredNFTs.length) {
      setSelectedNFTs([]);
    } else {
      const identifiers = filteredNFTs.map(nft =>
        isStakedView ? (nft.id || nft.mintAddress) : nft.mintAddress
      );
      setSelectedNFTs(identifiers);
    }
  };

  // Handle select NFT
  const handleSelectNFT = (identifier) => {
    if (selectedNFTs.includes(identifier)) {
      setSelectedNFTs(selectedNFTs.filter(id => id !== identifier));
    } else {
      setSelectedNFTs([...selectedNFTs, identifier]);
    }
  };

  // Format NFT name properly to show like "Pepe Gods Solana #1"
  const formatNFTName = (nft) => {
    // First, try to get the name from various sources
    let nftName = null;

    // Priority 1: Direct name field with full collection name
    if (nft.name && nft.name !== 'Unknown') {
      nftName = nft.name;
    }
    // Priority 2: Metadata name
    else if (nft.metadata?.name) {
      nftName = nft.metadata.name;
    }
    // Priority 3: Title field
    else if (nft.title) {
      nftName = nft.title;
    }
    // Priority 4: Try to construct from available data
    else {
      // Look for token ID or number in the data
      const tokenId = nft.tokenId || nft.token_id || nft.id;
      const collectionName = nft.collectionName || nft.collection_name || 'NFT';

      if (tokenId) {
        nftName = `${collectionName} #${tokenId}`;
      } else {
        // Last resort: use mint address
        const mintShort = (nft.mintAddress || nft.mint_address || '').substr(-4);
        nftName = `${collectionName} #${mintShort}`;
      }
    }

    // Clean up the name if needed
    if (nftName) {
      // If the name already contains the collection name properly, return as is
      if (nftName.includes('Pepe Gods Solana') || nftName.includes('Pepe Goddess')) {
        return nftName;
      }

      // If it's just a generic name, try to enhance it
      const collectionName = nft.collectionName || nft.collection_name;
      if (collectionName && !nftName.includes(collectionName)) {
        // Extract number from name if it exists
        const numberMatch = nftName.match(/#(\d+)/);
        if (numberMatch) {
          return `${collectionName} #${numberMatch[1]}`;
        }
      }
    }

    return nftName || 'Unknown NFT';
  };

  // Format collection name
  const formatCollectionName = (nft) => {
    return nft.collectionName || nft.collection_name || 'Unknown Collection';
  };

  // Format remaining lock time
  const formatRemainingLockTime = (nft) => {
    const MINIMUM_STAKE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
    const stakeTimestamp = nft.stakeTimestamp || nft.stake_timestamp;
    
    if (!stakeTimestamp) {
      return { text: '', className: '' };
    }

    const stakeTime = new Date(stakeTimestamp).getTime();
    const now = Date.now();
    const elapsedTime = now - stakeTime;
    const remainingMs = Math.max(0, MINIMUM_STAKE_DURATION_MS - elapsedTime);

    if (remainingMs === 0) {
      return { text: 'Ready to unstake', className: 'text-green-600' };
    }

    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
      return { 
        text: `${hours}h ${minutes}m remaining`, 
        className: 'text-orange-600' 
      };
    } else {
      return { 
        text: `${minutes}m remaining`, 
        className: 'text-orange-600' 
      };
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // No NFTs found
  if (!filteredNFTs || filteredNFTs.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {isStakedView ? 'No Staked NFTs' : 'No Available NFTs'}
        </h3>
        <p className="text-gray-500">
          {isStakedView
            ? 'You haven\'t staked any NFTs yet.'
            : collectionFilter
              ? 'No unstaked NFTs found in the selected collection.'
              : 'No unstaked NFTs found in your wallet that match any of the available collections.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {isStakedView ? 'Staked NFTs' : 'Your NFTs'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {filteredNFTs.length} NFT{filteredNFTs.length !== 1 ? 's' : ''}
            {collectionFilter ? ' in selected collection' : ' available'}
          </p>
        </div>

        {filteredNFTs.length > 0 && (
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              {selectedNFTs.length} selected
            </span>
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 text-sm rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              {selectedNFTs.length === filteredNFTs.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredNFTs.map((nft) => {
          const identifier = isStakedView ? (nft.id || nft.mintAddress) : nft.mintAddress;
          const isSelected = selectedNFTs.includes(identifier);
          const nftName = formatNFTName(nft);
          const collectionName = formatCollectionName(nft);

          return (
            <div
              key={identifier}
              className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer hover:shadow-lg ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleSelectNFT(identifier)}
            >
              <div className="aspect-square bg-gray-100">
                <img
                  src={nft.image}
                  alt={nftName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = `https://via.placeholder.com/150x150/e5e7eb/6b7280?text=${nftName?.charAt(0) || 'N'}`;
                  }}
                />
              </div>

              <div className="p-3">
                {/* NFT Name - Remove truncate and use line-clamp instead */}
                <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1" title={nftName}>
                  {nftName}
                </h4>

                {/* Collection Name */}
                <p className="text-xs text-gray-500 truncate" title={collectionName}>
                  {collectionName}
                </p>

                {/* Staking Info */}
                {isStakedView && (nft.stakeTimestamp || nft.stake_timestamp) && (
                  <>
                    <p className="text-xs text-gray-500 mt-1">
                      Staked {new Date(nft.stakeTimestamp || nft.stake_timestamp).toLocaleDateString()}
                    </p>
                    {(() => {
                      const lockTime = formatRemainingLockTime(nft);
                      return (
                        <p className={`text-xs font-medium mt-1 ${lockTime.className}`}>
                          {lockTime.text}
                        </p>
                      );
                    })()}
                  </>
                )}
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 bg-indigo-500 text-white rounded-full p-1 shadow-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}

              {/* Status indicator */}
              <div className={`absolute top-2 left-2 text-white text-xs px-2 py-1 rounded ${
                isStakedView
                  ? 'bg-green-600 bg-opacity-75'
                  : 'bg-black bg-opacity-75'
              }`}>
                {isStakedView ? 'STAKED' : collectionName.substring(0, 8) + (collectionName.length > 8 ? '...' : '')}
              </div>
            </div>
          );
        })}
      </div>

      {filteredNFTs.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            {isStakedView
              ? 'Select staked NFTs to unstake them and return them to your wallet.'
              : 'Select available NFTs to stake them and start earning rewards.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default NFTDisplay;