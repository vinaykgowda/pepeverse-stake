// api/admin-routes.js
// Fully self-contained: no imports from backend/ to avoid bcrypt native binary issues on Vercel

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const axios = require('axios');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
      `SELECT owner_wallet AS wallet_address, COUNT(*) AS staked_count FROM staked_nfts
       WHERE collection_id = $1 GROUP BY owner_wallet HAVING COUNT(*) >= $2`,
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
      `SELECT owner_wallet AS wallet_address, COUNT(*) AS matching_count FROM staked_nfts
       WHERE collection_id = $1 AND traits::jsonb @> $2::jsonb
       GROUP BY owner_wallet HAVING COUNT(*) > 0`,
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

// GET /api/v1/admin/dashboard
router.get('/dashboard', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [collectionsRes, stakedRes, walletsRes, rewardsRes, collectionDetailRes, rewardRatesRes, activeAirdropRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM collections`),
      pool.query(`SELECT COUNT(*) AS total FROM staked_nfts`),
      pool.query(`SELECT COUNT(DISTINCT owner_wallet) AS total FROM staked_nfts`),
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE transaction_type = 'CLAIM' AND status = 'completed'`),
      // Per-collection breakdown: name, staked count
      pool.query(`
        SELECT c.id, c.name, c.stake_fee, c.unstake_fee, c.claim_fee,
          COUNT(sn.id) AS staked_count,
          COUNT(DISTINCT sn.owner_wallet) AS unique_stakers
        FROM collections c
        LEFT JOIN staked_nfts sn ON sn.collection_id = c.id
        GROUP BY c.id, c.name, c.stake_fee, c.unstake_fee, c.claim_fee
        ORDER BY c.id
      `),
      // Daily rewards per token: base rate * staked count + trait bonuses
      pool.query(`
        SELECT
          cr.token_symbol,
          cr.token_address,
          SUM(cr.daily_rate) AS base_daily_per_nft,
          COUNT(sn.id) AS staked_count,
          SUM(cr.daily_rate) * COUNT(sn.id) AS base_daily_total
        FROM collection_rewards cr
        JOIN staked_nfts sn ON sn.collection_id = cr.collection_id
        WHERE cr.is_active = true
        GROUP BY cr.token_symbol, cr.token_address
      `),
      // Active airdrops
      pool.query(`
        SELECT ac.id, ac.token_symbol, ac.amount_per_nft, ac.airdrop_type,
          ac.expires_at, c.name AS collection_name,
          COUNT(snap.id) AS total_eligible,
          COUNT(CASE WHEN snap.claimed = true THEN 1 END) AS claimed_count,
          COALESCE(SUM(snap.token_amount), 0) AS total_tokens
        FROM airdrop_configs ac
        JOIN collections c ON ac.collection_id = c.id
        LEFT JOIN airdrop_snapshots snap ON snap.airdrop_config_id = ac.id
        WHERE ac.status = 'active' AND ac.expires_at > NOW()
        GROUP BY ac.id, ac.token_symbol, ac.amount_per_nft, ac.airdrop_type, ac.expires_at, c.name
        ORDER BY ac.expires_at ASC
      `),
    ]);

    return res.json({
      success: true,
      data: {
        total_collections: parseInt(collectionsRes.rows[0].total),
        total_staked_nfts: parseInt(stakedRes.rows[0].total),
        total_staking_wallets: parseInt(walletsRes.rows[0].total),
        total_rewards_distributed: parseFloat(rewardsRes.rows[0].total),
        collections: collectionDetailRes.rows.map(r => ({
          id: r.id,
          name: r.name,
          staked_count: parseInt(r.staked_count),
          unique_stakers: parseInt(r.unique_stakers),
          stake_fee: parseFloat(r.stake_fee || 0),
          unstake_fee: parseFloat(r.unstake_fee || 0),
          claim_fee: parseFloat(r.claim_fee || 0),
        })),
        daily_rewards: rewardRatesRes.rows.map(r => ({
          token_symbol: r.token_symbol,
          token_address: r.token_address,
          staked_count: parseInt(r.staked_count),
          daily_total: parseFloat(r.base_daily_total || 0),
        })),
        active_airdrops: activeAirdropRes.rows.map(r => ({
          id: r.id,
          collection_name: r.collection_name,
          token_symbol: r.token_symbol,
          airdrop_type: r.airdrop_type,
          total_eligible: parseInt(r.total_eligible),
          claimed_count: parseInt(r.claimed_count),
          total_tokens: parseFloat(r.total_tokens),
          expires_at: r.expires_at,
        })),
      }
    });
  } catch (error) {
    console.error('Error in GET /admin/dashboard:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
});

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
         COUNT(snap.id) AS eligible_count,
         COUNT(CASE WHEN snap.claimed = false THEN 1 END) AS remaining_count
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

