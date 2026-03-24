// api/index.js - Fully self-contained Vercel serverless entry point
// NO imports from backend/ to avoid bcrypt/native binary crashes on Vercel Linux

const express = require('express');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── DB pool ─────────────────────────────────────────────────────────────────
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

// ── Auth middleware ──────────────────────────────────────────────────────────
function verifyJWT(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ success: false, message: 'No token, authorization denied' });
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ success: false, message: 'JWT_SECRET not configured' });
    req.user = jwt.verify(token, secret);
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

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Pepeverse Staking API', timestamp: new Date().toISOString() }));
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Auth routes (inline — no bcrypt needed for wallet auth) ──────────────────
const authRouter = express.Router();

// In-memory nonce store
const nonces = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of nonces.entries()) { if (now > v.expiresAt) nonces.delete(k); }
}, 60000);

authRouter.post('/nonce', async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ success: false, message: 'Wallet address is required' });
    const crypto = require('crypto');
    const nonce = crypto.randomBytes(32).toString('base64');
    nonces.set(wallet, { nonce, expiresAt: Date.now() + 300000 });
    return res.json({ success: true, nonce });
  } catch (e) {
    console.error('[auth/nonce]', e.message);
    return res.status(500).json({ success: false, message: 'Failed to generate nonce' });
  }
});

authRouter.post('/verify', async (req, res) => {
  try {
    const { wallet, signature, message } = req.body;
    if (!wallet || !signature || !message) {
      return res.status(400).json({ success: false, message: 'wallet, signature, and message are required' });
    }

    const stored = nonces.get(wallet);
    if (!stored || Date.now() > stored.expiresAt) {
      return res.status(401).json({ success: false, message: 'Nonce not found or expired' });
    }
    if (stored.nonce !== message) {
      return res.status(401).json({ success: false, message: 'Nonce mismatch' });
    }

    // Verify Ed25519 signature
    const bs58 = require('bs58');
    const nacl = require('tweetnacl');

    const publicKeyBytes = bs58.decode(wallet);
    if (publicKeyBytes.length !== 32) return res.status(401).json({ success: false, message: 'Invalid wallet address' });

    let sigBytes;
    try {
      const decoded = bs58.decode(signature);
      sigBytes = decoded.length === 64 ? decoded : Buffer.from(signature, 'base64');
    } catch {
      sigBytes = Buffer.from(signature, 'base64');
    }
    if (!sigBytes || sigBytes.length !== 64) {
      return res.status(401).json({ success: false, message: 'Invalid signature encoding' });
    }

    const msgBytes = Buffer.from(message, 'utf8');
    const valid = nacl.sign.detached.verify(msgBytes, sigBytes, publicKeyBytes);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid signature' });

    nonces.delete(wallet);

    // Check admin status
    const pool = getPool();
    const adminResult = await pool.query('SELECT id FROM admins WHERE wallet_address = $1', [wallet]);
    const isAdmin = adminResult.rows.length > 0;

    const token = jwt.sign({ walletAddress: wallet, isAdmin }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token, user: { walletAddress: wallet, isAdmin } });
  } catch (e) {
    console.error('[auth/verify]', e.message);
    return res.status(500).json({ success: false, message: e.message || 'Error verifying signature' });
  }
});

