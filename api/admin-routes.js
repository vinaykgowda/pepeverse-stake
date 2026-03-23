// api/admin-routes.js
// Fully self-contained: no imports from backend/ to avoid bcrypt native binary issues on Vercel

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const axios = require('axios');

// ── Inline DB pool ──────────────────────────────────────────────────────────
let _pool = null;
function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return _pool;
}

// ── Inline auth middleware ──────────────────────────────────────────────────
function verifyJWT(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ success: false, message: 'No token, authorization denied' });
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ success: false, message: 'JWT_SECRET not configured' });
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token is not valid' });
  }
}

function verifyAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
  }
  next();
}

// ── Inline Helius token balance helper ─────────────────────────────────────
async function getTokenBalance(ownerAddress, mintAddress) {
  const baseUrl = process.env.HELIUS_MAINNET_ENDPOINT;
  const apiKey = process.env.HELIUS_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Helius not configured');
  const response = await axios.post(
    baseUrl,
    { jsonrpc: '2.0', id: 'admin-routes', method: 'getTokenAccountsByOwner',
      params: [ownerAddress, { mint: mintAddress }, { encoding: 'jsonParsed' }] },
    { headers: { 'Content-Type': 'application/json' }, params: { 'api-key': apiKey }, timeout: 10000 }
  );
  if (response.data.error) throw new Error(`Helius error: ${response.data.error.message}`);
  const accounts = response.data.result?.value ?? [];
  return accounts.reduce((sum, acct) => sum + (acct?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0);
}

// ── Inline snapshot service ─────────────────────────────────────────────────
async function generateSnapshot(airdropConfigId, client) {
  const configResult = await client.query(
    `SELECT id, collection_id, airdrop_type, amount_per_nft, minimum_threshold, trait_type, trait_value, status
     FROM airdrop_configs WHERE id = $1`,
    [airdropConfigId]
  );
  if (configResult.rows.length === 0) throw new Error(`Airdrop config not found: ${airdropConfigId}`);
  const config = configResult.rows[0];

  let eligibleWallets;
  if (config.airdrop_type === 'threshold') {
    const r = await client.query(
      `SELECT wallet_address, COUNT(*) AS staked_count FROM staked_nfts
       WHERE collection_id = $1 GROUP BY wallet_address HAVING COUNT(*) >= $2`,
      [config.collection_id, config.minimum_threshold]
    );
    eligibleWallets = r.rows.map(row => ({
      wallet_address: row.wallet_address,
      eligible_nft_count: parseInt(row.staked_count, 10),
      token_amount: (parseInt(row.staked_count, 10) * parseFloat(config.amount_per_nft)).toFixed(9),
    }));
  } else if (config.airdrop_type === 'trait') {
    const traitFilter = JSON.stringify([{ trait_type: config.trait_type, value: config.trait_value }]);
    const r = await client.query(
      `SELECT wallet_address, COUNT(*) AS matching_count FROM staked_nfts
       WHERE collection_id = $1 AND traits::jsonb @> $2::jsonb
       GROUP BY wallet_address HAVING COUNT(*) > 0`,
      [config.collection_id, traitFilter]
    );
    eligibleWallets = r.rows.map(row => ({
      wallet_address: row.wallet_address,
      eligible_nft_count: parseInt(row.matching_count, 10),
      token_amount: (parseInt(row.matching_count, 10) * parseFloat(config.amount_per_nft)).toFixed(9),
    }));
  } else {
    throw new Error(`Unknown airdrop_type: ${config.airdrop_type}`);
  }

  if (eligibleWallets.length > 0) {
    await client.query(
      `INSERT INTO airdrop_snapshots (airdrop_config_id, wallet_address, eligible_nft_count, token_amount)
       SELECT $1, UNNEST($2::text[]), UNNEST($3::integer[]), UNNEST($4::numeric[])`,
      [airdropConfigId, eligibleWallets.map(w => w.wallet_address),
       eligibleWallets.map(w => w.eligible_nft_count), eligibleWallets.map(w => w.token_amount)]
    );
  }

  await client.query(
    `UPDATE airdrop_configs SET status = 'active', activated_at = NOW(),
     expires_at = NOW() + INTERVAL '7 days', updated_at = NOW() WHERE id = $1`,
    [airdropConfigId]
  );

  return {
    eligible_count: eligibleWallets.length,
    total_tokens: eligibleWallets.reduce((sum, w) => sum + parseFloat(w.token_amount), 0).toFixed(9),
  };
}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /api/v1/admin/token-balances
router.get('/token-balances', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const tokensResult = await pool.query(`
      SELECT DISTINCT token_address, token_symbol, COALESCE(token_decimals, 9) AS token_decimals
      FROM (
        SELECT token_address, token_symbol, token_decimals FROM collection_rewards
        UNION
        SELECT token_address, token_symbol, 9 AS token_decimals FROM trait_rewards
      ) all_tokens ORDER BY token_symbol
    `);
    const walletResult = await pool.query(`SELECT value FROM settings WHERE key_name = 'rewards_wallet'`);
    const rewardsWallet = walletResult.rows[0]?.value;
    if (!rewardsWallet) return res.json({ success: true, data: [], walletNotConfigured: true });

    const data = await Promise.all(
      tokensResult.rows.map(async ({ token_address, token_symbol, token_decimals }) => {
        try {
          const balance = await getTokenBalance(rewardsWallet, token_address);
          return { token_address, token_symbol, token_decimals, balance };
        } catch (err) {
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

// GET /api/v1/admin/tokens
router.get('/tokens', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT DISTINCT token_address, token_symbol, COALESCE(token_decimals, 9) AS token_decimals
      FROM (
        SELECT token_address, token_symbol, token_decimals FROM collection_rewards
        UNION
        SELECT token_address, token_symbol, 9 AS token_decimals FROM trait_rewards
      ) all_tokens ORDER BY token_symbol
    `);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in GET /admin/tokens:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tokens' });
  }
});

// GET /api/v1/admin/airdrops
router.get('/airdrops', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { collection_id } = req.query;
    const params = [];
    let whereClause = '';
    if (collection_id) { params.push(collection_id); whereClause = `WHERE ac.collection_id = $1`; }

    const result = await pool.query(
      `SELECT ac.id, ac.collection_id, c.name AS collection_name,
         ac.airdrop_type, ac.token_address, ac.token_symbol, ac.token_decimals,
         ac.amount_per_nft, ac.minimum_threshold, ac.trait_type, ac.trait_value,
         ac.status, ac.activated_at, ac.expires_at, ac.created_at, ac.updated_at,
         COUNT(snap.id) AS eligible_count
       FROM airdrop_configs ac
       JOIN collections c ON ac.collection_id = c.id
       LEFT JOIN airdrop_snapshots snap ON snap.airdrop_config_id = ac.id
       ${whereClause}
       GROUP BY ac.id, c.name ORDER BY ac.created_at DESC`,
      params
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in GET /admin/airdrops:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch airdrop configs' });
  }
});

// POST /api/v1/admin/airdrops
router.post('/airdrops', verifyJWT, verifyAdmin, async (req, res) => {
  const { collection_id, airdrop_type, token_address, token_symbol, token_decimals,
          amount_per_nft, minimum_threshold, trait_type, trait_value } = req.body;

  if (!collection_id || !token_address || !token_symbol || amount_per_nft === undefined || !airdrop_type)
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  if (!['threshold', 'trait'].includes(airdrop_type))
    return res.status(400).json({ success: false, message: 'airdrop_type must be "threshold" or "trait"' });
  if (airdrop_type === 'threshold' && (!minimum_threshold || Number(minimum_threshold) <= 0))
    return res.status(400).json({ success: false, message: 'threshold type requires minimum_threshold > 0' });
  if (airdrop_type === 'trait' && (!trait_type || !trait_value))
    return res.status(400).json({ success: false, message: 'trait type requires both trait_type and trait_value' });

  try {
    const pool = getPool();
    let maxCost = 0;
    if (airdrop_type === 'threshold') {
      const r = await pool.query(
        `SELECT SUM(staked_count * $2) AS max_cost FROM (
           SELECT wallet_address, COUNT(*) AS staked_count FROM staked_nfts
           WHERE collection_id = $1 GROUP BY wallet_address HAVING COUNT(*) >= $3
         ) eligible`,
        [collection_id, amount_per_nft, minimum_threshold]
      );
      maxCost = parseFloat(r.rows[0]?.max_cost ?? 0);
    } else {
      const r = await pool.query(
        `SELECT SUM(matching_count * $2) AS max_cost FROM (
           SELECT wallet_address, COUNT(*) AS matching_count FROM staked_nfts
           WHERE collection_id = $1 AND traits::jsonb @> $3::jsonb
           GROUP BY wallet_address HAVING COUNT(*) > 0
         ) eligible`,
        [collection_id, amount_per_nft, JSON.stringify([{ trait_type, value: trait_value }])]
      );
      maxCost = parseFloat(r.rows[0]?.max_cost ?? 0);
    }

    const walletResult = await pool.query(`SELECT value FROM settings WHERE key_name = 'rewards_wallet'`);
    const rewardsWallet = walletResult.rows[0]?.value;
    let currentBalance = 0, balanceCheckFailed = false;
    if (rewardsWallet) {
      try { currentBalance = await getTokenBalance(rewardsWallet, token_address); }
      catch { balanceCheckFailed = true; }
    }

    const insertResult = await pool.query(
      `INSERT INTO airdrop_configs
         (collection_id, airdrop_type, token_address, token_symbol, token_decimals,
          amount_per_nft, minimum_threshold, trait_type, trait_value, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'inactive') RETURNING *`,
      [collection_id, airdrop_type, token_address, token_symbol,
       token_decimals !== undefined ? token_decimals : 9, amount_per_nft,
       airdrop_type === 'threshold' ? minimum_threshold : null,
       airdrop_type === 'trait' ? trait_type : null,
       airdrop_type === 'trait' ? trait_value : null]
    );
    const newConfig = insertResult.rows[0];
    if (!balanceCheckFailed && rewardsWallet && currentBalance < maxCost)
      return res.json({ success: true, data: newConfig, warning: true, shortfall: maxCost - currentBalance });
    return res.json({ success: true, data: newConfig });
  } catch (error) {
    console.error('Error in POST /admin/airdrops:', error);
    return res.status(500).json({ success: false, message: 'Failed to create airdrop config' });
  }
});

// PUT /api/v1/admin/airdrops/:id
router.put('/airdrops/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { token_address, token_symbol, token_decimals, amount_per_nft,
          minimum_threshold, trait_type, trait_value, airdrop_type, collection_id } = req.body;
  try {
    const pool = getPool();
    const existingResult = await pool.query('SELECT * FROM airdrop_configs WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Airdrop config not found' });
    const existing = existingResult.rows[0];
    if (existing.status === 'active') return res.status(409).json({ success: false, message: 'Cannot edit an active airdrop config. Deactivate it first.' });

    const updatedType = airdrop_type !== undefined ? airdrop_type : existing.airdrop_type;
    const updatedThreshold = minimum_threshold !== undefined ? minimum_threshold : existing.minimum_threshold;
    const updatedTraitType = trait_type !== undefined ? trait_type : existing.trait_type;
    const updatedTraitValue = trait_value !== undefined ? trait_value : existing.trait_value;

    if (airdrop_type !== undefined && !['threshold', 'trait'].includes(airdrop_type))
      return res.status(400).json({ success: false, message: 'airdrop_type must be "threshold" or "trait"' });
    if (updatedType === 'threshold' && (!updatedThreshold || Number(updatedThreshold) <= 0))
      return res.status(400).json({ success: false, message: 'threshold type requires minimum_threshold > 0' });
    if (updatedType === 'trait' && (!updatedTraitType || !updatedTraitValue))
      return res.status(400).json({ success: false, message: 'trait type requires both trait_type and trait_value' });

    const updates = [], values = [];
    let p = 1;
    if (token_address !== undefined) { updates.push(`token_address = $${p++}`); values.push(token_address); }
    if (token_symbol !== undefined) { updates.push(`token_symbol = $${p++}`); values.push(token_symbol); }
    if (token_decimals !== undefined) { updates.push(`token_decimals = $${p++}`); values.push(token_decimals); }
    if (amount_per_nft !== undefined) { updates.push(`amount_per_nft = $${p++}`); values.push(amount_per_nft); }
    if (airdrop_type !== undefined) { updates.push(`airdrop_type = $${p++}`); values.push(airdrop_type); }
    if (collection_id !== undefined) { updates.push(`collection_id = $${p++}`); values.push(collection_id); }
    updates.push(`minimum_threshold = $${p++}`); values.push(updatedType === 'threshold' ? updatedThreshold : null);
    updates.push(`trait_type = $${p++}`); values.push(updatedType === 'trait' ? updatedTraitType : null);
    updates.push(`trait_value = $${p++}`); values.push(updatedType === 'trait' ? updatedTraitValue : null);
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateResult = await pool.query(
      `UPDATE airdrop_configs SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values
    );
    return res.json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error('Error in PUT /admin/airdrops/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to update airdrop config' });
  }
});

// POST /api/v1/admin/airdrops/:id/activate
router.post('/airdrops/:id/activate', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const pool = getPool();
  try {
    const existingResult = await pool.query('SELECT id, status FROM airdrop_configs WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Airdrop config not found' });
    if (existingResult.rows[0].status === 'active') return res.status(409).json({ success: false, message: 'Airdrop config is already active' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to activate airdrop config' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await generateSnapshot(parseInt(id, 10), client);
    await client.query('COMMIT');
    return res.json({ success: true, data: result });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in POST /admin/airdrops/:id/activate:', error);
    return res.status(500).json({ success: false, message: 'Failed to activate airdrop config' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/airdrops/:id/deactivate
router.post('/airdrops/:id/deactivate', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const existingResult = await pool.query('SELECT id FROM airdrop_configs WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Airdrop config not found' });
    const updateResult = await pool.query(
      `UPDATE airdrop_configs SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *`, [id]
    );
    return res.json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error('Error in POST /admin/airdrops/:id/deactivate:', error);
    return res.status(500).json({ success: false, message: 'Failed to deactivate airdrop config' });
  }
});

// DELETE /api/v1/admin/airdrops/:id
router.delete('/airdrops/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const existingResult = await pool.query('SELECT id FROM airdrop_configs WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Airdrop config not found' });
    await pool.query('DELETE FROM airdrop_configs WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Airdrop config deleted' });
  } catch (error) {
    console.error('Error in DELETE /admin/airdrops/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete airdrop config' });
  }
});

