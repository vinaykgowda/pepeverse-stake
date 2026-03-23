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
const HeliusProxyService = require('../src/services/heliusProxy');
const heliusProxy = new HeliusProxyService();
const snapshotService = require('../src/services/snapshotService');

// GET /api/v1/admin/token-balances
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
router.get('/token-balances', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    // 1. Query all distinct tokens configured as rewards
    const tokensResult = await pool.query(`
      SELECT DISTINCT token_address, token_symbol, token_decimals
      FROM collection_rewards
      ORDER BY token_symbol
    `);

    // 2. Fetch rewards_wallet from settings
    const walletResult = await pool.query(
      `SELECT value FROM settings WHERE key_name = 'rewards_wallet'`
    );
    const rewardsWallet = walletResult.rows[0]?.value;

    if (!rewardsWallet) {
      return res.json({ success: true, data: [], walletNotConfigured: true });
    }

    // 3. For each token, fetch balance via Helius; isolate per-token failures
    const data = await Promise.all(
      tokensResult.rows.map(async ({ token_address, token_symbol, token_decimals }) => {
        try {
          const result = await heliusProxy.getTokenAccountsByOwner(rewardsWallet, token_address);
          // Sum balances across all token accounts for this mint
          const accounts = result?.value ?? [];
          const balance = accounts.reduce((sum, acct) => {
            const amount = acct?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
            return sum + amount;
          }, 0);
          return { token_address, token_symbol, token_decimals, balance };
        } catch (err) {
          console.error(`Error fetching balance for token ${token_address}:`, err.message);
          return { token_address, token_symbol, token_decimals, error: true };
        }
      })
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error in /admin/token-balances:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch token balances' });
  }
});

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

    // Verify current password if changing password
    if (password && currentPassword) {
      const storedPassword = adminsResult.rows[0].password;
      let passwordMatch = false;

      // Check if stored password is a bcrypt hash (starts with $2b$ or $2a$)
      const isBcryptHash = storedPassword && (storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2a$'));

      if (isBcryptHash) {
        passwordMatch = await bcrypt.compare(currentPassword, storedPassword);
      } else {
        // Fallback: plain text comparison (legacy passwords stored before hashing was applied)
        passwordMatch = currentPassword === storedPassword;
        if (passwordMatch) {
          // Migrate: hash and update the plain text password now
          console.log(`[ADMIN] Migrating plain text password to bcrypt hash for admin ${id}`);
          const migratedHash = await bcrypt.hash(storedPassword, 10);
          await pool.query('UPDATE admins SET password = $1 WHERE id = $2', [migratedHash, id]);
        }
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

// GET /api/v1/admin/airdrops
// Requirements: 3.11
router.get('/airdrops', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const { collection_id } = req.query;

    const params = [];
    let whereClause = '';

    if (collection_id) {
      params.push(collection_id);
      whereClause = `WHERE ac.collection_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         ac.id,
         ac.collection_id,
         c.name AS collection_name,
         ac.airdrop_type,
         ac.token_address,
         ac.token_symbol,
         ac.token_decimals,
         ac.amount_per_nft,
         ac.minimum_threshold,
         ac.trait_type,
         ac.trait_value,
         ac.status,
         ac.activated_at,
         ac.expires_at,
         ac.created_at,
         ac.updated_at,
         COUNT(snap.id) AS eligible_count
       FROM airdrop_configs ac
       JOIN collections c ON ac.collection_id = c.id
       LEFT JOIN airdrop_snapshots snap ON snap.airdrop_config_id = ac.id
       ${whereClause}
       GROUP BY ac.id, c.name
       ORDER BY ac.created_at DESC`,
      params
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in GET /admin/airdrops:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch airdrop configs' });
  }
});

// POST /api/v1/admin/airdrops
// Requirements: 3.1, 3.2, 3.3, 3.6, 3.7
router.post('/airdrops', verifyJWT, verifyAdmin, async (req, res) => {
  const {
    collection_id,
    airdrop_type,
    token_address,
    token_symbol,
    token_decimals,
    amount_per_nft,
    minimum_threshold,
    trait_type,
    trait_value
  } = req.body;

  // Validate required fields
  if (!collection_id || !token_address || !token_symbol || amount_per_nft === undefined || !airdrop_type) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: collection_id, token_address, token_symbol, amount_per_nft, airdrop_type'
    });
  }

  // Validate airdrop_type value
  if (!['threshold', 'trait'].includes(airdrop_type)) {
    return res.status(400).json({
      success: false,
      message: 'airdrop_type must be "threshold" or "trait"'
    });
  }

  // Validate type-specific fields
  if (airdrop_type === 'threshold') {
    if (!minimum_threshold || Number(minimum_threshold) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'threshold type requires minimum_threshold > 0'
      });
    }
  }

  if (airdrop_type === 'trait') {
    if (!trait_type || !trait_value) {
      return res.status(400).json({
        success: false,
        message: 'trait type requires both trait_type and trait_value'
      });
    }
  }

  try {
    // Compute max total token cost across currently eligible stakers
    let maxCost = 0;

    if (airdrop_type === 'threshold') {
      const eligibleResult = await pool.query(
        `SELECT SUM(staked_count * $2) AS max_cost
         FROM (
           SELECT wallet_address, COUNT(*) AS staked_count
           FROM staked_nfts
           WHERE collection_id = $1
           GROUP BY wallet_address
           HAVING COUNT(*) >= $3
         ) eligible`,
        [collection_id, amount_per_nft, minimum_threshold]
      );
      maxCost = parseFloat(eligibleResult.rows[0]?.max_cost ?? 0);
    } else {
      // trait type
      const eligibleResult = await pool.query(
        `SELECT SUM(matching_count * $2) AS max_cost
         FROM (
           SELECT wallet_address, COUNT(*) AS matching_count
           FROM staked_nfts
           WHERE collection_id = $1
             AND traits::jsonb @> $3::jsonb
           GROUP BY wallet_address
           HAVING COUNT(*) > 0
         ) eligible`,
        [
          collection_id,
          amount_per_nft,
          JSON.stringify([{ trait_type, value: trait_value }])
        ]
      );
      maxCost = parseFloat(eligibleResult.rows[0]?.max_cost ?? 0);
    }

    // Fetch rewards_wallet from settings
    const walletResult = await pool.query(
      `SELECT value FROM settings WHERE key_name = 'rewards_wallet'`
    );
    const rewardsWallet = walletResult.rows[0]?.value;

    // Check token balance via Helius
    let currentBalance = 0;
    let balanceCheckFailed = false;

    if (rewardsWallet) {
      try {
        const tokenResult = await heliusProxy.getTokenAccountsByOwner(rewardsWallet, token_address);
        const accounts = tokenResult?.value ?? [];
        currentBalance = accounts.reduce((sum, acct) => {
          const amount = acct?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
          return sum + amount;
        }, 0);
      } catch (err) {
        console.error('Error fetching token balance for airdrop creation:', err.message);
        balanceCheckFailed = true;
      }
    }

    // Insert airdrop config with status='inactive'
    const insertResult = await pool.query(
      `INSERT INTO airdrop_configs
         (collection_id, airdrop_type, token_address, token_symbol, token_decimals,
          amount_per_nft, minimum_threshold, trait_type, trait_value, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'inactive')
       RETURNING *`,
      [
        collection_id,
        airdrop_type,
        token_address,
        token_symbol,
        token_decimals !== undefined ? token_decimals : 9,
        amount_per_nft,
        airdrop_type === 'threshold' ? minimum_threshold : null,
        airdrop_type === 'trait' ? trait_type : null,
        airdrop_type === 'trait' ? trait_value : null
      ]
    );

    const newConfig = insertResult.rows[0];

    // Return warning if balance is insufficient (and balance check didn't fail)
    if (!balanceCheckFailed && rewardsWallet && currentBalance < maxCost) {
      const shortfall = maxCost - currentBalance;
      return res.json({
        success: true,
        data: newConfig,
        warning: true,
        shortfall
      });
    }

    return res.json({ success: true, data: newConfig });
  } catch (error) {
    console.error('Error in POST /admin/airdrops:', error);
    return res.status(500).json({ success: false, message: 'Failed to create airdrop config' });
  }
});

