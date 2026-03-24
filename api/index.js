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
    const data = result.rows.map(nft => ({ ...nft, canUnstake: true }));
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
    const pool = getPool();

    // Get all staked NFTs
    const stakedResult = await pool.query(
      `SELECT s.id, s.mint_address, s.collection_id, s.stake_timestamp, s.last_claim_timestamp, s.traits,
              EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_claim_timestamp, s.stake_timestamp))) as seconds_since_last_claim
       FROM staked_nfts s WHERE s.owner_wallet = $1`,
      [req.user.walletAddress]
    );
    if (stakedResult.rows.length === 0) return res.json({ success: true, data: [] });

    // Get all active base rewards and trait rewards
    const [baseRes, traitRes] = await Promise.all([
      pool.query(`SELECT collection_id, token_address, token_symbol, token_decimals, daily_rate FROM collection_rewards WHERE is_active = TRUE`),
      pool.query(`SELECT collection_id, token_address, token_symbol, token_decimals, trait_type, trait_value, multiplier FROM trait_rewards WHERE is_active = TRUE`),
    ]);

    const baseByCollection = {};
    for (const r of baseRes.rows) {
      if (!baseByCollection[r.collection_id]) baseByCollection[r.collection_id] = [];
      baseByCollection[r.collection_id].push(r);
    }
    const traitByCollection = {};
    for (const r of traitRes.rows) {
      if (!traitByCollection[r.collection_id]) traitByCollection[r.collection_id] = [];
      traitByCollection[r.collection_id].push(r);
    }

    const rewardsByToken = {};
    for (const nft of stakedResult.rows) {
      const seconds = parseInt(nft.seconds_since_last_claim) || 0;
      if (seconds < 60) continue;
      const days = seconds / 86400;

      let traits = [];
      try { traits = nft.traits ? (Array.isArray(nft.traits) ? nft.traits : JSON.parse(nft.traits)) : []; } catch {}

      // Base rewards
      for (const base of (baseByCollection[nft.collection_id] || [])) {
        const key = base.token_address;
        if (!rewardsByToken[key]) rewardsByToken[key] = { token_address: base.token_address, token_symbol: base.token_symbol, token_decimals: base.token_decimals, amount: 0 };
        rewardsByToken[key].amount += parseFloat(base.daily_rate) * days;
      }

      // Trait rewards — check if NFT has matching trait
      for (const tr of (traitByCollection[nft.collection_id] || [])) {
        const hasMatch = traits.some(t => {
          const tType = (t.trait_type || t.type || '').toLowerCase();
          const tVal = (t.value || t.trait_value || '').toLowerCase();
          return tType === tr.trait_type.toLowerCase() && tVal === tr.trait_value.toLowerCase();
        });
        if (!hasMatch) continue;
        const key = tr.token_address;
        if (!rewardsByToken[key]) rewardsByToken[key] = { token_address: tr.token_address, token_symbol: tr.token_symbol, token_decimals: tr.token_decimals || 0, amount: 0 };
        rewardsByToken[key].amount += parseFloat(tr.multiplier) * days;
      }
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

// POST /api/v1/nfts/stake/quote — fee calculation (must be before /nfts/stake)
stakingRouter.post('/nfts/stake/quote', verifyJWT, async (req, res) => {
  try {
    const { nfts, collectionId } = req.body;
    if (!nfts || !Array.isArray(nfts) || nfts.length === 0 || !collectionId) {
      return res.status(400).json({ success: false, message: 'Invalid request parameters' });
    }
    const pool = getPool();
    const colResult = await pool.query('SELECT id, name, stake_fee FROM collections WHERE id = $1', [collectionId]);
    if (colResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Collection not found' });
    const collection = colResult.rows[0];
    const stakeFee = parseFloat(collection.stake_fee) || 0;
    const totalFee = stakeFee * nfts.length;
    const feeRow = await pool.query("SELECT value FROM settings WHERE key_name = 'rewards_wallet'");
    const feeRecipient = feeRow.rows[0]?.value || null;
    if (stakeFee > 0 && !feeRecipient) {
      return res.status(500).json({ success: false, message: 'Fee recipient wallet not configured' });
    }
    return res.json({
      success: true,
      data: { collectionId: collection.id, collectionName: collection.name, nftCount: nfts.length, feePerNFT: stakeFee, totalFee, feeRecipient, currency: 'SOL', requiresPayment: totalFee > 0 }
    });
  } catch (e) { console.error('[nfts/stake/quote]', e.message); res.status(500).json({ success: false, message: 'Failed to calculate staking fee' }); }
});

// POST /api/v1/nfts/stake
stakingRouter.post('/nfts/stake', verifyJWT, async (req, res) => {
  try {
    const { nfts, collectionId, paymentSignature } = req.body;
    if (!nfts || !Array.isArray(nfts) || nfts.length === 0 || !collectionId) {
      return res.status(400).json({ success: false, message: 'Invalid request parameters' });
    }
    const pool = getPool();
    const colResult = await pool.query('SELECT id, name, stake_fee, hashlist FROM collections WHERE id = $1', [collectionId]);
    if (colResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Collection not found' });

    const stakedAt = new Date();
    const inserted = [];
    for (const nft of nfts) {
      const { mintAddress, traits } = nft;
      if (!mintAddress) continue;
      // Check not already staked
      const existing = await pool.query('SELECT id FROM staked_nfts WHERE mint_address = $1', [mintAddress]);
      if (existing.rows.length > 0) continue;
      const traitsJson = traits ? JSON.stringify(traits) : null;
      await pool.query(
        `INSERT INTO staked_nfts (mint_address, owner_wallet, collection_id, stake_timestamp, traits)
         VALUES ($1, $2, $3, $4, $5)`,
        [mintAddress, req.user.walletAddress, collectionId, stakedAt, traitsJson]
      );
      inserted.push(mintAddress);
    }
    return res.json({ success: true, message: `Staked ${inserted.length} NFTs`, data: { staked: inserted } });
  } catch (e) { console.error('[nfts/stake]', e.message); res.status(500).json({ success: false, message: 'Failed to stake NFTs' }); }
});

// POST /api/v1/nfts/unstake
stakingRouter.post('/nfts/unstake', verifyJWT, async (req, res) => {
  try {
    const { nftIds } = req.body;
    if (!nftIds || !Array.isArray(nftIds) || nftIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid request parameters' });
    }
    const pool = getPool();
    const unstaked = [];
    for (const id of nftIds) {
      const result = await pool.query(
        'SELECT id FROM staked_nfts WHERE id = $1 AND owner_wallet = $2',
        [id, req.user.walletAddress]
      );
      if (result.rows.length === 0) continue;
      await pool.query('DELETE FROM staked_nfts WHERE id = $1', [id]);
      unstaked.push(id);
    }
    return res.json({ success: true, message: `Unstaked ${unstaked.length} NFTs`, data: { unstaked } });
  } catch (e) { console.error('[nfts/unstake]', e.message); res.status(500).json({ success: false, message: 'Failed to unstake NFTs' }); }
});

// GET /api/v1/staking/global-stats — global staked counts + hashlist sizes per collection
stakingRouter.get('/staking/global-stats', async (req, res) => {
  try {
    const result = await getPool().query(
      `SELECT c.id, c.name,
              COUNT(sn.id) AS global_staked_count,
              CASE
                WHEN c.hashlist IS NOT NULL AND c.hashlist != ''
                THEN (LENGTH(c.hashlist) - LENGTH(REPLACE(c.hashlist, chr(10), '')))
                ELSE 0
              END AS hashlist_count
       FROM collections c
       LEFT JOIN staked_nfts sn ON c.id = sn.collection_id
       GROUP BY c.id, c.name, c.hashlist ORDER BY c.name`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) { console.error('[staking/global-stats]', e.message); res.status(500).json({ success: false, message: 'Failed to get global stats' }); }
});

// GET /api/v1/solana/blockhash — server-side proxy to avoid CORS/rate-limit on public RPC
stakingRouter.get('/solana/blockhash', verifyJWT, async (req, res) => {
  try {
    const endpoint = process.env.HELIUS_MAINNET_ENDPOINT;
    const apiKey = process.env.HELIUS_API_KEY;
    if (!endpoint || !apiKey) return res.status(500).json({ success: false, message: 'RPC not configured' });
    const url = endpoint.includes('?api-key=') ? endpoint : `${endpoint.replace(/\/$/, '')}/?api-key=${apiKey}`;
    const response = await axios.post(url, {
      jsonrpc: '2.0', id: 'get-blockhash', method: 'getLatestBlockhash',
      params: [{ commitment: 'confirmed' }]
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
    const blockhash = response.data?.result?.value?.blockhash;
    const lastValidBlockHeight = response.data?.result?.value?.lastValidBlockHeight;
    if (!blockhash) return res.status(500).json({ success: false, message: 'Failed to get blockhash from RPC' });
    return res.json({ success: true, data: { blockhash, lastValidBlockHeight } });
  } catch (e) { console.error('[solana/blockhash]', e.message); res.status(500).json({ success: false, message: 'Failed to get blockhash' }); }
});

// POST /api/v1/solana/send-transaction — server-side proxy to send raw transaction
stakingRouter.post('/solana/send-transaction', verifyJWT, async (req, res) => {
  try {
    const { transaction } = req.body;
    if (!transaction) return res.status(400).json({ success: false, message: 'transaction is required' });
    const endpoint = process.env.HELIUS_MAINNET_ENDPOINT;
    const apiKey = process.env.HELIUS_API_KEY;
    if (!endpoint || !apiKey) return res.status(500).json({ success: false, message: 'RPC not configured' });
    const url = endpoint.includes('?api-key=') ? endpoint : `${endpoint.replace(/\/$/, '')}/?api-key=${apiKey}`;
    const response = await axios.post(url, {
      jsonrpc: '2.0', id: 'send-tx', method: 'sendTransaction',
      params: [transaction, { encoding: 'base64', preflightCommitment: 'confirmed' }]
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
    if (response.data.error) {
      return res.status(400).json({ success: false, message: response.data.error.message || 'Transaction failed' });
    }
    const signature = response.data?.result;
    if (!signature) return res.status(500).json({ success: false, message: 'No signature returned' });
    return res.json({ success: true, data: { signature } });
  } catch (e) { console.error('[solana/send-transaction]', e.message); res.status(500).json({ success: false, message: 'Failed to send transaction' }); }
});

// GET /api/v1/rewards/per-nft — returns earning tokens per staked NFT mint address
// Shows base + trait earnings combined per token, including trait-only tokens
stakingRouter.get('/rewards/per-nft', verifyJWT, async (req, res) => {
  try {
    const pool = getPool();

    // Get all staked NFTs for this wallet
    const stakedResult = await pool.query(
      `SELECT s.mint_address, s.collection_id, s.traits FROM staked_nfts s WHERE s.owner_wallet = $1`,
      [req.user.walletAddress]
    );
    if (stakedResult.rows.length === 0) return res.json({ success: true, data: {} });

    // Get all active base collection rewards
    const baseRewardsResult = await pool.query(
      `SELECT collection_id, token_address, token_symbol, daily_rate FROM collection_rewards WHERE is_active = TRUE`
    );
    // Get all active trait rewards
    const traitRewardsResult = await pool.query(
      `SELECT collection_id, token_address, token_symbol, trait_type, trait_value, multiplier FROM trait_rewards WHERE is_active = TRUE`
    );

    const baseByCollection = {}; // collection_id -> [{token_address, token_symbol, daily_rate}]
    for (const r of baseRewardsResult.rows) {
      if (!baseByCollection[r.collection_id]) baseByCollection[r.collection_id] = [];
      baseByCollection[r.collection_id].push(r);
    }

    const traitByCollection = {}; // collection_id -> [{token_address, token_symbol, trait_type, trait_value, multiplier}]
    for (const r of traitRewardsResult.rows) {
      if (!traitByCollection[r.collection_id]) traitByCollection[r.collection_id] = [];
      traitByCollection[r.collection_id].push(r);
    }

    const map = {}; // mint_address -> [{token_symbol, daily_rate, trait_rate, total_rate, has_trait_bonus}]
    for (const nft of stakedResult.rows) {
      const { mint_address, collection_id, traits: traitsRaw } = nft;
      let traits = [];
      try {
        traits = traitsRaw ? (Array.isArray(traitsRaw) ? traitsRaw : JSON.parse(traitsRaw)) : [];
      } catch {}

      // Build per-token earning map for this NFT
      const tokenMap = {}; // token_address -> {token_symbol, base_rate, trait_rate}

      // Add base collection rewards
      for (const base of (baseByCollection[collection_id] || [])) {
        if (!tokenMap[base.token_address]) {
          tokenMap[base.token_address] = { token_symbol: base.token_symbol, base_rate: 0, trait_rate: 0 };
        }
        tokenMap[base.token_address].base_rate += parseFloat(base.daily_rate);
      }

      // Add trait rewards — check if this NFT has the matching trait
      for (const tr of (traitByCollection[collection_id] || [])) {
        // Match trait: check both t.value and t.trait_value to handle different JSON structures
        const hasMatch = traits.some(t => {
          const tType = t.trait_type || t.type || '';
          const tVal = t.value || t.trait_value || '';
          return tType.toLowerCase() === tr.trait_type.toLowerCase() &&
                 tVal.toLowerCase() === tr.trait_value.toLowerCase();
        });
        if (!hasMatch) continue;

        if (!tokenMap[tr.token_address]) {
          tokenMap[tr.token_address] = { token_symbol: tr.token_symbol, base_rate: 0, trait_rate: 0 };
        }
        tokenMap[tr.token_address].trait_rate += parseFloat(tr.multiplier);
      }

      // Convert to array, only include tokens where total > 0
      map[mint_address] = Object.entries(tokenMap)
        .map(([, v]) => ({
          token_symbol: v.token_symbol,
          base_rate: v.base_rate,
          trait_rate: v.trait_rate,
          total_rate: v.base_rate + v.trait_rate,
          has_trait_bonus: v.trait_rate > 0,
        }))
        .filter(e => e.total_rate > 0);
    }

    return res.json({ success: true, data: map });
  } catch (e) { console.error('[rewards/per-nft]', e.message); res.status(500).json({ success: false, message: 'Failed to get per-NFT earnings' }); }
});

// GET /api/v1/rewards/quote
stakingRouter.get('/rewards/quote', verifyJWT, async (req, res) => {
  try {
    const pool = getPool();
    const feeRow = await pool.query("SELECT value FROM settings WHERE key_name = 'claim_fee'");
    const recipientRow = await pool.query("SELECT value FROM settings WHERE key_name = 'rewards_wallet'");
    const claimFee = parseFloat(feeRow.rows[0]?.value || 0);
    const feeRecipient = recipientRow.rows[0]?.value || null;
    return res.json({ success: true, data: { claimFee, feeRecipient, requiresPayment: claimFee > 0 } });
  } catch (e) { console.error('[rewards/quote]', e.message); res.status(500).json({ success: false, message: 'Failed to get claim quote' }); }
});

// POST /api/v1/rewards/claim
stakingRouter.post('/rewards/claim', verifyJWT, async (req, res) => {
  try {
    const pool = getPool();
    const stakedResult = await pool.query(
      'SELECT id FROM staked_nfts WHERE owner_wallet = $1',
      [req.user.walletAddress]
    );
    if (stakedResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No staked NFTs found' });
    }
    // Update last_claim_timestamp for all staked NFTs
    await pool.query(
      'UPDATE staked_nfts SET last_claim_timestamp = NOW() WHERE owner_wallet = $1',
      [req.user.walletAddress]
    );
    return res.json({ success: true, message: 'Rewards claimed successfully' });
  } catch (e) { console.error('[rewards/claim]', e.message); res.status(500).json({ success: false, message: 'Failed to claim rewards' }); }
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
