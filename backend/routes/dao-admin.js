// backend/routes/dao-admin.js

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getPool } = require('../src/db');
const pool = getPool();
const { verifyJWT } = require('../middleware/auth');
const { verifyDaoAdmin } = require('../middleware/daoAdmin');

// POST /api/v1/dao-admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const result = await pool.query(
      'SELECT * FROM dao_admins WHERE username = $1 AND is_active = TRUE',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const admin = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await pool.query(
      'UPDATE dao_admins SET last_login = NOW() WHERE id = $1',
      [admin.id]
    );

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        isDaoAdmin: true
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        isDaoAdmin: true
      }
    });
  } catch (error) {
    console.error('DAO admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// GET /api/v1/dao-admin/admins
router.get('/admins', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, wallet_address, created_by, is_active, created_at, last_login
       FROM dao_admins
       ORDER BY created_at ASC`
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error listing DAO admins:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DAO admins'
    });
  }
});

// POST /api/v1/dao-admin/admins
router.post('/admins', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { username, password, email, wallet_address } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO dao_admins (username, password, email, wallet_address, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, wallet_address, created_by, is_active, created_at`,
      [username, hashedPassword, email || null, wallet_address || null, req.user.id]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding DAO admin:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to add DAO admin'
    });
  }
});

// GET /api/v1/dao-admin/trait-rewards
router.get('/trait-rewards', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, collection_id, trait_type, trait_value, token_address, token_symbol,
              token_decimals, multiplier, is_active, created_at, updated_at
       FROM dao_trait_rewards
       ORDER BY created_at ASC`
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error listing DAO trait rewards:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DAO trait rewards'
    });
  }
});

// POST /api/v1/dao-admin/trait-rewards
router.post('/trait-rewards', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier } = req.body;

    if (!collection_id || !trait_type || !trait_value || !token_address || !token_symbol || multiplier == null) {
      return res.status(400).json({
        success: false,
        message: 'collection_id, trait_type, trait_value, token_address, token_symbol, and multiplier are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO dao_trait_rewards
         (collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, collection_id, trait_type, trait_value, token_address, token_symbol,
                 token_decimals, multiplier, is_active, created_at, updated_at`,
      [collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals ?? 9, multiplier]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding DAO trait reward:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add DAO trait reward'
    });
  }
});

// PUT /api/v1/dao-admin/trait-rewards/:id
router.put('/trait-rewards/:id', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier, is_active } = req.body;

    const result = await pool.query(
      `UPDATE dao_trait_rewards
       SET collection_id   = COALESCE($1, collection_id),
           trait_type      = COALESCE($2, trait_type),
           trait_value     = COALESCE($3, trait_value),
           token_address   = COALESCE($4, token_address),
           token_symbol    = COALESCE($5, token_symbol),
           token_decimals  = COALESCE($6, token_decimals),
           multiplier      = COALESCE($7, multiplier),
           is_active       = COALESCE($8, is_active),
           updated_at      = NOW()
       WHERE id = $9
       RETURNING id, collection_id, trait_type, trait_value, token_address, token_symbol,
                 token_decimals, multiplier, is_active, created_at, updated_at`,
      [collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'DAO trait reward not found'
      });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating DAO trait reward:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update DAO trait reward'
    });
  }
});

// DELETE /api/v1/dao-admin/trait-rewards/:id
router.delete('/trait-rewards/:id', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE dao_trait_rewards
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'DAO trait reward not found'
      });
    }

    return res.json({
      success: true,
      message: 'DAO trait reward deactivated'
    });
  } catch (error) {
    console.error('Error deleting DAO trait reward:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete DAO trait reward'
    });
  }
});

