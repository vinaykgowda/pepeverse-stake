// backend/src/solana-api-endpoints.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const { verifyJWT } = require('../middleware/auth');
const { verifyAdmin } = require('../middleware/admin');
const { stakeLimiter, unstakeLimiter, claimLimiter } = require('../middleware/rateLimiter');
const { stakeNFTs, unstakeNFTs, getStakedNFTs, getStakingStats } = require('./solana-nft-staking');
const logger = require('./utils/logger');
const { calculateRewards, getClaimQuote, claimRewardsWithPayment, getTransactionHistory } = require('./solana-rewards-handler');
const collectionCache = require('./services/collectionCache');

const { getPool } = require('./db');
const pool = getPool();
const bcrypt = require('bcrypt');

router.get('/staking/stats', verifyJWT, async (req, res) => {
  const result = await getStakingStats(req.user.walletAddress);

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Update the original stake endpoint to use the new flow
router.post('/nfts/stake', verifyJWT, stakeLimiter, async (req, res) => {
  try {
    const { nfts, collectionId, paymentSignature } = req.body;

    if (!nfts || !Array.isArray(nfts) || nfts.length === 0 || !collectionId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters'
      });
    }

    // Requirement 16.3: Validate JSON structure for traits
    for (let i = 0; i < nfts.length; i++) {
      const nft = nfts[i];
      if (nft.traits !== undefined && nft.traits !== null) {
        if (!Array.isArray(nft.traits)) {
          return res.status(400).json({
            success: false,
            message: `Invalid traits format for NFT at index ${i}. Expected array.`,
            code: 'INVALID_TRAITS_FORMAT'
          });
        }
        
        // Validate each trait object
        for (let j = 0; j < nft.traits.length; j++) {
          const trait = nft.traits[j];
          if (typeof trait !== 'object' || trait === null) {
            return res.status(400).json({
              success: false,
              message: `Invalid trait at index ${j} for NFT at index ${i}. Expected object.`,
              code: 'INVALID_TRAIT_OBJECT'
            });
          }
        }
      }
    }

    logger.info('Stake request', {
      wallet: req.user.walletAddress,
      nftCount: nfts.length,
      collectionId,
      hasPaymentSignature: !!paymentSignature
    });

    // Call the updated stakeNFTs function
    const result = await stakeNFTs(
      req.user.walletAddress,
      nfts,
      collectionId,
      paymentSignature
    );

    if (result.success) {
      res.json(result);
    } else {
      // Check if error is ownership verification failure (Requirement 11.3)
      if (result.message && result.message.includes('Ownership verification failed')) {
        return res.status(403).json(result);
      }
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Error staking NFTs', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to stake NFTs'
    });
  }
});

// Get staking quote (fee calculation)
router.post('/nfts/stake/quote', verifyJWT, async (req, res) => {
  try {
    const { nfts, collectionId } = req.body;

    logger.info('Stake quote request', { nfts, collectionId });

    if (!nfts || !Array.isArray(nfts) || nfts.length === 0 || !collectionId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters'
      });
    }

    const connection = pool.promise();

    // Get collection details
    const [collections] = await connection.query(
      'SELECT id, name, stake_fee FROM collections WHERE id = ?',
      [collectionId]
    );

    if (collections.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    const collection = collections[0];
    const stakeFee = parseFloat(collection.stake_fee) || 0;
    const totalFee = stakeFee * nfts.length;

    // Get fee recipient wallet from settings
    const [feeRecipientSettings] = await connection.query(
      'SELECT value FROM settings WHERE key_name = ?',
      ['rewards_wallet']
    );

    if (stakeFee > 0 && (feeRecipientSettings.length === 0 || !feeRecipientSettings[0].value)) {
      return res.status(500).json({
        success: false,
        message: 'Fee recipient wallet not configured'
      });
    }

    const feeRecipient = feeRecipientSettings[0]?.value;

    logger.info('Stake quote generated', {
      collectionName: collection.name,
      nftCount: nfts.length,
      feePerNFT: stakeFee,
      totalFee,
      feeRecipient
    });

    res.json({
      success: true,
      data: {
        collectionId: collection.id,
        collectionName: collection.name,
        nftCount: nfts.length,
        feePerNFT: stakeFee,
        totalFee: totalFee,
        feeRecipient: feeRecipient,
        currency: 'SOL',
        requiresPayment: totalFee > 0
      }
    });

  } catch (error) {
    logger.error('Error getting stake quote', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to calculate staking fee'
    });
  }
});

