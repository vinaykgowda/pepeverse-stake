// backend/src/solana-rewards-handler.js - FIXED VERSION

const { PublicKey } = require('@solana/web3.js');
const { getConnection, sendTransaction, createTokenTransferInstruction, getOrCreateTokenAccount, getKeypairFromPrivateKey, verifyTransactionSignature } = require('./solana-transaction-utils');
const { getPool } = require('./db');
const pool = getPool();
const transactionVerification = require('./services/transactionVerification');
const { safeParseJSON } = require('../middleware/jsonErrorHandler');

// Legacy wrapper for backward compatibility
// Requirements: 16.1, 16.4 - Safe JSON parsing with error handling
function safeParseJSONLegacy(jsonString, defaultValue = []) {
  const result = safeParseJSON(jsonString, defaultValue);
  if (!result.success) {
    console.warn('JSON parsing failed:', result.error);
  }
  return result.data;
}

// OPTIMIZED calculateRewards function using single aggregated query
// Requirements: 18.1, 18.2, 18.3 - Single query, no N+1 problem, < 500ms for 100 NFTs
// SECURITY FIX: Accepts optional dbClient to run within the same transaction (prevents race conditions)
async function calculateRewards(walletAddress, dbClient = null) {
  const queryFn = dbClient || pool;
  try {
    console.log(`🔄 [REWARDS] Calculating rewards for wallet: ${walletAddress}`);

    // Query 1: base collection rewards per NFT
    const baseResult = await queryFn.query(
      `SELECT 
        s.id, s.mint_address, s.collection_id, s.stake_timestamp, s.last_claim_timestamp, s.traits,
        c.name as collection_name,
        cr.id as reward_id, cr.token_address, cr.token_symbol, cr.daily_rate, cr.token_decimals,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_claim_timestamp, s.stake_timestamp))) as seconds_since_last_claim
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       LEFT JOIN collection_rewards cr ON c.id = cr.collection_id AND cr.is_active = TRUE
       WHERE s.owner_wallet = $1`,
      [walletAddress]
    );

    // Query 2: ALL active trait rewards for the collections the user has staked in
    // SECURITY FIX: Include created_at to properly cap trait reward start time
    const traitRewardsResult = await queryFn.query(
      `SELECT tr.collection_id, tr.trait_type, tr.trait_value, tr.multiplier,
              tr.token_address, tr.token_symbol, tr.token_decimals,
              COALESCE(tr.created_at, '2000-01-01'::timestamptz) as created_at
       FROM trait_rewards tr
       WHERE tr.is_active = TRUE
         AND tr.collection_id IN (SELECT DISTINCT collection_id FROM staked_nfts WHERE owner_wallet = $1)`,
      [walletAddress]
    );

    const results = baseResult.rows;
    const allTraitRewards = traitRewardsResult.rows;

    console.log(`📊 [REWARDS] Found ${results.length} staked NFTs for wallet ${walletAddress}`);

    if (results.length === 0) {
      console.log(`ℹ️ [REWARDS] No staked NFTs found for wallet ${walletAddress}`);
      return {
        success: true,
        data: []
      };
    }

    // Filter NFTs that have active rewards
    const nftsWithRewards = results.filter(nft => nft.reward_id !== null);

    if (nftsWithRewards.length === 0) {
      console.log(`ℹ️ [REWARDS] No active rewards found for staked NFTs in wallet ${walletAddress}`);
      return {
        success: true,
        data: []
      };
    }

    console.log(`💰 [REWARDS] Found ${nftsWithRewards.length} NFTs with active rewards`);

    // Calculate rewards for each NFT and token
    const rewardsByToken = {};
    const now = Date.now();

    for (const nft of nftsWithRewards) {
      try {
        const secondsSinceLastClaim = parseInt(nft.seconds_since_last_claim) || 0;
        const daysSinceLastClaim = secondsSinceLastClaim / (24 * 60 * 60);

        console.log(`📅 [REWARDS] NFT ${nft.mint_address}: ${secondsSinceLastClaim} seconds (${daysSinceLastClaim.toFixed(6)} days) since last claim`);

        if (secondsSinceLastClaim < 60) {
          console.log(`⏰ [REWARDS] NFT ${nft.mint_address}: Claimed within last 60 seconds, minimum window not met`);
          continue;
        }

        // Parse traits — handle both string and already-parsed object from Postgres
        let traits = [];
        if (nft.traits) {
          if (typeof nft.traits === 'string') {
            try { traits = JSON.parse(nft.traits); } catch { traits = []; }
          } else if (Array.isArray(nft.traits)) {
            traits = nft.traits;
          }
        }

        // Base reward for this NFT's collection token
        const baseReward = parseFloat(nft.daily_rate) * daysSinceLastClaim;
        console.log(`📈 [REWARDS] NFT ${nft.mint_address}: base reward ${baseReward} ${nft.token_symbol}`);

        if (baseReward > 0.000001) {
          const tokenKey = `${nft.token_address}-${nft.token_symbol}`;
          if (!rewardsByToken[tokenKey]) {
            rewardsByToken[tokenKey] = { token_address: nft.token_address, token_symbol: nft.token_symbol, token_decimals: nft.token_decimals || 9, amount: 0 };
          }
          rewardsByToken[tokenKey].amount += baseReward;
        }

        // Trait rewards — each matching trait adds its own token reward
        // SECURITY FIX: Use MAX(lastClaim, trait.created_at) to prevent backdating
        const lastClaimTime = nft.last_claim_timestamp
          ? new Date(nft.last_claim_timestamp).getTime()
          : new Date(nft.stake_timestamp).getTime();

        const nftTraitRewards = allTraitRewards.filter(tr => tr.collection_id === nft.collection_id);
        for (const tr of nftTraitRewards) {
          const hasMatch = traits.some(t => {
            const tType = String(t.trait_type ?? t.type ?? '').toLowerCase();
            const tVal  = String(t.value ?? t.trait_value ?? '').toLowerCase();
            return tType === String(tr.trait_type).toLowerCase() && tVal === String(tr.trait_value).toLowerCase();
          });
          if (!hasMatch) continue;

          // SECURITY FIX: Start earning from whichever is later — last claim OR trait reward creation
          const traitCreatedTime = new Date(tr.created_at).getTime();
          const traitStart = Math.max(lastClaimTime, traitCreatedTime);
          const traitSeconds = Math.max(0, (now - traitStart) / 1000);

          if (traitSeconds < 60) continue;

          const traitDays = traitSeconds / 86400;
          const traitReward = parseFloat(tr.multiplier) * traitDays;
          console.log(`🎲 [REWARDS] NFT ${nft.mint_address}: trait ${tr.trait_type}:${tr.trait_value} → ${traitReward.toFixed(6)} ${tr.token_symbol} (${traitDays.toFixed(2)} days)`);

          if (traitReward > 0.000001) {
            const traitKey = `${tr.token_address}-${tr.token_symbol}`;
            if (!rewardsByToken[traitKey]) {
              rewardsByToken[traitKey] = { token_address: tr.token_address, token_symbol: tr.token_symbol, token_decimals: parseInt(tr.token_decimals) || 9, amount: 0 };
            }
            rewardsByToken[traitKey].amount += traitReward;
          }
        }

        console.log(`💎 [REWARDS] NFT ${nft.mint_address} processed`);
      } catch (nftError) {
        console.error(`❌ [REWARDS] Error processing NFT ${nft.mint_address}:`, nftError);
      }
    }

    const totalRewards = Object.values(rewardsByToken);

    console.log(`✅ [REWARDS] Total rewards calculated (since last claim):`, totalRewards);

    return {
      success: true,
      data: totalRewards
    };
  } catch (error) {
    console.error('❌ [REWARDS] Error calculating rewards:', error);

    return {
      success: false,
      message: error.message || 'Failed to calculate rewards'
    };
  }
}