// GET /api/v1/dao-admin/settings
router.get('/settings', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key_name, value, description, updated_at
       FROM settings
       WHERE key_name IN ('dao_claim_fee', 'dao_rewards_wallet')`
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching DAO settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DAO settings'
    });
  }
});

// PUT /api/v1/dao-admin/settings
router.put('/settings', verifyJWT, verifyDaoAdmin, async (req, res) => {
  const { dao_claim_fee, dao_rewards_wallet } = req.body;

  if (dao_claim_fee === undefined && dao_rewards_wallet === undefined) {
    return res.status(400).json({
      success: false,
      message: 'At least one of dao_claim_fee or dao_rewards_wallet is required'
    });
  }

  try {
    if (dao_claim_fee !== undefined) {
      await pool.query(
        'UPDATE settings SET value = $1, updated_at = NOW() WHERE key_name = $2',
        [String(dao_claim_fee), 'dao_claim_fee']
      );
    }

    if (dao_rewards_wallet !== undefined) {
      await pool.query(
        'UPDATE settings SET value = $1, updated_at = NOW() WHERE key_name = $2',
        [dao_rewards_wallet, 'dao_rewards_wallet']
      );
    }

    return res.json({
      success: true,
      message: 'DAO settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating DAO settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update DAO settings'
    });
  }
});

// GET /api/v1/dao-admin/wallet
router.get('/wallet', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT value FROM settings WHERE key_name = 'dao_rewards_wallet'`
    );

    const walletAddress = result.rows[0]?.value || null;

    return res.json({
      success: true,
      data: {
        wallet_address: walletAddress,
        note: 'Token balances are fetched client-side via Helius proxy'
      }
    });
  } catch (error) {
    console.error('Error fetching DAO wallet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DAO wallet'
    });
  }
});

// POST /api/v1/dao-admin/wallet
router.post('/wallet', verifyJWT, verifyDaoAdmin, async (req, res) => {
  const { wallet_address, encrypted_private_key } = req.body;

  if (!wallet_address) {
    return res.status(400).json({
      success: false,
      message: 'wallet_address is required'
    });
  }

  try {
    await pool.query(
      'UPDATE settings SET value = $1, updated_at = NOW() WHERE key_name = $2',
      [wallet_address, 'dao_rewards_wallet']
    );

    if (encrypted_private_key !== undefined) {
      await pool.query(
        'UPDATE settings SET value = $1, updated_at = NOW() WHERE key_name = $2',
        [encrypted_private_key, 'dao_rewards_wallet_encrypted_key']
      );
    }

    return res.json({
      success: true,
      message: 'DAO reward wallet updated successfully'
    });
  } catch (error) {
    console.error('Error updating DAO wallet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update DAO wallet'
    });
  }
});

// GET /api/v1/dao-admin/available-tokens
router.get('/available-tokens', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT token_address, token_symbol, token_decimals
       FROM (
         SELECT token_address, token_symbol, token_decimals FROM collection_rewards
         UNION
         SELECT token_address, token_symbol, token_decimals FROM trait_rewards
       ) combined
       ORDER BY token_symbol ASC`
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching available tokens:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available tokens'
    });
  }
});

// GET /api/v1/dao-admin/airdrops
router.get('/airdrops', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, collection_id, airdrop_type, token_address, token_symbol, token_decimals,
              amount_per_nft, minimum_threshold, trait_type, trait_value,
              status, activated_at, expires_at, created_at, updated_at
       FROM dao_airdrop_configs
       ORDER BY created_at DESC`
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error listing DAO airdrops:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DAO airdrop configs'
    });
  }
});