// PUT /api/v1/admin/airdrops/:id
// Requirements: 3.1, 3.2, 3.3
router.put('/airdrops/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    token_address,
    token_symbol,
    token_decimals,
    amount_per_nft,
    minimum_threshold,
    trait_type,
    trait_value,
    airdrop_type,
    collection_id
  } = req.body;

  try {
    // Fetch existing config
    const existingResult = await pool.query(
      'SELECT * FROM airdrop_configs WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Airdrop config not found' });
    }

    const existing = existingResult.rows[0];

    // Reject if currently active
    if (existing.status === 'active') {
      return res.status(409).json({
        success: false,
        message: 'Cannot edit an active airdrop config. Deactivate it first.'
      });
    }

    // Merge incoming fields with existing values
    const updatedType = airdrop_type !== undefined ? airdrop_type : existing.airdrop_type;
    const updatedThreshold = minimum_threshold !== undefined ? minimum_threshold : existing.minimum_threshold;
    const updatedTraitType = trait_type !== undefined ? trait_type : existing.trait_type;
    const updatedTraitValue = trait_value !== undefined ? trait_value : existing.trait_value;

    // Validate airdrop_type value if provided
    if (airdrop_type !== undefined && !['threshold', 'trait'].includes(airdrop_type)) {
      return res.status(400).json({
        success: false,
        message: 'airdrop_type must be "threshold" or "trait"'
      });
    }

    // Re-validate type-specific constraints
    if (updatedType === 'threshold') {
      if (!updatedThreshold || Number(updatedThreshold) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'threshold type requires minimum_threshold > 0'
        });
      }
    }

    if (updatedType === 'trait') {
      if (!updatedTraitType || !updatedTraitValue) {
        return res.status(400).json({
          success: false,
          message: 'trait type requires both trait_type and trait_value'
        });
      }
    }

    // Build update query for allowed fields
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (token_address !== undefined) {
      updates.push(`token_address = $${paramIndex++}`);
      values.push(token_address);
    }
    if (token_symbol !== undefined) {
      updates.push(`token_symbol = $${paramIndex++}`);
      values.push(token_symbol);
    }
    if (token_decimals !== undefined) {
      updates.push(`token_decimals = $${paramIndex++}`);
      values.push(token_decimals);
    }
    if (amount_per_nft !== undefined) {
      updates.push(`amount_per_nft = $${paramIndex++}`);
      values.push(amount_per_nft);
    }
    if (airdrop_type !== undefined) {
      updates.push(`airdrop_type = $${paramIndex++}`);
      values.push(airdrop_type);
    }
    if (collection_id !== undefined) {
      updates.push(`collection_id = $${paramIndex++}`);
      values.push(collection_id);
    }

    // Always sync type-specific fields based on resolved type
    updates.push(`minimum_threshold = $${paramIndex++}`);
    values.push(updatedType === 'threshold' ? updatedThreshold : null);

    updates.push(`trait_type = $${paramIndex++}`);
    values.push(updatedType === 'trait' ? updatedTraitType : null);

    updates.push(`trait_value = $${paramIndex++}`);
    values.push(updatedType === 'trait' ? updatedTraitValue : null);

    updates.push(`updated_at = NOW()`);

    values.push(id);

    const updateResult = await pool.query(
      `UPDATE airdrop_configs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return res.json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error('Error in PUT /admin/airdrops/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to update airdrop config' });
  }
});

// POST /api/v1/admin/airdrops/:id/activate
// Requirements: 3.9, 3.13
router.post('/airdrops/:id/activate', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  // Fetch the config to check existence and current status
  let existingConfig;
  try {
    const existingResult = await pool.query(
      'SELECT id, status FROM airdrop_configs WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Airdrop config not found' });
    }

    existingConfig = existingResult.rows[0];
  } catch (error) {
    console.error('Error in POST /admin/airdrops/:id/activate (fetch):', error);
    return res.status(500).json({ success: false, message: 'Failed to activate airdrop config' });
  }

  // Reject if already active
  if (existingConfig.status === 'active') {
    return res.status(409).json({ success: false, message: 'Airdrop config is already active' });
  }

  // Open a transaction, generate snapshot, commit on success, rollback on failure
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { eligible_count, total_tokens } = await snapshotService.generateSnapshot(parseInt(id, 10), client);

    await client.query('COMMIT');

    return res.json({ success: true, data: { eligible_count, total_tokens } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in POST /admin/airdrops/:id/activate (snapshot):', error);
    return res.status(500).json({ success: false, message: 'Failed to activate airdrop config' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/airdrops/:id/deactivate
// Requirements: 3.10
router.post('/airdrops/:id/deactivate', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const existingResult = await pool.query(
      'SELECT id FROM airdrop_configs WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Airdrop config not found' });
    }

    const updateResult = await pool.query(
      `UPDATE airdrop_configs SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    return res.json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error('Error in POST /admin/airdrops/:id/deactivate:', error);
    return res.status(500).json({ success: false, message: 'Failed to deactivate airdrop config' });
  }
});