// POST /api/v1/admin/airdrops/preview — calculate eligibility without saving
router.post('/airdrops/preview', verifyJWT, verifyAdmin, async (req, res) => {
  const { collection_id, airdrop_type, token_address, amount_per_nft,
          minimum_threshold, trait_type, trait_value } = req.body;

  if (!collection_id || !token_address || amount_per_nft === undefined || !airdrop_type)
    return res.status(400).json({ success: false, message: 'Missing required fields' });

  try {
    const pool = getPool();
    let eligibleWallets = [];

    if (airdrop_type === 'threshold') {
      const r = await pool.query(
        `SELECT owner_wallet, COUNT(*) AS nft_count
         FROM staked_nfts WHERE collection_id = $1
         GROUP BY owner_wallet HAVING COUNT(*) >= $2
         ORDER BY nft_count DESC`,
        [collection_id, minimum_threshold]
      );
      eligibleWallets = r.rows.map(row => ({
        wallet: row.owner_wallet,
        nft_count: parseInt(row.nft_count),
        token_amount: parseInt(row.nft_count) * parseFloat(amount_per_nft),
      }));
    } else if (airdrop_type === 'trait') {
      const traitFilter = JSON.stringify([{ trait_type, value: trait_value }]);
      const r = await pool.query(
        `SELECT owner_wallet, COUNT(*) AS nft_count
         FROM staked_nfts WHERE collection_id = $1 AND traits::jsonb @> $2::jsonb
         GROUP BY owner_wallet HAVING COUNT(*) > 0
         ORDER BY nft_count DESC`,
        [collection_id, traitFilter]
      );
      eligibleWallets = r.rows.map(row => ({
        wallet: row.owner_wallet,
        nft_count: parseInt(row.nft_count),
        token_amount: parseInt(row.nft_count) * parseFloat(amount_per_nft),
      }));
    }

    const totalTokens = eligibleWallets.reduce((s, w) => s + w.token_amount, 0);

    // Check treasury balance
    const walletResult = await pool.query(`SELECT value FROM settings WHERE key_name = 'rewards_wallet'`);
    const rewardsWallet = walletResult.rows[0]?.value;
    let treasuryBalance = null;
    let sufficient = true;
    if (rewardsWallet) {
      try { treasuryBalance = await getTokenBalance(rewardsWallet, token_address); }
      catch { treasuryBalance = null; }
      if (treasuryBalance !== null) sufficient = treasuryBalance >= totalTokens;
    }

    return res.json({
      success: true,
      data: {
        eligible_wallets: eligibleWallets,
        total_wallets: eligibleWallets.length,
        total_tokens: totalTokens,
        treasury_balance: treasuryBalance,
        sufficient,
        shortfall: sufficient ? 0 : totalTokens - (treasuryBalance ?? 0),
      }
    });
  } catch (error) {
    console.error('Error in POST /admin/airdrops/preview:', error);
    return res.status(500).json({ success: false, message: 'Failed to preview airdrop' });
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
           SELECT owner_wallet, COUNT(*) AS staked_count FROM staked_nfts
           WHERE collection_id = $1 GROUP BY owner_wallet HAVING COUNT(*) >= $3
         ) eligible`,
        [collection_id, amount_per_nft, minimum_threshold]
      );
      maxCost = parseFloat(r.rows[0]?.max_cost ?? 0);
    } else {
      const r = await pool.query(
        `SELECT SUM(matching_count * $2) AS max_cost FROM (
           SELECT owner_wallet, COUNT(*) AS matching_count FROM staked_nfts
           WHERE collection_id = $1 AND traits::jsonb @> $3::jsonb
           GROUP BY owner_wallet HAVING COUNT(*) > 0
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
        `SELECT owner_wallet AS wallet_address, COUNT(*) AS eligible_nft_count FROM staked_nfts
         WHERE collection_id = $1 GROUP BY owner_wallet HAVING COUNT(*) >= $2`,
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
        `SELECT owner_wallet AS wallet_address, COUNT(*) AS eligible_nft_count FROM staked_nfts
         WHERE collection_id = $1 AND traits::jsonb @> $2::jsonb
         GROUP BY owner_wallet HAVING COUNT(*) > 0`,
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
    if (wallet_address) { conditions.push(`t.wallet_address ILIKE $${p++}`); params.push(`%${wallet_address}%`); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Stats: total claims, unique wallets
    const statsResult = await pool.query(
      `SELECT COUNT(*) AS total_claims, COUNT(DISTINCT t.wallet_address) AS unique_wallets
       FROM transactions t ${whereClause}`,
      params
    );

    // Per-token breakdown
    const tokenStatsResult = await pool.query(
      `SELECT
         COALESCE(cr.token_symbol, tr.token_symbol, t.token_address) AS token_symbol,
         t.token_address,
         COUNT(*) AS claim_count,
         SUM(t.amount) AS total_amount
       FROM transactions t
       LEFT JOIN collection_rewards cr ON cr.token_address = t.token_address AND cr.is_active = TRUE
       LEFT JOIN trait_rewards tr ON tr.token_address = t.token_address AND tr.is_active = TRUE
       ${whereClause}
       GROUP BY t.token_address, cr.token_symbol, tr.token_symbol
       ORDER BY total_amount DESC`,
      params
    );

    const stats = {
      total_claims: parseInt(statsResult.rows[0].total_claims),
      unique_wallets: parseInt(statsResult.rows[0].unique_wallets),
      by_token: tokenStatsResult.rows.map(r => ({
        token_symbol: r.token_symbol,
        token_address: r.token_address,
        claim_count: parseInt(r.claim_count),
        total_amount: parseFloat(r.total_amount)
      }))
    };

    if (exportFormat === 'csv') {
      const csvResult = await pool.query(
        `SELECT t.wallet_address,
                COALESCE(cr.token_symbol, tr.token_symbol, t.token_address) AS token_symbol,
                t.amount, t.created_at AS timestamp,
                COALESCE(t.transaction_hash, '') AS transaction_hash, t.status
         FROM transactions t
         LEFT JOIN collection_rewards cr ON cr.token_address = t.token_address AND cr.is_active = TRUE
         LEFT JOIN trait_rewards tr ON tr.token_address = t.token_address AND tr.is_active = TRUE
         ${whereClause} ORDER BY t.created_at DESC`,
        params
      );
      const csv = ['wallet_address,token_symbol,amount,timestamp,transaction_hash,status',
        ...csvResult.rows.map(row =>
          [row.wallet_address, row.token_symbol, row.amount, row.timestamp, row.transaction_hash, row.status]
            .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="claims-export.csv"');
      return res.send(csv);
    }

    const recordsResult = await pool.query(
      `SELECT t.id, t.wallet_address,
              COALESCE(cr.token_symbol, tr.token_symbol, t.token_address) AS token_symbol,
              t.token_address, t.amount, t.created_at AS timestamp,
              COALESCE(t.transaction_hash, '') AS transaction_hash, t.status
       FROM transactions t
       LEFT JOIN collection_rewards cr ON cr.token_address = t.token_address AND cr.is_active = TRUE
       LEFT JOIN trait_rewards tr ON tr.token_address = t.token_address AND tr.is_active = TRUE
       ${whereClause} ORDER BY t.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, pageLimit, offset]
    );
    return res.json({ success: true, data: { records: recordsResult.rows, total: stats.total_claims, stats } });
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

// ── Collections CRUD ────────────────────────────────────────────────────────

// GET /api/v1/admin/collections
router.get('/collections', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM staked_nfts sn WHERE sn.collection_id = c.id) AS staked_count,
        CASE
          WHEN c.hashlist IS NOT NULL
          THEN array_length(regexp_split_to_array(trim(c.hashlist), E'\\\\+\\n|\\n\\\\+|\\\\+'), 1)
          ELSE 0
        END AS hashlist_count
      FROM collections c ORDER BY c.id
    `);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in GET /admin/collections:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch collections' });
  }
});

// POST /api/v1/admin/collections — multipart/form-data
router.post('/collections', verifyJWT, verifyAdmin, upload.single('hashlist'), async (req, res) => {
  try {
    const { name, creator_address } = req.body;
    if (!name || !creator_address) return res.status(400).json({ success: false, message: 'name and creator_address are required' });

    let hashlistText = null;
    if (req.file) {
      const raw = req.file.buffer.toString('utf8');
      // Support JSON array or newline-separated
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) hashlistText = arr.join('+\n') + '+\n';
        else hashlistText = raw;
      } catch {
        hashlistText = raw;
      }
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO collections (name, creator_address, hashlist, stake_fee, unstake_fee, claim_fee)
       VALUES ($1, $2, $3, 0.001, 0.001, 0.001) RETURNING *`,
      [name, creator_address, hashlistText]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in POST /admin/collections:', error);
    return res.status(500).json({ success: false, message: 'Failed to create collection' });
  }
});

// PUT /api/v1/admin/collections/:id — handles both JSON and multipart
router.put('/collections/:id', verifyJWT, verifyAdmin, upload.single('hashlist'), async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT * FROM collections WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Collection not found' });

    const { name, creator_address, stake_fee, unstake_fee, claim_fee } = req.body;
    const updates = [], values = [];
    let p = 1;
    if (name !== undefined) { updates.push(`name = $${p++}`); values.push(name); }
    if (creator_address !== undefined) { updates.push(`creator_address = $${p++}`); values.push(creator_address); }
    if (stake_fee !== undefined) { updates.push(`stake_fee = $${p++}`); values.push(parseFloat(stake_fee)); }
    if (unstake_fee !== undefined) { updates.push(`unstake_fee = $${p++}`); values.push(parseFloat(unstake_fee)); }
    if (claim_fee !== undefined) { updates.push(`claim_fee = $${p++}`); values.push(parseFloat(claim_fee)); }
    if (req.file) {
      const raw = req.file.buffer.toString('utf8');
      let hashlistText;
      try {
        const arr = JSON.parse(raw);
        hashlistText = Array.isArray(arr) ? arr.join('+\n') + '+\n' : raw;
      } catch { hashlistText = raw; }
      updates.push(`hashlist = $${p++}`); values.push(hashlistText);
    }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    values.push(id);
    const result = await pool.query(`UPDATE collections SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in PUT /admin/collections/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to update collection' });
  }
});

// DELETE /api/v1/admin/collections/:id
router.delete('/collections/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM collections WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Collection not found' });
    await pool.query('DELETE FROM collections WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Collection deleted' });
  } catch (error) {
    console.error('Error in DELETE /admin/collections/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete collection' });
  }
});