// Execute staking with payment proof
router.post('/nfts/stake/execute', verifyJWT, stakeLimiter, async (req, res) => {
  try {
    const { nfts, collectionId, paymentSignature } = req.body;

    logger.info('Execute stake request', {
      wallet: req.user.walletAddress,
      nftCount: nfts?.length,
      collectionId,
      hasPaymentSignature: !!paymentSignature
    });

    if (!nfts || !Array.isArray(nfts) || nfts.length === 0 || !collectionId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters'
      });
    }

    // Requirement 16.3: Validate JSON structure for traits
    for (let i = 0; i < nfts.length; i++) {
      const nft = nfts[i];
      if (nft.traits !== undefined && nft.traits !== null) {
        if (!Array.isArray(nft.traits)) {
          return res.status(400).json({
            success: false,
            message: `Invalid traits format for NFT at index ${i}. Expected array.`,
            code: 'INVALID_TRAITS_FORMAT'
          });
        }
        
        // Validate each trait object
        for (let j = 0; j < nft.traits.length; j++) {
          const trait = nft.traits[j];
          if (typeof trait !== 'object' || trait === null) {
            return res.status(400).json({
              success: false,
              message: `Invalid trait at index ${j} for NFT at index ${i}. Expected object.`,
              code: 'INVALID_TRAIT_OBJECT'
            });
          }
        }
      }
    }

    // Call the updated stakeNFTs function with payment signature
    const result = await stakeNFTs(
      req.user.walletAddress,
      nfts,
      collectionId,
      paymentSignature
    );

    if (result.success) {
      res.json(result);
    } else {
      // Check if error is ownership verification failure (Requirement 11.3)
      if (result.message && result.message.includes('Ownership verification failed')) {
        return res.status(403).json(result);
      }
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Error executing stake', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to execute staking'
    });
  }
});

router.post('/nfts/unstake', verifyJWT, unstakeLimiter, async (req, res) => {
  const { nftIds } = req.body;

  if (!nftIds || !Array.isArray(nftIds) || nftIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request parameters'
    });
  }

  const result = await unstakeNFTs(req.user.walletAddress, nftIds);

  if (result.success) {
    res.json(result);
  } else {
    // Requirement 25.2: Return HTTP 400 if minimum duration not met
    if (result.message && result.message.includes('Minimum stake duration')) {
      return res.status(400).json({
        ...result,
        code: 'MINIMUM_STAKE_DURATION_NOT_MET'
      });
    }
    res.status(400).json(result);
  }
});

router.get('/rewards/calculate', verifyJWT, async (req, res) => {
  const result = await calculateRewards(req.user.walletAddress);

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/rewards/quote', verifyJWT, async (req, res) => {
  try {
    logger.info('Getting claim quote for wallet', { wallet: req.user.walletAddress });
    const result = await getClaimQuote(req.user.walletAddress);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error getting claim quote', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get claim quote'
    });
  }
});

router.post('/rewards/claim', verifyJWT, claimLimiter, async (req, res) => {
  try {
    const { paymentSignature } = req.body;

    logger.info('CLAIM: Starting claim with payment signature', { paymentSignature });

    const result = await claimRewardsWithPayment(req.user.walletAddress, paymentSignature);

    if (result.success) {
      res.json(result);
    } else {
      // If payment is required, return 402 Payment Required
      if (result.requires_payment) {
        res.status(402).json(result);
      } else {
        res.status(400).json(result);
      }
    }
  } catch (error) {
    logger.error('Error claiming rewards', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to claim rewards'
    });
  }
});

