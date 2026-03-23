// api/index.js - Vercel Serverless Entry Point

const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.disable('x-powered-by');

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Health checks
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Pepeverse Staking API', timestamp: new Date().toISOString() }));
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'production', database: process.env.DATABASE_URL ? 'configured' : 'not configured' }));

// Database pool (lazy init)
let dbPool = null;
async function getDbPool() {
  if (!dbPool && process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return dbPool;
}

app.use(async (req, res, next) => {
  try { req.db = await getDbPool(); next(); } catch (error) { next(); }
});

// Load routes
try {
  const authRoutes = require('../routes/auth');
  app.use('/api/v1/auth', authRoutes);
  console.log('[ROUTES] auth loaded from ../routes/auth');
} catch (e) { console.error('[ROUTES] Failed to load auth routes:', e.message); }

try {
  const heliusRoutes = require('../routes/helius');
  app.use('/api/v1/helius', heliusRoutes);
  console.log('[ROUTES] helius loaded from ../routes/helius');
} catch (e) { console.error('[ROUTES] Failed to load helius routes:', e.message); }

try {
  const adminRoutes = require('./admin-routes');
  app.use('/api/v1/admin', adminRoutes);
  console.log('[ROUTES] admin-routes loaded from ./admin-routes');
} catch (e) { console.error('[ROUTES] Failed to load admin routes:', e.message, e.stack); }

try {
  const userRoutes = require('../backend/routes/user');
  app.use('/api/v1/user', userRoutes);
  console.log('[ROUTES] user loaded from ../backend/routes/user');
} catch (e) { console.error('[ROUTES] Failed to load user routes:', e.message, e.stack); }

// ── Inline user routes (staking/stats, rewards/calculate, nfts/staked) ──────
// These bypass solana-api-endpoints.js which fails on Vercel due to bcrypt native binary
try {
  const { Pool } = require('pg');
  const jwt = require('jsonwebtoken');
  const express2 = require('express');
  const userRouter = express2.Router();

  let _uPool = null;
  function uPool() {
    if (!_uPool) _uPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 30000 });
    return _uPool;
  }

  function uJWT(req, res, next) {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
    catch { res.status(401).json({ success: false, message: 'Token is not valid' }); }
  }

  // GET /api/v1/nfts/staked
  userRouter.get('/nfts/staked', uJWT, async (req, res) => {
    try {
      const result = await uPool().query(
        `SELECT sn.*, c.name as collection_name FROM staked_nfts sn
         JOIN collections c ON sn.collection_id = c.id
         WHERE sn.wallet_address = $1 ORDER BY sn.stake_timestamp DESC`,
        [req.user.walletAddress]
      );
      const LOCK_MS = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const data = result.rows.map(nft => {
        const stakeTime = new Date(nft.stake_timestamp).getTime();
        const remainingMs = Math.max(0, LOCK_MS - (now - stakeTime));
        return { ...nft, remainingLockTimeMs: remainingMs, remainingLockTimeHours: Math.ceil(remainingMs / 3600000), canUnstake: remainingMs === 0 };
      });
      res.json({ success: true, data });
    } catch (e) { console.error('[nfts/staked]', e.message); res.status(500).json({ success: false, message: 'Failed to get staked NFTs' }); }
  });

  // GET /api/v1/staking/stats
  userRouter.get('/staking/stats', uJWT, async (req, res) => {
    try {
      const result = await uPool().query(
        `SELECT c.id, c.name, COUNT(sn.id) as staked_count
         FROM collections c
         LEFT JOIN staked_nfts sn ON c.id = sn.collection_id AND sn.wallet_address = $1
         GROUP BY c.id, c.name ORDER BY c.name`,
        [req.user.walletAddress]
      );
      res.json({ success: true, data: result.rows });
    } catch (e) { console.error('[staking/stats]', e.message); res.status(500).json({ success: false, message: 'Failed to get staking stats' }); }
  });

  // GET /api/v1/rewards/calculate
  userRouter.get('/rewards/calculate', uJWT, async (req, res) => {
    try {
      const result = await uPool().query(
        `SELECT s.id, s.mint_address, s.collection_id, s.stake_timestamp, s.last_claim_timestamp, s.traits,
                c.name as collection_name, cr.id as reward_id, cr.token_address, cr.token_symbol,
                cr.daily_rate, cr.token_decimals,
                EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_claim_timestamp, s.stake_timestamp))) as seconds_since_last_claim,
                STRING_AGG(CONCAT(tr.trait_type, ':', tr.trait_value, ':', tr.multiplier), '||') as trait_multipliers
         FROM staked_nfts s
         JOIN collections c ON s.collection_id = c.id
         LEFT JOIN collection_rewards cr ON c.id = cr.collection_id AND cr.is_active = TRUE
         LEFT JOIN trait_rewards tr ON tr.collection_id = s.collection_id AND tr.token_address = cr.token_address AND tr.is_active = TRUE
         WHERE s.wallet_address = $1
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

        // Apply trait multipliers
        if (nft.trait_multipliers && nft.traits) {
          const traits = Array.isArray(nft.traits) ? nft.traits : (typeof nft.traits === 'string' ? JSON.parse(nft.traits) : []);
          const pairs = nft.trait_multipliers.split('||');
          for (const pair of pairs) {
            const [traitType, traitValue, earnStr] = pair.split(':');
            const earn = parseFloat(earnStr);
            if (traits.some(t => t.trait_type === traitType && t.value === traitValue)) {
              reward += earn * days;
            }
          }
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

  app.use('/api/v1', userRouter);
  console.log('[ROUTES] inline user routes loaded (staking/stats, rewards/calculate, nfts/staked)');
} catch (e) { console.error('[ROUTES] Failed to load inline user routes:', e.message); }

try {
  const apiRoutes = require('../src/solana-api-endpoints');
  app.use('/api/v1', apiRoutes);
  console.log('[ROUTES] solana-api-endpoints loaded');
} catch (e) { console.error('[ROUTES] Failed to load API routes:', e.message); }

// Debug: log all registered routes
app.get('/api/v1/debug-routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(layer => {
    if (layer.handle && layer.handle.stack) {
      layer.handle.stack.forEach(r => {
        if (r.route) routes.push({ path: layer.regexp.toString().substring(0, 60), route: r.route.path, methods: Object.keys(r.route.methods) });
      });
    } else if (layer.route) {
      routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
    }
  });
  res.json({ routes });
});

// 404
app.use((req, res) => {
  console.log('[404]', req.method, req.path);
  res.status(404).json({ error: 'Not Found', path: req.path, message: 'The requested endpoint does not exist' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