// DELETE /api/v1/admin/airdrops/:id
// Requirements: 3.12
router.delete('/airdrops/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if config exists
    const existingResult = await pool.query(
      'SELECT id FROM airdrop_configs WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Airdrop config not found' });
    }

    // Delete the config; FK ON DELETE CASCADE handles airdrop_snapshots cleanup
    await pool.query('DELETE FROM airdrop_configs WHERE id = $1', [id]);

    return res.json({ success: true, message: 'Airdrop config deleted' });
  } catch (error) {
    console.error('Error in DELETE /admin/airdrops/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete airdrop config' });
  }
});

// GET /api/v1/admin/airdrops/:id/eligible-wallets
// Requirements: 3.14
router.get('/airdrops/:id/eligible-wallets', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the airdrop config
    const configResult = await pool.query(
      'SELECT * FROM airdrop_configs WHERE id = $1',
      [id]
    );

    if (configResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Airdrop config not found' });
    }

    const config = configResult.rows[0];

    // For active configs: return existing snapshot rows
    if (config.status === 'active') {
      const snapshotResult = await pool.query(
        `SELECT wallet_address, eligible_nft_count, token_amount, claimed
         FROM airdrop_snapshots
         WHERE airdrop_config_id = $1
         ORDER BY token_amount DESC`,
        [id]
      );

      return res.json({
        success: true,
        data: {
          wallets: snapshotResult.rows,
          source: 'snapshot'
        }
      });
    }

    // For inactive (or other) configs: run live eligibility query
    let wallets = [];

    if (config.airdrop_type === 'threshold') {
      const liveResult = await pool.query(
        `SELECT wallet_address, COUNT(*) AS eligible_nft_count
         FROM staked_nfts
         WHERE collection_id = $1
         GROUP BY wallet_address
         HAVING COUNT(*) >= $2`,
        [config.collection_id, config.minimum_threshold]
      );

      wallets = liveResult.rows.map(row => ({
        wallet_address: row.wallet_address,
        eligible_nft_count: parseInt(row.eligible_nft_count),
        token_amount: parseInt(row.eligible_nft_count) * parseFloat(config.amount_per_nft),
        claimed: false
      }));
    } else {
      // trait type
      const liveResult = await pool.query(
        `SELECT wallet_address, COUNT(*) AS eligible_nft_count
         FROM staked_nfts
         WHERE collection_id = $1
           AND traits::jsonb @> $2::jsonb
         GROUP BY wallet_address
         HAVING COUNT(*) > 0`,
        [
          config.collection_id,
          JSON.stringify([{ trait_type: config.trait_type, value: config.trait_value }])
        ]
      );

      wallets = liveResult.rows.map(row => ({
        wallet_address: row.wallet_address,
        eligible_nft_count: parseInt(row.eligible_nft_count),
        token_amount: parseInt(row.eligible_nft_count) * parseFloat(config.amount_per_nft),
        claimed: false
      }));
    }

    return res.json({
      success: true,
      data: {
        wallets,
        source: 'live'
      }
    });
  } catch (error) {
    console.error('Error in GET /admin/airdrops/:id/eligible-wallets:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch eligible wallets' });
  }
});