// ── Collection Rewards CRUD ──────────────────────────────────────────────────

// GET /api/v1/admin/rewards
router.get('/rewards', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT cr.*, c.name AS collection_name
      FROM collection_rewards cr
      JOIN collections c ON cr.collection_id = c.id
      ORDER BY cr.id
    `);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in GET /admin/rewards:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch rewards' });
  }
});

// POST /api/v1/admin/rewards
router.post('/rewards', verifyJWT, verifyAdmin, async (req, res) => {
  const { collection_id, token_address, token_symbol, token_decimals, daily_rate } = req.body;
  if (!collection_id || !token_address || !token_symbol || daily_rate === undefined)
    return res.status(400).json({ success: false, message: 'collection_id, token_address, token_symbol, daily_rate are required' });
  try {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO collection_rewards (collection_id, token_address, token_symbol, token_decimals, daily_rate, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [collection_id, token_address, token_symbol, token_decimals ?? 9, daily_rate]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in POST /admin/rewards:', error);
    return res.status(500).json({ success: false, message: 'Failed to create reward' });
  }
});

// PUT /api/v1/admin/rewards/:id
router.put('/rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { collection_id, token_address, token_symbol, token_decimals, daily_rate, is_active } = req.body;
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM collection_rewards WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Reward not found' });
    const updates = [], values = [];
    let p = 1;
    if (collection_id !== undefined) { updates.push(`collection_id = $${p++}`); values.push(collection_id); }
    if (token_address !== undefined) { updates.push(`token_address = $${p++}`); values.push(token_address); }
    if (token_symbol !== undefined) { updates.push(`token_symbol = $${p++}`); values.push(token_symbol); }
    if (token_decimals !== undefined) { updates.push(`token_decimals = $${p++}`); values.push(token_decimals); }
    if (daily_rate !== undefined) { updates.push(`daily_rate = $${p++}`); values.push(daily_rate); }
    if (is_active !== undefined) { updates.push(`is_active = $${p++}`); values.push(is_active); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    values.push(id);
    const result = await pool.query(`UPDATE collection_rewards SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in PUT /admin/rewards/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to update reward' });
  }
});

