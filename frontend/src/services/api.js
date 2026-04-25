// frontend/src/services/api.js - Updated for StakingPanel compatibility

import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to add auth tokens
api.interceptors.request.use(
  (config) => {
    // Check for wallet token first (for user routes)
    const walletToken = localStorage.getItem('token');
    if (walletToken) {
      config.headers['x-auth-token'] = walletToken;
    }

    // Check for admin token (for admin routes)
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      if (config.url.includes('/admin')) {
        config.headers['Authorization'] = `Bearer ${adminToken}`;
      }
      // Also set x-auth-token for admin so non-/admin routes (e.g. PUT /collections/:id) work
      if (!walletToken) {
        config.headers['x-auth-token'] = adminToken;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Don't auto-redirect on 401 - let the component handle it
    return Promise.reject(error);
  }
);

// Authentication API calls
const authApi = {
  getNonce: (wallet) => api.post('/auth/nonce', { wallet }),
  verifySignature: (wallet, signature, message) =>
    api.post('/auth/verify', { wallet, signature, message }),
  adminLogin: (username, password) =>
    api.post('/auth/admin/login', { username, password })
};

// NFT API calls
const nftApi = {
  getStakedNFTs: () => api.get('/nfts/staked'),

  // Updated stakeNFTs to support payment signature
  stakeNFTs: (nfts, collectionId, paymentSignature = null) => {
    const payload = { nfts, collectionId };
    if (paymentSignature) {
      payload.paymentSignature = paymentSignature;
    }
    console.log('🚀 API call stakeNFTs:', payload);
    return api.post('/nfts/stake', payload);
  },

  // FIXED: Function to get staking quote - ensuring it matches what StakingPanel expects
  getStakeQuote: (data) => {
    console.log('📋 API call getStakeQuote:', data);
    return api.post('/nfts/stake/quote', data);
  },

  // Function to execute staking with payment
  executeStaking: (data) => {
    console.log('⚡ API call executeStaking:', data);
    return api.post('/nfts/stake/execute', data);
  },

  unstakeNFTs: (nftIds) => api.post('/nfts/unstake', { nftIds }),

  // Add the public collections endpoint for staking
  getCollections: () => api.get('/collections')
};

// Staking API calls
const stakingApi = {
  getStakingStats: () => api.get('/staking/stats'),
  getGlobalStats: () => api.get('/staking/global-stats'),
  calculateRewards: () => api.get('/rewards/calculate'),

  // NEW: Get claim quote (includes fees)
  getClaimQuote: () => api.get('/rewards/quote'),

  // UPDATED: Claim rewards with optional payment signature
  claimRewards: (paymentSignature = null) => {
    const payload = {};
    if (paymentSignature) {
      payload.paymentSignature = paymentSignature;
    }
    return api.post('/rewards/claim', payload);
  },

  getTransactionHistory: () => api.get('/transactions'),
  getPerNftEarnings: () => api.get('/rewards/per-nft'),
  refreshTraits: () => api.post('/nfts/refresh-traits'),
};

// Admin API calls
const adminApi = {
  // Collections
  getCollections: () => api.get('/admin/collections'),

  addCollection: (formData) =>
    api.post('/admin/collections', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  updateCollection: (id, collection) => {
    // Check if collection is FormData
    if (collection instanceof FormData) {
      return api.put(`/collections/${id}`, collection, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    }
    return api.put(`/collections/${id}`, collection);
  },

  deleteCollection: (id) => api.delete(`/admin/collections/${id}`),
  updateProfile: (id, profileData) => api.put(`/admin/profile/${id}`, profileData),
  getDashboardStats: () => api.get('/admin/dashboard'),

  // Rewards
  getRewardsBreakdown: () => api.get('/admin/rewards-breakdown'),
  getTokenPrices: (ids) => api.get(`/admin/token-prices?ids=${ids.join(',')}`),
  getRewards: () => api.get('/admin/rewards'),
  addReward: (reward) => api.post('/admin/rewards', reward),
  updateReward: (id, reward) => api.put(`/admin/rewards/${id}`, reward),
  deleteReward: (id) => api.delete(`/admin/rewards/${id}`),

  // Trait Rewards
  getTraitRewards: () => api.get('/admin/trait-rewards'),
  addTraitReward: (reward) => api.post('/admin/trait-rewards', reward),
  updateTraitReward: (id, reward) => api.put(`/admin/trait-rewards/${id}`, reward),
  deleteTraitReward: (id) => api.delete(`/admin/trait-rewards/${id}`),

  // Admins
  getAdmins: () => api.get('/admin/managers'),
  addAdmin: (admin) => api.post('/admin/managers', admin),
  deleteAdmin: (id) => api.delete(`/admin/managers/${id}`),

  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (settings) => api.put('/admin/settings', { settings }),

  // Token Balances
  getTokenBalances: () => api.get('/admin/token-balances'),

  // All tokens (from rewards + trait_rewards)
  getTokens: () => api.get('/admin/tokens'),

  // Airdrops
  getAirdrops: (params) => api.get('/admin/airdrops', { params }),
  previewAirdrop: (data) => api.post('/admin/airdrops/preview', data),
  createAirdrop: (data) => api.post('/admin/airdrops', data),
  updateAirdrop: (id, data) => api.put(`/admin/airdrops/${id}`, data),
  deleteAirdrop: (id) => api.delete(`/admin/airdrops/${id}`),
  activateAirdrop: (id) => api.post(`/admin/airdrops/${id}/activate`),
  deactivateAirdrop: (id) => api.post(`/admin/airdrops/${id}/deactivate`),
  getEligibleWallets: (id) => api.get(`/admin/airdrops/${id}/eligible-wallets`),

  // Claims Analytics
  getClaimsAnalytics: (params) => {
    if (params && params.export === 'csv') {
      return api.get('/admin/analytics/claims', { params, responseType: 'blob' });
    }
    return api.get('/admin/analytics/claims', { params });
  },
  getAirdropClaimsAnalytics: (params) => {
    if (params && params.export === 'csv') {
      return api.get('/admin/analytics/airdrop-claims', { params, responseType: 'blob' });
    }
    return api.get('/admin/analytics/airdrop-claims', { params });
  }
};

// Solana RPC proxy (routes through backend to avoid CORS/rate-limit on public RPC)
const solanaApi = {
  getBlockhash: () => api.get('/solana/blockhash'),
  sendTransaction: (transactionBase64) => api.post('/solana/send-transaction', { transaction: transactionBase64 }),
};

// User-facing airdrop API calls (uses wallet JWT via x-auth-token header)
const userApi = {
  getAirdrops: (walletAddress) => api.get(`/user/airdrops/${walletAddress}`),
  getAirdropQuote: (data) => api.post('/user/airdrops/quote', data),
  claimAirdrop: (data) => api.post('/user/airdrops/claim', data)
};

export default {
  auth: authApi,
  nft: nftApi,
  staking: stakingApi,
  admin: adminApi,
  user: userApi,
  solana: solanaApi
};