// POST /api/v1/dao-admin/airdrops
router.post('/airdrops', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
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

    if (!collection_id || !airdrop_type || !token_address || !token_symbol || amount_per_nft == null) {
      return res.status(400).json({
        success: false,
        message: 'collection_id, airdrop_type, token_address, token_symbol, and amount_per_nft are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO dao_airdrop_configs
         (collection_id, airdrop_type, token_address, token_symbol, token_decimals,
          amount_per_nft, minimum_threshold, trait_type, trait_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, collection_id, airdrop_type, token_address, token_symbol, token_decimals,
                 amount_per_nft, minimum_threshold, trait_type, trait_value,
                 status, activated_at, expires_at, created_at, updated_at`,
      [
        collection_id,
        airdrop_type,
        token_address,
        token_symbol,
        token_decimals ?? 9,
        amount_per_nft,
        minimum_threshold ?? null,
        trait_type ?? null,
        trait_value ?? null
      ]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating DAO airdrop:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create DAO airdrop config'
    });
  }
});

// POST /api/v1/dao-admin/airdrops/:id/activate
router.post('/airdrops/:id/activate', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE dao_airdrop_configs
       SET status = 'active', activated_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, collection_id, airdrop_type, token_address, token_symbol, token_decimals,
                 amount_per_nft, minimum_threshold, trait_type, trait_value,
                 status, activated_at, expires_at, created_at, updated_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'DAO airdrop config not found'
      });
    }

    // Generate snapshot (service will be created in Task 10)
    try {
      const { generateDaoSnapshot } = require('../src/dao-snapshot-service');
      await generateDaoSnapshot(id);
    } catch (snapshotError) {
      console.error('Error generating DAO snapshot (service may not exist yet):', snapshotError.message);
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error activating DAO airdrop:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to activate DAO airdrop'
    });
  }
});

// DELETE /api/v1/dao-admin/airdrops/:id
router.delete('/airdrops/:id', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT id, status FROM dao_airdrop_configs WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'DAO airdrop config not found'
      });
    }

    if (existing.rows[0].status !== 'inactive') {
      return res.status(400).json({
        success: false,
        message: 'Only inactive DAO airdrop configs can be deleted'
      });
    }

    await pool.query('DELETE FROM dao_airdrop_configs WHERE id = $1', [id]);

    return res.json({
      success: true,
      message: 'DAO airdrop config deleted'
    });
  } catch (error) {
    console.error('Error deleting DAO airdrop:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete DAO airdrop config'
    });
  }
});

// GET /api/v1/dao-admin/analytics/dashboard
router.get('/analytics/dashboard', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const [stakersResult, rewardsResult, adminsResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT owner_wallet) AS total_dao_stakers
         FROM staked_nfts
         WHERE dao_last_claim_timestamp IS NOT NULL
            OR mint_address IN (
              SELECT DISTINCT sn.mint_address
              FROM staked_nfts sn
              JOIN dao_trait_rewards dtr ON dtr.is_active = TRUE
              WHERE sn.owner_wallet IS NOT NULL
            )`
      ),
      pool.query(
        `SELECT COALESCE(SUM(token_amount), 0) AS total_dao_rewards_distributed
         FROM transactions
         WHERE transaction_type = 'DAO_CLAIM'`
      ),
      pool.query(
        `SELECT COUNT(*) AS active_dao_admins
         FROM dao_admins
         WHERE is_active = TRUE`
      )
    ]);

    return res.json({
      success: true,
      data: {
        total_dao_stakers: parseInt(stakersResult.rows[0].total_dao_stakers, 10),
        total_dao_rewards_distributed: parseFloat(rewardsResult.rows[0].total_dao_rewards_distributed),
        active_dao_admins: parseInt(adminsResult.rows[0].active_dao_admins, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching DAO dashboard analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DAO dashboard analytics'
    });
  }
});

// GET /api/v1/dao-admin/analytics/claims
router.get('/analytics/claims', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, wallet_address, transaction_type, token_amount, token_symbol, created_at
         FROM transactions
         WHERE transaction_type = 'DAO_CLAIM'
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM transactions WHERE transaction_type = 'DAO_CLAIM'`
      )
    ]);

    return res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total, 10),
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error fetching DAO claims analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DAO claims analytics'
    });
  }
});

// GET /api/v1/dao-admin/analytics/airdrop-claims
router.get('/analytics/airdrop-claims', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, wallet_address, transaction_type, token_amount, token_symbol, created_at
         FROM transactions
         WHERE transaction_type = 'DAO_AIRDROP_CLAIM'
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM transactions WHERE transaction_type = 'DAO_AIRDROP_CLAIM'`
      )
    ]);

    return res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total, 10),
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error fetching DAO airdrop claims analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DAO airdrop claims analytics'
    });
  }
});

// GET /api/v1/dao-admin/rewards-breakdown
router.get('/rewards-breakdown', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         sn.owner_wallet AS wallet_address,
         dtr.token_symbol,
         dtr.token_address,
         dtr.token_decimals,
         SUM(
           dtr.multiplier *
           EXTRACT(EPOCH FROM (NOW() - COALESCE(sn.dao_last_claim_timestamp, sn.stake_timestamp))) / 86400.0
         ) AS total_pending_dao_rewards
       FROM staked_nfts sn
       JOIN dao_trait_rewards dtr ON dtr.is_active = TRUE
       WHERE sn.owner_wallet IS NOT NULL
       GROUP BY sn.owner_wallet, dtr.token_symbol, dtr.token_address, dtr.token_decimals
       HAVING SUM(
         dtr.multiplier *
         EXTRACT(EPOCH FROM (NOW() - COALESCE(sn.dao_last_claim_timestamp, sn.stake_timestamp))) / 86400.0
       ) > 0
       ORDER BY sn.owner_wallet, dtr.token_symbol`
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching DAO rewards breakdown:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DAO rewards breakdown'
    });
  }
});

module.exports = router;