authRouter.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required' });

    const pool = getPool();
    const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const admin = result.rows[0];
    // Use bcrypt only for admin login — loaded lazily so it doesn't crash on import
    let passwordMatch = false;
    try {
      const bcrypt = require('bcrypt');
      const isBcryptHash = admin.password && (admin.password.startsWith('$2b$') || admin.password.startsWith('$2a$'));
      if (isBcryptHash) {
        passwordMatch = await bcrypt.compare(password, admin.password);
      } else {
        passwordMatch = password === admin.password;
        if (passwordMatch) {
          const hash = await bcrypt.hash(admin.password, 10);
          await pool.query('UPDATE admins SET password = $1 WHERE id = $2', [hash, admin.id]);
        }
      }
    } catch (bcryptErr) {
      // bcrypt native binary failed — fall back to plain text comparison only
      console.error('[admin/login] bcrypt unavailable:', bcryptErr.message);
      passwordMatch = password === admin.password;
    }

    if (!passwordMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    await pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, isAdmin: true, isSuperAdmin: admin.is_super_admin },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.json({ success: true, token, user: { adminId: admin.id, username: admin.username, isAdmin: true, isSuperAdmin: admin.is_super_admin } });
  } catch (e) {
    console.error('[admin/login]', e.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.use('/api/v1/auth', authRouter);

// ── Helius proxy (inline) ────────────────────────────────────────────────────
const heliusRouter = express.Router();
const axios = require('axios');

heliusRouter.post('/nfts/by-owner', async (req, res) => {
  try {
    const { ownerAddress, collectionAddress, page = 1, limit = 1000 } = req.body;
    if (!ownerAddress) return res.status(400).json({ error: 'ownerAddress is required' });

    const endpoint = process.env.HELIUS_MAINNET_ENDPOINT;
    const apiKey = process.env.HELIUS_API_KEY;
    if (!endpoint || !apiKey) return res.status(500).json({ error: 'Helius not configured' });

    const payload = {
      jsonrpc: '2.0', id: 'get-assets-by-owner', method: 'getAssetsByOwner',
      params: { ownerAddress, page, limit, displayOptions: { showFungible: false, showNativeBalance: false } }
    };

    const url = endpoint.includes('?api-key=') ? endpoint : `${endpoint.replace(/\/$/, '')}/?api-key=${apiKey}`;
    const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });

    let items = response.data?.result?.items || [];
    if (collectionAddress) {
      items = items.filter(item => {
        const groupings = item.grouping || [];
        return groupings.some(g => g.group_key === 'collection' && g.group_value === collectionAddress);
      });
    }
    res.json({ success: true, data: { items, total: items.length } });
  } catch (e) {
    console.error('[helius/nfts/by-owner]', e.message);
    res.status(500).json({ error: 'Failed to fetch NFTs from Helius' });
  }
});