// DELETE /api/v1/admin/rewards/:id
router.delete('/rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM collection_rewards WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Reward not found' });
    await pool.query('DELETE FROM collection_rewards WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Reward deleted' });
  } catch (error) {
    console.error('Error in DELETE /admin/rewards/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete reward' });
  }
});

// ── Trait Rewards CRUD ───────────────────────────────────────────────────────

// GET /api/v1/admin/trait-rewards
router.get('/trait-rewards', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT tr.*, c.name AS collection_name
      FROM trait_rewards tr
      JOIN collections c ON tr.collection_id = c.id
      ORDER BY tr.id
    `);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in GET /admin/trait-rewards:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch trait rewards' });
  }
});

// POST /api/v1/admin/trait-rewards
router.post('/trait-rewards', verifyJWT, verifyAdmin, async (req, res) => {
  const { collection_id, trait_type, trait_value, token_address, token_symbol, multiplier } = req.body;
  if (!collection_id || !trait_type || !trait_value || !token_address || !token_symbol || multiplier === undefined)
    return res.status(400).json({ success: false, message: 'collection_id, trait_type, trait_value, token_address, token_symbol, multiplier are required' });
  try {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO trait_rewards (collection_id, trait_type, trait_value, token_address, token_symbol, multiplier, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW()) RETURNING *`,
      [collection_id, trait_type, trait_value, token_address, token_symbol, multiplier]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in POST /admin/trait-rewards:', error);
    return res.status(500).json({ success: false, message: 'Failed to create trait reward' });
  }
});

