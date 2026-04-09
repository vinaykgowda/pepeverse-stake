// frontend/src/components/User/NFTDisplay.jsx
import React, { useMemo } from 'react';

const NFTDisplay = ({
  nfts,
  stakedNFTs = [],
  selectedNFTs,
  setSelectedNFTs,
  collectionFilter,
  isStakedView = false,
  loading = false,
  collections = [],
  walletNFTs = [],
  nftEarnings = {},
}) => {
  const stakedMintAddresses = useMemo(() =>
    new Set(stakedNFTs.map(nft => nft.mintAddress || nft.mint_address)),
    [stakedNFTs]
  );

  const walletNFTMap = useMemo(() => {
    const map = {};
    walletNFTs.forEach(n => { if (n.mintAddress) map[n.mintAddress] = n; });
    return map;
  }, [walletNFTs]);

  const filteredNFTs = useMemo(() => {
    if (!nfts) return [];
    let result = [...nfts];
    if (isStakedView) {
      result = result.filter(nft => stakedMintAddresses.has(nft.mintAddress || nft.mint_address));
    } else {
      result = result.filter(nft => !stakedMintAddresses.has(nft.mintAddress || nft.mint_address));
    }
    if (collectionFilter && collectionFilter !== '') {
      const filterId = parseInt(collectionFilter);
      result = result.filter(nft =>
        (nft.collectionId === filterId) ||
        (parseInt(nft.collection_id) === filterId)
      );
    }
    return result;
  }, [nfts, stakedMintAddresses, collectionFilter, isStakedView]);

  const handleSelectAll = () => {
    if (selectedNFTs.length === filteredNFTs.length) {
      setSelectedNFTs([]);
    } else {
      setSelectedNFTs(filteredNFTs.map(nft => isStakedView ? (nft.id || nft.mintAddress) : nft.mintAddress));
    }
  };

  const handleSelectNFT = (identifier) => {
    if (selectedNFTs.includes(identifier)) {
      setSelectedNFTs(selectedNFTs.filter(id => id !== identifier));
    } else {
      setSelectedNFTs([...selectedNFTs, identifier]);
    }
  };

  const formatNFTName = (nft) => {
    if (nft.name && nft.name !== 'Unknown') return nft.name;
    if (nft.metadata?.name) return nft.metadata.name;
    if (nft.title) return nft.title;
    const collectionName = nft.collectionName || nft.collection_name || 'NFT';
    const numberMatch = (nft.name || '').match(/#(\d+)/);
    if (numberMatch) return `${collectionName} #${numberMatch[1]}`;
    const mintShort = (nft.mintAddress || nft.mint_address || '').slice(-4);
    return `${collectionName} #${mintShort}`;
  };

  const formatCollectionName = (nft) =>
    nft.collectionName || nft.collection_name || 'Unknown Collection';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500" />
      </div>
    );
  }

  if (!filteredNFTs || filteredNFTs.length === 0) {
    return (
      <div className="bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-8 text-center">
        <div className="text-green-800 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-green-600 mb-2">
          {isStakedView ? 'No Staked NFTs' : 'No Available NFTs'}
        </h3>
        <p className="text-green-800 text-sm">
          {isStakedView ? "You haven't staked any NFTs yet." : collectionFilter ? 'No NFTs in selected collection.' : 'No NFTs found in your wallet matching available collections.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-green-700">
          {filteredNFTs.length} NFT{filteredNFTs.length !== 1 ? 's' : ''}
          {collectionFilter ? ' in collection' : ''}
        </p>
        {filteredNFTs.length > 0 && (
          <div className="flex items-center gap-3">
            {selectedNFTs.length > 0 && (
              <span className="text-xs text-green-600 bg-green-950/50 border border-green-800 px-2 py-0.5 rounded-full">
                {selectedNFTs.length} selected
              </span>
            )}
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 text-xs rounded-lg bg-[#0d1a0d] border border-[#1e3a1e] text-green-500 hover:border-green-600 transition-colors"
            >
              {selectedNFTs.length === filteredNFTs.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filteredNFTs.map((nft) => {
          const identifier = isStakedView ? (nft.id || nft.mintAddress) : nft.mintAddress;
          const isSelected = selectedNFTs.includes(identifier);
          const mintAddr = nft.mintAddress || nft.mint_address;
          const enriched = isStakedView && walletNFTMap[mintAddr] ? { ...walletNFTMap[mintAddr], ...nft } : nft;
          const nftName = formatNFTName(enriched);
          const collectionName = formatCollectionName(enriched);
          // Earning badges for staked NFTs
          const earnings = isStakedView ? (nftEarnings[mintAddr] || []) : [];

          return (
            <div
              key={identifier}
              className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                  : 'border-[#1e3a1e] hover:border-green-700'
              }`}
              onClick={() => handleSelectNFT(identifier)}
            >
              <div className="aspect-square bg-[#0d1a0d]">
                <img
                  src={enriched.image}
                  alt={nftName}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = `https://via.placeholder.com/150x150/0d1a0d/22c55e?text=${nftName?.charAt(0) || 'N'}`; }}
                />
              </div>

              <div className="p-2 bg-[#111a11]">
                <h4 className="text-xs font-medium text-green-300 line-clamp-1 mb-0.5" title={nftName}>{nftName}</h4>
                <p className="text-xs text-green-700 truncate mb-1">{collectionName}</p>
                {/* Earning badges */}
                {earnings.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {earnings.map((e, i) => (
                      <span
                        key={i}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold leading-tight ${
                          e.has_trait_bonus
                            ? 'bg-yellow-900/60 text-yellow-400 border border-yellow-700/50'
                            : 'bg-green-950/60 text-green-500 border border-green-800/50'
                        }`}
                        title={e.has_trait_bonus
                          ? `${e.base_rate}/day base + ${e.trait_rate}/day trait`
                          : `${e.total_rate}/day`}
                      >
                        {e.total_rate} {e.token_symbol}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 bg-green-500 text-black rounded-full p-0.5 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              <div className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-semibold bg-green-600/80 text-black">
                {isStakedView ? 'STAKED' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NFTDisplay;
