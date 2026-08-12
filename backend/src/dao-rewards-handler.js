// backend/src/dao-rewards-handler.js
// DAO reward calculation, eligible NFT lookup, and claim — independent of regular staking rewards.

const { PublicKey } = require('@solana/web3.js');
const {
  getConnection,
  sendTransaction,
  createTokenTransferInstruction,
  getOrCreateTokenAccount,
  getKeypairFromPrivateKey
} = require('./solana-transaction-utils');
const { getPool } = require('./db');
const pool = getPool();
const transactionVerification = require('./services/transactionVerification');

// ---------------------------------------------------------------------------
// calculateDaoRewards(walletAddress)
// Requirements: 4.1 — DAO reward calculation independent of regular rewards
// ---------------------------------------------------------------------------
async function calculateDaoRewards(walletAddress) {
  try {
    console.log(`🔄 [DAO-REWARDS] Calculating DAO rewards for wallet: ${walletAddress}`);

    // Query staked NFTs for this wallet
    const stakedResult = await pool.query(
      `SELECT s.id, s.mint_address, s.collection_id, s.stake_timestamp,
              s.dao_last_claim_timestamp, s.traits
       FROM staked_nfts s
       WHERE s.owner_wallet = $1`,
      [walletAddress]
    );

    const stakedNFTs = stakedResult.rows;
    console.log(`📊 [DAO-REWARDS] Found ${stakedNFTs.length} staked NFTs for wallet ${walletAddress}`);

    if (stakedNFTs.length === 0) {
      return { success: true, data: [] };
    }

    // Query all active DAO trait rewards for the collections this wallet has staked in
    const daoTraitRewardsResult = await pool.query(
      `SELECT dtr.collection_id, dtr.trait_type, dtr.trait_value,
              dtr.token_address, dtr.token_symbol, dtr.token_decimals, dtr.multiplier,
              COALESCE(dtr.created_at, '2000-01-01'::timestamptz) AS created_at
       FROM dao_trait_rewards dtr
       WHERE dtr.is_active = TRUE
         AND dtr.collection_id IN (SELECT DISTINCT collection_id FROM staked_nfts WHERE owner_wallet = $1)`,
      [walletAddress]
    );

    const allDaoTraitRewards = daoTraitRewardsResult.rows;
    console.log(`🎯 [DAO-REWARDS] Found ${allDaoTraitRewards.length} active DAO trait rewards`);

    if (allDaoTraitRewards.length === 0) {
      return { success: true, data: [] };
    }

    const rewardsByToken = {};

    for (const nft of stakedNFTs) {
      try {
        // If dao_last_claim_timestamp is NULL, this NFT hasn't been seeded yet.
        // Skip it — rewards only accrue AFTER the seeding (done in dao-eligible-nfts endpoint).
        if (!nft.dao_last_claim_timestamp) {
          continue;
        }
        const claimStart = new Date(nft.dao_last_claim_timestamp).getTime();

        // Parse traits
        let traits = [];
        if (nft.traits) {
          if (typeof nft.traits === 'string') {
            try { traits = JSON.parse(nft.traits); } catch { traits = []; }
          } else if (Array.isArray(nft.traits)) {
            traits = nft.traits;
          }
        }

        // Match against DAO trait rewards for this NFT's collection
        const nftDaoTraitRewards = allDaoTraitRewards.filter(
          dtr => String(dtr.collection_id) === String(nft.collection_id)
        );

        for (const dtr of nftDaoTraitRewards) {
          const hasMatch = traits.some(t => {
            const tType = String(t.trait_type ?? t.type ?? '').toLowerCase();
            const tVal  = String(t.value ?? t.trait_value ?? '').toLowerCase();
            return (
              tType === String(dtr.trait_type).toLowerCase() &&
              tVal  === String(dtr.trait_value).toLowerCase()
            );
          });

          if (!hasMatch) continue;

          // Earn from dao_last_claim_timestamp (seeded when trait was first detected)
          const secondsEarning = Math.max(0, (Date.now() - claimStart) / 1000);

          // Minimum 60-second window
          if (secondsEarning < 60) {
            console.log(`⏰ [DAO-REWARDS] NFT ${nft.mint_address}: DAO earn window < 60s, skipping`);
            continue;
          }

          const daysEarning = secondsEarning / 86400;
          const daoReward = parseFloat(dtr.multiplier) * daysEarning;
          console.log(`🎲 [DAO-REWARDS] NFT ${nft.mint_address}: trait ${dtr.trait_type}:${dtr.trait_value} → ${daoReward} ${dtr.token_symbol} (${daysEarning.toFixed(4)} days)`);

          if (daoReward > 0.000001) {
            const tokenKey = `${dtr.token_address}-${dtr.token_symbol}`;
            if (!rewardsByToken[tokenKey]) {
              rewardsByToken[tokenKey] = {
                token_address: dtr.token_address,
                token_symbol: dtr.token_symbol,
                token_decimals: parseInt(dtr.token_decimals) || 9,
                amount: 0
              };
            }
            rewardsByToken[tokenKey].amount += daoReward;
          }
        }
      } catch (nftError) {
        console.error(`❌ [DAO-REWARDS] Error processing NFT ${nft.mint_address}:`, nftError);
      }
    }

    const totalRewards = Object.values(rewardsByToken);
    console.log(`✅ [DAO-REWARDS] Total DAO rewards calculated:`, totalRewards);

    return { success: true, data: totalRewards };
  } catch (error) {
    console.error('❌ [DAO-REWARDS] Error calculating DAO rewards:', error);
    return { success: false, message: error.message || 'Failed to calculate DAO rewards' };
  }
}

