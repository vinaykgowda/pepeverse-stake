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

// GET /dao-rewards?wallet_address=...
router.get('/dao-rewards', async (req, res) => {
  try {
    const { wallet_address } = req.query;
    if (!wallet_address) return res.status(400).json({ success: false, message: 'wallet_address is required' });

    const pool = getPool();
    const stakedResult = await pool.query(
      `SELECT id, mint_address, collection_id, stake_timestamp, dao_last_claim_timestamp, traits,
              EXTRACT(EPOCH FROM (NOW() - COALESCE(dao_last_claim_timestamp, stake_timestamp))) AS seconds_since_dao_claim
       FROM staked_nfts WHERE owner_wallet = $1`,
      [wallet_address]
    );
    if (stakedResult.rows.length === 0) return res.json({ success: true, data: [] });

    const daoTraitRes = await pool.query(
      'SELECT collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier FROM dao_trait_rewards WHERE is_active=TRUE'
    );
    if (daoTraitRes.rows.length === 0) return res.json({ success: true, data: [] });

    const rewardsByToken = {};
    for (const nft of stakedResult.rows) {
      const seconds = parseFloat(nft.seconds_since_dao_claim) || 0;
      if (seconds < 60) continue;
      const days = seconds / 86400;
      let traits = [];
      try { traits = nft.traits ? (Array.isArray(nft.traits) ? nft.traits : JSON.parse(nft.traits)) : []; } catch {}

      for (const dtr of daoTraitRes.rows) {
        if (dtr.collection_id !== nft.collection_id) continue;
        const match = traits.some(t => {
          const tType = String(t.trait_type ?? t.type ?? '').toLowerCase();
          const tVal = String(t.value ?? t.trait_value ?? '').toLowerCase();
          return tType === String(dtr.trait_type).toLowerCase() && tVal === String(dtr.trait_value).toLowerCase();
        });
        if (!match) continue;
        const key = dtr.token_address;
        if (!rewardsByToken[key]) rewardsByToken[key] = { token_address: dtr.token_address, token_symbol: dtr.token_symbol, token_decimals: parseInt(dtr.token_decimals) || 9, amount: 0 };
        rewardsByToken[key].amount += parseFloat(dtr.multiplier) * days;
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
    const settingsRes = await pool.query(
      "SELECT key_name, value FROM settings WHERE key_name IN ('dao_claim_fee','dao_rewards_wallet')"
    );
    const settings = {};
    settingsRes.rows.forEach(r => { settings[r.key_name] = r.value; });

    // Reuse rewards calculation
    const rewardsRes = await fetch(`${req.protocol}://${req.get('host')}/api/v1/user/dao-rewards?wallet_address=${wallet_address}`).catch(() => null);
    let rewards = [];
    if (rewardsRes && rewardsRes.ok) {
      const data = await rewardsRes.json();
      rewards = data.data || [];
    }

    return res.json({ success: true, data: {
      claimFee: parseFloat(settings['dao_claim_fee'] || '0'),
      feeRecipient: settings['dao_rewards_wallet'] || null,
      requiresPayment: parseFloat(settings['dao_claim_fee'] || '0') > 0,
      rewards,
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
    const stakedResult = await pool.query(
      `SELECT id, mint_address, collection_id, stake_timestamp, dao_last_claim_timestamp, traits,
              EXTRACT(EPOCH FROM (NOW() - COALESCE(dao_last_claim_timestamp, stake_timestamp))) AS seconds_since_dao_claim
       FROM staked_nfts WHERE owner_wallet = $1`,
      [wallet_address]
    );
    if (stakedResult.rows.length === 0) return res.json({ success: true, data: [] });

    const daoTraitRes = await pool.query(
      'SELECT collection_id, trait_type, trait_value, token_address, token_symbol, token_decimals, multiplier FROM dao_trait_rewards WHERE is_active=TRUE'
    );

    const eligible = [];
    for (const nft of stakedResult.rows) {
      let traits = [];
      try { traits = nft.traits ? (Array.isArray(nft.traits) ? nft.traits : JSON.parse(nft.traits)) : []; } catch {}

      const seconds = parseFloat(nft.seconds_since_dao_claim) || 0;
      const days = seconds / 86400;
      const earnings = [];

      for (const dtr of daoTraitRes.rows) {
        if (dtr.collection_id !== nft.collection_id) continue;
        const match = traits.some(t => {
          const tType = String(t.trait_type ?? t.type ?? '').toLowerCase();
          const tVal = String(t.value ?? t.trait_value ?? '').toLowerCase();
          return tType === String(dtr.trait_type).toLowerCase() && tVal === String(dtr.trait_value).toLowerCase();
        });
        if (!match) continue;
        earnings.push({
          trait_type: dtr.trait_type, trait_value: dtr.trait_value,
          token_address: dtr.token_address, token_symbol: dtr.token_symbol,
          token_decimals: parseInt(dtr.token_decimals) || 9,
          daily_rate: parseFloat(dtr.multiplier),
          pending_amount: seconds >= 60 ? parseFloat(dtr.multiplier) * days : 0,
        });
      }
      if (earnings.length > 0) {
        eligible.push({ mint_address: nft.mint_address, name: `NFT ${nft.mint_address.slice(0, 8)}`, image: null, dao_earnings: earnings });
      }
    }
    return res.json({ success: true, data: eligible });
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
              EXTRACT(EPOCH FROM (dac.expires_at - NOW()))::INTEGER AS time_remaining_seconds
       FROM dao_airdrop_snapshots snap
       JOIN dao_airdrop_configs dac ON snap.dao_airdrop_config_id = dac.id
       WHERE snap.wallet_address=$1 AND snap.is_claimed=false AND dac.status='active' AND dac.expires_at > NOW()`,
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
    // Delegate to backend handler
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
        return res.status(500).json({ success: false, message: 'DAO rewards wallet not configured' });
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

      await client.query(
        "INSERT INTO transactions (wallet_address, collection_id, transaction_type, amount, token_symbol, token_address, status, transaction_hash) VALUES ($1,$2,'DAO_AIRDROP_CLAIM',$3,$4,$5,'CONFIRMED',$6)",
        [wallet_address, s.collection_id, tokenAmount, s.token_symbol, s.token_address, signature]
      );
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
