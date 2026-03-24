// frontend/src/pages/Staking.jsx - UPDATED WITH TAB SYSTEM

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import NFTDisplay from '../components/User/NFTDisplay';
import StakingPanel from '../components/User/StakingPanel';
import StakingStats from '../components/User/StakingStats';
import RewardsPanel from '../components/User/RewardsPanel';
import WalletConnect from '../components/User/WalletConnect';

const Staking = () => {
  const {
    connected,
    loading,
    collections,
    loadUserNFTs,
    getStakedNFTs
  } = useWallet();

  // State
  const [selectedNFTs, setSelectedNFTs] = useState([]);
  const [walletNFTs, setWalletNFTs] = useState([]);
  const [stakedNFTs, setStakedNFTs] = useState([]);
  const [activeTab, setActiveTab] = useState('wallet'); // 'wallet' or 'staked'
  const [collectionFilter, setCollectionFilter] = useState('');
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  // Load both wallet and staked NFTs - memoized to prevent recreation
  const loadNFTs = useCallback(async () => {
    try {
      setLoadingNFTs(true);

      // Load wallet NFTs and staked NFTs in parallel
      const [walletData, stakedData] = await Promise.all([
        loadUserNFTs(),
        getStakedNFTs()
      ]);

      setWalletNFTs(walletData || []);
      setStakedNFTs(stakedData || []);

      console.log('Loaded NFTs:', {
        wallet: walletData?.length || 0,
        staked: stakedData?.length || 0
      });
    } catch (error) {
      console.error('Error loading NFTs:', error);
    } finally {
      setLoadingNFTs(false);
    }
  }, [loadUserNFTs, getStakedNFTs]); // Memoize with stable dependencies

  // Load NFTs on connection
  useEffect(() => {
    if (connected && collections.length > 0) {
      loadNFTs();
    }
  }, [connected, collections.length, loadNFTs]); // Use collections.length instead of collections array

  // Create staked mint addresses set for filtering - memoized to prevent recreation
  const stakedMintAddresses = React.useMemo(() => {
    return new Set(
      stakedNFTs.map(nft => nft.mintAddress || nft.mint_address)
    );
  }, [stakedNFTs]);

  // Filter wallet NFTs to show only unstaked ones - memoized
  const unstakedNFTs = React.useMemo(() => {
    return walletNFTs.filter(nft =>
      !stakedMintAddresses.has(nft.mintAddress)
    );
  }, [walletNFTs, stakedMintAddresses]);

  // Handle tab change - memoized
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedNFTs([]); // Clear selections when switching tabs
  }, []); // No dependencies

  // Handle successful staking - memoized
  const handleStakeSuccess = useCallback(() => {
    loadNFTs(); // Reload all NFTs
    setSelectedNFTs([]); // Clear selections
  }, [loadNFTs]); // Depend on loadNFTs

  // Handle successful unstaking - memoized
  const handleUnstakeSuccess = useCallback(() => {
    loadNFTs(); // Reload all NFTs
    setSelectedNFTs([]); // Clear selections
  }, [loadNFTs]); // Depend on loadNFTs

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center">
        <div className="max-w-md w-full">
          <WalletConnect />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f0a]">
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🐸</span>
            <h1 className="text-3xl font-bold text-green-400 tracking-tight">NFT Staking</h1>
          </div>
          <p className="text-green-700 ml-14">Stake your Pepe Gods and earn rewards</p>
        </div>

        {/* Stats Section */}
        <div className="mb-8">
          <StakingStats />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left side - NFT Management with Tabs */}
          <div className="lg:col-span-2">
            <div className="bg-[#111a11] border border-[#1e3a1e] rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.08)] p-6">
              {/* Tab Navigation */}
              <div className="flex space-x-1 bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-1 mb-6">
                <button
                  onClick={() => handleTabChange('wallet')}
                  className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === 'wallet'
                      ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                      : 'text-green-700 hover:text-green-400'
                  }`}
                >
                  Available ({unstakedNFTs.length})
                </button>
                <button
                  onClick={() => handleTabChange('staked')}
                  className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === 'staked'
                      ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                      : 'text-green-700 hover:text-green-400'
                  }`}
                >
                  Staked ({stakedNFTs.length})
                </button>
              </div>

              {/* Collection Filter */}
              <div className="flex justify-between items-center mb-6">
                <select
                  value={collectionFilter}
                  onChange={(e) => setCollectionFilter(e.target.value)}
                  className="px-3 py-2 bg-[#0d1a0d] border border-[#1e3a1e] text-green-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-green-600 text-sm"
                >
                  <option value="">All Collections</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>

                {selectedNFTs.length > 0 && (
                  <div className="text-xs text-green-600 bg-green-950/50 border border-green-800 px-3 py-1 rounded-full">
                    {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>

              {/* NFT Display */}
              <NFTDisplay
                nfts={activeTab === 'wallet' ? unstakedNFTs : stakedNFTs}
                stakedNFTs={stakedNFTs}
                selectedNFTs={selectedNFTs}
                setSelectedNFTs={setSelectedNFTs}
                collectionFilter={collectionFilter}
                isStakedView={activeTab === 'staked'}
                loading={loadingNFTs}
                collections={collections}
              />
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="space-y-6">
            {activeTab === 'wallet' && (
              <StakingPanel
                selectedNFTs={selectedNFTs}
                setSelectedNFTs={setSelectedNFTs}
                onStakeSuccess={handleStakeSuccess}
                collections={collections}
                walletNFTs={unstakedNFTs}
                stakedNFTs={stakedNFTs}
              />
            )}

            {activeTab === 'staked' && (
              <UnstakingPanel
                selectedNFTs={selectedNFTs}
                setSelectedNFTs={setSelectedNFTs}
                onUnstakeSuccess={handleUnstakeSuccess}
                stakedNFTs={stakedNFTs}
              />
            )}

            <RewardsPanel />
          </div>
        </div>
      </main>
    </div>
  );
};

// Simple Unstaking Panel Component
const UnstakingPanel = ({
  selectedNFTs,
  setSelectedNFTs,
  onUnstakeSuccess,
  stakedNFTs
}) => {
  const { unstakeNFTs, loading } = useWallet();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState('');
  const [estimatedTime, setEstimatedTime] = useState(0);

  // Memoize handleUnstake to prevent recreation
  const handleUnstake = useCallback(() => {
    if (selectedNFTs.length === 0) {
      setError('Please select at least one NFT to unstake');
      return;
    }
    setShowConfirm(true);
  }, [selectedNFTs.length]);

  // Memoize handleConfirmUnstake
  const handleConfirmUnstake = useCallback(async () => {
    try {
      setProcessing(true);
      setError(null);
      setTransactionStatus('Processing unstake transaction...');
      setEstimatedTime(20); // Estimated 20 seconds

      const result = await unstakeNFTs(selectedNFTs);

      if (result.success) {
        setTransactionStatus('Transaction confirmed!');
        setSuccess(`Successfully unstaked ${selectedNFTs.length} NFTs!`);
        setSelectedNFTs([]);
        setShowConfirm(false);

        if (onUnstakeSuccess) {
          onUnstakeSuccess();
        }
      } else {
        setError(result.message || 'Failed to unstake NFTs');
      }
    } catch (error) {
      console.error('Error unstaking NFTs:', error);
      setError(error.message || 'An error occurred while unstaking NFTs');
      setTransactionStatus('');
    } finally {
      setProcessing(false);
      setTransactionStatus('');
      setEstimatedTime(0);
    }
  }, [selectedNFTs, unstakeNFTs, onUnstakeSuccess, setSelectedNFTs]);

  // Memoize clearMessages
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  // Memoize getNFTName
  const getNFTName = useCallback((nftId) => {
    const nft = stakedNFTs.find(n => n.id === nftId);
    return nft ? nft.name : `NFT #${nftId}`;
  }, [stakedNFTs]);

  return (
    <div className="bg-[#111a11] border border-[#1e3a1e] rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.1)] p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xl">🔓</span>
        <h3 className="text-lg font-semibold text-green-400 tracking-wide">Unstaking</h3>
      </div>

      {error && (
        <div className="bg-red-950/60 border border-red-700 text-red-400 px-4 py-3 rounded-xl mb-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="font-semibold mb-1 text-red-300">Unstake Failed</p>
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={clearMessages} className="ml-4 text-red-500 hover:text-red-300 transition-colors">
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {!showConfirm && selectedNFTs.length > 0 && (
            <button onClick={handleUnstake} className="mt-3 text-sm font-medium text-red-400 hover:text-red-300 underline">
              Try again
            </button>
          )}
        </div>
      )}

      {success && (
        <div className="bg-green-950/60 border border-green-700 text-green-400 px-4 py-3 rounded-xl mb-4 relative">
          <span className="block sm:inline">{success}</span>
          <button onClick={clearMessages} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-green-500 hover:text-green-300">
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold text-green-600 uppercase tracking-widest">Selected NFTs</span>
          <span className="text-xs text-green-700 bg-green-950/50 border border-green-800 px-2 py-0.5 rounded-full">
            {selectedNFTs.length} selected
          </span>
        </div>
        <div className="p-3 border border-[#1e3a1e] rounded-xl bg-[#0d1a0d] min-h-[100px] max-h-[200px] overflow-y-auto">
          {selectedNFTs.length > 0 ? (
            <div className="space-y-1">
              {selectedNFTs.map((nftId) => (
                <div
                  key={nftId}
                  className="flex justify-between items-center px-3 py-1.5 bg-[#111a11] border border-[#1e3a1e] rounded-lg text-xs hover:border-green-700 transition-colors"
                >
                  <span className="font-medium text-green-300 truncate">
                    {getNFTName(nftId)}
                  </span>
                  <span className="text-green-700 ml-2">
                    ID: {nftId}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[80px]">
              <p className="text-sm text-green-800">No staked NFTs selected</p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleUnstake}
        disabled={loading || selectedNFTs.length === 0 || processing}
        className="w-full py-3 px-4 rounded-xl text-sm font-bold text-black bg-red-500 hover:bg-red-400 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] disabled:bg-red-950 disabled:text-red-800 disabled:shadow-none disabled:cursor-not-allowed"
      >
        {processing ? 'Processing...' : `Unstake ${selectedNFTs.length} NFTs`}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm"></div>

          <div className="relative bg-[#111a11] border border-[#1e3a1e] rounded-2xl shadow-[0_0_60px_rgba(34,197,94,0.2)] max-w-md w-full mx-auto p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">🔓</span>
              <h3 className="text-lg font-semibold text-green-400">Confirm Unstaking</h3>
            </div>

            {processing ? (
              <div className="mb-4">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-500 mb-4"></div>
                  <p className="text-lg font-medium text-green-300 mb-2">{transactionStatus}</p>
                  {estimatedTime > 0 && (
                    <p className="text-sm text-green-700">Estimated time: ~{estimatedTime} seconds</p>
                  )}
                  <p className="text-xs text-green-800 mt-4 text-center">
                    Please do not close this window or refresh the page
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-5">
                <p className="text-sm text-gray-400 mb-3">
                  You are about to unstake {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? 's' : ''}.
                </p>
                <p className="text-sm text-gray-500">
                  This will return the NFTs to your wallet. Are you sure you want to continue?
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={processing}
                className="py-2 px-5 border border-[#1e3a1e] rounded-xl text-sm font-medium text-gray-400 bg-[#0d1a0d] hover:border-green-700 hover:text-green-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmUnstake}
                disabled={processing}
                className="py-2 px-5 rounded-xl text-sm font-bold text-black bg-red-500 hover:bg-red-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] disabled:bg-red-950 disabled:text-red-800 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {processing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black mr-2"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  'Confirm Unstaking'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staking;