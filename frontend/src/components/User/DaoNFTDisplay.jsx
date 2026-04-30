// frontend/src/components/User/DaoNFTDisplay.jsx
// NFT name and image come from the API (Helius metadata fetched server-side).
// walletNFTs is kept as a secondary enrichment source since it's soft staking.
import React, { useMemo } from 'react';

const DaoNFTDisplay = ({ eligibleNFTs = [], walletNFTs = [], stakedNFTs = [], loading = false }) => {
  // Build lookup from walletNFTs (soft staking — NFT stays in wallet, so Helius returns it)
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
        const mint = nft.mint_address || nft.mintAddress;

        // Priority order for name and image:
        // 1. API response (Helius metadata fetched server-side in dao-eligible-nfts endpoint)
        // 2. walletNFTs lookup (soft staking — NFT is still in wallet)
        // 3. Fallback
        const walletNft = walletMap[mint] || {};
        const image = nft.image || walletNft.image || null;
        const name = nft.name || walletNft.name || null;
        const displayName = name || (mint ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : 'DAO NFT');
        const shortMint = mint ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : '—';
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
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full aspect-square bg-[#0a1628] flex items-center justify-center">
                <span className="text-3xl">🏛️</span>
              </div>
            )}
            <div className="p-2">
              <p className="text-blue-300 text-xs font-semibold truncate" title={name || mint}>{displayName}</p>
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
