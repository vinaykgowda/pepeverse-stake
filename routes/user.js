// routes/user.js

const express = require('express');
const router = express.Router();
const { getPool } = require('../src/db');
const pool = getPool();
const { verifyJWT } = require('../middleware/auth');
const transactionVerification = require('../src/services/transactionVerification');
const HeliusProxyService = require('../src/services/heliusProxy');
const heliusProxy = new HeliusProxyService();
const {
  getConnection,
  getKeypairFromPrivateKey,
  createTokenTransferInstruction,
  sendTransaction,
  getOrCreateTokenAccount
} = require('../src/solana-transaction-utils');
const { PublicKey } = require('@solana/web3.js');

// GET /api/v1/user/airdrops/:walletAddress
router.get('/airdrops/:walletAddress', verifyJWT, async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const result = await pool.query(
      `SELECT snap.airdrop_config_id, ac.token_symbol, snap.token_amount, ac.expires_at,
         c.name AS collection_name,
         EXTRACT(EPOCH FROM (ac.expires_at - NOW()))::INTEGER AS time_remaining_seconds
       FROM airdrop_snapshots snap
       JOIN airdrop_configs ac ON snap.airdrop_config_id = ac.id
       JOIN collections c ON ac.collection_id = c.id
       WHERE snap.wallet_address = $1
         AND snap.claimed = false
         AND ac.status = 'active'
         AND ac.expires_at > NOW()`,
      [walletAddress]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in GET /user/airdrops/:walletAddress:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch airdrops' });
  }
});

// POST /api/v1/user/airdrops/quote
router.post('/airdrops/quote', verifyJWT, async (req, res) => {
  try {
    const { wallet_address, airdrop_config_id } = req.body;
    if (!wallet_address || !airdrop_config_id) {
      return res.status(400).json({ success: false, message: 'wallet_address and airdrop_config_id are required' });
    }
    const snapshotResult = await pool.query(
      `SELECT snap.token_amount, ac.expires_at
       FROM airdrop_snapshots snap
       JOIN airdrop_configs ac ON snap.airdrop_config_id = ac.id
       WHERE snap.airdrop_config_id = $1 AND snap.wallet_address = $2
         AND snap.claimed = false AND ac.status = 'active' AND ac.expires_at > NOW()`,
      [airdrop_config_id, wallet_address]
    );
    if (snapshotResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No eligible unclaimed airdrop found for this wallet' });
    }
    const { token_amount } = snapshotResult.rows[0];
    const claimFeeResult = await pool.query('SELECT value FROM settings WHERE key_name = $1', ['claim_fee']);
    const feeRecipientResult = await pool.query('SELECT value FROM settings WHERE key_name = $1', ['rewards_wallet']);
    return res.json({
      success: true,
      data: {
        token_amount,
        claim_fee: parseFloat(claimFeeResult.rows[0]?.value || 0),
        fee_recipient: feeRecipientResult.rows[0]?.value || null
      }
    });
  } catch (error) {
    console.error('Error in POST /user/airdrops/quote:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch airdrop quote' });
  }
});

// POST /api/v1/user/airdrops/claim
router.post('/airdrops/claim', verifyJWT, async (req, res) => {
  const { wallet_address, airdrop_config_id, payment_signature } = req.body;
  if (!wallet_address || !airdrop_config_id || !payment_signature) {
    return res.status(400).json({ success: false, message: 'wallet_address, airdrop_config_id, and payment_signature are required' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const snapshotResult = await client.query(
      `SELECT snap.id, snap.claimed, snap.token_amount,
              ac.token_symbol, ac.token_address, ac.token_decimals, ac.expires_at, ac.collection_id
       FROM airdrop_snapshots snap
       JOIN airdrop_configs ac ON snap.airdrop_config_id = ac.id
       WHERE snap.airdrop_config_id = $1 AND snap.wallet_address = $2
       FOR UPDATE`,
      [airdrop_config_id, wallet_address]
    );

    if (snapshotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Not eligible for this airdrop' });
    }

    const snap = snapshotResult.rows[0];
    if (snap.claimed) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Airdrop already claimed' }); }
    if (new Date(snap.expires_at) <= new Date()) { await client.query('ROLLBACK'); return res.status(410).json({ success: false, message: 'Claim window has expired' }); }

    const settingsResult = await client.query(`SELECT key_name, value FROM settings WHERE key_name IN ('rewards_wallet', 'rewards_wallet_encrypted_key', 'claim_fee')`);
    const settings = {};
    settingsResult.rows.forEach(r => { settings[r.key_name] = r.value; });

    const rewards_wallet = settings['rewards_wallet'];
    const rewards_wallet_encrypted_key = settings['rewards_wallet_encrypted_key'];
    const claim_fee = parseFloat(settings['claim_fee'] || 0);

    if (!rewards_wallet || !rewards_wallet_encrypted_key) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: 'Rewards wallet not configured' });
    }

    const paymentResult = await transactionVerification.verifyPaymentWithConfirmation(payment_signature, wallet_address, rewards_wallet, claim_fee);
    if (!paymentResult.success) { await client.query('ROLLBACK'); return res.status(402).json({ success: false, message: 'Payment verification failed' }); }

    let walletBalance = 0;
    try {
      const tokenAccounts = await heliusProxy.getTokenAccountsByOwner(rewards_wallet, snap.token_address);
      walletBalance = (tokenAccounts?.value ?? []).reduce((sum, acct) => sum + (acct?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0);
    } catch (balanceErr) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: 'Failed to verify rewards wallet balance' });
    }

    const tokenAmount = parseFloat(snap.token_amount);
    if (walletBalance < tokenAmount) { await client.query('ROLLBACK'); return res.status(402).json({ success: false, message: 'Insufficient token balance in rewards wallet' }); }

    let signature;
    try {
      const connection = getConnection();
      const rewardsKeypair = getKeypairFromPrivateKey(rewards_wallet_encrypted_key);
      const userPubkey = new PublicKey(wallet_address);
      const tokenMint = new PublicKey(snap.token_address);
      const sourceTokenAccount = await getOrCreateTokenAccount(connection, tokenMint, rewardsKeypair.publicKey, rewardsKeypair);
      const destinationTokenAccount = await getOrCreateTokenAccount(connection, tokenMint, userPubkey, rewardsKeypair);
      const rawAmount = Math.floor(tokenAmount * Math.pow(10, snap.token_decimals));
      const transferInstruction = await createTokenTransferInstruction(sourceTokenAccount, destinationTokenAccount, rewardsKeypair.publicKey, rawAmount);
      signature = await sendTransaction([transferInstruction], rewardsKeypair);
    } catch (transferErr) {
      console.error('❌ [AIRDROP CLAIM] SPL transfer failed:', transferErr);
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: 'Token transfer failed. Please try again.' });
    }

    await client.query(
      `INSERT INTO transactions (wallet_address, collection_id, transaction_type, amount, token_symbol, token_address, status, transaction_hash) VALUES ($1, $2, 'AIRDROP_CLAIM', $3, $4, $5, 'CONFIRMED', $6)`,
      [wallet_address, snap.collection_id, tokenAmount, snap.token_symbol, snap.token_address, signature]
    );
    await client.query(`UPDATE airdrop_snapshots SET claimed = true, claimed_at = NOW(), claim_tx_hash = $1 WHERE id = $2`, [signature, snap.id]);
    await client.query('COMMIT');
    return res.json({ success: true, signature });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error in POST /user/airdrops/claim:', error);
    return res.status(500).json({ success: false, message: 'Failed to process airdrop claim' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