// ---------------------------------------------------------------------------
// getDaoEligibleNFTs(walletAddress)
// Requirements: 4.4 — staked NFTs with at least one matching DAO trait reward
// ---------------------------------------------------------------------------
async function getDaoEligibleNFTs(walletAddress) {
  try {
    console.log(`🔄 [DAO-ELIGIBLE] Getting DAO-eligible NFTs for wallet: ${walletAddress}`);

    // Query staked NFTs
    const stakedResult = await pool.query(
      `SELECT s.id, s.mint_address, s.collection_id, s.stake_timestamp,
              s.dao_last_claim_timestamp, s.traits,
              EXTRACT(EPOCH FROM (NOW() - COALESCE(s.dao_last_claim_timestamp, s.stake_timestamp))) AS seconds_since_dao_claim
       FROM staked_nfts s
       WHERE s.owner_wallet = $1`,
      [walletAddress]
    );

    const stakedNFTs = stakedResult.rows;

    if (stakedNFTs.length === 0) {
      return { success: true, data: [] };
    }

    // Query all active DAO trait rewards for these collections
    const daoTraitRewardsResult = await pool.query(
      `SELECT dtr.id, dtr.collection_id, dtr.trait_type, dtr.trait_value,
              dtr.token_address, dtr.token_symbol, dtr.token_decimals, dtr.multiplier
       FROM dao_trait_rewards dtr
       WHERE dtr.is_active = TRUE
         AND dtr.collection_id IN (SELECT DISTINCT collection_id FROM staked_nfts WHERE owner_wallet = $1)`,
      [walletAddress]
    );

    const allDaoTraitRewards = daoTraitRewardsResult.rows;

    const eligibleNFTs = [];

    for (const nft of stakedNFTs) {
      // Parse traits
      let traits = [];
      if (nft.traits) {
        if (typeof nft.traits === 'string') {
          try { traits = JSON.parse(nft.traits); } catch { traits = []; }
        } else if (Array.isArray(nft.traits)) {
          traits = nft.traits;
        }
      }

      const nftDaoTraitRewards = allDaoTraitRewards.filter(
        dtr => dtr.collection_id === nft.collection_id
      );

      const secondsSinceDaoClaim = parseInt(nft.seconds_since_dao_claim) || 0;
      const daysSinceDaoClaim = secondsSinceDaoClaim / 86400;

      // Build per-NFT DAO earnings breakdown
      const daoEarnings = [];

      for (const dtr of nftDaoTraitRewards) {
        const hasMatch = traits.some(t => {
          const tType = String(t.trait_type ?? t.type ?? '').toLowerCase();
          const tVal  = String(t.value ?? t.trait_value ?? '').toLowerCase();
          return (
            tType === String(dtr.trait_type).toLowerCase() &&
            tVal  === String(dtr.trait_value).toLowerCase()
          );
        });

        if (!hasMatch) continue;

        const pendingAmount = secondsSinceDaoClaim >= 60
          ? parseFloat(dtr.multiplier) * daysSinceDaoClaim
          : 0;

        daoEarnings.push({
          trait_type: dtr.trait_type,
          trait_value: dtr.trait_value,
          token_address: dtr.token_address,
          token_symbol: dtr.token_symbol,
          token_decimals: parseInt(dtr.token_decimals) || 9,
          daily_rate: parseFloat(dtr.multiplier),
          pending_amount: pendingAmount
        });
      }

      // Only include NFTs that have at least one matching DAO trait
      if (daoEarnings.length === 0) continue;

      eligibleNFTs.push({
        mint_address: nft.mint_address,
        name: `NFT ${nft.mint_address.substring(0, 8)}`,
        image: null,
        dao_earnings: daoEarnings
      });
    }

    console.log(`✅ [DAO-ELIGIBLE] Found ${eligibleNFTs.length} DAO-eligible NFTs`);
    return { success: true, data: eligibleNFTs };
  } catch (error) {
    console.error('❌ [DAO-ELIGIBLE] Error getting DAO-eligible NFTs:', error);
    return { success: false, message: error.message || 'Failed to get DAO-eligible NFTs' };
  }
}

