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
    const connection = pool.promise();

    const [collections] = await connection.query(`SELECT COUNT(*) as count FROM collections`);
    console.log('[collections]', collections);

    const [staked] = await connection.query(`SELECT COUNT(*) as count FROM staked_nfts`);
    console.log('[staked]', staked);

    const [fees] = await connection.query(`
      SELECT IFNULL(SUM(amount), 0) as total
      FROM transactions
      WHERE transaction_type IN ('STAKE', 'UNSTAKE') AND status = 'CONFIRMED'
    `);
    console.log('[fees]', fees);

    const [rewards] = await connection.query(`
      SELECT IFNULL(SUM(amount), 0) as total
      FROM transactions
      WHERE transaction_type = 'CLAIM' AND status = 'CONFIRMED'
    `);
    console.log('[rewards]', rewards);

    return res.json({
      success: true,
      data: {
        collections: collections[0].count,
        totalStaked: staked[0].count,
        stakeFeesCollected: parseFloat(fees[0].total),
        rewardsDistributed: parseFloat(rewards[0].total)
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

    const connection = pool.promise();
    const [result] = await connection.query(
      'INSERT INTO collections (name, creator_address, hashlist) VALUES (?, ?, ?)',
      [name, creator_address, hashlist]
    );

    const collectionId = result.insertId;

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
    const connection = pool.promise();
    const [collections] = await connection.query(`
      SELECT
        c.id,
        c.name,
        c.creator_address,
        c.stake_fee,
        c.unstake_fee,
        c.created_at,
        c.updated_at,
        LENGTH(c.hashlist) - LENGTH(REPLACE(c.hashlist, '\n', '')) + 1 AS hashlist_count,
        COUNT(s.id) as staked_count
      FROM collections c
      LEFT JOIN staked_nfts s ON c.id = s.collection_id
      GROUP BY c.id
      ORDER BY c.id DESC;
    `);
    res.json({ success: true, data: collections });
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

    const connection = pool.promise();
    
    // Get old values for audit log
    const [oldCollection] = await connection.query(
      'SELECT name, creator_address FROM collections WHERE id = ?',
      [id]
    );
    
    if (oldCollection.length === 0) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }
    
    let updateFields = `name = ?, creator_address = ?`;
    const values = [name, creator_address];

    if (req.file) {
      const hashlist = req.file.buffer.toString('utf-8');
      updateFields += `, hashlist = ?`;
      values.push(hashlist);
    }

    values.push(id);

    await connection.query(`UPDATE collections SET ${updateFields} WHERE id = ?`, values);

    // Invalidate collection cache after updating collection
    collectionCache.invalidate(id);

    // Log audit entry
    await auditLog.logCollectionModification({
      adminId: req.user.adminId,
      action: 'UPDATED',
      collectionId: parseInt(id),
      oldValue: { 
        name: oldCollection[0].name, 
        creator_address: oldCollection[0].creator_address 
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

    const connection = pool.promise();

    // Check if there are staked NFTs for this collection
    const [staked] = await connection.query(
      'SELECT COUNT(*) as count FROM staked_nfts WHERE collection_id = ?',
      [id]
    );

    if (staked[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete collection with staked NFTs'
      });
    }

    // Get collection details for audit log
    const [collection] = await connection.query(
      'SELECT name, creator_address FROM collections WHERE id = ?',
      [id]
    );
    
    if (collection.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Delete collection rewards first (if they exist)
    await connection.query(
      'DELETE FROM collection_rewards WHERE collection_id = ?',
      [id]
    );

    // Delete trait rewards (if they exist)
    await connection.query(
      'DELETE FROM trait_rewards WHERE collection_id = ?',
      [id]
    );

    // Delete collection
    await connection.query('DELETE FROM collections WHERE id = ?', [id]);

    // Invalidate collection cache after deleting collection
    collectionCache.invalidate(id);

    // Log audit entry
    await auditLog.logCollectionModification({
      adminId: req.user.adminId,
      action: 'DELETED',
      collectionId: parseInt(id),
      oldValue: { 
        name: collection[0].name, 
        creator_address: collection[0].creator_address 
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
    const connection = pool.promise();
    const [result] = await connection.query(
      'INSERT INTO collection_rewards (collection_id, token_address, token_symbol, token_decimals, daily_rate) VALUES (?, ?, ?, ?, ?)',
      [collection_id, token_address, token_symbol, token_decimals || 9, daily_rate]
    );

    // Invalidate collection cache after adding reward
    collectionCache.invalidate(collection_id);

    res.json({
      success: true,
      message: 'Reward added successfully',
      id: result.insertId
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
    const connection = pool.promise();
    
    // Get old values for audit log
    const [reward] = await connection.query(
      'SELECT collection_id, daily_rate, is_active FROM collection_rewards WHERE id = ?',
      [id]
    );
    
    if (reward.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }
    
    const collectionId = reward[0].collection_id;
    const oldRate = reward[0].daily_rate;
    const oldIsActive = reward[0].is_active;
    
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
    const connection = pool.promise();
    
    // Get collection_id for cache invalidation
    const [reward] = await connection.query(
      'SELECT collection_id FROM collection_rewards WHERE id = ?',
      [id]
    );
    
    if (reward.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }
    
    const collectionId = reward[0].collection_id;
    
    await connection.query(
      'DELETE FROM collection_rewards WHERE id = ?',
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
    const connection = pool.promise();
    const [result] = await connection.query(
      'INSERT INTO trait_rewards (collection_id, trait_type, trait_value, token_address, token_symbol, multiplier) VALUES (?, ?, ?, ?, ?, ?)',
      [collection_id, trait_type, trait_value, token_address, token_symbol, multiplier]
    );

    // Invalidate collection cache after adding trait reward
    collectionCache.invalidate(collection_id);

    res.json({
      success: true,
      message: 'Trait reward added successfully',
      id: result.insertId
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
    const connection = pool.promise();
    
    // Get collection_id for cache invalidation
    const [traitReward] = await connection.query(
      'SELECT collection_id FROM trait_rewards WHERE id = ?',
      [id]
    );
    
    if (traitReward.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Trait reward not found'
      });
    }
    
    const collectionId = traitReward[0].collection_id;
    
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
    const connection = pool.promise();
    
    // Get collection_id for cache invalidation
    const [traitReward] = await connection.query(
      'SELECT collection_id FROM trait_rewards WHERE id = ?',
      [id]
    );
    
    if (traitReward.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Trait reward not found'
      });
    }
    
    const collectionId = traitReward[0].collection_id;
    
    await connection.query(
      'DELETE FROM trait_rewards WHERE id = ?',
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
    const connection = pool.promise();
    const [admins] = await connection.query(
      'SELECT id, username, email, is_super_admin, created_at, last_login FROM admins'
    );

    res.json({
      success: true,
      data: admins
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
    const connection = pool.promise();
    const [settings] = await connection.query(
      'SELECT key_name, value, description, updated_at FROM settings'
    );

    // Don't return the encrypted key
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
    const connection = pool.promise();

    for (const setting of settings) {
      if (!setting.key_name || setting.value === undefined) {
        continue;
      }

      await connection.query(
        'UPDATE settings SET value = ? WHERE key_name = ?',
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
