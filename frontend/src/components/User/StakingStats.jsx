// frontend/src/components/User/StakingStats.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../../context/WalletContext';

const StakingStats = () => {
  const { loading, getStakingStats, getStakedNFTs, calculateRewards, connected } = useWallet();
  const [stats, setStats] = useState({
    totalStaked: 0,
    stakedByCollection: [],
    totalRewards: 0
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Refs to prevent multiple simultaneous calls
  const loadingStatsRef = useRef(false);

  // Load stats function - memoized to prevent recreating on every render
    const loadStats = useCallback(async () => {
      if (!connected || loadingStatsRef.current) {
        return;
      }

      try {
        loadingStatsRef.current = true;
        setLoadingStats(true);

        console.log('Loading staking stats...');

        // Get staking stats
        const statsData = await getStakingStats();

        // Get staked NFTs
        const stakedNFTs = await getStakedNFTs();

        // Calculate rewards
        const rewards = await calculateRewards();

        // Calculate total rewards
        const totalRewards = rewards?.reduce((total, reward) => total + (reward.amount || 0), 0) || 0;

        const newStats = {
          totalStaked: stakedNFTs?.length || 0,
          stakedByCollection: statsData || [],
          totalRewards
        };

        setStats(newStats);
        setStatsLoaded(true);

        console.log('Staking stats loaded:', newStats);
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoadingStats(false);
        loadingStatsRef.current = false;
      }
    }, [connected, getStakingStats, getStakedNFTs, calculateRewards]);

  // Load stats on mount and when connected changes - but only once
  useEffect(() => {
    if (connected && !statsLoaded && !loadingStatsRef.current) {
      loadStats();
    }

    // Reset stats when disconnected
    if (!connected) {
      setStats({
        totalStaked: 0,
        stakedByCollection: [],
        totalRewards: 0
      });
      setStatsLoaded(false);
    }
  }, [connected, statsLoaded, loadStats]);

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md p-6 text-white">
      <h3 className="text-lg font-medium mb-4">Staking Overview</h3>

      {(loading || loadingStats) && !statsLoaded ? (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <div className="text-sm opacity-80">Total NFTs Staked</div>
            <div className="text-3xl font-bold mt-1">{stats.totalStaked}</div>
          </div>

          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <div className="text-sm opacity-80">Active Collections</div>
            <div className="text-3xl font-bold mt-1">
              {stats.stakedByCollection.filter(col => col.staked_count > 0).length}
            </div>
          </div>

          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <div className="text-sm opacity-80">Total Rewards Value</div>
            <div className="text-3xl font-bold mt-1">{stats.totalRewards.toFixed(4)}</div>
          </div>
        </div>
      )}

      {stats.stakedByCollection.length > 0 && (
        <div className="mt-6">
          <h4 className="text-md font-medium mb-3">Staked by Collection</h4>

          <div className="overflow-hidden bg-white bg-opacity-10 rounded-lg">
            <div className="grid grid-cols-2 text-sm font-medium px-4 py-2 border-b border-white border-opacity-20">
              <div>Collection</div>
              <div className="text-right">Staked</div>
            </div>

            {stats.stakedByCollection
              .filter(collection => collection.staked_count > 0)
              .map((collection) => (
                <div
                  key={collection.id}
                  className="grid grid-cols-2 text-sm px-4 py-2 border-b border-white border-opacity-10 last:border-0"
                >
                  <div>{collection.name}</div>
                  <div className="text-right font-medium">{collection.staked_count}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StakingStats;