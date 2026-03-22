// backend/routes/admin.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const { getPool } = require('../src/db');
const pool = getPool();
const { verifyJWT, verifyAdmin } = require('../middleware/auth');
const bcrypt = require('bcrypt'); // Added missing import for bcrypt
const collectionCache = require('../src/services/collectionCache');
const auditLog = require('../src/services/auditLog');

// GET /api/v1/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const collectionsResult = await pool.query(`SELECT COUNT(*) as count FROM collections`);
    console.log('[collections]', collectionsResult.rows);

    const stakedResult = await pool.query(`SELECT COUNT(*) as count FROM staked_nfts`);
    console.log('[staked]', stakedResult.rows);

    const feesResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE transaction_type IN ('STAKE', 'UNSTAKE') AND status = 'CONFIRMED'
    `);
    console.log('[fees]', feesResult.rows);

    const rewardsResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE transaction_type = 'CLAIM' AND status = 'CONFIRMED'
    `);
    console.log('[rewards]', rewardsResult.rows);

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
    console.error('Error in /admin/dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add collection
router.post('/collections', verifyJWT, verifyAdmin, upload.single('hashlist'), async (req, res) => {
  try {
    const { name, creator_address } = req.body;
    const file = req.file;

    if (!name || !creator_address || !file) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const hashlist = file.buffer.toString('utf-8');

    const result = await pool.query(
      'INSERT INTO collections (name, creator_address, hashlist) VALUES ($1, $2, $3) RETURNING id',
      [name, creator_address, hashlist]
    );

    const collectionId = result.rows[0].id;

    // Invalidate collection cache after adding new collection
    collectionCache.invalidate();

    // Log audit entry
    await auditLog.logCollectionModification({
      adminId: req.user.adminId,
      action: 'CREATED',
      collectionId,
      newValue: { name, creator_address },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Collection added' });
  } catch (err) {
    console.error('Error adding collection:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all collections
router.get('/collections', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const collectionsResult = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.creator_address,
        c.stake_fee,
        c.unstake_fee,
        c.created_at,
        c.updated_at,
        LENGTH(c.hashlist) - LENGTH(REPLACE(c.hashlist, E'\\n', '')) + 1 AS hashlist_count,
        COUNT(s.id) as staked_count
      FROM collections c
      LEFT JOIN staked_nfts s ON c.id = s.collection_id
      GROUP BY c.id, c.name, c.creator_address, c.stake_fee, c.unstake_fee, c.created_at, c.updated_at, c.hashlist
      ORDER BY c.id DESC;
    `);
    res.json({ success: true, data: collectionsResult.rows });
  } catch (err) {
    console.error('Error fetching collections:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update collection
router.put('/collections/:id', verifyJWT, verifyAdmin, upload.single('hashlist'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, creator_address } = req.body;
    
    // Get old values for audit log
    const oldCollectionResult = await pool.query(
      'SELECT name, creator_address FROM collections WHERE id = $1',
      [id]
    );
    
    if (oldCollectionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }
    
    let updateFields = `name = $1, creator_address = $2`;
    const values = [name, creator_address];
    let paramIndex = 3;

    if (req.file) {
      const hashlist = req.file.buffer.toString('utf-8');
      updateFields += `, hashlist = $${paramIndex++}`;
      values.push(hashlist);
    }

    values.push(id);

    await pool.query(`UPDATE collections SET ${updateFields} WHERE id = $${paramIndex}`, values);

    // Invalidate collection cache after updating collection
    collectionCache.invalidate(id);

    // Log audit entry
    await auditLog.logCollectionModification({
      adminId: req.user.adminId,
      action: 'UPDATED',
      collectionId: parseInt(id),
      oldValue: { 
        name: oldCollectionResult.rows[0].name, 
        creator_address: oldCollectionResult.rows[0].creator_address 
      },
      newValue: { name, creator_address },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Collection updated' });
  } catch (err) {
    console.error('Error updating collection:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete collection
router.delete('/collections/:id', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are staked NFTs for this collection
    const stakedResult = await pool.query(
      'SELECT COUNT(*) as count FROM staked_nfts WHERE collection_id = $1',
      [id]
    );

    if (parseInt(stakedResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete collection with staked NFTs'
      });
    }

    // Get collection details for audit log
    const collectionResult = await pool.query(
      'SELECT name, creator_address FROM collections WHERE id = $1',
      [id]
    );
    
    if (collectionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Delete collection rewards first (if they exist)
    await pool.query(
      'DELETE FROM collection_rewards WHERE collection_id = $1',
      [id]
    );

    // Delete trait rewards (if they exist)
    await pool.query(
      'DELETE FROM trait_rewards WHERE collection_id = $1',
      [id]
    );

    // Delete collection
    await pool.query('DELETE FROM collections WHERE id = $1', [id]);

    // Invalidate collection cache after deleting collection
    collectionCache.invalidate(id);

    // Log audit entry
    await auditLog.logCollectionModification({
      adminId: req.user.adminId,
      action: 'DELETED',
      collectionId: parseInt(id),
      oldValue: { 
        name: collectionResult.rows[0].name, 
        creator_address: collectionResult.rows[0].creator_address 
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Collection deleted' });
  } catch (err) {
    console.error('Error deleting collection:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Rewards
router.get('/rewards', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const rewardsResult = await pool.query(
      `SELECT cr.*, c.name as collection_name
       FROM collection_rewards cr
       JOIN collections c ON cr.collection_id = c.id`
    );

    res.json({
      success: true,
      data: rewardsResult.rows
    });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rewards'
    });
  }
});

router.post('/rewards', verifyJWT, verifyAdmin, async (req, res) => {
  const { collection_id, token_address, token_symbol, token_decimals, daily_rate } = req.body;

  if (!collection_id || !token_address || !token_symbol || daily_rate === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Invalid reward data'
    });
  }

  try {
    const result = await pool.query(
      'INSERT INTO collection_rewards (collection_id, token_address, token_symbol, token_decimals, daily_rate) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [collection_id, token_address, token_symbol, token_decimals || 9, daily_rate]
    );

    // Invalidate collection cache after adding reward
    collectionCache.invalidate(collection_id);

    res.json({
      success: true,
      message: 'Reward added successfully',
      id: result.rows[0].id
    });
  } catch (error) {
    console.error('Error adding reward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add reward'
    });
  }
});

router.put('/rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { daily_rate, is_active } = req.body;

  try {
    // Get old values for audit log
    const rewardResult = await pool.query(
      'SELECT collection_id, daily_rate, is_active FROM collection_rewards WHERE id = $1',
      [id]
    );
    
    if (rewardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }
    
    const collectionId = rewardResult.rows[0].collection_id;
    const oldRate = rewardResult.rows[0].daily_rate;
    const oldIsActive = rewardResult.rows[0].is_active;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (daily_rate !== undefined) {
      updates.push(`daily_rate = $${paramIndex++}`);
      values.push(daily_rate);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    values.push(id);

    await pool.query(
      `UPDATE collection_rewards SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Invalidate collection cache after updating reward
    collectionCache.invalidate(collectionId);

    // Log audit entry for rate change
    if (daily_rate !== undefined && daily_rate !== oldRate) {
      await auditLog.logRewardRateChange({
        adminId: req.user.adminId,
        rewardId: parseInt(id),
        collectionId,
        oldRate,
        newRate: daily_rate,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    }
    
    // Log audit entry for status change
    if (is_active !== undefined && is_active !== oldIsActive) {
      await auditLog.log({
        adminId: req.user.adminId,
        action: 'REWARD_STATUS_CHANGED',
        entityType: 'reward',
        entityId: parseInt(id),
        oldValue: { is_active: oldIsActive, collectionId },
        newValue: { is_active, collectionId },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    }

    res.json({
      success: true,
      message: 'Reward updated successfully'
    });
  } catch (error) {
    console.error('Error updating reward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reward'
    });
  }
});

router.delete('/rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Get collection_id for cache invalidation
    const rewardResult = await pool.query(
      'SELECT collection_id FROM collection_rewards WHERE id = $1',
      [id]
    );
    
    if (rewardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }
    
    const collectionId = rewardResult.rows[0].collection_id;
    
    await pool.query(
      'DELETE FROM collection_rewards WHERE id = $1',
      [id]
    );

    // Invalidate collection cache after deleting reward
    collectionCache.invalidate(collectionId);

    res.json({
      success: true,
      message: 'Reward deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reward'
    });
  }
});

// Trait rewards
router.get('/trait-rewards', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const rewardsResult = await pool.query(
      `SELECT tr.*, c.name as collection_name
       FROM trait_rewards tr
       JOIN collections c ON tr.collection_id = c.id`
    );

    res.json({
      success: true,
      data: rewardsResult.rows
    });
  } catch (error) {
    console.error('Error fetching trait rewards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trait rewards'
    });
  }
});

router.post('/trait-rewards', verifyJWT, verifyAdmin, async (req, res) => {
  const { collection_id, trait_type, trait_value, token_address, token_symbol, multiplier } = req.body;

  if (!collection_id || !trait_type || !trait_value || !token_address || !token_symbol || multiplier === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Invalid trait reward data'
    });
  }

  try {
    const result = await pool.query(
      'INSERT INTO trait_rewards (collection_id, trait_type, trait_value, token_address, token_symbol, multiplier) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [collection_id, trait_type, trait_value, token_address, token_symbol, multiplier]
    );

    // Invalidate collection cache after adding trait reward
    collectionCache.invalidate(collection_id);

    res.json({
      success: true,
      message: 'Trait reward added successfully',
      id: result.rows[0].id
    });
  } catch (error) {
    console.error('Error adding trait reward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add trait reward'
    });
  }
});

