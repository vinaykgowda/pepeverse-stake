// frontend/src/components/User/DaoNFTDisplay.jsx
import React from 'react';

const DaoNFTDisplay = ({ eligibleNFTs = [], loading = false }) => {
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
        const name = nft.name || nft.metadata?.name || 'DAO NFT';
        const image = nft.image || nft.metadata?.image;
        const shortMint = mint ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : '—';

        return (
          <div
            key={mint}
            className="bg-[#0d1a2d] border border-blue-900 rounded-xl overflow-hidden shadow-[0_0_12px_rgba(59,130,246,0.15)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all"
          >
            {image ? (
              <img
                src={image}
                alt={name}
                className="w-full aspect-square object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full aspect-square bg-[#0a1628] flex items-center justify-center">
                <span className="text-3xl">🏛️</span>
              </div>
            )}
            <div className="p-2">
              <p className="text-blue-300 text-xs font-semibold truncate">{name}</p>
              <p className="text-blue-700 text-xs font-mono mt-0.5">{shortMint}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DaoNFTDisplay;
