// api/dao-user-routes.js
// DAO user-facing routes for Vercel — self-contained

const express = require('express');
const router = express.Router();
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

// ── Shared reward calculation helper ────────────────────────────────────────
// FIX: DAO trait rewards only accrue from MAX(claim_start, dtr.created_at)
// This prevents backdating when a new DAO trait reward is added to existing staked NFTs.
function calcDaoRewardsForNft(nft, daoTraitRewards) {
  const now = Date.now();
  let traits = [];
  try { traits = nft.traits ? (Array.isArray(nft.traits) ? nft.traits : JSON.parse(nft.traits)) : []; } catch {}

  // The base start time: when the user last claimed DAO rewards (or when they staked)
  const claimStart = nft.dao_last_claim_timestamp
    ? new Date(nft.dao_last_claim_timestamp).getTime()
    : new Date(nft.stake_timestamp).getTime();

  const earnings = [];

  for (const dtr of daoTraitRewards) {
    if (String(dtr.collection_id) !== String(nft.collection_id)) continue;

    const match = traits.some(t => {
      const tType = String(t.trait_type ?? t.type ?? '').toLowerCase();
      const tVal  = String(t.value ?? t.trait_value ?? '').toLowerCase();
      return tType === String(dtr.trait_type).toLowerCase() && tVal === String(dtr.trait_value).toLowerCase();
    });
    if (!match) continue;

    // FIX: earn from MAX(claimStart, dtr.created_at) — never before the trait reward existed
    const traitCreated = dtr.created_at ? new Date(dtr.created_at).getTime() : 0;
    const earnStart = Math.max(claimStart, traitCreated);
    const secondsEarning = Math.max(0, (now - earnStart) / 1000);

    // Enforce 60-second minimum window
    if (secondsEarning < 60) continue;

    const daysEarning = secondsEarning / 86400;
    const pendingAmount = parseFloat(dtr.multiplier) * daysEarning;

    earnings.push({
      trait_type: dtr.trait_type,
      trait_value: dtr.trait_value,
      token_address: dtr.token_address,
      token_symbol: dtr.token_symbol,
      token_decimals: parseInt(dtr.token_decimals) || 9,
      daily_rate: parseFloat(dtr.multiplier),
      pending_amount: pendingAmount,
    });
  }

  return earnings;
}

