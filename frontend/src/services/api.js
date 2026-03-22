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
    if (adminToken && config.url.includes('/admin')) {
      config.headers['Authorization'] = `Bearer ${adminToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Check which type of auth failed
      if (error.config.url.includes('/admin')) {
        // Admin token expired
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        window.location.href = '/admin/login?timeout=true';
      } else {
        // Wallet token expired
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/?timeout=true';
      }
    }
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

  getTransactionHistory: () => api.get('/transactions')
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
  updateSettings: (settings) => api.put('/admin/settings', { settings })
};

export default {
  auth: authApi,
  nft: nftApi,
  staking: stakingApi,
  admin: adminApi
};