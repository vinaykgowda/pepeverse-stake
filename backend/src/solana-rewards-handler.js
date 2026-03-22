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
async function calculateRewards(walletAddress) {
  try {
    console.log(`🔄 [REWARDS] Calculating rewards for wallet: ${walletAddress}`);

    const connection = pool; // mysql2/promise pool already returns promises

    // Single optimized query that:
    // 1. Fetches all staked NFTs with collection and reward info
    // 2. JOINs with trait_rewards to get multipliers
    // 3. Calculates time-based rewards in SQL
    // 4. Uses indexes on wallet_address and staked_at (Requirement 18.4)
    const [results] = await connection.query(
      `SELECT 
        s.id,
        s.mint_address,
        s.collection_id,
        s.stake_timestamp,
        s.last_claim_timestamp,
        s.traits,
        c.name as collection_name,
        cr.id as reward_id,
        cr.token_address,
        cr.token_symbol,
        cr.daily_rate,
        cr.token_decimals,
        TIMESTAMPDIFF(SECOND, COALESCE(s.last_claim_timestamp, s.stake_timestamp), NOW()) as seconds_since_last_claim,
        GROUP_CONCAT(
          CONCAT(tr.trait_type, ':', tr.trait_value, ':', tr.multiplier)
          SEPARATOR '||'
        ) as trait_multipliers
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       LEFT JOIN collection_rewards cr ON c.id = cr.collection_id AND cr.is_active = TRUE
       LEFT JOIN trait_rewards tr ON tr.collection_id = s.collection_id 
         AND tr.token_address = cr.token_address
         AND tr.is_active = TRUE
       WHERE s.wallet_address = ?
       GROUP BY s.id, s.mint_address, s.collection_id, s.stake_timestamp, 
                s.last_claim_timestamp, s.traits, c.name, cr.id, 
                cr.token_address, cr.token_symbol, cr.daily_rate, cr.token_decimals`,
      [walletAddress]
    );

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

    for (const nft of nftsWithRewards) {
      try {
        const secondsSinceLastClaim = parseInt(nft.seconds_since_last_claim) || 0;
        const daysSinceLastClaim = secondsSinceLastClaim / (24 * 60 * 60); // Convert seconds to days

        console.log(`📅 [REWARDS] NFT ${nft.mint_address}: ${secondsSinceLastClaim} seconds (${daysSinceLastClaim.toFixed(6)} days) since last claim`);

        // Use 60-second minimum window for reward calculation updates (Requirement 13.1)
        // This prevents exploitation of timing windows to claim excess rewards
        if (secondsSinceLastClaim < 60) {
          console.log(`⏰ [REWARDS] NFT ${nft.mint_address}: Claimed within last 60 seconds (${secondsSinceLastClaim}s ago), minimum window not met`);
          continue;
        }

        // Calculate base reward
        let reward = parseFloat(nft.daily_rate) * daysSinceLastClaim;

        console.log(`📈 [REWARDS] NFT ${nft.mint_address}: ${daysSinceLastClaim.toFixed(6)} days since last claim, base reward: ${reward}`);

        // Apply trait multipliers if applicable
        // Parse trait multipliers from the aggregated string
        const traitMultipliers = {};
        if (nft.trait_multipliers) {
          const multiplierPairs = nft.trait_multipliers.split('||');
          for (const pair of multiplierPairs) {
            const [traitType, traitValue, multiplier] = pair.split(':');
            const key = `${traitType}:${traitValue}`;
            traitMultipliers[key] = parseFloat(multiplier);
          }
        }

        // Requirements: 16.1, 16.3 - Safe JSON parsing with validation
        const traits = safeParseJSONLegacy(nft.traits, []);

        if (Array.isArray(traits) && traits.length > 0) {
          for (const trait of traits) {
            if (trait && typeof trait === 'object' && trait.trait_type && trait.value) {
              const key = `${trait.trait_type}:${trait.value}`;
              if (traitMultipliers[key]) {
                console.log(`🎲 [REWARDS] Applying trait multiplier ${traitMultipliers[key]} for ${trait.trait_type}:${trait.value}`);
                reward *= traitMultipliers[key];
              }
            }
          }
        }

        console.log(`💎 [REWARDS] NFT ${nft.mint_address} final reward: ${reward}`);

        // Only add if reward is meaningful (> 0.000001)
        if (reward > 0.000001) {
          const tokenKey = `${nft.token_address}-${nft.token_symbol}`;
          if (!rewardsByToken[tokenKey]) {
            rewardsByToken[tokenKey] = {
              token_address: nft.token_address,
              token_symbol: nft.token_symbol,
              token_decimals: nft.token_decimals || 9,
              amount: 0
            };
          }

          rewardsByToken[tokenKey].amount += reward;
        }
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

// FIXED claimRewardsWithPayment with better wallet address handling
async function claimRewardsWithPayment(walletAddress, paymentSignature = null) {
  let dbConnection;

  try {
    console.log(`🎯 [CLAIM] Starting claim with payment verification for: ${walletAddress}`);

    dbConnection = await pool.promise().getConnection();
    
    // Use database transaction with row-level locking to prevent race conditions
    // This ensures concurrent claim requests are processed serially (Requirements 13.2, 13.5)
    await dbConnection.beginTransaction();

    // FIXED: Debug wallet address before any operations
    console.log(`🔍 [CLAIM] Wallet address received: "${walletAddress}" (length: ${walletAddress.length})`);

    // Get staked NFTs with their collection info, including claim fees
    // Use FOR UPDATE to lock rows and prevent race conditions (Requirement 13.2, 13.5)
    const [stakedNFTs] = await dbConnection.query(
      `SELECT s.id, s.mint_address, s.collection_id, s.wallet_address,
              c.name as collection_name, c.claim_fee
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       WHERE s.wallet_address = ?
       FOR UPDATE`,
      [walletAddress]
    );

    console.log(`📊 [CLAIM] Found ${stakedNFTs.length} staked NFTs for wallet ${walletAddress}`);

    // Debug: Log actual wallet addresses found
    if (stakedNFTs.length > 0) {
      console.log(`🔍 [CLAIM] Sample wallet address from staked NFTs: "${stakedNFTs[0].wallet_address}"`);
    }

    if (stakedNFTs.length === 0) {
      await dbConnection.rollback();
      return {
        success: false,
        message: 'No staked NFTs found'
      };
    }

    // Calculate rewards
    const rewardsResult = await calculateRewards(walletAddress);

    if (!rewardsResult.success) {
      await dbConnection.rollback();
      throw new Error(rewardsResult.message);
    }

    const rewards = rewardsResult.data;

    if (rewards.length === 0) {
      await dbConnection.rollback();
      return {
        success: false,
        message: 'No rewards available to claim'
      };
    }

    console.log(`💰 [CLAIM] Found ${rewards.length} different reward tokens to claim`);

    // Get required settings
    const [rewardsWalletSetting] = await dbConnection.query(
      'SELECT value FROM settings WHERE key_name = ?',
      ['rewards_wallet']
    );

    const [encryptedKeySetting] = await dbConnection.query(
      'SELECT value FROM settings WHERE key_name = ?',
      ['rewards_wallet_encrypted_key']
    );

    const [minClaimSetting] = await dbConnection.query(
      'SELECT value FROM settings WHERE key_name = ?',
      ['minimum_claim_amount']
    );

    // Validate settings
    if (rewardsWalletSetting.length === 0 || !rewardsWalletSetting[0].value) {
      await dbConnection.rollback();
      throw new Error('Rewards wallet not configured in settings. Please contact administrator.');
    }

    if (encryptedKeySetting.length === 0 || !encryptedKeySetting[0].value) {
      await dbConnection.rollback();
      throw new Error('Rewards wallet private key not configured. Please contact administrator.');
    }

    const rewardsWallet = rewardsWalletSetting[0].value;
    const encryptedKey = encryptedKeySetting[0].value;
    const minClaimAmount = parseFloat(minClaimSetting[0]?.value || 0);

    console.log(`⚙️ [CLAIM] Settings loaded - Min claim: ${minClaimAmount}, Rewards wallet: ${rewardsWallet.substring(0, 8)}...`);

    // Check if total rewards meet minimum claim amount
    const totalRewardsValue = rewards.reduce((sum, reward) => sum + reward.amount, 0);

    if (totalRewardsValue < minClaimAmount) {
      await dbConnection.rollback();
      return {
        success: false,
        message: `Total rewards (${totalRewardsValue.toFixed(6)}) must be at least ${minClaimAmount} to claim`
      };
    }

    // Calculate claim fees
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

    // Calculate total claim fee - one fee per collection that has staked NFTs
    Object.values(collectionMap).forEach(collection => {
      totalClaimFee += collection.claim_fee;
    });

    console.log(`💳 [CLAIM] Total claim fee: ${totalClaimFee} SOL across ${Object.keys(collectionMap).length} collections`);

    // If claim fee is required, verify payment
    if (totalClaimFee > 0) {
      if (!paymentSignature) {
        await dbConnection.rollback();
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

      // Verify the payment transaction
      console.log(`💳 [CLAIM] Verifying payment signature: ${paymentSignature}`);
      const isValidPayment = await verifyClaimFeePayment(
        paymentSignature,
        walletAddress,
        rewardsWallet,
        totalClaimFee
      );

      if (!isValidPayment) {
        await dbConnection.rollback();
        return {
          success: false,
          message: 'Payment verification failed. Please ensure you paid the correct amount to the correct wallet.'
        };
      }

      console.log(`✅ [CLAIM] Payment verified successfully`);

      // Record claim fee transactions
      for (const collectionId in collectionMap) {
        const collection = collectionMap[collectionId];

        if (collection.claim_fee > 0) {
          console.log(`💳 [CLAIM] Recording claim fee transaction for ${collection.name}: ${collection.claim_fee} SOL`);

          await dbConnection.query(
            'INSERT INTO transactions (wallet_address, transaction_type, amount, status, collection_id, transaction_hash) VALUES (?, ?, ?, ?, ?, ?)',
            [walletAddress, 'CLAIM_FEE', collection.claim_fee, 'CONFIRMED', collectionId, paymentSignature]
          );
        }
      }
    }

    // Get Solana connection and rewards keypair
    console.log(`🔐 [CLAIM] Setting up Solana connection for devnet...`);

    let solanaConnection;
    let rewardsKeypair;

    try {
      solanaConnection = getConnection();
      console.log(`🌐 [CLAIM] Connected to: ${solanaConnection.rpcEndpoint}`);

      rewardsKeypair = getKeypairFromPrivateKey(encryptedKey);
      console.log(`🔑 [CLAIM] Rewards wallet loaded: ${rewardsKeypair.publicKey.toString()}`);

      // Check rewards wallet balance
      const balance = await solanaConnection.getBalance(rewardsKeypair.publicKey);
      console.log(`💰 [CLAIM] Rewards wallet balance: ${balance / 1e9} SOL`);

      if (balance < 10000000) { // Less than 0.01 SOL
        throw new Error('Insufficient SOL balance in rewards wallet for transaction fees');
      }

    } catch (connectionError) {
      console.error('❌ [CLAIM] Solana setup failed:', connectionError);
      await dbConnection.rollback();
      throw new Error(`Solana connection failed: ${connectionError.message}`);
    }

    // Process each reward token with REAL transactions
    let successfulClaims = 0;
    let failedClaims = 0;
    let rewardTransactionSignatures = [];

    for (const reward of rewards) {
      const tokenAmount = Math.floor(reward.amount * Math.pow(10, reward.token_decimals));

      if (tokenAmount <= 0) {
        console.log(`⚠️ [CLAIM] Skipping ${reward.token_symbol} - amount too small`);
        continue;
      }

      // Record transaction as pending
      const [rewardResult] = await dbConnection.query(
        'INSERT INTO transactions (wallet_address, transaction_type, amount, token_address, status) VALUES (?, ?, ?, ?, ?)',
        [walletAddress, 'CLAIM', reward.amount, reward.token_address, 'PENDING']
      );

      const rewardTransactionId = rewardResult.insertId;

      try {
        console.log(`🚀 [CLAIM] Processing ${reward.token_symbol}: ${reward.amount} tokens (${tokenAmount} base units)`);

        let signature;

        // For SOL rewards, send direct SOL transfer
        if (reward.token_address === 'So11111111111111111111111111111111111111112') {
          console.log(`💎 [CLAIM] Sending SOL reward...`);

          const userPubkey = new PublicKey(walletAddress);

          // Create SOL transfer instruction
          const { createSolTransferInstruction } = require('./solana-transaction-utils');
          const transferInstruction = createSolTransferInstruction(
            rewardsKeypair.publicKey,
            userPubkey,
            tokenAmount
          );

          // Send transaction
          signature = await sendTransaction([transferInstruction], rewardsKeypair);
          console.log(`✅ [CLAIM] SOL transfer completed: ${signature}`);
        } else {
          // For SPL tokens
          console.log(`🪙 [CLAIM] Processing SPL token: ${reward.token_symbol}`);

          const tokenMint = new PublicKey(reward.token_address);
          const userPubkey = new PublicKey(walletAddress);

          // Get or create token accounts
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
            rewardsKeypair // Fee payer for creating user's token account
          );

          console.log(`🏦 [CLAIM] Source: ${sourceTokenAccount.toString()}`);
          console.log(`🏦 [CLAIM] Destination: ${destinationTokenAccount.toString()}`);

          // Create token transfer instruction
          const transferInstruction = await createTokenTransferInstruction(
            sourceTokenAccount,
            destinationTokenAccount,
            rewardsKeypair.publicKey,
            tokenAmount
          );

          // Send transaction
          signature = await sendTransaction([transferInstruction], rewardsKeypair);
          console.log(`✅ [CLAIM] SPL transfer completed: ${signature}`);
        }

        // Update transaction status
        await dbConnection.query(
          'UPDATE transactions SET status = ?, transaction_hash = ? WHERE id = ?',
          ['CONFIRMED', signature, rewardTransactionId]
        );

        rewardTransactionSignatures.push({
          token_symbol: reward.token_symbol,
          signature: signature,
          amount: reward.amount
        });

        console.log(`✅ [CLAIM] Successfully claimed ${reward.token_symbol}: ${signature}`);
        successfulClaims++;

      } catch (error) {
        console.error(`❌ [CLAIM] Failed to send ${reward.token_symbol}:`, error);

        // Update transaction status
        await dbConnection.query(
          'UPDATE transactions SET status = ?, error_message = ? WHERE id = ?',
          ['FAILED', error.message, rewardTransactionId]
        );

        failedClaims++;
      }
    }

    // CRITICAL FIX: Update last_claim_timestamp with extensive logging and verification
    console.log(`🔄 [CLAIM] About to update last_claim_timestamp for wallet: "${walletAddress}"`);
    console.log(`🔄 [CLAIM] Successful claims: ${successfulClaims}, proceeding with timestamp update...`);

    // Check current timestamps BEFORE update (with lock to ensure consistency)
    const [beforeUpdate] = await dbConnection.query(
      'SELECT mint_address, wallet_address, last_claim_timestamp, NOW() as current_server_time FROM staked_nfts WHERE wallet_address = ? FOR UPDATE',
      [walletAddress]
    );
    console.log(`📅 [CLAIM] Current server time:`, new Date().toISOString());
    console.log(`📅 [CLAIM] Timestamps BEFORE update:`, beforeUpdate);

    // FIXED: Perform the update with exact wallet address match
    console.log(`🔄 [CLAIM] Executing UPDATE query with wallet address: "${walletAddress}"`);
    const [updateResult] = await dbConnection.query(
      'UPDATE staked_nfts SET last_claim_timestamp = NOW() WHERE wallet_address = ?',
      [walletAddress]
    );

    console.log(`🔄 [CLAIM] Update result:`, {
      affectedRows: updateResult.affectedRows,
      changedRows: updateResult.changedRows,
      warningCount: updateResult.warningCount,
      info: updateResult.info
    });

    // Check timestamps AFTER update
    const [afterUpdate] = await dbConnection.query(
      'SELECT mint_address, wallet_address, last_claim_timestamp, NOW() as current_server_time FROM staked_nfts WHERE wallet_address = ?',
      [walletAddress]
    );
    console.log(`📅 [CLAIM] Timestamps AFTER update:`, afterUpdate);

    // CRITICAL: Validate the update worked
    if (updateResult.affectedRows === 0) {
      console.error(`❌ [CLAIM] CRITICAL ERROR: NO ROWS WERE UPDATED!`);
      console.error(`❌ [CLAIM] Wallet address used: "${walletAddress}"`);

      // Check if any NFTs exist for this wallet with exact debugging
      const [exactWalletCheck] = await dbConnection.query(
        'SELECT wallet_address, COUNT(*) as count FROM staked_nfts WHERE wallet_address = ? GROUP BY wallet_address',
        [walletAddress]
      );

      // Also check for similar wallet addresses
      const [similarWallets] = await dbConnection.query(
        'SELECT DISTINCT wallet_address FROM staked_nfts LIMIT 5'
      );

      console.error(`❌ [CLAIM] Exact wallet match: ${JSON.stringify(exactWalletCheck)}`);
      console.error(`❌ [CLAIM] Sample wallet addresses in DB: ${JSON.stringify(similarWallets)}`);

      await dbConnection.rollback();
      throw new Error(`Failed to update claim timestamps. Wallet address mismatch detected.`);
    } else {
      console.log(`✅ [CLAIM] Successfully updated ${updateResult.affectedRows} NFT timestamps`);
    }

    // Commit all database changes
    await dbConnection.commit();
    console.log(`✅ [CLAIM] Transaction committed successfully`);

    console.log(`🎉 [CLAIM] DEVNET claim completed!`);
    console.log(`🎉 [CLAIM] Successful: ${successfulClaims}, Failed: ${failedClaims}`);
    console.log(`🎉 [CLAIM] Total claim fee: ${totalClaimFee} SOL`);

    // IMPORTANT: Refresh metadata AFTER successful claim
    // This ensures current claim uses old traits, but future claims use updated traits
    console.log(`🔄 [CLAIM] Refreshing metadata for wallet ${walletAddress} after successful claim...`);
    try {
      const metadataRefresh = require('./services/metadataRefresh');
      const refreshResult = await metadataRefresh.refreshStakedNFTMetadata(null, walletAddress, walletAddress);
      console.log(`✅ [CLAIM] Metadata refresh completed:`, refreshResult.stats);
    } catch (refreshError) {
      // Don't fail the claim if metadata refresh fails
      console.error(`⚠️ [CLAIM] Metadata refresh failed (non-critical):`, refreshError);
    }

    return {
      success: true,
      message: `Successfully claimed ${successfulClaims} rewards on devnet! ${totalClaimFee > 0 ? `Claim fee: ${totalClaimFee} SOL paid.` : ''} ${failedClaims > 0 ? `${failedClaims} failed.` : ''} Timestamps updated for ${updateResult.affectedRows || 0} NFTs.`,
      claim_timestamp: new Date().toISOString(),
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
        updated_nfts: updateResult.affectedRows || 0,
        wallet_address_used: walletAddress
      }
    };

  } catch (error) {
    if (dbConnection) {
      await dbConnection.rollback();
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

    const connection = pool.promise();

    const [nfts] = await connection.query(
      `SELECT s.id, s.mint_address, s.collection_id, s.stake_timestamp,
              s.last_claim_timestamp, s.traits,
              c.name as collection_name
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       WHERE s.wallet_address = ?
       ORDER BY s.stake_timestamp DESC`,
      [walletAddress]
    );

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
    const connection = pool.promise();

    const [transactions] = await connection.query(
      `SELECT id, transaction_type, transaction_hash, amount, token_address, status, created_at, error_message
       FROM transactions
       WHERE wallet_address = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [walletAddress]
    );

    return {
      success: true,
      data: transactions
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

    const connection = pool.promise();

    // Get staked NFTs with collection info
    const [stakedNFTs] = await connection.query(
      `SELECT s.id, s.mint_address, s.collection_id,
              c.name as collection_name, c.claim_fee
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       WHERE s.wallet_address = ?`,
      [walletAddress]
    );

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
    const [feeRecipientSetting] = await connection.query(
      'SELECT value FROM settings WHERE key_name = ?',
      ['rewards_wallet'] // Using same wallet for fees and rewards for simplicity
    );

    const feeRecipient = feeRecipientSetting[0]?.value;

    console.log(`📋 [QUOTE] Quote generated - Total fee: ${totalClaimFee} SOL`);

    return {
      success: true,
      data: {
        rewards: rewardsResult.data,
        total_claim_fee: totalClaimFee,
        fee_recipient: feeRecipient,
        collection_fees: Object.values(collectionFees),
        requires_payment: totalClaimFee > 0
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