// GET /dao-rewards?wallet_address=...
router.get('/dao-rewards', async (req, res) => {
  try {
    const { wallet_address } = req.query;
    if (!wallet_address) return res.status(400).json({ success: false, message: 'wallet_address is required' });

    const pool = getPool();
    const [stakedResult, daoTraitRes] = await Promise.all([
      pool.query(
        'SELECT id, mint_address, collection_id, stake_timestamp, dao_last_claim_timestamp, traits FROM staked_nfts WHERE owner_wallet = $1',
        [wallet_address]
      ),
      pool.query(
        'SELECT collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier, created_at FROM dao_trait_rewards WHERE is_active=TRUE'
      ),
    ]);

    if (stakedResult.rows.length === 0 || daoTraitRes.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const rewardsByToken = {};
    for (const nft of stakedResult.rows) {
      const earnings = calcDaoRewardsForNft(nft, daoTraitRes.rows);
      for (const e of earnings) {
        const key = e.token_address;
        if (!rewardsByToken[key]) {
          rewardsByToken[key] = { token_address: e.token_address, token_symbol: e.token_symbol, token_decimals: e.token_decimals, amount: 0 };
        }
        rewardsByToken[key].amount += e.pending_amount;
      }
    }

    return res.json({ success: true, data: Object.values(rewardsByToken) });
  } catch (e) {
    console.error('[dao-rewards]', e.message);
    return res.status(500).json({ success: false, message: 'Failed to calculate DAO rewards' });
  }
});

// GET /dao-claim-quote?wallet_address=...
router.get('/dao-claim-quote', async (req, res) => {
  try {
    const { wallet_address } = req.query;
    if (!wallet_address) return res.status(400).json({ success: false, message: 'wallet_address is required' });

    const pool = getPool();
    const [settingsRes, stakedResult, daoTraitRes] = await Promise.all([
      pool.query("SELECT key_name, value FROM settings WHERE key_name IN ('dao_claim_fee','dao_rewards_wallet')"),
      pool.query('SELECT id, mint_address, collection_id, stake_timestamp, dao_last_claim_timestamp, traits FROM staked_nfts WHERE owner_wallet = $1', [wallet_address]),
      pool.query('SELECT collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier, created_at FROM dao_trait_rewards WHERE is_active=TRUE'),
    ]);

    const settings = {};
    settingsRes.rows.forEach(r => { settings[r.key_name] = r.value; });

    const rewardsByToken = {};
    for (const nft of stakedResult.rows) {
      const earnings = calcDaoRewardsForNft(nft, daoTraitRes.rows);
      for (const e of earnings) {
        const key = e.token_address;
        if (!rewardsByToken[key]) rewardsByToken[key] = { token_address: e.token_address, token_symbol: e.token_symbol, token_decimals: e.token_decimals, amount: 0 };
        rewardsByToken[key].amount += e.pending_amount;
      }
    }

    return res.json({ success: true, data: {
      claimFee: parseFloat(settings['dao_claim_fee'] || '0'),
      feeRecipient: settings['dao_rewards_wallet'] || null,
      requiresPayment: parseFloat(settings['dao_claim_fee'] || '0') > 0,
      rewards: Object.values(rewardsByToken),
    }});
  } catch (e) {
    console.error('[dao-claim-quote]', e.message);
    return res.status(500).json({ success: false, message: 'Failed to get DAO claim quote' });
  }
});

// GET /dao-eligible-nfts?wallet_address=...
router.get('/dao-eligible-nfts', async (req, res) => {
  try {
    const { wallet_address } = req.query;
    if (!wallet_address) return res.status(400).json({ success: false, message: 'wallet_address is required' });

    const pool = getPool();
    const [stakedResult, daoTraitRes] = await Promise.all([
      pool.query(
        `SELECT sn.id, sn.mint_address, sn.collection_id, sn.stake_timestamp,
                sn.dao_last_claim_timestamp, sn.traits,
                c.name AS collection_name
         FROM staked_nfts sn
         JOIN collections c ON c.id = sn.collection_id
         WHERE sn.owner_wallet = $1`,
        [wallet_address]
      ),
      pool.query(
        'SELECT collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier, created_at FROM dao_trait_rewards WHERE is_active=TRUE'
      ),
    ]);

    if (stakedResult.rows.length === 0) return res.json({ success: true, data: [] });

    // First pass: find eligible NFTs
    const eligiblePairs = [];
    for (const nft of stakedResult.rows) {
      const earnings = calcDaoRewardsForNft(nft, daoTraitRes.rows);
      if (earnings.length > 0) eligiblePairs.push({ nft, earnings });
    }
    if (eligiblePairs.length === 0) return res.json({ success: true, data: [] });

    // Fetch metadata from Helius for eligible NFTs (small batch — typically 1-5 NFTs)
    const metadataMap = {};
    try {
      const endpoint = process.env.HELIUS_MAINNET_ENDPOINT;
      const apiKey = process.env.HELIUS_API_KEY;
      if (endpoint && apiKey) {
        const url = endpoint.includes('?api-key=') ? endpoint : `${endpoint.replace(/\/$/, '')}/?api-key=${apiKey}`;
        const axios = require('axios');
        const mints = eligiblePairs.map(e => e.nft.mint_address);
        // Try getAssetBatch first (single request for all mints)
        try {
          const batchRes = await axios.post(url, {
            jsonrpc: '2.0', id: 'get-assets-batch', method: 'getAssetBatch',
            params: { ids: mints }
          }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
          const assets = batchRes.data?.result || [];
          for (const asset of assets) {
            if (asset?.id) {
              metadataMap[asset.id] = {
                name: asset.content?.metadata?.name || null,
                image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
              };
            }
          }
        } catch {
          // Fallback: fetch individually (only for small batches)
          for (const { nft } of eligiblePairs.slice(0, 5)) {
            try {
              const r = await axios.post(url, {
                jsonrpc: '2.0', id: 'get-asset', method: 'getAsset',
                params: { id: nft.mint_address }
              }, { headers: { 'Content-Type': 'application/json' }, timeout: 8000 });
              const asset = r.data?.result;
              if (asset) {
                metadataMap[nft.mint_address] = {
                  name: asset.content?.metadata?.name || null,
                  image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
                };
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch { /* metadata fetch failed — use fallback names */ }

    const result = eligiblePairs.map(({ nft, earnings }) => {
      const meta = metadataMap[nft.mint_address] || {};
      return {
        mint_address: nft.mint_address,
        name: meta.name || null,
        image: meta.image || null,
        collection_name: nft.collection_name || null,
        dao_earnings: earnings,
      };
    });

    return res.json({ success: true, data: result });
  } catch (e) {
    console.error('[dao-eligible-nfts]', e.message);
    return res.status(500).json({ success: false, message: 'Failed to get DAO eligible NFTs' });
  }
});

// GET /dao-airdrops?wallet_address=...
router.get('/dao-airdrops', async (req, res) => {
  try {
    const { wallet_address } = req.query;
    if (!wallet_address) return res.status(400).json({ success: false, message: 'wallet_address is required' });
    const result = await getPool().query(
      `SELECT snap.id, snap.dao_airdrop_config_id, snap.token_amount,
              dac.token_symbol, dac.token_address, dac.token_decimals, dac.expires_at,
              c.name AS collection_name,
              EXTRACT(EPOCH FROM (dac.expires_at - NOW()))::INTEGER AS time_remaining_seconds
       FROM dao_airdrop_snapshots snap
       JOIN dao_airdrop_configs dac ON snap.dao_airdrop_config_id = dac.id
       JOIN collections c ON c.id = dac.collection_id
       WHERE snap.wallet_address=$1
         AND snap.is_claimed=false
         AND dac.status='active'
         AND dac.expires_at > NOW()`,
      [wallet_address]
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error('[dao-airdrops]', e.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch DAO airdrops' });
  }
});

// POST /dao-airdrop-quote
router.post('/dao-airdrop-quote', async (req, res) => {
  try {
    const { wallet_address, dao_airdrop_snapshot_id } = req.body;
    if (!wallet_address || !dao_airdrop_snapshot_id) return res.status(400).json({ success: false, message: 'wallet_address and dao_airdrop_snapshot_id are required' });
    const pool = getPool();
    const snap = await pool.query(
      `SELECT snap.token_amount FROM dao_airdrop_snapshots snap
       JOIN dao_airdrop_configs dac ON snap.dao_airdrop_config_id=dac.id
       WHERE snap.id=$1 AND snap.wallet_address=$2 AND snap.is_claimed=false AND dac.status='active' AND dac.expires_at>NOW()`,
      [dao_airdrop_snapshot_id, wallet_address]
    );
    if (snap.rows.length === 0) return res.status(404).json({ success: false, message: 'No eligible DAO airdrop found' });
    const settings = await pool.query("SELECT key_name, value FROM settings WHERE key_name IN ('dao_claim_fee','dao_rewards_wallet')");
    const s = {};
    settings.rows.forEach(r => { s[r.key_name] = r.value; });
    return res.json({ success: true, data: { token_amount: snap.rows[0].token_amount, claim_fee: parseFloat(s['dao_claim_fee'] || '0'), fee_recipient: s['dao_rewards_wallet'] || null } });
  } catch (e) {
    console.error('[dao-airdrop-quote]', e.message);
    return res.status(500).json({ success: false, message: 'Failed to get DAO airdrop quote' });
  }
});

// POST /dao-claim
router.post('/dao-claim', async (req, res) => {
  try {
    const { wallet_address } = req.body;
    if (!wallet_address) return res.status(400).json({ success: false, message: 'wallet_address is required' });
    const { claimDaoRewards } = require('../backend/src/dao-rewards-handler');
    const result = await claimDaoRewards(wallet_address, req.body.payment_signature || null);
    return result.success ? res.json(result) : res.status(400).json(result);
  } catch (e) {
    console.error('[dao-claim]', e.message);
    return res.status(500).json({ success: false, message: 'Failed to claim DAO rewards' });
  }
});

// POST /dao-airdrop-claim
router.post('/dao-airdrop-claim', async (req, res) => {
  try {
    const { wallet_address, dao_airdrop_snapshot_id } = req.body;
    if (!wallet_address || !dao_airdrop_snapshot_id) return res.status(400).json({ success: false, message: 'wallet_address and dao_airdrop_snapshot_id are required' });

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const snap = await client.query(
        `SELECT snap.id, snap.is_claimed, snap.token_amount, dac.token_symbol, dac.token_address, dac.token_decimals, dac.expires_at, dac.collection_id
         FROM dao_airdrop_snapshots snap JOIN dao_airdrop_configs dac ON snap.dao_airdrop_config_id=dac.id
         WHERE snap.id=$1 AND snap.wallet_address=$2 FOR UPDATE`,
        [dao_airdrop_snapshot_id, wallet_address]
      );
      if (snap.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Not eligible' }); }
      const s = snap.rows[0];
      if (s.is_claimed) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Already claimed' }); }
      if (new Date(s.expires_at) <= new Date()) { await client.query('ROLLBACK'); return res.status(410).json({ success: false, message: 'Expired' }); }

      const settings = await client.query("SELECT key_name, value FROM settings WHERE key_name IN ('dao_claim_fee','dao_rewards_wallet','dao_rewards_wallet_encrypted_key')");
      const cfg = {};
      settings.rows.forEach(r => { cfg[r.key_name] = r.value; });
      if (!cfg['dao_rewards_wallet'] || !cfg['dao_rewards_wallet_encrypted_key']) {
        await client.query('ROLLBACK');
        return res.status(500).json({ success: false, message: 'DAO rewards wallet not configured. Please set it in DAO Admin → Wallet.' });
      }
      // Validate key format before attempting decrypt
      if (!cfg['dao_rewards_wallet_encrypted_key'].includes(':')) {
        await client.query('ROLLBACK');
        return res.status(500).json({ success: false, message: 'DAO wallet key is in wrong format. Please re-save it in DAO Admin → Wallet.' });
      }

      const { getKeypairFromPrivateKey, getConnection, sendTransaction } = require('../backend/src/solana-transaction-utils');
      const { PublicKey } = require('@solana/web3.js');
      const splToken = require('@solana/spl-token');

      const daoKeypair = getKeypairFromPrivateKey(cfg['dao_rewards_wallet_encrypted_key']);
      const connection = getConnection();
      const userPubkey = new PublicKey(wallet_address);
      const tokenMint = new PublicKey(s.token_address);
      const tokenAmount = parseFloat(s.token_amount);
      const rawAmount = Math.floor(tokenAmount * Math.pow(10, s.token_decimals || 9));

      const sourceATA = await splToken.getAssociatedTokenAddress(tokenMint, daoKeypair.publicKey);
      const destATA = await splToken.getAssociatedTokenAddress(tokenMint, userPubkey);
      const instructions = [];
      try { await splToken.getAccount(connection, destATA); }
      catch { instructions.push(splToken.createAssociatedTokenAccountInstruction(daoKeypair.publicKey, destATA, userPubkey, tokenMint)); }
      instructions.push(splToken.createTransferInstruction(sourceATA, destATA, daoKeypair.publicKey, rawAmount));

      const signature = await sendTransaction(instructions, daoKeypair);

      // Record transaction — wrapped in savepoint so failure doesn't abort the main transaction
      try {
        await client.query('SAVEPOINT before_tx_record');
        await client.query(
          "INSERT INTO transactions (wallet_address, transaction_type, amount, token_address, status, transaction_hash) VALUES ($1,'DAO_AIRDROP_CLAIM',$2,$3,'CONFIRMED',$4)",
          [wallet_address, tokenAmount, s.token_address, signature]
        );
      } catch (txErr) {
        await client.query('ROLLBACK TO SAVEPOINT before_tx_record');
        console.error('[dao-airdrop-claim] transaction record failed (non-fatal):', txErr.message);
      }

      // Mark snapshot as claimed — this MUST succeed
      await client.query('UPDATE dao_airdrop_snapshots SET is_claimed=true, claimed_at=NOW(), claim_tx_hash=$1 WHERE id=$2', [signature, s.id]);
      await client.query('COMMIT');
      return res.json({ success: true, data: { signature } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('[dao-airdrop-claim]', e.message);
    return res.status(500).json({ success: false, message: 'Failed to claim DAO airdrop' });
  }
});

module.exports = router;
