// api/dao-admin-routes.js
// DAO Admin routes for Vercel — self-contained, no native binary imports

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

let _pool = null;
function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return _pool;
}

function verifyJWT(req, res, next) {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token is not valid' });
  }
}

function verifyDaoAdmin(req, res, next) {
  if (!req.user || req.user.isDaoAdmin !== true) {
    return res.status(403).json({ success: false, message: 'Access denied. DAO admin privileges required.' });
  }
  next();
}

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required' });

    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM dao_admins WHERE username = $1 AND is_active = TRUE', [username]
    );
    if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const admin = result.rows[0];

    // Use pgcrypto-compatible bcrypt check via DB, or bcrypt module
    let passwordMatch = false;
    try {
      const bcrypt = require('bcrypt');
      passwordMatch = await bcrypt.compare(password, admin.password);
    } catch {
      // bcrypt native failed — try pgcrypto via DB
      try {
        const checkResult = await pool.query(
          'SELECT (password = crypt($1, password)) AS match FROM dao_admins WHERE id = $2',
          [password, admin.id]
        );
        passwordMatch = checkResult.rows[0]?.match === true;
      } catch (e2) {
        console.error('[dao-admin/login] password check failed:', e2.message);
        return res.status(500).json({ success: false, message: 'Server error during authentication' });
      }
    }

    if (!passwordMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    await pool.query('UPDATE dao_admins SET last_login = NOW() WHERE id = $1', [admin.id]);

    const token = jwt.sign(
      { id: admin.id, username: admin.username, isDaoAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.json({ success: true, token, user: { id: admin.id, username: admin.username, isDaoAdmin: true } });
  } catch (e) {
    console.error('[dao-admin/login]', e.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /admins
router.get('/admins', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await getPool().query(
      'SELECT id, username, email, wallet_address, created_by, is_active, created_at, last_login FROM dao_admins ORDER BY created_at ASC'
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error('[dao-admin/admins GET]', e.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch DAO admins' });
  }
});

// POST /admins
router.post('/admins', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { username, password, email, wallet_address } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required' });

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO dao_admins (username, password, email, wallet_address, created_by)
       VALUES ($1, crypt($2, gen_salt('bf', 12)), $3, $4, $5)
       RETURNING id, username, email, wallet_address, created_by, is_active, created_at`,
      [username, password, email || null, wallet_address || null, req.user.id]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ success: false, message: 'Username or email already exists' });
    console.error('[dao-admin/admins POST]', e.message);
    return res.status(500).json({ success: false, message: 'Failed to add DAO admin' });
  }
});

// GET /trait-rewards
router.get('/trait-rewards', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await getPool().query(
      'SELECT id, collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier, is_active, created_at, updated_at FROM dao_trait_rewards ORDER BY created_at ASC'
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to fetch DAO trait rewards' }); }
});

// POST /trait-rewards
router.post('/trait-rewards', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier } = req.body;
    if (!collection_id || !trait_type || !trait_value || !token_address || !token_symbol || multiplier == null)
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    const result = await getPool().query(
      `INSERT INTO dao_trait_rewards (collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals ?? 9, multiplier]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to add DAO trait reward' }); }
});

// PUT /trait-rewards/:id
router.put('/trait-rewards/:id', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier, is_active } = req.body;
    const result = await getPool().query(
      `UPDATE dao_trait_rewards SET
         collection_id=COALESCE($1,collection_id), trait_type=COALESCE($2,trait_type),
         trait_value=COALESCE($3,trait_value), token_address=COALESCE($4,token_address),
         token_symbol=COALESCE($5,token_symbol), token_decimals=COALESCE($6,token_decimals),
         multiplier=COALESCE($7,multiplier), is_active=COALESCE($8,is_active), updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier, is_active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to update DAO trait reward' }); }
});

// DELETE /trait-rewards/:id
router.delete('/trait-rewards/:id', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await getPool().query(
      'UPDATE dao_trait_rewards SET is_active=FALSE, updated_at=NOW() WHERE id=$1 RETURNING id', [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, message: 'DAO trait reward deactivated' });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to delete DAO trait reward' }); }
});

// GET /settings
router.get('/settings', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await getPool().query(
      "SELECT key_name, value, description FROM settings WHERE key_name IN ('dao_claim_fee','dao_rewards_wallet')"
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to fetch DAO settings' }); }
});

// PUT /settings
router.put('/settings', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { dao_claim_fee, dao_rewards_wallet } = req.body;
    if (dao_claim_fee === undefined && dao_rewards_wallet === undefined)
      return res.status(400).json({ success: false, message: 'At least one field required' });
    const pool = getPool();
    if (dao_claim_fee !== undefined)
      await pool.query("UPDATE settings SET value=$1 WHERE key_name='dao_claim_fee'", [String(dao_claim_fee)]);
    if (dao_rewards_wallet !== undefined)
      await pool.query("UPDATE settings SET value=$1 WHERE key_name='dao_rewards_wallet'", [dao_rewards_wallet]);
    return res.json({ success: true, message: 'DAO settings updated' });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to update DAO settings' }); }
});

// GET /wallet
router.get('/wallet', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await getPool().query("SELECT value FROM settings WHERE key_name='dao_rewards_wallet'");
    return res.json({ success: true, data: { wallet_address: result.rows[0]?.value || null } });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to fetch DAO wallet' }); }
});

// POST /wallet
router.post('/wallet', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { wallet_address, encrypted_private_key } = req.body;
    if (!wallet_address) return res.status(400).json({ success: false, message: 'wallet_address is required' });
    const pool = getPool();
    await pool.query("UPDATE settings SET value=$1 WHERE key_name='dao_rewards_wallet'", [wallet_address]);
    if (encrypted_private_key)
      await pool.query("UPDATE settings SET value=$1 WHERE key_name='dao_rewards_wallet_encrypted_key'", [encrypted_private_key]);
    return res.json({ success: true, message: 'DAO wallet updated' });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to update DAO wallet' }); }
});

// GET /available-tokens
router.get('/available-tokens', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await getPool().query(
      `SELECT DISTINCT token_address, token_symbol, token_decimals FROM (
         SELECT token_address, token_symbol, token_decimals FROM collection_rewards
         UNION SELECT token_address, token_symbol, token_decimals FROM trait_rewards
       ) t ORDER BY token_symbol ASC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to fetch available tokens' }); }
});

// GET /airdrops
router.get('/airdrops', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await getPool().query(
      'SELECT * FROM dao_airdrop_configs ORDER BY created_at DESC'
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to fetch DAO airdrops' }); }
});

// POST /airdrops
router.post('/airdrops', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { collection_id, airdrop_type, token_address, token_symbol, token_decimals, amount_per_nft, minimum_threshold, trait_type, trait_value } = req.body;
    if (!collection_id || !airdrop_type || !token_address || !token_symbol || amount_per_nft == null)
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    const result = await getPool().query(
      `INSERT INTO dao_airdrop_configs (collection_id,airdrop_type,token_address,token_symbol,token_decimals,amount_per_nft,minimum_threshold,trait_type,trait_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [collection_id, airdrop_type, token_address, token_symbol, token_decimals ?? 9, amount_per_nft, minimum_threshold ?? null, trait_type ?? null, trait_value ?? null]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to create DAO airdrop' }); }
});

// POST /airdrops/:id/activate
router.post('/airdrops/:id/activate', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query(
      "UPDATE dao_airdrop_configs SET status='active', activated_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *", [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    // Generate snapshots inline
    const config = result.rows[0];
    try {
      let wallets;
      if (config.airdrop_type === 'threshold') {
        const r = await pool.query(
          'SELECT owner_wallet, COUNT(*) as cnt FROM staked_nfts WHERE collection_id=$1 GROUP BY owner_wallet HAVING COUNT(*)>=$2',
          [config.collection_id, config.minimum_threshold]
        );
        wallets = r.rows.map(w => ({ wallet: w.owner_wallet, count: parseInt(w.cnt) }));
      } else {
        const r = await pool.query(
          "SELECT owner_wallet, COUNT(*) as cnt FROM staked_nfts WHERE collection_id=$1 AND traits::jsonb @> $2::jsonb GROUP BY owner_wallet",
          [config.collection_id, JSON.stringify([{ trait_type: config.trait_type, value: config.trait_value }])]
        );
        wallets = r.rows.map(w => ({ wallet: w.owner_wallet, count: parseInt(w.cnt) }));
      }
      for (const w of wallets) {
        const amount = (w.count * parseFloat(config.amount_per_nft)).toFixed(9);
        await pool.query(
          'INSERT INTO dao_airdrop_snapshots (dao_airdrop_config_id, wallet_address, token_amount) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [id, w.wallet, amount]
        );
      }
    } catch (snapErr) { console.error('[dao-admin/airdrops/activate] snapshot error:', snapErr.message); }
    return res.json({ success: true, data: result.rows[0] });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to activate DAO airdrop' }); }
});

// DELETE /airdrops/:id
router.delete('/airdrops/:id', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT id, status FROM dao_airdrop_configs WHERE id=$1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    if (existing.rows[0].status !== 'inactive') return res.status(400).json({ success: false, message: 'Only inactive airdrops can be deleted' });
    await pool.query('DELETE FROM dao_airdrop_configs WHERE id=$1', [req.params.id]);
    return res.json({ success: true, message: 'DAO airdrop deleted' });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to delete DAO airdrop' }); }
});

// GET /analytics/dashboard
router.get('/analytics/dashboard', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [stakers, rewards, admins] = await Promise.all([
      pool.query('SELECT COUNT(DISTINCT owner_wallet) AS total FROM staked_nfts WHERE dao_last_claim_timestamp IS NOT NULL'),
      pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE transaction_type='DAO_CLAIM'"),
      pool.query('SELECT COUNT(*) AS total FROM dao_admins WHERE is_active=TRUE'),
    ]);
    return res.json({ success: true, data: {
      total_dao_stakers: parseInt(stakers.rows[0].total),
      total_dao_rewards_distributed: parseFloat(rewards.rows[0].total),
      active_dao_admins: parseInt(admins.rows[0].total),
    }});
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to fetch DAO dashboard' }); }
});

// GET /analytics/claims
router.get('/analytics/claims', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const pool = getPool();
    const [data, count] = await Promise.all([
      pool.query("SELECT id,wallet_address,transaction_type,amount,token_symbol,created_at FROM transactions WHERE transaction_type='DAO_CLAIM' ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]),
      pool.query("SELECT COUNT(*) AS total FROM transactions WHERE transaction_type='DAO_CLAIM'"),
    ]);
    return res.json({ success: true, data: data.rows, pagination: { total: parseInt(count.rows[0].total), limit, offset } });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to fetch DAO claims analytics' }); }
});

// GET /analytics/airdrop-claims
router.get('/analytics/airdrop-claims', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const pool = getPool();
    const [data, count] = await Promise.all([
      pool.query("SELECT id,wallet_address,transaction_type,amount,token_symbol,created_at FROM transactions WHERE transaction_type='DAO_AIRDROP_CLAIM' ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]),
      pool.query("SELECT COUNT(*) AS total FROM transactions WHERE transaction_type='DAO_AIRDROP_CLAIM'"),
    ]);
    return res.json({ success: true, data: data.rows, pagination: { total: parseInt(count.rows[0].total), limit, offset } });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to fetch DAO airdrop claims analytics' }); }
});

// GET /rewards-breakdown
router.get('/rewards-breakdown', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await getPool().query(
      `SELECT sn.owner_wallet AS wallet_address, dtr.token_symbol, dtr.token_address,
              SUM(dtr.multiplier * EXTRACT(EPOCH FROM (NOW() - COALESCE(sn.dao_last_claim_timestamp, sn.stake_timestamp))) / 86400.0) AS total_pending_dao_rewards
       FROM staked_nfts sn JOIN dao_trait_rewards dtr ON dtr.is_active=TRUE
       WHERE sn.owner_wallet IS NOT NULL
       GROUP BY sn.owner_wallet, dtr.token_symbol, dtr.token_address
       HAVING SUM(dtr.multiplier * EXTRACT(EPOCH FROM (NOW() - COALESCE(sn.dao_last_claim_timestamp, sn.stake_timestamp))) / 86400.0) > 0
       ORDER BY sn.owner_wallet, dtr.token_symbol`
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to fetch DAO rewards breakdown' }); }
});

// GET /collections (needed by DAO admin UI dropdowns)
router.get('/collections', verifyJWT, verifyDaoAdmin, async (req, res) => {
  try {
    const result = await getPool().query('SELECT id, name FROM collections ORDER BY name');
    return res.json({ success: true, data: result.rows });
  } catch (e) { return res.status(500).json({ success: false, message: 'Failed to fetch collections' }); }
});

module.exports = router;