// PUT /api/v1/admin/trait-rewards/:id
router.put('/trait-rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { collection_id, trait_type, trait_value, token_address, token_symbol, multiplier, is_active } = req.body;
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM trait_rewards WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Trait reward not found' });
    const updates = [], values = [];
    let p = 1;
    if (collection_id !== undefined) { updates.push(`collection_id = $${p++}`); values.push(collection_id); }
    if (trait_type !== undefined) { updates.push(`trait_type = $${p++}`); values.push(trait_type); }
    if (trait_value !== undefined) { updates.push(`trait_value = $${p++}`); values.push(trait_value); }
    if (token_address !== undefined) { updates.push(`token_address = $${p++}`); values.push(token_address); }
    if (token_symbol !== undefined) { updates.push(`token_symbol = $${p++}`); values.push(token_symbol); }
    if (multiplier !== undefined) { updates.push(`multiplier = $${p++}`); values.push(multiplier); }
    if (is_active !== undefined) { updates.push(`is_active = $${p++}`); values.push(is_active); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    values.push(id);
    const result = await pool.query(`UPDATE trait_rewards SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in PUT /admin/trait-rewards/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to update trait reward' });
  }
});

// DELETE /api/v1/admin/trait-rewards/:id
router.delete('/trait-rewards/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM trait_rewards WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Trait reward not found' });
    await pool.query('DELETE FROM trait_rewards WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Trait reward deleted' });
  } catch (error) {
    console.error('Error in DELETE /admin/trait-rewards/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete trait reward' });
  }
});

// ── Admin Managers CRUD ──────────────────────────────────────────────────────

// GET /api/v1/admin/managers
router.get('/managers', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, username, email, is_super_admin, last_login, created_at FROM admins ORDER BY id`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in GET /admin/managers:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch admins' });
  }
});