// GET /api/v1/admin/airdrops/:id/eligible-wallets
router.get('/airdrops/:id/eligible-wallets', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const configResult = await pool.query('SELECT * FROM airdrop_configs WHERE id = $1', [id]);
    if (configResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Airdrop config not found' });
    const config = configResult.rows[0];

    if (config.status === 'active') {
      const snapshotResult = await pool.query(
        `SELECT wallet_address, eligible_nft_count, token_amount, claimed
         FROM airdrop_snapshots WHERE airdrop_config_id = $1 ORDER BY token_amount DESC`, [id]
      );
      return res.json({ success: true, data: { wallets: snapshotResult.rows, source: 'snapshot' } });
    }

    let wallets = [];
    if (config.airdrop_type === 'threshold') {
      const r = await pool.query(
        `SELECT wallet_address, COUNT(*) AS eligible_nft_count FROM staked_nfts
         WHERE collection_id = $1 GROUP BY wallet_address HAVING COUNT(*) >= $2`,
        [config.collection_id, config.minimum_threshold]
      );
      wallets = r.rows.map(row => ({
        wallet_address: row.wallet_address,
        eligible_nft_count: parseInt(row.eligible_nft_count),
        token_amount: parseInt(row.eligible_nft_count) * parseFloat(config.amount_per_nft),
        claimed: false
      }));
    } else {
      const r = await pool.query(
        `SELECT wallet_address, COUNT(*) AS eligible_nft_count FROM staked_nfts
         WHERE collection_id = $1 AND traits::jsonb @> $2::jsonb
         GROUP BY wallet_address HAVING COUNT(*) > 0`,
        [config.collection_id, JSON.stringify([{ trait_type: config.trait_type, value: config.trait_value }])]
      );
      wallets = r.rows.map(row => ({
        wallet_address: row.wallet_address,
        eligible_nft_count: parseInt(row.eligible_nft_count),
        token_amount: parseInt(row.eligible_nft_count) * parseFloat(config.amount_per_nft),
        claimed: false
      }));
    }
    return res.json({ success: true, data: { wallets, source: 'live' } });
  } catch (error) {
    console.error('Error in GET /admin/airdrops/:id/eligible-wallets:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch eligible wallets' });
  }
});