// ---------------------------------------------------------------------------
// claimDaoRewards(walletAddress, paymentSignature)
// Requirements: 4.3 — verify fee, SPL transfer from dao_rewards_wallet, update dao_last_claim_timestamp
// SECURITY: Uses advisory lock, signature dedup, and claim-before-send pattern
// ---------------------------------------------------------------------------
async function claimDaoRewards(walletAddress, paymentSignature = null) {
  let dbConnection;

  try {
    console.log(`🎯 [DAO-CLAIM] Starting DAO claim for wallet: ${walletAddress}`);

    dbConnection = await pool.getClient();
    await dbConnection.query('BEGIN');

    // SECURITY: Advisory lock to prevent concurrent DAO claims
    const lockKey = Buffer.from('dao-' + walletAddress).reduce((acc, byte) => (acc * 31 + byte) & 0x7FFFFFFF, 0);
    const lockResult = await dbConnection.query('SELECT pg_try_advisory_xact_lock($1) as acquired', [lockKey]);
    if (!lockResult.rows[0].acquired) {
      await dbConnection.query('ROLLBACK');
      return { success: false, message: 'A DAO claim is already being processed for this wallet. Please wait.' };
    }

    // SECURITY: Check payment signature replay
    if (paymentSignature) {
      const sigCheck = await dbConnection.query(
        'SELECT id FROM used_payment_signatures WHERE signature = $1',
        [paymentSignature]
      );
      if (sigCheck.rows.length > 0) {
        await dbConnection.query('ROLLBACK');
        console.error(`🚫 [DAO-CLAIM] REPLAY ATTACK BLOCKED — signature already used: ${paymentSignature}`);
        return { success: false, message: 'This payment signature has already been used. Please initiate a new claim.' };
      }
    }

    // Lock staked NFTs for this wallet to prevent race conditions
    const stakedResult = await dbConnection.query(
      `SELECT s.id, s.mint_address, s.collection_id, s.owner_wallet
       FROM staked_nfts s
       WHERE s.owner_wallet = $1
       FOR UPDATE OF s`,
      [walletAddress]
    );

    if (stakedResult.rows.length === 0) {
      await dbConnection.query('ROLLBACK');
      return { success: false, message: 'No staked NFTs found' };
    }

    // Get DAO settings
    const settingsResult = await dbConnection.query(
      `SELECT key_name, value FROM settings WHERE key_name IN ($1, $2, $3)`,
      ['dao_claim_fee', 'dao_rewards_wallet', 'dao_rewards_wallet_encrypted_key']
    );

    const settings = {};
    for (const row of settingsResult.rows) {
      settings[row.key_name] = row.value;
    }

    const daoClaimFee = parseFloat(settings['dao_claim_fee'] || '0');
    const daoRewardsWallet = settings['dao_rewards_wallet'];
    const daoEncryptedKey = settings['dao_rewards_wallet_encrypted_key'];

    if (!daoRewardsWallet) {
      await dbConnection.query('ROLLBACK');
      throw new Error('DAO rewards wallet not configured. Please contact administrator.');
    }

    if (!daoEncryptedKey) {
      await dbConnection.query('ROLLBACK');
      throw new Error('DAO rewards wallet private key not configured. Please contact administrator.');
    }

    // Verify claim fee payment if required (Requirement 4.3)
    if (daoClaimFee > 0) {
      if (!paymentSignature) {
        await dbConnection.query('ROLLBACK');
        return {
          success: false,
          message: `DAO claim fee required: ${daoClaimFee} SOL to ${daoRewardsWallet}`,
          requires_payment: true,
          quote: {
            dao_claim_fee: daoClaimFee,
            fee_recipient: daoRewardsWallet,
            requires_payment: true
          }
        };
      }

      console.log(`💳 [DAO-CLAIM] Verifying payment signature: ${paymentSignature}`);
      const isValidPayment = await verifyDaoClaimFeePayment(
        paymentSignature,
        walletAddress,
        daoRewardsWallet,
        daoClaimFee
      );

      if (!isValidPayment) {
        await dbConnection.query('ROLLBACK');
        return {
          success: false,
          message: 'DAO payment verification failed. Please ensure you paid the correct amount to the DAO rewards wallet.'
        };
      }

      console.log(`✅ [DAO-CLAIM] DAO payment verified`);

      // SECURITY: Mark signature as used IMMEDIATELY
      await dbConnection.query(
        'INSERT INTO used_payment_signatures (signature, wallet_address, purpose, amount) VALUES ($1, $2, $3, $4)',
        [paymentSignature, walletAddress, 'DAO_CLAIM', daoClaimFee]
      );

      // Record fee transaction
      await dbConnection.query(
        'INSERT INTO transactions (wallet_address, transaction_type, amount, status, transaction_hash) VALUES ($1, $2, $3, $4, $5)',
        [walletAddress, 'FEE', daoClaimFee, 'CONFIRMED', paymentSignature]
      );
    }

    // Calculate DAO rewards
    const rewardsResult = await calculateDaoRewards(walletAddress);

    if (!rewardsResult.success) {
      await dbConnection.query('ROLLBACK');
      throw new Error(rewardsResult.message);
    }

    const rewards = rewardsResult.data;

    if (rewards.length === 0) {
      await dbConnection.query('ROLLBACK');
      return { success: false, message: 'No DAO rewards available to claim' };
    }

    console.log(`💰 [DAO-CLAIM] ${rewards.length} DAO reward token(s) to distribute`);

    // CLAIM-BEFORE-SEND: Update dao_last_claim_timestamp FIRST
    const updateResult = await dbConnection.query(
      `UPDATE staked_nfts SET dao_last_claim_timestamp = NOW()
       WHERE owner_wallet = $1 AND dao_last_claim_timestamp IS NOT NULL`,
      [walletAddress]
    );

    console.log(`🔄 [DAO-CLAIM] Updated dao_last_claim_timestamp for ${updateResult.rowCount} NFTs BEFORE sending tokens`);

    // Record pending transactions
    const pendingTransactions = [];
    for (const reward of rewards) {
      const tokenAmount = Math.floor(reward.amount * Math.pow(10, reward.token_decimals));
      if (tokenAmount <= 0) continue;

      const txResult = await dbConnection.query(
        'INSERT INTO transactions (wallet_address, transaction_type, amount, token_address, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [walletAddress, 'DAO_CLAIM', reward.amount, reward.token_address, 'PENDING']
      );
      pendingTransactions.push({ id: txResult.rows[0].id, reward, tokenAmount });
    }

    // COMMIT before sending tokens (claim-before-send pattern)
    await dbConnection.query('COMMIT');
    console.log(`✅ [DAO-CLAIM] DB transaction committed — timestamps locked, proceeding with transfers`);
    dbConnection.release();
    dbConnection = null;

    // Send SPL transfers (outside of DB transaction)
    let solanaConnection;
    let daoKeypair;

    try {
      solanaConnection = getConnection();
      daoKeypair = getKeypairFromPrivateKey(daoEncryptedKey);
      console.log(`🔑 [DAO-CLAIM] DAO rewards wallet loaded: ${daoKeypair.publicKey.toString()}`);

      const balance = await solanaConnection.getBalance(daoKeypair.publicKey);
      if (balance < 10000000) {
        throw new Error('Insufficient SOL balance in DAO rewards wallet');
      }
    } catch (connectionError) {
      // Mark all as failed
      for (const pt of pendingTransactions) {
        await pool.query('UPDATE transactions SET status = $1 WHERE id = $2', ['FAILED', pt.id]);
      }
      return {
        success: false,
        message: `DAO Solana connection failed: ${connectionError.message}. Claim recorded, contact admin for retry.`,
        data: { successful_claims: 0, failed_claims: pendingTransactions.length, claim_recorded: true }
      };
    }

    let successfulClaims = 0;
    let failedClaims = 0;
    const rewardSignatures = [];

    for (const pt of pendingTransactions) {
      const { id: txId, reward, tokenAmount } = pt;

      try {
        console.log(`🚀 [DAO-CLAIM] Sending ${reward.amount} ${reward.token_symbol} to ${walletAddress}`);

        const tokenMint = new PublicKey(reward.token_address);
        const userPubkey = new PublicKey(walletAddress);

        const sourceTokenAccount = await getOrCreateTokenAccount(
          solanaConnection,
          tokenMint,
          daoKeypair.publicKey,
          daoKeypair
        );

        const destinationTokenAccount = await getOrCreateTokenAccount(
          solanaConnection,
          tokenMint,
          userPubkey,
          daoKeypair
        );

        const transferInstruction = await createTokenTransferInstruction(
          sourceTokenAccount,
          destinationTokenAccount,
          daoKeypair.publicKey,
          tokenAmount
        );

        const signature = await sendTransaction([transferInstruction], daoKeypair);
        console.log(`✅ [DAO-CLAIM] SPL transfer complete: ${signature}`);

        await pool.query(
          'UPDATE transactions SET status = $1, transaction_hash = $2 WHERE id = $3',
          ['CONFIRMED', signature, txId]
        );

        rewardSignatures.push({ token_symbol: reward.token_symbol, signature, amount: reward.amount });
        successfulClaims++;
      } catch (transferError) {
        console.error(`❌ [DAO-CLAIM] Transfer failed for ${reward.token_symbol}:`, transferError);
        await pool.query('UPDATE transactions SET status = $1 WHERE id = $2', ['FAILED', txId]);
        failedClaims++;
      }
    }

    console.log(`🎉 [DAO-CLAIM] DAO claim complete — ${successfulClaims} succeeded, ${failedClaims} failed`);

    return {
      success: successfulClaims > 0,
      message: successfulClaims > 0
        ? `Successfully sent ${successfulClaims} DAO reward(s)!${failedClaims > 0 ? ` ${failedClaims} failed (will be retried).` : ''}`
        : `All DAO transfers failed. Claim time window consumed. Contact admin for retry.`,
      data: {
        rewards,
        signature: rewardSignatures[0]?.signature || null,
        reward_signatures: rewardSignatures,
        successful_claims: successfulClaims,
        failed_claims: failedClaims,
        updated_nfts: updateResult.rowCount
      }
    };
  } catch (error) {
    if (dbConnection) {
      await dbConnection.query('ROLLBACK');
      console.log(`🔄 [DAO-CLAIM] Transaction rolled back: ${error.message}`);
    }
    console.error('❌ [DAO-CLAIM] Fatal error:', error);
    return { success: false, message: error.message || 'Failed to claim DAO rewards' };
  } finally {
    if (dbConnection) {
      dbConnection.release();
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helper — verify DAO claim fee payment
// ---------------------------------------------------------------------------
async function verifyDaoClaimFeePayment(paymentSignature, fromWallet, toWallet, expectedAmount) {
  try {
    console.log('🔐 [DAO-CLAIM] Verifying DAO fee payment:', {
      signature: paymentSignature,
      from: fromWallet,
      to: toWallet,
      expected: expectedAmount
    });

    const result = await transactionVerification.verifyPaymentWithConfirmation(
      paymentSignature,
      fromWallet,
      toWallet,
      expectedAmount
    );

    if (!result.success) {
      console.error('❌ [DAO-CLAIM] DAO payment verification failed:', result.error);
      return false;
    }

    console.log('✅ [DAO-CLAIM] DAO payment verification successful:', result.details);
    return true;
  } catch (error) {
    console.error('❌ [DAO-CLAIM] Error verifying DAO payment:', error);
    return false;
  }
}

module.exports = {
  calculateDaoRewards,
  getDaoEligibleNFTs,
  claimDaoRewards
};
