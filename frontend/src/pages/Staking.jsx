// frontend/src/pages/Staking.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import NFTDisplay from '../components/User/NFTDisplay';
import StakingStats from '../components/User/StakingStats';
import WalletConnect from '../components/User/WalletConnect';
import StakeModal from '../components/User/StakeModal';
import UnstakeModal from '../components/User/UnstakeModal';

const Staking = () => {
  const { connected, collections, loadUserNFTs, getStakedNFTs } = useWallet();

  const [selectedNFTs, setSelectedNFTs] = useState([]);
  const [walletNFTs, setWalletNFTs] = useState([]);
  const [stakedNFTs, setStakedNFTs] = useState([]);
  const [activeTab, setActiveTab] = useState('wallet');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);

  const loadNFTs = useCallback(async () => {
    try {
      setLoadingNFTs(true);
      const [walletData, stakedData] = await Promise.all([loadUserNFTs(), getStakedNFTs()]);
      setWalletNFTs(walletData || []);
      setStakedNFTs(stakedData || []);
    } catch (error) {
      console.error('Error loading NFTs:', error);
    } finally {
      setLoadingNFTs(false);
    }
  }, [loadUserNFTs, getStakedNFTs]);

  useEffect(() => {
    if (connected && collections.length > 0) loadNFTs();
  }, [connected, collections.length, loadNFTs]);

  const stakedMintAddresses = React.useMemo(
    () => new Set(stakedNFTs.map(nft => nft.mintAddress || nft.mint_address)),
    [stakedNFTs]
  );

  const unstakedNFTs = React.useMemo(
    () => walletNFTs.filter(nft => !stakedMintAddresses.has(nft.mintAddress)),
    [walletNFTs, stakedMintAddresses]
  );

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedNFTs([]);
  }, []);

  const handleSuccess = useCallback(() => {
    loadNFTs();
    setSelectedNFTs([]);
    setShowStakeModal(false);
    setShowUnstakeModal(false);
  }, [loadNFTs]);

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-green-400 tracking-tight mb-2">PEPE GODS STAKING</h1>
            <p className="text-green-700">Connect your wallet to start staking</p>
          </div>
          <WalletConnect />
        </div>
      </div>
    );
  }

  const currentNFTs = activeTab === 'wallet' ? unstakedNFTs : stakedNFTs;

  return (
    <div className="min-h-screen bg-[#0a0f0a]">
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* Stats + Airdrops */}
        <div className="mb-8">
          <StakingStats walletNFTs={unstakedNFTs} />
        </div>

        {/* NFT Panel - full width */}
        <div className="bg-[#111a11] border border-[#1e3a1e] rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.08)] p-6">

          {/* Tabs + Filter row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="flex space-x-1 bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-1">
              <button
                onClick={() => handleTabChange('wallet')}
                className={`py-2 px-5 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'wallet'
                    ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                    : 'text-green-700 hover:text-green-400'
                }`}
              >
                Available ({unstakedNFTs.length})
              </button>
              <button
                onClick={() => handleTabChange('staked')}
                className={`py-2 px-5 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'staked'
                    ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                    : 'text-green-700 hover:text-green-400'
                }`}
              >
                Staked ({stakedNFTs.length})
              </button>
            </div>

            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="px-3 py-2 bg-[#0d1a0d] border border-[#1e3a1e] text-green-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 text-sm"
            >
              <option value="">All Collections</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Stake / Unstake action button */}
            {selectedNFTs.length > 0 && (
              <div className="sm:ml-auto">
                {activeTab === 'wallet' ? (
                  <button
                    onClick={() => setShowStakeModal(true)}
                    className="py-2 px-6 rounded-xl text-sm font-bold text-black bg-green-500 hover:bg-green-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                  >
                    Stake ({selectedNFTs.length})
                  </button>
                ) : (
                  <button
                    onClick={() => setShowUnstakeModal(true)}
                    className="py-2 px-6 rounded-xl text-sm font-bold text-black bg-red-500 hover:bg-red-400 transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                  >
                    Unstake ({selectedNFTs.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* NFT Grid */}
          <NFTDisplay
            nfts={currentNFTs}
            stakedNFTs={stakedNFTs}
            selectedNFTs={selectedNFTs}
            setSelectedNFTs={setSelectedNFTs}
            collectionFilter={collectionFilter}
            isStakedView={activeTab === 'staked'}
            loading={loadingNFTs}
            collections={collections}
            walletNFTs={walletNFTs}
          />
        </div>
      </main>

      {/* Stake Modal */}
      {showStakeModal && (
        <StakeModal
          selectedNFTs={selectedNFTs}
          walletNFTs={unstakedNFTs}
          collections={collections}
          onSuccess={handleSuccess}
          onClose={() => setShowStakeModal(false)}
        />
      )}

      {/* Unstake Modal */}
      {showUnstakeModal && (
        <UnstakeModal
          selectedNFTs={selectedNFTs}
          stakedNFTs={stakedNFTs}
          onSuccess={handleSuccess}
          onClose={() => setShowUnstakeModal(false)}
        />
      )}
    </div>
  );
};

export default Staking;
