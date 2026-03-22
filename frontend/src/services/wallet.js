// frontend/src/services/wallet.js - UPDATED VERSION

import { PublicKey } from '@solana/web3.js';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import api from './api';
import heliusService from './helius';
import networkConfig from '../config/network';

// Import Buffer polyfill for browser environment
import { Buffer } from 'buffer';

// Supported wallets - configured for mainnet (Requirements 2.2, 23.2)
const SUPPORTED_WALLETS = [
  new PhantomWalletAdapter({ network: WalletAdapterNetwork.Mainnet }),
  new SolflareWalletAdapter({ network: WalletAdapterNetwork.Mainnet })
];

// Current connected wallet
let currentWallet = null;

// Initialize wallet
const initWallet = async (walletName) => {
  try {
    console.log(`Initializing wallet: ${walletName}`);

    // Find requested wallet adapter
    const walletAdapter = SUPPORTED_WALLETS.find(
      adapter => adapter.name.toLowerCase() === walletName.toLowerCase()
    );

    if (!walletAdapter) {
      throw new Error(`Wallet "${walletName}" not supported`);
    }

    // Connect to wallet
    await walletAdapter.connect();
    console.log('Wallet connected successfully');

    // Set current wallet
    currentWallet = walletAdapter;

    return {
      success: true,
      publicKey: walletAdapter.publicKey.toString(),
      adapter: walletAdapter
    };
  } catch (error) {
    console.error('Error initializing wallet:', error);

    return {
      success: false,
      message: error.message || 'Failed to initialize wallet'
    };
  }
};

// Disconnect wallet
const disconnectWallet = async () => {
  try {
    if (currentWallet) {
      await currentWallet.disconnect();
      currentWallet = null;
    }

    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Clear NFT cache
    heliusService.clearCache();

    return {
      success: true
    };
  } catch (error) {
    console.error('Error disconnecting wallet:', error);

    return {
      success: false,
      message: error.message || 'Failed to disconnect wallet'
    };
  }
};