// GET /api/v1/admin/analytics/claims
router.get('/analytics/claims', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { start_date, end_date, wallet_address, page = 1, limit = 50, export: exportFormat } = req.query;
    const pageLimit = Math.min(parseInt(limit, 10) || 50, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * pageLimit;

    const conditions = [`t.transaction_type = 'CLAIM'`];
    const params = [];
    let p = 1;
    if (start_date) { conditions.push(`t.created_at >= $${p++}`); params.push(start_date); }
    if (end_date) { conditions.push(`t.created_at <= $${p++}`); params.push(end_date); }
    if (wallet_address) { conditions.push(`t.wallet_address ILIKE $${p++}`); params.push(wallet_address); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    // transactions table has no collection_id column — omit join
    const baseSelect = `FROM transactions t ${whereClause}`;

    const statsResult = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(t.amount), 0) AS total_distributed,
              COUNT(DISTINCT t.wallet_address) AS unique_wallets ${baseSelect}`,
      params
    );
    const stats = {
      count: parseInt(statsResult.rows[0].count),
      total_distributed: parseFloat(statsResult.rows[0].total_distributed),
      unique_wallets: parseInt(statsResult.rows[0].unique_wallets)
    };

    if (exportFormat === 'csv') {
      const csvResult = await pool.query(
        `SELECT t.wallet_address, '' AS collection_name,
                '' AS token_symbol, t.amount, t.created_at AS timestamp,
                COALESCE(t.transaction_hash, '') AS transaction_hash
         ${baseSelect} ORDER BY t.created_at DESC`,
        params
      );
      const csv = ['wallet_address,collection_name,token_symbol,amount,timestamp,transaction_hash',
        ...csvResult.rows.map(row =>
          [row.wallet_address, row.collection_name, row.token_symbol, row.amount, row.timestamp, row.transaction_hash]
            .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="claims-export.csv"');
      return res.send(csv);
    }

    const recordsResult = await pool.query(
      `SELECT t.id, t.wallet_address, '' AS collection_name,
              '' AS token_symbol, t.amount, t.created_at AS timestamp,
              COALESCE(t.transaction_hash, '') AS transaction_hash, t.status
       ${baseSelect} ORDER BY t.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, pageLimit, offset]
    );
    return res.json({ success: true, data: { records: recordsResult.rows, total: stats.count, stats } });
  } catch (error) {
    console.error('Error in GET /admin/analytics/claims:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch claims analytics' });
  }
});