// POST /api/v1/helius/nfts/metadata — fetch token symbol/decimals via Helius getAsset
heliusRouter.post('/nfts/metadata', async (req, res) => {
  try {
    const { mintAddress } = req.body;
    if (!mintAddress) return res.status(400).json({ success: false, error: 'mintAddress is required' });
    const endpoint = process.env.HELIUS_MAINNET_ENDPOINT;
    const apiKey = process.env.HELIUS_API_KEY;
    if (!endpoint || !apiKey) return res.status(500).json({ success: false, error: 'Helius not configured' });
    const url = endpoint.includes('?api-key=') ? endpoint : `${endpoint.replace(/\/$/, '')}/?api-key=${apiKey}`;
    const response = await axios.post(url, {
      jsonrpc: '2.0', id: 'get-asset', method: 'getAsset',
      params: { id: mintAddress }
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
    if (response.data.error) return res.status(400).json({ success: false, error: response.data.error.message });
    return res.json({ success: true, data: response.data.result });
  } catch (e) {
    console.error('[helius/nfts/metadata]', e.message);
    res.status(500).json({ success: false, error: 'Failed to fetch token metadata' });
  }
});

app.use('/api/v1/helius', heliusRouter);

// ── Admin routes ─────────────────────────────────────────────────────────────
try {
  const adminRoutes = require('./admin-routes');
  app.use('/api/v1/admin', adminRoutes);
  console.log('[ROUTES] admin-routes loaded');
} catch (e) { console.error('[ROUTES] Failed to load admin routes:', e.message); }

// ── User airdrop routes (inline) ─────────────────────────────────────────────
const userRouter = express.Router();

userRouter.get('/airdrops/:walletAddress', verifyJWT, async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const result = await getPool().query(
      `SELECT snap.airdrop_config_id, ac.token_symbol, snap.token_amount, ac.expires_at,
              c.name AS collection_name,
              EXTRACT(EPOCH FROM (ac.expires_at - NOW()))::INTEGER AS time_remaining_seconds
       FROM airdrop_snapshots snap
       JOIN airdrop_configs ac ON snap.airdrop_config_id = ac.id
       JOIN collections c ON ac.collection_id = c.id
       WHERE snap.wallet_address = $1 AND snap.claimed = false AND ac.status = 'active' AND ac.expires_at > NOW()`,
      [walletAddress]
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) { console.error('[user/airdrops]', e.message); res.status(500).json({ success: false, message: 'Failed to fetch airdrops' }); }
});

userRouter.post('/airdrops/quote', verifyJWT, async (req, res) => {
  try {
    const { wallet_address, airdrop_config_id } = req.body;
    if (!wallet_address || !airdrop_config_id) return res.status(400).json({ success: false, message: 'wallet_address and airdrop_config_id are required' });
    const pool = getPool();
    const snap = await pool.query(
      `SELECT snap.token_amount FROM airdrop_snapshots snap JOIN airdrop_configs ac ON snap.airdrop_config_id = ac.id
       WHERE snap.airdrop_config_id = $1 AND snap.wallet_address = $2 AND snap.claimed = false AND ac.status = 'active' AND ac.expires_at > NOW()`,
      [airdrop_config_id, wallet_address]
    );
    if (snap.rows.length === 0) return res.status(404).json({ success: false, message: 'No eligible unclaimed airdrop found' });
    const feeRow = await pool.query("SELECT value FROM settings WHERE key_name = 'claim_fee'");
    const recipientRow = await pool.query("SELECT value FROM settings WHERE key_name = 'rewards_wallet'");
    return res.json({ success: true, data: { token_amount: snap.rows[0].token_amount, claim_fee: parseFloat(feeRow.rows[0]?.value || 0), fee_recipient: recipientRow.rows[0]?.value || null } });
  } catch (e) { console.error('[user/airdrops/quote]', e.message); res.status(500).json({ success: false, message: 'Failed to fetch airdrop quote' }); }
});

app.use('/api/v1/user', userRouter);

// ── Staking / Rewards / NFT routes (inline — no bcrypt) ──────────────────────
const stakingRouter = express.Router();

stakingRouter.get('/nfts/staked', verifyJWT, async (req, res) => {
  try {
    const result = await getPool().query(
      `SELECT sn.*, c.name as collection_name FROM staked_nfts sn
       JOIN collections c ON sn.collection_id = c.id
       WHERE sn.owner_wallet = $1 ORDER BY sn.stake_timestamp DESC`,
      [req.user.walletAddress]
    );
    const LOCK_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const data = result.rows.map(nft => {
      const remainingMs = Math.max(0, LOCK_MS - (now - new Date(nft.stake_timestamp).getTime()));
      return { ...nft, remainingLockTimeMs: remainingMs, remainingLockTimeHours: Math.ceil(remainingMs / 3600000), canUnstake: remainingMs === 0 };
    });
    res.json({ success: true, data });
  } catch (e) { console.error('[nfts/staked]', e.message); res.status(500).json({ success: false, message: 'Failed to get staked NFTs' }); }
});

stakingRouter.get('/staking/stats', verifyJWT, async (req, res) => {
  try {
    const result = await getPool().query(
      `SELECT c.id, c.name, COUNT(sn.id) as staked_count
       FROM collections c
       LEFT JOIN staked_nfts sn ON c.id = sn.collection_id AND sn.owner_wallet = $1
       GROUP BY c.id, c.name ORDER BY c.name`,
      [req.user.walletAddress]
    );
    res.json({ success: true, data: result.rows });
  } catch (e) { console.error('[staking/stats]', e.message); res.status(500).json({ success: false, message: 'Failed to get staking stats' }); }
});

stakingRouter.get('/rewards/calculate', verifyJWT, async (req, res) => {
  try {
    const result = await getPool().query(
      `SELECT s.id, s.mint_address, s.collection_id, s.stake_timestamp, s.last_claim_timestamp, s.traits,
              c.name as collection_name, cr.id as reward_id, cr.token_address, cr.token_symbol,
              cr.daily_rate, cr.token_decimals,
              EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_claim_timestamp, s.stake_timestamp))) as seconds_since_last_claim,
              STRING_AGG(CONCAT(tr.trait_type, ':', tr.trait_value, ':', tr.multiplier), '||') as trait_multipliers
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       LEFT JOIN collection_rewards cr ON c.id = cr.collection_id AND cr.is_active = TRUE
       LEFT JOIN trait_rewards tr ON tr.collection_id = s.collection_id AND tr.token_address = cr.token_address AND tr.is_active = TRUE
       WHERE s.owner_wallet = $1
       GROUP BY s.id, s.mint_address, s.collection_id, s.stake_timestamp, s.last_claim_timestamp, s.traits,
                c.name, cr.id, cr.token_address, cr.token_symbol, cr.daily_rate, cr.token_decimals`,
      [req.user.walletAddress]
    );

    const nftsWithRewards = result.rows.filter(r => r.reward_id !== null);
    if (nftsWithRewards.length === 0) return res.json({ success: true, data: [] });

    const rewardsByToken = {};
    for (const nft of nftsWithRewards) {
      const seconds = parseInt(nft.seconds_since_last_claim) || 0;
      if (seconds < 60) continue;
      const days = seconds / 86400;
      let reward = parseFloat(nft.daily_rate) * days;

      if (nft.trait_multipliers && nft.traits) {
        try {
          const traits = Array.isArray(nft.traits) ? nft.traits : JSON.parse(nft.traits);
          for (const pair of nft.trait_multipliers.split('||')) {
            const [traitType, traitValue, earnStr] = pair.split(':');
            if (traits.some(t => t.trait_type === traitType && t.value === traitValue)) {
              reward += parseFloat(earnStr) * days;
            }
          }
        } catch {}
      }

      const key = nft.token_address;
      if (!rewardsByToken[key]) {
        rewardsByToken[key] = { token_address: nft.token_address, token_symbol: nft.token_symbol, token_decimals: nft.token_decimals, amount: 0 };
      }
      rewardsByToken[key].amount += reward;
    }

    res.json({ success: true, data: Object.values(rewardsByToken) });
  } catch (e) { console.error('[rewards/calculate]', e.message); res.status(500).json({ success: false, message: 'Failed to calculate rewards' }); }
});

stakingRouter.get('/collections', async (req, res) => {
  try {
    const result = await getPool().query(
      `SELECT id, name, creator_address, stake_fee, unstake_fee, hashlist, created_at FROM collections ORDER BY id`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) { console.error('[collections]', e.message); res.status(500).json({ success: false, message: 'Failed to get collections' }); }
});

// PUT /api/v1/collections/:id — used by FeeManager and CollectionManager (updateCollection in api.js)
const multer = require('multer');
const _upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
stakingRouter.put('/collections/:id', verifyJWT, _upload.single('hashlist'), async (req, res) => {
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
      try { const arr = JSON.parse(raw); hashlistText = Array.isArray(arr) ? arr.join('+\n') + '+\n' : raw; } catch { hashlistText = raw; }
      updates.push(`hashlist = $${p++}`); values.push(hashlistText);
    }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    values.push(id);
    const result = await pool.query(`UPDATE collections SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values);
    return res.json({ success: true, data: result.rows[0] });
  } catch (e) { console.error('[PUT /collections/:id]', e.message); res.status(500).json({ success: false, message: 'Failed to update collection' }); }
});

app.use('/api/v1', stakingRouter);

// ── 404 & error handler ──────────────────────────────────────────────────────
app.use((req, res) => {
  console.log('[404]', req.method, req.path);
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