// POST /api/v1/admin/managers
router.post('/managers', verifyJWT, verifyAdmin, async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'username and password are required' });
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM admins WHERE username = $1', [username]);
    if (existing.rows.length > 0) return res.status(409).json({ success: false, message: 'Username already exists' });

    let hashedPassword = password;
    try {
      const bcrypt = require('bcrypt');
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (bcryptErr) {
      console.error('[managers/post] bcrypt unavailable:', bcryptErr.message);
    }

    const result = await pool.query(
      `INSERT INTO admins (username, password, email, is_super_admin) VALUES ($1, $2, $3, false) RETURNING id, username, email, is_super_admin, created_at`,
      [username, hashedPassword, email || null]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in POST /admin/managers:', error);
    return res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
});

// DELETE /api/v1/admin/managers/:id
router.delete('/managers/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT id, is_super_admin, username FROM admins WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Admin not found' });
    if (existing.rows[0].is_super_admin) return res.status(403).json({ success: false, message: 'Cannot delete super admin' });
    if (req.user.adminId && parseInt(id) === req.user.adminId) return res.status(403).json({ success: false, message: 'Cannot delete yourself' });
    await pool.query('DELETE FROM admins WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Admin removed' });
  } catch (error) {
    console.error('Error in DELETE /admin/managers/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete admin' });
  }
});

// ── Settings ─────────────────────────────────────────────────────────────────

// GET /api/v1/admin/settings
router.get('/settings', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`SELECT key_name, value, description FROM settings ORDER BY key_name`);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in GET /admin/settings:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// PUT /api/v1/admin/settings
router.put('/settings', verifyJWT, verifyAdmin, async (req, res) => {
  const { settings } = req.body;
  if (!Array.isArray(settings) || settings.length === 0)
    return res.status(400).json({ success: false, message: 'settings must be a non-empty array of { key_name, value }' });
  try {
    const pool = getPool();
    for (const { key_name, value } of settings) {
      if (!key_name) continue;
      await pool.query(
        `INSERT INTO settings (key_name, value) VALUES ($1, $2)
         ON CONFLICT (key_name) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key_name, value]
      );
    }
    const result = await pool.query(`SELECT key_name, value, description FROM settings ORDER BY key_name`);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in PUT /admin/settings:', error);
    return res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// ── Profile ───────────────────────────────────────────────────────────────────

// GET /api/v1/admin/profile/:id
router.get('/profile/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, username, email, is_super_admin, last_login, created_at FROM admins WHERE id = $1`, [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Admin not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in GET /admin/profile/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// PUT /api/v1/admin/profile/:id
router.put('/profile/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, email, password, currentPassword } = req.body;
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT * FROM admins WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Admin not found' });
    const admin = existing.rows[0];

    const updates = [], values = [];
    let p = 1;
    if (username !== undefined) { updates.push(`username = $${p++}`); values.push(username); }
    if (email !== undefined) { updates.push(`email = $${p++}`); values.push(email); }

    if (password) {
      if (!currentPassword) return res.status(400).json({ success: false, message: 'currentPassword is required to change password' });
      let passwordMatch = false;
      try {
        const bcrypt = require('bcrypt');
        const isBcryptHash = admin.password && (admin.password.startsWith('$2b$') || admin.password.startsWith('$2a$'));
        passwordMatch = isBcryptHash ? await bcrypt.compare(currentPassword, admin.password) : currentPassword === admin.password;
      } catch {
        passwordMatch = currentPassword === admin.password;
      }
      if (!passwordMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

      let newHash = password;
      try {
        const bcrypt = require('bcrypt');
        newHash = await bcrypt.hash(password, 10);
      } catch {}
      updates.push(`password = $${p++}`); values.push(newHash);
    }

    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    values.push(id);
    const result = await pool.query(
      `UPDATE admins SET ${updates.join(', ')} WHERE id = $${p} RETURNING id, username, email, is_super_admin, last_login, created_at`,
      values
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in PUT /admin/profile/:id:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

module.exports = router;