// GET /api/v1/admin/analytics/claims
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9
router.get('/analytics/claims', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      collection_id,
      wallet_address,
      page = 1,
      limit = 50,
      export: exportFormat
    } = req.query;

    // Clamp limit to max 100
    const pageLimit = Math.min(parseInt(limit, 10) || 50, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * pageLimit;

    // Build WHERE conditions
    const conditions = [`t.transaction_type = 'CLAIM'`];
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      conditions.push(`t.created_at >= $${paramIndex++}`);
      params.push(start_date);
    }
    if (end_date) {
      conditions.push(`t.created_at <= $${paramIndex++}`);
      params.push(end_date);
    }
    if (collection_id) {
      conditions.push(`t.collection_id = $${paramIndex++}`);
      params.push(collection_id);
    }
    if (wallet_address) {
      conditions.push(`t.wallet_address ILIKE $${paramIndex++}`);
      params.push(wallet_address);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Base SELECT with join to collections and collection_rewards for token_symbol
    const baseSelect = `
      FROM transactions t
      LEFT JOIN collections c ON t.collection_id = c.id
      LEFT JOIN collection_rewards cr ON cr.collection_id = t.collection_id
        AND cr.token_address = t.token_address
      ${whereClause}
    `;

    // Stats query (no pagination)
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) AS count,
         COALESCE(SUM(t.amount), 0) AS total_distributed,
         COUNT(DISTINCT t.wallet_address) AS unique_wallets
       ${baseSelect}`,
      params
    );

    const stats = {
      count: parseInt(statsResult.rows[0].count),
      total_distributed: parseFloat(statsResult.rows[0].total_distributed),
      unique_wallets: parseInt(statsResult.rows[0].unique_wallets)
    };

    // CSV export
    if (exportFormat === 'csv') {
      const csvResult = await pool.query(
        `SELECT
           t.wallet_address,
           COALESCE(c.name, '') AS collection_name,
           COALESCE(cr.token_symbol, '') AS token_symbol,
           t.amount,
           t.created_at AS timestamp,
           COALESCE(t.transaction_hash, '') AS transaction_hash
         ${baseSelect}
         ORDER BY t.created_at DESC`,
        params
      );

      const csvHeaders = 'wallet_address,collection_name,token_symbol,amount,timestamp,transaction_hash';
      const csvRows = csvResult.rows.map(row =>
        [
          row.wallet_address,
          row.collection_name,
          row.token_symbol,
          row.amount,
          row.timestamp,
          row.transaction_hash
        ]
          .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(',')
      );
      const csv = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="claims-export.csv"');
      return res.send(csv);
    }

    // Paginated records query
    const recordsResult = await pool.query(
      `SELECT
         t.id,
         t.wallet_address,
         COALESCE(c.name, '') AS collection_name,
         COALESCE(cr.token_symbol, '') AS token_symbol,
         t.amount,
         t.created_at AS timestamp,
         COALESCE(t.transaction_hash, '') AS transaction_hash,
         t.status
       ${baseSelect}
       ORDER BY t.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageLimit, offset]
    );

    return res.json({
      success: true,
      data: {
        records: recordsResult.rows,
        total: stats.count,
        stats
      }
    });
  } catch (error) {
    console.error('Error in GET /admin/analytics/claims:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch claims analytics' });
  }
});

