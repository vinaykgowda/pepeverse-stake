// frontend/src/context/WalletContext.jsx

import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import walletService from '../services/wallet';
import api from '../services/api';
import heliusService from '../services/helius';

// Create context
const WalletContext = createContext();

// Custom hook to use wallet context
export const useWallet = () => useContext(WalletContext);

// Wallet provider component
export const WalletProvider = ({ children }) => {
  // State
  const [connected, setConnected] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collections, setCollections] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Refs to prevent infinite loops
  const loadingCollectionsRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // Memoize wallet admin status to prevent recreating dependencies
  const isAdmin = useMemo(() => wallet?.isAdmin || false, [wallet?.isAdmin]);

  // FIXED: Load collections with proper dependency management
  const loadCollections = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingCollectionsRef.current || !connected) {
      return;
    }

    try {
      loadingCollectionsRef.current = true;
      console.log('🔄 Loading collections...');

      // First try to get collections from the public endpoint
      try {
        const response = await api.nft.getCollections();
        setCollections(response.data.data || []);
        console.log('✅ Loaded collections from public endpoint');
        return;
      } catch (publicEndpointError) {
        console.log('Public collections endpoint failed, trying admin endpoint...');
      }

      // If that fails and the user is admin, try the admin endpoint
      if (isAdmin) {
        try {
          const response = await api.admin.getCollections();
          setCollections(response.data.data || []);
          console.log('✅ Loaded collections from admin endpoint');
        } catch (adminError) {
          console.error('Admin collections endpoint also failed:', adminError);
          setCollections([]); // Set empty array as fallback
        }
      } else {
        setCollections([]); // Set empty array if not admin and public failed
      }
    } catch (error) {
      console.error('Error loading collections:', error);
      setError('Failed to load collections. Please try again.');
      setCollections([]); // Set empty array on error
    } finally {
      loadingCollectionsRef.current = false;
    }
  }, [connected, isAdmin]); // Only depend on connected and isAdmin

  // FIXED: Load collections effect with proper dependencies
  useEffect(() => {
    // Only load if connected and haven't done initial load
    if (connected && !initialLoadDoneRef.current) {
      loadCollections().then(() => {
        initialLoadDoneRef.current = true;
      });
    }

    // Reset initial load flag when disconnected
    if (!connected) {
      initialLoadDoneRef.current = false;
      setCollections([]);
    }
  }, [connected, loadCollections, refreshTrigger]);

  // FIXED: Connect wallet with better state management
  const connect = useCallback(async (walletName) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔗 Connecting wallet:', walletName);

      // Initialize wallet
      const initResult = await walletService.initWallet(walletName);

      if (!initResult.success) {
        throw new Error(initResult.message);
      }

      // Check if we already have a valid token for this wallet
      const existingToken = localStorage.getItem('token');
      const existingUser = localStorage.getItem('user');
      let authUser = null;

      if (existingToken && existingUser) {
        try {
          // Decode JWT to check expiry (without verifying signature — server will reject if invalid)
          const payload = JSON.parse(atob(existingToken.split('.')[1]));
          const isExpired = payload.exp && Date.now() / 1000 > payload.exp;
          const isSameWallet = payload.walletAddress === initResult.publicKey;

          if (!isExpired && isSameWallet) {
            // Reuse existing session — no need to re-sign
            authUser = JSON.parse(existingUser);
            window.dispatchEvent(new Event('wallet-auth'));
            console.log('✅ Reusing existing session');
          }
        } catch (e) {
          // Token malformed — fall through to re-sign
        }
      }

      if (!authUser) {
        // Sign and verify message
        const authResult = await walletService.signAndVerify();
        if (!authResult.success) {
          throw new Error(authResult.message);
        }
        authUser = authResult.user;
      }

      // Set wallet state
      const newWallet = {
        publicKey: initResult.publicKey,
        adapter: initResult.adapter,
        isAdmin: authUser.isAdmin
      };

      setWallet(newWallet);
      setConnected(true);

      console.log('✅ Wallet connected successfully');
      return { success: true };
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError(error.message || 'Failed to connect wallet. Please try again.');

      // Disconnect wallet on error
      await walletService.disconnectWallet();
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies needed

  // FIXED: Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      setLoading(true);

      await walletService.disconnectWallet();

      setWallet(null);
      setConnected(false);
      setCollections([]);
      setError(null);
      initialLoadDoneRef.current = false;

      console.log('✅ Wallet disconnected');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setError(error.message || 'Failed to disconnect wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // FIXED: Load user NFTs with stable dependencies
  const loadUserNFTs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const userNFTsResult = await walletService.getUserNFTs(collections);

      if (!userNFTsResult.success) {
        throw new Error(userNFTsResult.message);
      }

      return userNFTsResult.data;
    } catch (error) {
      console.error('Error loading user NFTs:', error);
      setError(error.message || 'Failed to load NFTs. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [collections]); // Only depend on collections

  // FIXED: Get user's staked NFTs using the backend API
  const getStakedNFTs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Getting staked NFTs from backend...');
      const response = await api.nft.getStakedNFTs();

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      const stakedNFTs = response.data.data || [];
      console.log(`✅ Retrieved ${stakedNFTs.length} staked NFTs from backend`);

      return stakedNFTs;
    } catch (error) {
      console.error('Error getting staked NFTs:', error);
      setError(error.message || 'Failed to get staked NFTs. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies needed

  // Get staking stats
  const getStakingStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.staking.getStakingStats();
      return response.data.data;
    } catch (error) {
      console.error('Error getting staking stats:', error);
      setError(error.message || 'Failed to get staking stats. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate rewards
  const calculateRewards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.staking.calculateRewards();
      return response.data.data;
    } catch (error) {
      console.error('Error calculating rewards:', error);
      setError(error.message || 'Failed to calculate rewards. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get claim quote
  const getClaimQuote = useCallback(async () => {
    try {
      setError(null);

      console.log('📋 WalletContext: Getting claim quote...');
      const response = await api.staking.getClaimQuote();
      console.log('📋 WalletContext: Quote response:', response);

      return response.data;
    } catch (error) {
      console.error('❌ WalletContext: Error getting claim quote:', error);
      const msg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to get claim quote';
      return {
        success: false,
        message: msg
      };
    }
  }, []);

  // Claim rewards with optional payment signature
  const claimRewards = useCallback(async (paymentSignature = null) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🎯 WalletContext: Starting claim with payment signature:', paymentSignature);
      const response = await api.staking.claimRewards(paymentSignature);
      console.log('🎯 WalletContext: Response:', response);

      // Refresh data after successful claim
      setRefreshTrigger(prev => prev + 1);

      return response.data;
    } catch (error) {
      console.error('❌ WalletContext: Error claiming rewards:', error);

      // Handle different error statuses
      if (error.response?.status === 402) {
        // Payment required
        return {
          success: false,
          message: error.response.data.message,
          requires_payment: true,
          quote: error.response.data.quote
        };
      }

      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Stake NFTs with payment signature support
  const stakeNFTs = useCallback(async (nfts, collectionId, paymentSignature = null) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.nft.stakeNFTs(nfts, collectionId, paymentSignature);

      // Refresh
      setRefreshTrigger(prev => prev + 1);

      return response.data;
    } catch (error) {
      console.error('❌ Error staking NFTs:', error);
      setError(error.message || 'Failed to stake NFTs. Please try again.');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Get staking quote
  const getStakingQuote = useCallback(async (nfts, collectionId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.nft.getStakeQuote({ nfts, collectionId });
      return response.data;
    } catch (error) {
      console.error('❌ Error getting staking quote:', error);
      setError(error.message || 'Failed to get staking quote. Please try again.');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Unstake NFTs
  const unstakeNFTs = useCallback(async (nftIds) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.nft.unstakeNFTs(nftIds);

      // Refresh
      setRefreshTrigger(prev => prev + 1);

      return response.data;
    } catch (error) {
      console.error('Error unstaking NFTs:', error);
      setError(error.message || 'Failed to unstake NFTs. Please try again.');
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Get transaction history
  const getTransactionHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.staking.getTransactionHistory();
      return response.data.data;
    } catch (error) {
      console.error('Error getting transaction history:', error);
      setError(error.message || 'Failed to get transaction history. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refresh data
  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // FIXED: Memoize context value with stable dependencies
  const contextValue = useMemo(() => ({
    connected,
    wallet,
    loading,
    error,
    collections,
    connect,
    disconnect,
    loadUserNFTs,
    getStakedNFTs,
    getStakingStats,
    calculateRewards,
    getClaimQuote,
    claimRewards,
    stakeNFTs,
    getStakingQuote,
    unstakeNFTs,
    getTransactionHistory,
    clearError,
    refresh
  }), [
    connected,
    wallet,
    loading,
    error,
    collections,
    connect,
    disconnect,
    loadUserNFTs,
    getStakedNFTs,
    getStakingStats,
    calculateRewards,
    getClaimQuote,
    claimRewards,
    stakeNFTs,
    getStakingQuote,
    unstakeNFTs,
    getTransactionHistory,
    clearError,
    refresh
  ]);

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletContext;