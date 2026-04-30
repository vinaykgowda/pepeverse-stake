// frontend/src/components/User/DaoNFTDisplay.jsx
import React, { useMemo } from 'react';

const DaoNFTDisplay = ({ eligibleNFTs = [], walletNFTs = [], stakedNFTs = [], loading = false }) => {
  // Build a lookup map from mint address → NFT data (image, name) from wallet NFTs
  // walletNFTs use camelCase mintAddress; stakedNFTs from DB use snake_case mint_address
  const nftDataMap = useMemo(() => {
    const map = {};
    // walletNFTs have image + name from Helius — this is the primary source
    walletNFTs.forEach(nft => {
      const mint = nft.mintAddress || nft.mint_address || nft.mint;
      if (mint) map[mint] = nft;
    });
    // stakedNFTs from DB don't have image/name, but add them as fallback keys
    stakedNFTs.forEach(nft => {
      const mint = nft.mintAddress || nft.mint_address || nft.mint;
      if (mint && !map[mint]) map[mint] = nft;
    });
    return map;
  }, [walletNFTs, stakedNFTs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-blue-400 text-sm animate-pulse">Loading DAO-eligible NFTs...</div>
      </div>
    );
  }

  if (!eligibleNFTs.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-4">🏛️</div>
        <p className="text-blue-400 font-semibold">No DAO-eligible NFTs</p>
        <p className="text-blue-700 text-sm mt-1">
          Stake NFTs with DAO-eligible traits to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {eligibleNFTs.map((nft) => {
        const mint = nft.mint_address || nft.mintAddress || nft.mint;

        // Enrich with wallet/staked NFT data for image and name
        const enriched = nftDataMap[mint] || {};
        const image = enriched.image || nft.image || enriched.metadata?.image || null;
        const name = enriched.name || enriched.metadata?.name || nft.name || null;

        // Clean display: use real name if available, otherwise show last 6 chars of mint
        const displayName = name || (mint ? `#${mint.slice(-6)}` : 'DAO NFT');        const shortMint = mint ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : '—';

        // Show DAO earnings summary on the card
        const topEarning = nft.dao_earnings?.[0];

        return (
          <div
            key={mint}
            className="bg-[#0d1a2d] border border-blue-900 rounded-xl overflow-hidden shadow-[0_0_12px_rgba(59,130,246,0.15)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all"
          >
            {image ? (
              <img
                src={image}
                alt={displayName}
                className="w-full aspect-square object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                }}
              />
            ) : null}
            <div
              className="w-full aspect-square bg-[#0a1628] items-center justify-center"
              style={{ display: image ? 'none' : 'flex' }}
            >
              <span className="text-3xl">🏛️</span>
            </div>
            <div className="p-2">
              <p className="text-blue-300 text-xs font-semibold truncate">{displayName}</p>
              <p className="text-blue-700 text-xs font-mono mt-0.5">{shortMint}</p>
              {topEarning && (
                <p className="text-blue-400 text-xs mt-1">
                  {topEarning.daily_rate}/day {topEarning.token_symbol}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DaoNFTDisplay;
