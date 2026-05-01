// frontend/src/components/User/DaoNFTDisplay.jsx
// Matches the style of NFTDisplay staked view — STAKED badge, name, collection, earnings pill
import React, { useMemo } from 'react';

const DaoNFTDisplay = ({ eligibleNFTs = [], walletNFTs = [], stakedNFTs = [], loading = false }) => {
  // Build lookup from walletNFTs for image/name enrichment (soft staking — NFT stays in wallet)
  const walletMap = useMemo(() => {
    const map = {};
    walletNFTs.forEach(nft => {
      const mint = nft.mintAddress || nft.mint_address;
      if (mint) map[mint] = nft;
    });
    return map;
  }, [walletNFTs]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!eligibleNFTs.length) {
    return (
      <div className="bg-[#0d1a2d] border border-blue-900 rounded-xl p-8 text-center">
        <div className="text-blue-800 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-blue-400 mb-2">No DAO-eligible NFTs</h3>
        <p className="text-blue-700 text-sm">Stake NFTs with DAO-eligible traits to see them here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-4">
        <p className="text-sm text-blue-600">{eligibleNFTs.length} DAO NFT{eligibleNFTs.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {eligibleNFTs.map((nft) => {
          const mint = nft.mint_address || nft.mintAddress;
          const walletNft = walletMap[mint] || {};

          // Name: API first, then wallet lookup, then fallback
          const name = nft.name || walletNft.name || null;
          const displayName = name || (mint ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : 'DAO NFT');

          // Image: API first, then wallet lookup
          const image = nft.image || walletNft.image || null;

          // Collection name from API
          const collectionName = nft.collection_name || walletNft.collectionName || null;

          // DAO earnings — show all tokens as pills
          const earnings = nft.dao_earnings || [];

          return (
            <div
              key={mint}
              className="relative rounded-xl overflow-hidden border-2 border-blue-800 hover:border-blue-500 transition-all"
            >
              {/* NFT Image */}
              <div className="aspect-square bg-[#0a1628]">
                {image ? (
                  <img
                    src={image}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl">🏛️</span>
                  </div>
                )}
              </div>

              {/* Card info */}
              <div className="p-2 bg-[#0d1a2d]">
                <h4 className="text-xs font-medium text-blue-200 line-clamp-1 mb-0.5" title={displayName}>
                  {displayName}
                </h4>
                {collectionName && (
                  <p className="text-xs text-blue-600 truncate mb-1">{collectionName}</p>
                )}
                {/* DAO earnings pills — same style as staked earnings badges */}
                {earnings.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {earnings.map((e, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold leading-tight bg-blue-900/60 text-blue-300 border border-blue-700/50"
                        title={`${e.daily_rate}/day DAO`}
                      >
                        {e.daily_rate} {e.token_symbol}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* STAKED badge — blue version of the green one */}
              <div className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-600/90 text-white">
                STAKED
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DaoNFTDisplay;