// GET /api/v1/admin/analytics/airdrop-claims
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
router.get('/analytics/airdrop-claims', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      collection_id,
      wallet_address,
      airdrop_config_id,
      page = 1,
      limit = 50,
      export: exportFormat
    } = req.query;

    // Clamp limit to max 100
    const pageLimit = Math.min(parseInt(limit, 10) || 50, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * pageLimit;

    // Build WHERE conditions — only claimed snapshots
    const conditions = [`snap.claimed = true`];
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      conditions.push(`snap.claimed_at >= $${paramIndex++}`);
      params.push(start_date);
    }
    if (end_date) {
      conditions.push(`snap.claimed_at <= $${paramIndex++}`);
      params.push(end_date);
    }
    if (collection_id) {
      conditions.push(`ac.collection_id = $${paramIndex++}`);
      params.push(collection_id);
    }
    if (wallet_address) {
      conditions.push(`snap.wallet_address ILIKE $${paramIndex++}`);
      params.push(wallet_address);
    }
    if (airdrop_config_id) {
      conditions.push(`snap.airdrop_config_id = $${paramIndex++}`);
      params.push(airdrop_config_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const baseFrom = `
      FROM airdrop_snapshots snap
      JOIN airdrop_configs ac ON snap.airdrop_config_id = ac.id
      JOIN collections c ON ac.collection_id = c.id
      ${whereClause}
    `;

    // Stats query (no pagination)
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) AS count,
         COALESCE(SUM(snap.token_amount), 0) AS total_airdropped,
         COUNT(DISTINCT snap.wallet_address) AS unique_wallets
       ${baseFrom}`,
      params
    );

    const stats = {
      count: parseInt(statsResult.rows[0].count),
      total_airdropped: parseFloat(statsResult.rows[0].total_airdropped),
      unique_wallets: parseInt(statsResult.rows[0].unique_wallets)
    };

    // CSV export
    if (exportFormat === 'csv') {
      const csvResult = await pool.query(
        `SELECT
           snap.wallet_address,
           c.name AS collection_name,
           ac.token_symbol || ' (' || ac.collection_id || ')' AS airdrop_name,
           ac.token_symbol,
           snap.token_amount AS amount_claimed,
           snap.claimed_at AS claim_timestamp,
           COALESCE(snap.claim_tx_hash, '') AS transaction_hash,
           ac.activated_at,
           ac.expires_at
         ${baseFrom}
         ORDER BY snap.claimed_at DESC`,
        params
      );

      const csvHeaders = 'wallet_address,collection_name,airdrop_name,token_symbol,amount_claimed,claim_timestamp,transaction_hash,activated_at,expires_at';
      const csvRows = csvResult.rows.map(row =>
        [
          row.wallet_address,
          row.collection_name,
          row.airdrop_name,
          row.token_symbol,
          row.amount_claimed,
          row.claim_timestamp,
          row.transaction_hash,
          row.activated_at,
          row.expires_at
        ]
          .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(',')
      );
      const csv = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="airdrop-claims-export.csv"');
      return res.send(csv);
    }

    // Paginated records query
    const recordsResult = await pool.query(
      `SELECT
         snap.id,
         snap.wallet_address,
         c.name AS collection_name,
         ac.token_symbol || ' (' || ac.collection_id || ')' AS airdrop_name,
         ac.token_symbol,
         snap.token_amount AS amount_claimed,
         snap.claimed_at,
         COALESCE(snap.claim_tx_hash, '') AS transaction_hash,
         ac.activated_at,
         ac.expires_at,
         snap.airdrop_config_id,
         snap.eligible_nft_count
       ${baseFrom}
       ORDER BY snap.claimed_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageLimit, offset]
    );

    return res.json({
      success: true,
      data: {
        records: recordsResult.rows,
        total: stats.count,
        stats
      }
    });
  } catch (error) {
    console.error('Error in GET /admin/analytics/airdrop-claims:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch airdrop claims analytics' });
  }
});

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