// SECURED claimRewardsWithPayment — CLAIM-BEFORE-SEND pattern
// Fixes: Race condition, signature replay, trait backdating, non-atomic rollback
async function claimRewardsWithPayment(walletAddress, paymentSignature = null) {
  let dbConnection;

  try {
    console.log(`🎯 [CLAIM] Starting claim with payment verification for: ${walletAddress}`);

    dbConnection = await pool.getClient();
    await dbConnection.query('BEGIN');

    // ═══════════════════════════════════════════════════════════════════
    // SECURITY CHECK 1: Acquire wallet-level claim lock (prevents concurrent claims)
    // Uses advisory lock keyed on wallet address hash for zero-contention mutex
    // ═══════════════════════════════════════════════════════════════════
    const lockKey = Buffer.from(walletAddress).reduce((acc, byte) => (acc * 31 + byte) & 0x7FFFFFFF, 0);
    const lockResult = await dbConnection.query('SELECT pg_try_advisory_xact_lock($1) as acquired', [lockKey]);
    
    if (!lockResult.rows[0].acquired) {
      await dbConnection.query('ROLLBACK');
      console.warn(`⚠️ [CLAIM] Claim already in progress for wallet: ${walletAddress}`);
      return {
        success: false,
        message: 'A claim is already being processed for this wallet. Please wait for it to complete.'
      };
    }
    console.log(`🔒 [CLAIM] Advisory lock acquired for wallet: ${walletAddress}`);

    // ═══════════════════════════════════════════════════════════════════
    // SECURITY CHECK 2: Verify payment signature hasn't been used before
    // ═══════════════════════════════════════════════════════════════════
    if (paymentSignature) {
      const sigCheckResult = await dbConnection.query(
        'SELECT id FROM used_payment_signatures WHERE signature = $1',
        [paymentSignature]
      );
      if (sigCheckResult.rows.length > 0) {
        await dbConnection.query('ROLLBACK');
        console.error(`🚫 [CLAIM] REPLAY ATTACK BLOCKED — signature already used: ${paymentSignature}`);
        return {
          success: false,
          message: 'This payment signature has already been used. Please initiate a new claim.'
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Lock staked NFTs rows (FOR UPDATE prevents concurrent reads)
    // ═══════════════════════════════════════════════════════════════════
    const stakedNFTsResult = await dbConnection.query(
      `SELECT s.id, s.mint_address, s.collection_id, s.owner_wallet,
              c.name as collection_name, c.claim_fee
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       WHERE s.owner_wallet = $1
       FOR UPDATE OF s`,
      [walletAddress]
    );
    
    const stakedNFTs = stakedNFTsResult.rows;
    console.log(`📊 [CLAIM] Found ${stakedNFTs.length} staked NFTs for wallet ${walletAddress}`);

    if (stakedNFTs.length === 0) {
      await dbConnection.query('ROLLBACK');
      return { success: false, message: 'No staked NFTs found' };
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Calculate rewards WITHIN the locked transaction
    // SECURITY FIX: Pass dbConnection so rewards calc uses same locked snapshot
    // ═══════════════════════════════════════════════════════════════════
    const rewardsResult = await calculateRewards(walletAddress, dbConnection);

    if (!rewardsResult.success) {
      await dbConnection.query('ROLLBACK');
      throw new Error(rewardsResult.message);
    }

    const rewards = rewardsResult.data;

    if (rewards.length === 0) {
      await dbConnection.query('ROLLBACK');
      return { success: false, message: 'No rewards available to claim' };
    }

    console.log(`💰 [CLAIM] Found ${rewards.length} different reward tokens to claim`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Get required settings
    // ═══════════════════════════════════════════════════════════════════
    const settingsResult = await dbConnection.query(
      `SELECT key_name, value FROM settings WHERE key_name IN ('rewards_wallet', 'rewards_wallet_encrypted_key', 'minimum_claim_amount')`
    );
    const settings = {};
    settingsResult.rows.forEach(r => { settings[r.key_name] = r.value; });

    const rewardsWallet = settings['rewards_wallet'];
    const encryptedKey = settings['rewards_wallet_encrypted_key'];
    const minClaimAmount = parseFloat(settings['minimum_claim_amount'] || 0);

    if (!rewardsWallet) {
      await dbConnection.query('ROLLBACK');
      throw new Error('Rewards wallet not configured in settings. Please contact administrator.');
    }
    if (!encryptedKey) {
      await dbConnection.query('ROLLBACK');
      throw new Error('Rewards wallet private key not configured. Please contact administrator.');
    }

    // Check minimum claim amount
    const totalRewardsValue = rewards.reduce((sum, reward) => sum + reward.amount, 0);
    if (totalRewardsValue < minClaimAmount) {
      await dbConnection.query('ROLLBACK');
      return {
        success: false,
        message: `Total rewards (${totalRewardsValue.toFixed(6)}) must be at least ${minClaimAmount} to claim`
      };
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Calculate claim fees
    // ═══════════════════════════════════════════════════════════════════
    const collectionMap = {};
    let totalClaimFee = 0;

    stakedNFTs.forEach(nft => {
      if (!collectionMap[nft.collection_id]) {
        collectionMap[nft.collection_id] = {
          id: nft.collection_id,
          name: nft.collection_name,
          claim_fee: parseFloat(nft.claim_fee || 0),
          nftCount: 0
        };
      }
      collectionMap[nft.collection_id].nftCount++;
    });

    Object.values(collectionMap).forEach(collection => {
      totalClaimFee += collection.claim_fee;
    });

    console.log(`💳 [CLAIM] Total claim fee: ${totalClaimFee} SOL`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Verify payment (if required)
    // ═══════════════════════════════════════════════════════════════════
    if (totalClaimFee > 0) {
      if (!paymentSignature) {
        await dbConnection.query('ROLLBACK');
        return {
          success: false,
          message: `Payment required: ${totalClaimFee} SOL to ${rewardsWallet}`,
          requires_payment: true,
          quote: {
            rewards,
            total_claim_fee: totalClaimFee,
            fee_recipient: rewardsWallet,
            collection_fees: Object.values(collectionMap),
            requires_payment: true
          }
        };
      }

      // Verify the payment transaction on-chain
      console.log(`💳 [CLAIM] Verifying payment signature: ${paymentSignature}`);
      const isValidPayment = await verifyClaimFeePayment(
        paymentSignature,
        walletAddress,
        rewardsWallet,
        totalClaimFee
      );

      if (!isValidPayment) {
        await dbConnection.query('ROLLBACK');
        return {
          success: false,
          message: 'Payment verification failed. Please ensure you paid the correct amount to the correct wallet.'
        };
      }

      console.log(`✅ [CLAIM] Payment verified successfully`);

      // SECURITY: Mark payment signature as used IMMEDIATELY (before sending rewards)
      await dbConnection.query(
        'INSERT INTO used_payment_signatures (signature, wallet_address, purpose, amount) VALUES ($1, $2, $3, $4)',
        [paymentSignature, walletAddress, 'CLAIM', totalClaimFee]
      );
      console.log(`🔒 [CLAIM] Payment signature marked as used: ${paymentSignature}`);

      // Record claim fee transaction
      for (const collectionId in collectionMap) {
        const collection = collectionMap[collectionId];
        if (collection.claim_fee > 0) {
          await dbConnection.query(
            'INSERT INTO transactions (wallet_address, transaction_type, amount, status, transaction_hash) VALUES ($1, $2, $3, $4, $5)',
            [walletAddress, 'FEE', collection.claim_fee, 'CONFIRMED', paymentSignature]
          );
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CRITICAL STEP 6: UPDATE last_claim_timestamp BEFORE sending tokens
    // This is the "claim-before-send" pattern:
    // - Mark rewards as claimed in DB first
    // - Then send tokens on-chain
    // - If send fails, we record it as FAILED and can retry/refund later
    // - But we NEVER allow double-calculation of the same time window
    // ═══════════════════════════════════════════════════════════════════
    const claimTimestamp = new Date();
    const updateResult = await dbConnection.query(
      'UPDATE staked_nfts SET last_claim_timestamp = $1 WHERE owner_wallet = $2',
      [claimTimestamp, walletAddress]
    );

    if (updateResult.rowCount === 0) {
      await dbConnection.query('ROLLBACK');
      throw new Error('Failed to update claim timestamps — wallet mismatch');
    }

    console.log(`✅ [CLAIM] Timestamps updated for ${updateResult.rowCount} NFTs BEFORE sending tokens`);

    // Record each reward as PENDING transaction
    const pendingTransactions = [];
    for (const reward of rewards) {
      const tokenAmount = Math.floor(reward.amount * Math.pow(10, reward.token_decimals));
      if (tokenAmount <= 0) continue;

      const rewardResult = await dbConnection.query(
        'INSERT INTO transactions (wallet_address, transaction_type, amount, token_address, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [walletAddress, 'CLAIM', reward.amount, reward.token_address, 'PENDING']
      );
      pendingTransactions.push({
        id: rewardResult.rows[0].id,
        reward,
        tokenAmount
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 7: COMMIT the database transaction
    // At this point, rewards are claimed in DB. Even if token transfer fails,
    // the user cannot claim the same time window again.
    // ═══════════════════════════════════════════════════════════════════
    await dbConnection.query('COMMIT');
    console.log(`✅ [CLAIM] Database transaction COMMITTED — timestamps locked, proceeding with transfers`);

    // Release the DB connection since we're done with the transaction
    dbConnection.release();
    dbConnection = null;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 8: Send token transfers (OUTSIDE of DB transaction)
    // Uses Helius RPC via transactionRetry service for reliable delivery
    // If these fail, the user's rewards are recorded as FAILED and can be
    // retried by admin or automatically — but the time window is consumed.
    // ═══════════════════════════════════════════════════════════════════
    let solanaConnection;
    let rewardsKeypair;

    try {
      solanaConnection = getConnection();
      rewardsKeypair = getKeypairFromPrivateKey(encryptedKey);
      console.log(`🔑 [CLAIM] Rewards wallet loaded: ${rewardsKeypair.publicKey.toString()}`);

      const balance = await solanaConnection.getBalance(rewardsKeypair.publicKey);
      console.log(`💰 [CLAIM] Rewards wallet SOL balance: ${balance / 1e9} SOL`);

      if (balance < 10000000) {
        throw new Error('Insufficient SOL balance in rewards wallet for transaction fees');
      }
    } catch (connectionError) {
      console.error('❌ [CLAIM] Solana setup failed:', connectionError);
      // Mark all pending transactions as FAILED
      for (const pt of pendingTransactions) {
        await pool.query('UPDATE transactions SET status = $1 WHERE id = $2', ['FAILED', pt.id]);
      }
      return {
        success: false,
        message: `Solana connection failed: ${connectionError.message}. Your claim has been recorded. Contact admin for retry.`,
        data: { successful_claims: 0, failed_claims: pendingTransactions.length, claim_recorded: true }
      };
    }

    let successfulClaims = 0;
    let failedClaims = 0;
    let rewardTransactionSignatures = [];

    for (const pt of pendingTransactions) {
      const { reward, tokenAmount, id: transactionId } = pt;

      try {
        console.log(`🚀 [CLAIM] Processing ${reward.token_symbol}: ${reward.amount} tokens (${tokenAmount} base units)`);

        let signature;

        if (reward.token_address === 'So11111111111111111111111111111111111111112') {
          // SOL transfer
          const userPubkey = new PublicKey(walletAddress);
          const transferInstruction = createSolTransferInstruction(
            rewardsKeypair.publicKey,
            userPubkey,
            tokenAmount
          );
          signature = await sendTransaction([transferInstruction], rewardsKeypair);
        } else {
          // SPL token transfer
          const tokenMint = new PublicKey(reward.token_address);
          const userPubkey = new PublicKey(walletAddress);

          const sourceTokenAccount = await getOrCreateTokenAccount(
            solanaConnection,
            tokenMint,
            rewardsKeypair.publicKey,
            rewardsKeypair
          );

          const destinationTokenAccount = await getOrCreateTokenAccount(
            solanaConnection,
            tokenMint,
            userPubkey,
            rewardsKeypair
          );

          const transferInstruction = await createTokenTransferInstruction(
            sourceTokenAccount,
            destinationTokenAccount,
            rewardsKeypair.publicKey,
            tokenAmount
          );

          // sendTransaction uses transactionRetryService which has:
          // - 3 retries with exponential backoff
          // - Priority fee escalation per retry
          // - Fresh blockhash per attempt
          // - 60-second confirmation timeout
          // - Helius RPC as primary endpoint
          signature = await sendTransaction([transferInstruction], rewardsKeypair);
        }

        // Update transaction status to CONFIRMED
        await pool.query(
          'UPDATE transactions SET status = $1, transaction_hash = $2 WHERE id = $3',
          ['CONFIRMED', signature, transactionId]
        );

        rewardTransactionSignatures.push({
          token_symbol: reward.token_symbol,
          signature: signature,
          amount: reward.amount
        });

        console.log(`✅ [CLAIM] Successfully sent ${reward.token_symbol}: ${signature}`);
        successfulClaims++;

      } catch (error) {
        console.error(`❌ [CLAIM] Failed to send ${reward.token_symbol}:`, error);

        // Mark as FAILED — admin can retry later
        await pool.query(
          'UPDATE transactions SET status = $1 WHERE id = $2',
          ['FAILED', transactionId]
        );

        failedClaims++;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 9: Post-claim metadata refresh (non-critical)
    // ═══════════════════════════════════════════════════════════════════
    try {
      const metadataRefresh = require('./services/metadataRefresh');
      await metadataRefresh.refreshStakedNFTMetadata(null, walletAddress, walletAddress);
      console.log(`✅ [CLAIM] Metadata refresh completed`);
    } catch (refreshError) {
      console.error(`⚠️ [CLAIM] Metadata refresh failed (non-critical):`, refreshError);
    }

    console.log(`🎉 [CLAIM] Claim completed! Successful: ${successfulClaims}, Failed: ${failedClaims}`);

    // Build response
    const responseMessage = successfulClaims > 0
      ? `Successfully sent ${successfulClaims} reward(s)!${failedClaims > 0 ? ` ${failedClaims} failed (will be retried).` : ''}${totalClaimFee > 0 ? ` Claim fee: ${totalClaimFee} SOL paid.` : ''}`
      : `All ${failedClaims} transfers failed. Your claim time window has been consumed. Contact admin for a retry.`;

    return {
      success: successfulClaims > 0,
      message: responseMessage,
      claim_timestamp: claimTimestamp.toISOString(),
      just_claimed: true,
      data: {
        rewards,
        claim_fees: Object.values(collectionMap).map(c => ({
          collection_id: c.id,
          collection_name: c.name,
          claim_fee: c.claim_fee
        })),
        total_claim_fee: totalClaimFee,
        successful_claims: successfulClaims,
        failed_claims: failedClaims,
        payment_signature: paymentSignature,
        reward_signatures: rewardTransactionSignatures,
        updated_nfts: updateResult.rowCount || 0,
        wallet_address_used: walletAddress
      }
    };

  } catch (error) {
    if (dbConnection) {
      await dbConnection.query('ROLLBACK');
      console.log(`🔄 [CLAIM] Transaction rolled back due to error: ${error.message}`);
    }
    console.error('❌ [CLAIM] Fatal error:', error);
    console.error('❌ [CLAIM] Error stack:', error.stack);

    return {
      success: false,
      message: error.message || 'Failed to claim rewards'
    };
  } finally {
    if (dbConnection) {
      dbConnection.release();
      console.log(`🔄 [CLAIM] Database connection released`);
    }
  }
}

// FIXED getStakedNFTs function to properly fetch images from cache
async function getStakedNFTs(walletAddress) {
  try {
    console.log(`🔄 [STAKED] Getting staked NFTs for wallet: ${walletAddress}`);

    const nftsResult = await pool.query(
      `SELECT s.id, s.mint_address, s.collection_id, s.stake_timestamp,
              s.last_claim_timestamp, s.traits,
              c.name as collection_name
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       WHERE s.owner_wallet = $1
       ORDER BY s.stake_timestamp DESC`,
      [walletAddress]
    );
    
    const nfts = nftsResult.rows;

    console.log(`📊 [STAKED] Found ${nfts.length} staked NFTs for wallet ${walletAddress}`);

    // FIXED: Import heliusService properly and get images from cache
    const heliusService = require('./helius');

    const formattedNFTs = nfts.map(nft => {
      let image = `https://via.placeholder.com/150x150/4F46E5/FFFFFF?text=${nft.mint_address.substr(0, 2)}`;
      let name = `${nft.collection_name} #${nft.mint_address.substr(0, 4)}`;

      // FIXED: Try to find in Helius cache with better error handling
      try {
        if (heliusService && heliusService.nftCache && heliusService.nftCache.size > 0) {
          console.log(`🔍 [STAKED] Searching cache for NFT: ${nft.mint_address}`);

          // Search through all cache entries
          for (const [cacheKey, cachedData] of heliusService.nftCache) {
            if (cachedData?.data?.items && Array.isArray(cachedData.data.items)) {
              const found = cachedData.data.items.find(item => item.id === nft.mint_address);
              if (found) {
                console.log(`✅ [STAKED] Found cached data for: ${nft.mint_address}`);

                // Use heliusService.transformNFTData if available
                if (typeof heliusService.transformNFTData === 'function') {
                  const transformed = heliusService.transformNFTData(found);
                  image = transformed.image || image;
                  name = transformed.name || name;
                } else {
                  // Fallback: manual transformation
                  image = found.content?.files?.[0]?.uri ||
                         found.content?.links?.image ||
                         found.content?.metadata?.image ||
                         image;
                  name = found.content?.metadata?.name ||
                         found.content?.metadata?.title ||
                         name;
                }

                console.log(`🖼️ [STAKED] Updated image for ${nft.mint_address}: ${image.substring(0, 50)}...`);
                break;
              }
            }
          }
        } else {
          console.log(`⚠️ [STAKED] Helius cache not available or empty`);
        }
      } catch (cacheError) {
        console.error(`❌ [STAKED] Error accessing cache for ${nft.mint_address}:`, cacheError);
      }

      return {
        id: nft.id,
        mintAddress: nft.mint_address,
        name: name,
        image: image,
        collectionId: nft.collection_id,
        collectionName: nft.collection_name,
        stakeTimestamp: nft.stake_timestamp,
        traits: safeParseJSONLegacy(nft.traits, []),
        isStaked: true
      };
    });

    console.log(`✅ [STAKED] Formatted ${formattedNFTs.length} staked NFTs`);

    return {
      success: true,
      data: formattedNFTs
    };
  } catch (error) {
    console.error('❌ [STAKED] Error getting staked NFTs:', error);
    return {
      success: false,
      message: error.message || 'Failed to get staked NFTs'
    };
  }
}

// Get transaction history for user
async function getTransactionHistory(walletAddress) {
  try {
    const transactionsResult = await pool.query(
      `SELECT id, transaction_type, transaction_hash, amount, token_address, status, created_at
       FROM transactions
       WHERE wallet_address = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [walletAddress]
    );

    return {
      success: true,
      data: transactionsResult.rows
    };
  } catch (error) {
    console.error('❌ Error getting transaction history:', error);

    return {
      success: false,
      message: error.message || 'Failed to get transaction history'
    };
  }
}

async function getClaimQuote(walletAddress) {
  try {
    console.log(`📋 [QUOTE] Getting claim quote for wallet: ${walletAddress}`);

    // Get staked NFTs with collection info
    const stakedNFTsResult = await pool.query(
      `SELECT s.id, s.mint_address, s.collection_id,
              c.name as collection_name, c.claim_fee
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       WHERE s.owner_wallet = $1`,
      [walletAddress]
    );
    
    const stakedNFTs = stakedNFTsResult.rows;

    if (stakedNFTs.length === 0) {
      return {
        success: false,
        message: 'No staked NFTs found'
      };
    }

    // Calculate available rewards
    const rewardsResult = await calculateRewards(walletAddress);
    if (!rewardsResult.success || rewardsResult.data.length === 0) {
      return {
        success: false,
        message: 'No rewards available to claim'
      };
    }

    // Calculate claim fees by collection
    const collectionFees = {};
    let totalClaimFee = 0;

    stakedNFTs.forEach(nft => {
      if (!collectionFees[nft.collection_id]) {
        collectionFees[nft.collection_id] = {
          collection_id: nft.collection_id,
          collection_name: nft.collection_name,
          claim_fee: parseFloat(nft.claim_fee || 0),
          nft_count: 0
        };
      }
      collectionFees[nft.collection_id].nft_count++;
    });

    // Calculate total fee - one fee per collection
    Object.values(collectionFees).forEach(collection => {
      totalClaimFee += collection.claim_fee;
    });

    // Get fee recipient wallet
    const feeRecipientResult = await pool.query(
      'SELECT value FROM settings WHERE key_name = $1',
      ['rewards_wallet'] // Using same wallet for fees and rewards for simplicity
    );

    const feeRecipient = feeRecipientResult.rows[0]?.value;

    console.log(`📋 [QUOTE] Quote generated - Total fee: ${totalClaimFee} SOL`);

    // PRE-FLIGHT: Check treasury balances — block claim if insufficient
    let treasuryWarning = null;
    const { Connection: SolConn, PublicKey: SolPK } = require('@solana/web3.js');
    // Use Helius endpoint for balance check (avoids 429 on public RPC)
    const heliusEndpoint = process.env.HELIUS_MAINNET_ENDPOINT;
    const heliusApiKey = process.env.HELIUS_API_KEY;
    const rpcUrl = heliusEndpoint
      ? (heliusEndpoint.includes('?api-key=') ? heliusEndpoint : `${heliusEndpoint.replace(/\/$/, '')}/?api-key=${heliusApiKey}`)
      : (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    const conn = new SolConn(rpcUrl, 'confirmed');
    const walletPK = new SolPK(feeRecipient);
    const insufficient = [];

    for (const reward of rewardsResult.data) {
      const tokenAmount = BigInt(Math.floor(reward.amount * Math.pow(10, reward.token_decimals || 9)));
      if (tokenAmount <= 0n) continue;
      try {
        // Use getParsedTokenAccountsByOwner to sum ALL token accounts for this mint
        const tokenAccounts = await conn.getParsedTokenAccountsByOwner(walletPK, {
          mint: new SolPK(reward.token_address)
        });
        let balance = 0n;
        for (const { account } of tokenAccounts.value) {
          try {
            const amount = account.data?.parsed?.info?.tokenAmount?.amount;
            if (amount) balance += BigInt(amount);
          } catch {}
        }
        if (balance < tokenAmount) {
          insufficient.push(`${reward.token_symbol} (have: ${(Number(balance) / Math.pow(10, reward.token_decimals || 9)).toFixed(2)}, need: ${reward.amount.toFixed(2)})`);
        }
      } catch (e) {
        console.warn(`[QUOTE] Balance check error for ${reward.token_symbol}:`, e.message);
        // Don't block claim on balance check failure — let the transfer attempt
      }
    }

    if (insufficient.length > 0) {
      treasuryWarning = `Admin action required — rewards wallet is low on: ${insufficient.join(', ')}. Claiming is disabled until the wallet is topped up.`;
      console.warn(`⚠️ [QUOTE] Treasury insufficient: ${treasuryWarning}`);
    } else {
      console.log(`✅ [QUOTE] Treasury balance check passed`);
    }

    return {
      success: true,
      data: {
        rewards: rewardsResult.data,
        total_claim_fee: totalClaimFee,
        fee_recipient: feeRecipient,
        collection_fees: Object.values(collectionFees),
        requires_payment: totalClaimFee > 0,
        treasury_warning: treasuryWarning
      }
    };

  } catch (error) {
    console.error('❌ [QUOTE] Error getting claim quote:', error);
    return {
      success: false,
      message: error.message || 'Failed to get claim quote'
    };
  }
}

// Helper function to verify claim fee payment
// Uses the new transaction verification service (Requirements 14.1, 14.2, 14.3, 14.4, 14.5)
async function verifyClaimFeePayment(paymentSignature, fromWallet, toWallet, expectedAmount) {
  try {
    console.log('🔐 [CLAIM] Verifying payment with new verification service:', {
      signature: paymentSignature,
      from: fromWallet,
      to: toWallet,
      expected: expectedAmount
    });

    // Use the new transaction verification service
    // This implements all requirements: 14.1, 14.2, 14.3, 14.4, 14.5
    const result = await transactionVerification.verifyPaymentWithConfirmation(
      paymentSignature,
      fromWallet,
      toWallet,
      expectedAmount
    );

    if (!result.success) {
      // Requirement 14.4: Failures are already logged by the service
      console.error('❌ [CLAIM] Payment verification failed:', result.error);
      return false;
    }

    console.log('✅ [CLAIM] Payment verification successful:', result.details);
    return true;

  } catch (error) {
    console.error('❌ [CLAIM] Error verifying payment:', error);
    return false;
  }
}

module.exports = {
  calculateRewards,
  getClaimQuote,
  claimRewardsWithPayment,
  getTransactionHistory,
  getStakedNFTs
};