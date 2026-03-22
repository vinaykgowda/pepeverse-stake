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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <WalletConnect />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">NFT Staking</h1>
          <p className="mt-2 text-gray-600">
            Stake your NFTs to earn rewards
          </p>
        </div>

        {/* Stats Section */}
        <div className="mb-8">
          <StakingStats />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left side - NFT Management with Tabs */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              {/* Tab Navigation */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
                <button
                  onClick={() => handleTabChange('wallet')}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'wallet'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Available ({unstakedNFTs.length})
                </button>
                <button
                  onClick={() => handleTabChange('staked')}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'staked'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
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
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Collections</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>

                {selectedNFTs.length > 0 && (
                  <div className="text-sm text-gray-500">
                    {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>

              {/* NFT Display with proper filtering */}
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
            {/* Staking Panel - only show for wallet tab */}
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

            {/* Unstaking Panel - only show for staked tab */}
            {activeTab === 'staked' && (
              <UnstakingPanel
                selectedNFTs={selectedNFTs}
                setSelectedNFTs={setSelectedNFTs}
                onUnstakeSuccess={handleUnstakeSuccess}
                stakedNFTs={stakedNFTs}
              />
            )}

            {/* Rewards Panel */}
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Unstaking</h3>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="font-medium mb-1">Unstake Failed</p>
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={clearMessages} className="ml-4 text-red-700 hover:text-red-900">
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {!showConfirm && selectedNFTs.length > 0 && (
            <button
              onClick={handleUnstake}
              className="mt-3 text-sm font-medium text-red-700 hover:text-red-900 underline"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 relative">
          <span className="block sm:inline">{success}</span>
          <button onClick={clearMessages} className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">Selected NFTs</span>
          <span className="text-sm text-gray-500">{selectedNFTs.length} selected</span>
        </div>
        <div className="p-3 border border-gray-300 rounded-md bg-gray-50 min-h-[100px] max-h-[200px] overflow-y-auto">
          {selectedNFTs.length > 0 ? (
            <div className="space-y-1">
              {selectedNFTs.map((nftId) => (
                <div
                  key={nftId}
                  className="flex justify-between items-center px-2 py-1 bg-white border border-gray-200 rounded text-xs"
                >
                  <span className="font-medium text-gray-900 truncate">
                    {getNFTName(nftId)}
                  </span>
                  <span className="text-gray-500 ml-2">
                    ID: {nftId}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-500">No staked NFTs selected</p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleUnstake}
        disabled={loading || selectedNFTs.length === 0 || processing}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300 disabled:cursor-not-allowed"
      >
        {processing ? 'Processing...' : `Unstake ${selectedNFTs.length} NFTs`}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50"></div>

          <div className="relative bg-white rounded-lg max-w-md w-full mx-auto p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Unstaking</h3>

            {processing ? (
              /* Loading State */
              <div className="mb-4">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mb-4"></div>
                  <p className="text-lg font-medium text-gray-900 mb-2">{transactionStatus}</p>
                  {estimatedTime > 0 && (
                    <p className="text-sm text-gray-500">
                      Estimated time: ~{estimatedTime} seconds
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-4 text-center">
                    Please do not close this window or refresh the page
                  </p>
                </div>
              </div>
            ) : (
              /* Confirmation State */
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-3">
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
                className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmUnstake}
                disabled={processing}
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  `Confirm Unstaking`
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