router.put('/trait-rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { multiplier, is_active } = req.body;

  try {
    // Get collection_id for cache invalidation
    const traitRewardResult = await pool.query(
      'SELECT collection_id FROM trait_rewards WHERE id = $1',
      [id]
    );
    
    if (traitRewardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Trait reward not found'
      });
    }
    
    const collectionId = traitRewardResult.rows[0].collection_id;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (multiplier !== undefined) {
      updates.push(`multiplier = $${paramIndex++}`);
      values.push(multiplier);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    values.push(id);

    await pool.query(
      `UPDATE trait_rewards SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Invalidate collection cache after updating trait reward
    collectionCache.invalidate(collectionId);

    res.json({
      success: true,
      message: 'Trait reward updated successfully'
    });
  } catch (error) {
    console.error('Error updating trait reward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update trait reward'
    });
  }
});

router.delete('/trait-rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Get collection_id for cache invalidation
    const traitRewardResult = await pool.query(
      'SELECT collection_id FROM trait_rewards WHERE id = $1',
      [id]
    );
    
    if (traitRewardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Trait reward not found'
      });
    }
    
    const collectionId = traitRewardResult.rows[0].collection_id;
    
    await pool.query(
      'DELETE FROM trait_rewards WHERE id = $1',
      [id]
    );

    // Invalidate collection cache after deleting trait reward
    collectionCache.invalidate(collectionId);

    res.json({
      success: true,
      message: 'Trait reward deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting trait reward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete trait reward'
    });
  }
});

// Admin users
router.get('/managers', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const adminsResult = await pool.query(
      'SELECT id, username, email, is_super_admin, created_at, last_login FROM admins'
    );

    res.json({
      success: true,
      data: adminsResult.rows
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins'
    });
  }
});

// Admin profile update
router.put('/profile/:id', verifyJWT, verifyAdmin, async (req, res) => {
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
    // Check if admin exists
    const adminsResult = await pool.query(
      'SELECT id, password FROM admins WHERE id = $1',
      [id]
    );

    if (adminsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Verify current password if changing password (check for non-empty strings)
    if (password && password.trim() && currentPassword && currentPassword.trim()) {
      const storedPassword = adminsResult.rows[0].password;
      let passwordMatch;
      
      // Check if stored password is bcrypt hash or plain text
      if (storedPassword.startsWith('$2')) {
        passwordMatch = await bcrypt.compare(currentPassword, storedPassword);
      } else {
        // Plain text comparison (temporary for migration)
        passwordMatch = currentPassword === storedPassword;
      }

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
    let paramIndex = 1;

    if (username) {
      // Check if username is already taken
      const existingResult = await pool.query(
        'SELECT id FROM admins WHERE username = $1 AND id != $2',
        [username, id]
      );

      if (existingResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }

      updates.push(`username = $${paramIndex++}`);
      values.push(username);
    }

    if (email) {
      // Check if email is already taken
      const existingResult = await pool.query(
        'SELECT id FROM admins WHERE email = $1 AND id != $2',
        [email, id]
      );

      if (existingResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
      }

      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }

    if (password && currentPassword) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password = $${paramIndex++}`);
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    values.push(id);

    await pool.query(
      `UPDATE admins SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

router.post('/managers', verifyJWT, verifyAdmin, async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  try {
    // Check if admin already exists
    const existingResult = await pool.query(
      'SELECT id FROM admins WHERE username = $1 OR (email = $2 AND email IS NOT NULL)',
      [username, email]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this username or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new admin
    const result = await pool.query(
      'INSERT INTO admins (username, password, email) VALUES ($1, $2, $3) RETURNING id',
      [username, hashedPassword, email]
    );

    res.json({
      success: true,
      message: 'Admin added successfully',
      id: result.rows[0].id
    });
  } catch (error) {
    console.error('Error adding admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add admin'
    });
  }
});

router.delete('/managers/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if trying to delete a super admin
    const adminResult = await pool.query(
      'SELECT is_super_admin FROM admins WHERE id = $1',
      [id]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    if (adminResult.rows[0].is_super_admin) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete super admin'
      });
    }

    await pool.query(
      'DELETE FROM admins WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'Admin deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete admin'
    });
  }
});

// Settings
router.get('/settings', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const settingsResult = await pool.query(
      'SELECT key_name, value, description, updated_at FROM settings'
    );

    // Don't return the encrypted key
    const filteredSettings = settingsResult.rows.map(setting => {
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
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
});

router.put('/settings', verifyJWT, verifyAdmin, async (req, res) => {
  const { settings } = req.body;

  if (!settings || !Array.isArray(settings)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid settings data'
    });
  }

  try {
    for (const setting of settings) {
      if (!setting.key_name || setting.value === undefined) {
        continue;
      }

      await pool.query(
        'UPDATE settings SET value = $1 WHERE key_name = $2',
        [setting.value, setting.key_name]
      );
    }

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
});

module.exports = router;

// POST /api/v1/admin/metadata/refresh
// Refresh metadata for all staked NFTs (or specific collection)
router.post('/metadata/refresh', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const { collectionId } = req.body;
    const adminWallet = req.user.walletAddress;
    
    console.log(`🔄 [ADMIN] Metadata refresh requested by ${adminWallet}${collectionId ? ` for collection ${collectionId}` : ' for all collections'}`);
    
    // Import the metadata refresh service
    const metadataRefresh = require('../src/services/metadataRefresh');
    
    // Perform the refresh
    const result = await metadataRefresh.refreshStakedNFTMetadata(collectionId, adminWallet);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ [ADMIN] Error in metadata refresh endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh metadata'
    });
  }
});

// POST /api/v1/admin/metadata/refresh/:mintAddress
// Refresh metadata for a single staked NFT
router.post('/metadata/refresh/:mintAddress', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const { mintAddress } = req.params;
    const adminWallet = req.user.walletAddress;
    
    console.log(`🔄 [ADMIN] Single NFT metadata refresh requested by ${adminWallet} for ${mintAddress}`);
    
    const metadataRefresh = require('../src/services/metadataRefresh');
    
    const result = await metadataRefresh.refreshSingleNFT(mintAddress, adminWallet);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error(`❌ [ADMIN] Error refreshing metadata for ${req.params.mintAddress}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh metadata'
    });
  }
});

module.exports = router;