// GET /api/v1/admin/analytics/airdrop-claims
router.get('/analytics/airdrop-claims', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { start_date, end_date, collection_id, wallet_address, airdrop_config_id,
            page = 1, limit = 50, export: exportFormat } = req.query;
    const pageLimit = Math.min(parseInt(limit, 10) || 50, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * pageLimit;

    const conditions = [`snap.claimed = true`];
    const params = [];
    let p = 1;
    if (start_date) { conditions.push(`snap.claimed_at >= $${p++}`); params.push(start_date); }
    if (end_date) { conditions.push(`snap.claimed_at <= $${p++}`); params.push(end_date); }
    if (collection_id) { conditions.push(`ac.collection_id = $${p++}`); params.push(collection_id); }
    if (wallet_address) { conditions.push(`snap.wallet_address ILIKE $${p++}`); params.push(wallet_address); }
    if (airdrop_config_id) { conditions.push(`snap.airdrop_config_id = $${p++}`); params.push(airdrop_config_id); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const baseFrom = `FROM airdrop_snapshots snap
      JOIN airdrop_configs ac ON snap.airdrop_config_id = ac.id
      JOIN collections c ON ac.collection_id = c.id
      ${whereClause}`;

    const statsResult = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(snap.token_amount), 0) AS total_airdropped,
              COUNT(DISTINCT snap.wallet_address) AS unique_wallets ${baseFrom}`,
      params
    );
    const stats = {
      count: parseInt(statsResult.rows[0].count),
      total_airdropped: parseFloat(statsResult.rows[0].total_airdropped),
      unique_wallets: parseInt(statsResult.rows[0].unique_wallets)
    };

    if (exportFormat === 'csv') {
      const csvResult = await pool.query(
        `SELECT snap.wallet_address, c.name AS collection_name,
                ac.token_symbol || ' (' || ac.collection_id || ')' AS airdrop_name,
                ac.token_symbol, snap.token_amount AS amount_claimed, snap.claimed_at AS claim_timestamp,
                COALESCE(snap.claim_tx_hash, '') AS transaction_hash, ac.activated_at, ac.expires_at
         ${baseFrom} ORDER BY snap.claimed_at DESC`,
        params
      );
      const csv = ['wallet_address,collection_name,airdrop_name,token_symbol,amount_claimed,claim_timestamp,transaction_hash,activated_at,expires_at',
        ...csvResult.rows.map(row =>
          [row.wallet_address, row.collection_name, row.airdrop_name, row.token_symbol,
           row.amount_claimed, row.claim_timestamp, row.transaction_hash, row.activated_at, row.expires_at]
            .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="airdrop-claims-export.csv"');
      return res.send(csv);
    }

    const recordsResult = await pool.query(
      `SELECT snap.id, snap.wallet_address, c.name AS collection_name,
              ac.token_symbol || ' (' || ac.collection_id || ')' AS airdrop_name,
              ac.token_symbol, snap.token_amount AS amount_claimed, snap.claimed_at,
              COALESCE(snap.claim_tx_hash, '') AS transaction_hash,
              ac.activated_at, ac.expires_at, snap.airdrop_config_id, snap.eligible_nft_count
       ${baseFrom} ORDER BY snap.claimed_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, pageLimit, offset]
    );
    return res.json({ success: true, data: { records: recordsResult.rows, total: stats.count, stats } });
  } catch (error) {
    console.error('Error in GET /admin/analytics/airdrop-claims:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch airdrop claims analytics' });
  }
});

module.exports = router;