router.get('/transactions', verifyJWT, async (req, res) => {
  const result = await getTransactionHistory(req.user.walletAddress);

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Update to the GET collections endpoint to include claim_fee in the response
// Requirements: 15.1 - Use newline-separated format
router.get('/admin/collections', verifyJWT, async (req, res) => {
  try {
    const { parseHashlist } = require('./utils/hashlistParser');
    const connection = pool.promise();

    // Fetch collections with basic data
    const [collections] = await connection.query(`
      SELECT
        c.id,
        c.name,
        c.creator_address,
        c.stake_fee,
        c.unstake_fee,
        c.claim_fee,
        c.created_at,
        c.updated_at,
        c.hashlist,
        COUNT(s.id) as staked_count
      FROM collections c
      LEFT JOIN staked_nfts s ON c.id = s.collection_id
      GROUP BY c.id
      ORDER BY c.id DESC;
    `);

    // Process each collection to get the correct hashlist count
    const processedCollections = collections.map(collection => {
      let hashlistCount = 0;
      
      // Use standardized parser (Requirement 15.1)
      const result = parseHashlist(collection.hashlist || '');
      if (result.success) {
        hashlistCount = result.addresses.length;
      }

      // Return the collection with hashlist_count, removing the full hashlist
      return {
        ...collection,
        hashlist_count: hashlistCount,
        hashlist: undefined // Remove the full hashlist from response
      };
    });

    res.json({ success: true, data: processedCollections });
  } catch (err) {
    logger.error('Error fetching collections', { error: err });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a public endpoint for collections for staking
// This is a new endpoint specifically for staking purposes
// Requirements: 15.1 - Use newline-separated format
router.get('/collections', verifyJWT, async (req, res) => {
  try {
    const { parseHashlist } = require('./utils/hashlistParser');
    const connection = pool.promise();

    // Fetch only active collections with minimal data needed for staking
    const [collections] = await connection.query(`
      SELECT
        c.id,
        c.name,
        c.stake_fee,
        c.unstake_fee,
        c.claim_fee,
        c.hashlist,
        COUNT(s.id) as staked_count
      FROM collections c
      LEFT JOIN staked_nfts s ON c.id = s.collection_id
      WHERE c.is_active = TRUE
      GROUP BY c.id
      ORDER BY c.name ASC;
    `);

    // Process collections using standardized parser
    const processedCollections = collections.map(collection => {
      const result = parseHashlist(collection.hashlist || '');
      
      return {
        id: collection.id,
        name: collection.name,
        stake_fee: collection.stake_fee,
        unstake_fee: collection.unstake_fee,
        claim_fee: collection.claim_fee,
        hashlist_count: result.success ? result.addresses.length : 0,
        hashlist: collection.hashlist // Include hashlist for client-side validation
      };
    });

    res.json({ success: true, data: processedCollections });
  } catch (err) {
    logger.error('Error fetching collections for staking', { error: err });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// UPDATED to handle FormData with file upload
// Requirements: 15.1, 15.2, 15.3, 15.4 - Validate and store newline-separated format
router.post('/admin/collections', verifyJWT, verifyAdmin, upload.single('hashlist'), async (req, res) => {
  try {
    const { parseHashlist } = require('./utils/hashlistParser');
    const { name, creator_address } = req.body;
    const file = req.file;

    if (!name || !creator_address || !file) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    let hashlistString = file.buffer.toString('utf-8');

    // Validate the hashlist using standardized parser
    // Requirements: 15.2, 15.3
    const result = parseHashlist(hashlistString);
    
    if (!result.success) {
      // Requirement 15.3: Reject hashlists containing invalid addresses with descriptive error
      return res.status(400).json({
        success: false,
        message: 'Invalid hashlist format',
        errors: result.errors
      });
    }

    // Store in newline-separated format (Requirement 15.1)
    const connection = pool.promise();
    await connection.query(
      'INSERT INTO collections (name, creator_address, hashlist) VALUES (?, ?, ?)',
      [name, creator_address, hashlistString.trim()]
    );

    // Invalidate collection cache after adding new collection
    collectionCache.invalidate();

    res.json({
      success: true,
      message: 'Collection added',
      hashlist_count: result.addresses.length
    });
  } catch (err) {
    logger.error('Error adding collection', { error: err });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// UPDATED to handle FormData with file upload
// Find the router.put('/admin/collections/:id') route and update it to include claim_fee
// Requirements: 15.1, 15.2, 15.3, 15.4 - Validate and store newline-separated format
router.put('/collections/:id', verifyJWT, verifyAdmin, upload.single('hashlist'), async (req, res) => {
  try {
    const { parseHashlist } = require('./utils/hashlistParser');
    const { id } = req.params;
    const { name, creator_address, stake_fee, unstake_fee, claim_fee } = req.body;

    const connection = pool.promise();
    let updateFields = [];
    const values = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      values.push(name);
    }

    if (creator_address !== undefined) {
      updateFields.push('creator_address = ?');
      values.push(creator_address);
    }

    if (stake_fee !== undefined) {
      updateFields.push('stake_fee = ?');
      values.push(stake_fee);
    }

    if (unstake_fee !== undefined) {
      updateFields.push('unstake_fee = ?');
      values.push(unstake_fee);
    }

    if (claim_fee !== undefined) {
      updateFields.push('claim_fee = ?');
      values.push(claim_fee);
    }

    if (req.file) {
      let hashlistString = req.file.buffer.toString('utf-8');

      // Validate the hashlist using standardized parser
      // Requirements: 15.2, 15.3
      const result = parseHashlist(hashlistString);
      
      if (!result.success) {
        // Requirement 15.3: Reject hashlists containing invalid addresses with descriptive error
        return res.status(400).json({
          success: false,
          message: 'Invalid hashlist format',
          errors: result.errors
        });
      }

      updateFields.push('hashlist = ?');
      values.push(hashlistString.trim());
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    values.push(id);

    await connection.query(
      `UPDATE collections SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    // Invalidate collection cache after updating collection
    collectionCache.invalidate(id);

    res.json({ success: true, message: 'Collection updated' });
  } catch (err) {
    logger.error('Error updating collection', { error: err });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.delete('/admin/collections/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const connection = pool.promise();

    // Check if there are staked NFTs for this collection
    const [nfts] = await connection.query(
      'SELECT COUNT(*) as count FROM staked_nfts WHERE collection_id = ?',
      [id]
    );

    if (nfts[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete collection with staked NFTs'
      });
    }

    // Delete collection rewards first
    await connection.query(
      'DELETE FROM collection_rewards WHERE collection_id = ?',
      [id]
    );

    // Delete trait rewards
    await connection.query(
      'DELETE FROM trait_rewards WHERE collection_id = ?',
      [id]
    );

    // Delete collection
    await connection.query(
      'DELETE FROM collections WHERE id = ?',
      [id]
    );

    // Invalidate collection cache after deleting collection
    collectionCache.invalidate(id);

    res.json({
      success: true,
      message: 'Collection deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting collection', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to delete collection'
    });
  }
});

// GET /api/v1/admin/dashboard
router.get('/admin/dashboard', async (req, res) => {
  try {
    const collectionsResult = await pool.query(`SELECT COUNT(*) as count FROM collections`);
    const stakedResult = await pool.query(`SELECT COUNT(*) as count FROM staked_nfts`);

    const feesResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE transaction_type IN ('STAKE', 'STAKE_FEE', 'UNSTAKE', 'UNSTAKE_FEE') AND status = 'CONFIRMED'
    `);

    const rewardsResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE transaction_type = 'CLAIM' AND status = 'CONFIRMED'
    `);

    return res.json({
      success: true,
      data: {
        collections: parseInt(collectionsResult.rows[0].count),
        totalStaked: parseInt(stakedResult.rows[0].count),
        stakeFeesCollected: parseFloat(feesResult.rows[0].total),
        rewardsDistributed: parseFloat(rewardsResult.rows[0].total)
      }
    });
  } catch (error) {
    logger.error('Error in /admin/dashboard', { error });
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Rewards
router.get('/admin/rewards', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const connection = pool.promise();
    const [rewards] = await connection.query(
      `SELECT cr.*, c.name as collection_name
       FROM collection_rewards cr
       JOIN collections c ON cr.collection_id = c.id`
    );

    res.json({
      success: true,
      data: rewards
    });
  } catch (error) {
    logger.error('Error fetching rewards', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rewards'
    });
  }
});

router.post('/admin/rewards', verifyJWT, verifyAdmin, async (req, res) => {
  const { collection_id, token_address, token_symbol, token_decimals, daily_rate } = req.body;

  if (!collection_id || !token_address || !token_symbol || daily_rate === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Invalid reward data'
    });
  }

  try {
    const connection = pool.promise();
    const [result] = await connection.query(
      'INSERT INTO collection_rewards (collection_id, token_address, token_symbol, token_decimals, daily_rate) VALUES (?, ?, ?, ?, ?)',
      [collection_id, token_address, token_symbol, token_decimals || 9, daily_rate]
    );

    res.json({
      success: true,
      message: 'Reward added successfully',
      id: result.insertId
    });
  } catch (error) {
    logger.error('Error adding reward', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to add reward'
    });
  }
});

router.put('/admin/rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { daily_rate, is_active } = req.body;

  try {
    const connection = pool.promise();
    const updates = [];
    const values = [];

    if (daily_rate !== undefined) {
      updates.push('daily_rate = ?');
      values.push(daily_rate);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    await connection.query(
      `UPDATE collection_rewards SET ${updates.join(', ')} WHERE id = ?`,
      [...values, id]
    );

    res.json({
      success: true,
      message: 'Reward updated successfully'
    });
  } catch (error) {
    logger.error('Error updating reward', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update reward'
    });
  }
});

router.delete('/admin/rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const connection = pool.promise();
    await connection.query(
      'DELETE FROM collection_rewards WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Reward deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting reward', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to delete reward'
    });
  }
});

// Trait rewards
router.get('/admin/trait-rewards', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const connection = pool.promise();
    const [rewards] = await connection.query(
      `SELECT tr.*, c.name as collection_name
       FROM trait_rewards tr
       JOIN collections c ON tr.collection_id = c.id`
    );

    res.json({
      success: true,
      data: rewards
    });
  } catch (error) {
    logger.error('Error fetching trait rewards', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trait rewards'
    });
  }
});

router.post('/admin/trait-rewards', verifyJWT, verifyAdmin, async (req, res) => {
  const { collection_id, trait_type, trait_value, token_address, token_symbol, multiplier } = req.body;

  if (!collection_id || !trait_type || !trait_value || !token_address || !token_symbol || multiplier === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Invalid trait reward data'
    });
  }

  try {
    const connection = pool.promise();
    const [result] = await connection.query(
      'INSERT INTO trait_rewards (collection_id, trait_type, trait_value, token_address, token_symbol, multiplier) VALUES (?, ?, ?, ?, ?, ?)',
      [collection_id, trait_type, trait_value, token_address, token_symbol, multiplier]
    );

    res.json({
      success: true,
      message: 'Trait reward added successfully',
      id: result.insertId
    });
  } catch (error) {
    logger.error('Error adding trait reward', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to add trait reward'
    });
  }
});

router.put('/admin/trait-rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { multiplier, is_active } = req.body;

  try {
    const connection = pool.promise();
    const updates = [];
    const values = [];

    if (multiplier !== undefined) {
      updates.push('multiplier = ?');
      values.push(multiplier);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    await connection.query(
      `UPDATE trait_rewards SET ${updates.join(', ')} WHERE id = ?`,
      [...values, id]
    );

    res.json({
      success: true,
      message: 'Trait reward updated successfully'
    });
  } catch (error) {
    logger.error('Error updating trait reward', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update trait reward'
    });
  }
});

router.delete('/admin/trait-rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const connection = pool.promise();
    await connection.query(
      'DELETE FROM trait_rewards WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Trait reward deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting trait reward', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to delete trait reward'
    });
  }
});

// Admin users
router.get('/admin/managers', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const connection = pool.promise();
    const [admins] = await connection.query(
      'SELECT id, username, email, is_super_admin, created_at, last_login FROM admins'
    );

    res.json({
      success: true,
      data: admins
    });
  } catch (error) {
    logger.error('Error fetching admins', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins'
    });
  }
});

// Admin profile update
router.put('/admin/profile/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, email, password, currentPassword } = req.body;

  // Ensure user is updating their own profile or is a super admin
  if (req.user.adminId != id && !req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'You can only update your own profile'
    });
  }

  try {
    const connection = pool.promise();

    // Check if admin exists
    const [admins] = await connection.query(
      'SELECT id, password FROM admins WHERE id = ?',
      [id]
    );

    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Verify current password if changing password
    if (password && currentPassword) {
      const passwordMatch = await bcrypt.compare(currentPassword, admins[0].password);

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    }

    // Update admin
    const updates = [];
    const values = [];

    if (username) {
      // Check if username is already taken
      const [existingAdmins] = await connection.query(
        'SELECT id FROM admins WHERE username = ? AND id != ?',
        [username, id]
      );

      if (existingAdmins.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }

      updates.push('username = ?');
      values.push(username);
    }

    if (email) {
      // Check if email is already taken
      const [existingAdmins] = await connection.query(
        'SELECT id FROM admins WHERE email = ? AND id != ?',
        [email, id]
      );

      if (existingAdmins.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
      }

      updates.push('email = ?');
      values.push(email);
    }

    if (password && currentPassword) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    await connection.query(
      `UPDATE admins SET ${updates.join(', ')} WHERE id = ?`,
      [...values, id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Error updating profile', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

router.post('/admin/managers', verifyJWT, verifyAdmin, async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  try {
    const connection = pool.promise();

    // Check if admin already exists
    const [existingAdmins] = await connection.query(
      'SELECT id FROM admins WHERE username = ? OR (email = ? AND email IS NOT NULL)',
      [username, email]
    );

    if (existingAdmins.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this username or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new admin
    const [result] = await connection.query(
      'INSERT INTO admins (username, password, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email]
    );

    res.json({
      success: true,
      message: 'Admin added successfully',
      id: result.insertId
    });
  } catch (error) {
    logger.error('Error adding admin', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to add admin'
    });
  }
});

router.delete('/admin/managers/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const connection = pool.promise();

    // Check if trying to delete a super admin
    const [admin] = await connection.query(
      'SELECT is_super_admin FROM admins WHERE id = ?',
      [id]
    );

    if (admin.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    if (admin[0].is_super_admin) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete super admin'
      });
    }

    await connection.query(
      'DELETE FROM admins WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Admin deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting admin', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to delete admin'
    });
  }
});

// Settings
// Update your settings endpoint to encrypt private keys:
router.put('/admin/settings', verifyJWT, verifyAdmin, async (req, res) => {
  const { settings } = req.body;

  if (!settings || !Array.isArray(settings)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid settings data'
    });
  }

  try {
    const connection = pool.promise();
    const { encryptPrivateKey } = require('./solana-transaction-utils');

    for (const setting of settings) {
      if (!setting.key_name || setting.value === undefined) {
        continue;
      }

      let valueToStore = setting.value;

      // Encrypt private keys before storing
      if (setting.key_name === 'rewards_wallet_encrypted_key' && setting.value) {
        logger.info('Encrypting private key before storage');

        try {
          // Only encrypt if it's not already encrypted (doesn't start with hex:hex format)
          if (!setting.value.includes(':')) {
            valueToStore = encryptPrivateKey(setting.value);
            logger.info('Private key encrypted successfully');
          } else {
            logger.info('Private key already encrypted, keeping as-is');
          }
        } catch (encryptError) {
          logger.error('Failed to encrypt private key', { error: encryptError });
          return res.status(500).json({
            success: false,
            message: 'Failed to encrypt private key'
          });
        }
      }

      await connection.query(
        'UPDATE settings SET value = ? WHERE key_name = ?',
        [valueToStore, setting.key_name]
      );
    }

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    logger.error('Error updating settings', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
});

// Also update the get settings endpoint to hide sensitive data:
router.get('/admin/settings', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const connection = pool.promise();
    const [settings] = await connection.query(
      'SELECT key_name, value, description, updated_at FROM settings'
    );

    // Filter sensitive settings
    const filteredSettings = settings.map(setting => {
      if (setting.key_name === 'rewards_wallet_encrypted_key') {
        return {
          ...setting,
          value: setting.value ? '[ENCRYPTED]' : ''
        };
      }
      return setting;
    });

    res.json({
      success: true,
      data: filteredSettings
    });
  } catch (error) {
    logger.error('Error fetching settings', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
});


router.get('/debug/claim-timestamps', verifyJWT, async (req, res) => {
  try {
    const connection = pool.promise();

    // Get staked NFTs with timestamps
    const [nfts] = await connection.query(
      `SELECT
         s.id,
         s.mint_address,
         s.stake_timestamp,
         s.last_claim_timestamp,
         c.name as collection_name,
         TIMESTAMPDIFF(MINUTE, COALESCE(s.last_claim_timestamp, s.stake_timestamp), NOW()) as minutes_since_last_claim
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       WHERE s.wallet_address = ?
       ORDER BY s.stake_timestamp DESC`,
      [req.user.walletAddress]
    );

    // Check if column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'staked_nfts'
      AND COLUMN_NAME = 'last_claim_timestamp'
    `);

    res.json({
      success: true,
      data: {
        wallet_address: req.user.walletAddress,
        has_last_claim_column: columns.length > 0,
        staked_nfts: nfts,
        total_staked: nfts.length,
        current_time: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in debug endpoint', { error });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/nfts/staked', verifyJWT, async (req, res) => {
  try {
    logger.info('Getting staked NFTs for wallet', { wallet: req.user.walletAddress });

    const result = await getStakedNFTs(req.user.walletAddress);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error in /nfts/staked endpoint', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get staked NFTs'
    });
  }
});


module.exports = router;