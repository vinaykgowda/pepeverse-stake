// backend/routes/helius.js

const express = require('express');
const router = express.Router();
const heliusProxy = require('../src/services/heliusProxy');
const { validateWalletAddress } = require('../middleware/validation');
const logger = require('../src/utils/logger');

/**
 * Helius Proxy API Routes
 * 
 * Provides secure backend proxy endpoints for Helius API calls
 * Requirement: 3.2
 */

/**
 * POST /api/helius/nfts/by-owner
 * Get NFTs owned by a wallet address
 * 
 * Request body:
 * {
 *   "ownerAddress": "wallet_address",
 *   "options": {} // optional
 * }
 */
router.post('/nfts/by-owner', validateWalletAddress('ownerAddress'), async (req, res) => {
  try {
    const { ownerAddress, options = {} } = req.body;
    
    if (!ownerAddress) {
      return res.status(400).json({
        error: 'ownerAddress is required',
        code: 'MISSING_OWNER_ADDRESS'
      });
    }
    
    const assets = await heliusProxy.getAssetsByOwner(ownerAddress, options);
    
    res.json({
      success: true,
      data: assets
    });
  } catch (error) {
    logger.error('Error in /nfts/by-owner', { error });
    res.status(500).json({
      error: error.message,
      code: 'HELIUS_PROXY_ERROR'
    });
  }
});

/**
 * POST /api/helius/nfts/metadata
 * Get metadata for a specific NFT mint address
 * 
 * Request body:
 * {
 *   "mintAddress": "nft_mint_address"
 * }
 */
router.post('/nfts/metadata', validateWalletAddress('mintAddress'), async (req, res) => {
  try {
    const { mintAddress } = req.body;
    
    if (!mintAddress) {
      return res.status(400).json({
        error: 'mintAddress is required',
        code: 'MISSING_MINT_ADDRESS'
      });
    }
    
    const metadata = await heliusProxy.getAssetMetadata(mintAddress);
    
    res.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    logger.error('Error in /nfts/metadata', { error });
    
    // Return 503 for service unavailable (as per requirement 12.3)
    const statusCode = error.message.includes('after 3 attempts') ? 503 : 500;
    
    res.status(statusCode).json({
      error: error.message,
      code: 'HELIUS_PROXY_ERROR'
    });
  }
});

/**
 * GET /api/helius/cache/stats
 * Get cache statistics (for monitoring/debugging)
 */
router.get('/cache/stats', (req, res) => {
  try {
    const stats = heliusProxy.getCacheStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error in /cache/stats', { error });
    res.status(500).json({
      error: error.message,
      code: 'CACHE_STATS_ERROR'
    });
  }
});

/**
 * POST /api/helius/cache/clear
 * Clear the cache (admin only - should be protected)
 */
router.post('/cache/clear', (req, res) => {
  try {
    heliusProxy.clearCache();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    logger.error('Error in /cache/clear', { error });
    res.status(500).json({
      error: error.message,
      code: 'CACHE_CLEAR_ERROR'
    });
  }
});

module.exports = router;