// Sign and verify message for authentication
const signAndVerify = async () => {
  try {
    console.log('Starting signAndVerify process');

    if (!currentWallet || !currentWallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const walletAddress = currentWallet.publicKey.toString();
    console.log(`Wallet address: ${walletAddress}`);

    // Get nonce from server
    console.log('Requesting nonce from server');
    const nonceResponse = await api.auth.getNonce(walletAddress);
    const nonce = nonceResponse.data.nonce;
    console.log(`Received nonce: ${nonce}`);

    // Encode message
    const message = nonce;
    const encodedMessage = new TextEncoder().encode(message);
    console.log('Message encoded for signing');

    // Sign message
    console.log('Requesting signature from wallet');
    const signatureBytes = await currentWallet.signMessage(encodedMessage);
    console.log('Message signed successfully');

    // Convert signature to base64 for transmission
    const signature = Buffer.from(signatureBytes).toString('base64');
    console.log(`Signature (base64): ${signature}`);

    // Log verification request
    console.log('Sending verification request with:', {
      walletAddress,
      signature: signature.substring(0, 20) + '...',  // Show just beginning for privacy
      message
    });

    // Verify signature on server and get token
    const verifyResponse = await api.auth.verifySignature(
      walletAddress,
      signature,
      message
    );

    console.log('Verification response:', verifyResponse.data);

    // Store token and user info
    localStorage.setItem('token', verifyResponse.data.token);
    localStorage.setItem('user', JSON.stringify(verifyResponse.data.user));
    console.log('User authenticated and token stored');

    return {
      success: true,
      user: verifyResponse.data.user
    };
  } catch (error) {
    console.error('Error signing and verifying message:', error);

    // More detailed error logging
    if (error.response) {
      console.error('Server response error:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    return {
      success: false,
      message: error.message || 'Failed to authenticate wallet'
    };
  }
};

// Get user NFTs using Helius API
const getUserNFTs = async (collections) => {
  try {
    if (!currentWallet || !currentWallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const walletAddress = currentWallet.publicKey.toString();
    console.log('Fetching NFTs for wallet:', walletAddress);

    if (!collections || collections.length === 0) {
      console.log('No collections available');
      return {
        success: true,
        data: []
      };
    }

    // Use Helius service to get NFTs for all collections
    const nfts = await heliusService.getNFTsForCollections(walletAddress, collections);

    console.log(`Found ${nfts.length} NFTs across ${collections.length} collections`);

    return {
      success: true,
      data: nfts
    };
  } catch (error) {
    console.error('Error getting user NFTs:', error);

    return {
      success: false,
      message: error.message || 'Failed to get user NFTs'
    };
  }
};

// FIXED: Enhanced getStakedNFTs function
const getStakedNFTs = async () => {
  try {
    console.log('🔄 [WALLET] Starting getStakedNFTs...');

    if (!currentWallet || !currentWallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    // Get staked NFTs from the backend API
    const response = await api.nft.getStakedNFTs();
    console.log('🔄 [WALLET] Backend API response:', response);

    if (!response.data.success) {
      throw new Error(response.data.message);
    }

    const stakedNFTs = response.data.data || [];
    console.log(`🔄 [WALLET] Found ${stakedNFTs.length} staked NFTs from backend`);

    if (stakedNFTs.length === 0) {
      return {
        success: true,
        data: []
      };
    }

    // The backend should already have tried to get images from cache
    // But let's enhance them further if possible
    const enhancedNFTs = await Promise.all(stakedNFTs.map(async (nft) => {
      console.log(`🖼️ [WALLET] Processing NFT: ${nft.mintAddress}`);

      let image = nft.image;
      let name = nft.name;

      // If we still have a placeholder image, try to get it from current wallet's cache
      if (image && image.includes('placeholder')) {
        console.log(`🔍 [WALLET] Trying to enhance placeholder image for ${nft.mintAddress}`);

        // Check if we have this NFT in our current Helius cache
        if (heliusService.nftCache && heliusService.nftCache.size > 0) {
          for (const [cacheKey, cachedData] of heliusService.nftCache) {
            if (cachedData?.data?.items && Array.isArray(cachedData.data.items)) {
              const found = cachedData.data.items.find(item => item.id === nft.mintAddress);
              if (found) {
                console.log(`✅ [WALLET] Found enhanced data for ${nft.mintAddress}`);
                const transformed = heliusService.transformNFTData(found);
                image = transformed.image;
                name = transformed.name || name;
                break;
              }
            }
          }
        }

        // If still placeholder, try to fetch fresh data for this specific NFT
        if (image.includes('placeholder')) {
          console.log(`🚀 [WALLET] Fetching fresh data for ${nft.mintAddress}`);
          try {
            // Get the current wallet address to search through their cached NFTs
            const walletAddress = currentWallet.publicKey.toString();

            // Search through all cached NFT data for this mint address
            if (heliusService.nftCache) {
              for (const [cacheKey, cachedData] of heliusService.nftCache) {
                if (cacheKey.includes(walletAddress) && cachedData?.data?.items) {
                  const found = cachedData.data.items.find(item => item.id === nft.mintAddress);
                  if (found) {
                    console.log(`✅ [WALLET] Found NFT in wallet cache: ${nft.mintAddress}`);
                    const transformed = heliusService.transformNFTData(found);
                    image = transformed.image;
                    name = transformed.name || name;
                    break;
                  }
                }
              }
            }
          } catch (fetchError) {
            console.log(`⚠️ [WALLET] Could not fetch fresh data for ${nft.mintAddress}:`, fetchError);
          }
        }
      }

      return {
        ...nft,
        image,
        name,
        // Ensure all required fields are present
        id: nft.id,
        mintAddress: nft.mintAddress,
        collectionId: nft.collectionId,
        collectionName: nft.collectionName,
        stakeTimestamp: nft.stakeTimestamp,
        traits: nft.traits || [],
        isStaked: true
      };
    }));

    console.log(`✅ [WALLET] Enhanced ${enhancedNFTs.length} staked NFTs`);

    return {
      success: true,
      data: enhancedNFTs
    };
  } catch (error) {
    console.error('❌ [WALLET] Error getting staked NFTs:', error);
    return {
      success: false,
      message: error.message || 'Failed to get staked NFTs',
      data: []
    };
  }
};

// Check if user is authenticated
const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

// Get current user
const getCurrentUser = () => {
  const userJson = localStorage.getItem('user');
  return userJson ? JSON.parse(userJson) : null;
};

// Check if user is admin
const isAdmin = () => {
  const user = getCurrentUser();
  return user && user.isAdmin;
};

export default {
  initWallet,
  disconnectWallet,
  signAndVerify,
  getUserNFTs,
  getStakedNFTs,
  isAuthenticated,
  getCurrentUser,
  isAdmin,
  get currentWallet() {
    return currentWallet;
  }
};