// backend/src/solana-rewards-handler.js - COMPLETE FIXED VERSION WITH BETTER JSON HANDLING

const { PublicKey } = require('@solana/web3.js');
const { getConnection, sendTransaction, createTokenTransferInstruction, getOrCreateTokenAccount, getKeypairFromPrivateKey } = require('./solana-transaction-utils');
const { getPool } = require('./db');
const pool = getPool();

// Safe JSON parsing function - FIXED
function safeParseJSON(jsonString, defaultValue = []) {
  // Handle null, undefined, or non-string values
  if (!jsonString || typeof jsonString !== 'string') {
    console.log('Invalid JSON input:', typeof jsonString, jsonString);
    return defaultValue;
  }

  // Handle empty strings
  if (jsonString.trim() === '') {
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(jsonString);
    return parsed;
  } catch (error) {
    console.warn('Failed to parse JSON:', jsonString, error.message);
    return defaultValue;
  }
}

// Calculate rewards for staked NFTs
async function calculateRewards(walletAddress) {
  try {
    const connection = pool.promise();

    // Get all staked NFTs for this wallet with their collection rewards
    const [nfts] = await connection.query(
      `SELECT s.id, s.mint_address, s.collection_id, s.stake_timestamp, s.traits,
              c.name as collection_name,
              cr.token_address, cr.token_symbol, cr.daily_rate, cr.token_decimals
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       JOIN collection_rewards cr ON c.id = cr.collection_id AND cr.is_active = TRUE
       WHERE s.wallet_address = ?`,
      [walletAddress]
    );

    console.log(`Found ${nfts.length} staked NFTs with active rewards for wallet ${walletAddress}`);

    // Get trait-based reward multipliers
    const [traitRewards] = await connection.query(
      `SELECT collection_id, trait_type, trait_value, token_address, multiplier
       FROM trait_rewards
       WHERE is_active = TRUE`
    );

    // Map trait rewards for easier access
    const traitMultipliers = {};
    traitRewards.forEach(reward => {
      const key = `${reward.collection_id}:${reward.trait_type}:${reward.trait_value}:${reward.token_address}`;
      traitMultipliers[key] = reward.multiplier;
    });

    // Calculate rewards for each NFT and token
    const rewardsByToken = {};

    for (const nft of nfts) {
      try {
        // Calculate base reward
        const stakeDate = new Date(nft.stake_timestamp);
        const now = new Date();
        const stakeDays = (now - stakeDate) / (1000 * 60 * 60 * 24); // Convert ms to days

        let reward = nft.daily_rate * stakeDays;

        console.log(`NFT ${nft.mint_address}: ${stakeDays.toFixed(2)} days staked, base reward: ${reward}`);

        // Apply trait multipliers if applicable - FIXED JSON PARSING
        const traits = safeParseJSON(nft.traits, []);

        console.log(`NFT ${nft.mint_address} traits:`, traits);

        // Only process traits if we got a valid array
        if (Array.isArray(traits)) {
          for (const trait of traits) {
            if (trait && typeof trait === 'object' && trait.trait_type && trait.value) {
              const key = `${nft.collection_id}:${trait.trait_type}:${trait.value}:${nft.token_address}`;
              if (traitMultipliers[key]) {
                console.log(`Applying trait multiplier ${traitMultipliers[key]} for ${trait.trait_type}:${trait.value}`);
                reward *= traitMultipliers[key];
              }
            }
          }
        } else {
          console.log(`NFT ${nft.mint_address} traits are not a valid array, skipping trait multipliers`);
        }

        console.log(`NFT ${nft.mint_address} final reward: ${reward}`);

        // Add to rewards by token
        if (!rewardsByToken[nft.token_address]) {
          rewardsByToken[nft.token_address] = {
            token_address: nft.token_address,
            token_symbol: nft.token_symbol,
            token_decimals: nft.token_decimals,
            amount: 0
          };
        }

        rewardsByToken[nft.token_address].amount += reward;
      } catch (nftError) {
        console.error(`Error processing NFT ${nft.mint_address}:`, nftError);
        // Continue processing other NFTs
      }
    }

    const totalRewards = Object.values(rewardsByToken);
    console.log(`Total rewards calculated:`, totalRewards);

    return {
      success: true,
      data: totalRewards
    };
  } catch (error) {
    console.error('Error calculating rewards:', error);

    return {
      success: false,
      message: error.message
    };
  }
}

// Claim rewards
async function claimRewards(walletAddress) {
  const dbConnection = await pool.promise().getConnection();

  try {
    // Start transaction
    await dbConnection.beginTransaction();

    // Get staked NFTs with their collection info, including claim fees
    const [stakedNFTs] = await dbConnection.query(
      `SELECT s.id, s.mint_address, s.collection_id,
              c.name as collection_name, c.claim_fee
       FROM staked_nfts s
       JOIN collections c ON s.collection_id = c.id
       WHERE s.wallet_address = ?`,
      [walletAddress]
    );

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

    // Get settings for rewards distribution
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

    if (rewardsWalletSetting.length === 0 || !rewardsWalletSetting[0].value) {
      await dbConnection.rollback();
      throw new Error('Rewards wallet not configured');
    }

    if (encryptedKeySetting.length === 0 || !encryptedKeySetting[0].value) {
      await dbConnection.rollback();
      throw new Error('Rewards wallet private key not configured');
    }

    const rewardsWallet = rewardsWalletSetting[0].value;
    const encryptedKey = encryptedKeySetting[0].value;
    const minClaimAmount = parseFloat(minClaimSetting[0]?.value || 0);

    // Check if total rewards meet minimum claim amount
    const totalRewards = rewards.reduce((sum, reward) => sum + reward.amount, 0);

    if (totalRewards < minClaimAmount) {
      await dbConnection.rollback();
      return {
        success: false,
        message: `Rewards must be at least ${minClaimAmount} to claim`
      };
    }

    // Group NFTs by collection for claim fees
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

    // Calculate total claim fee - one fee per collection
    Object.values(collectionMap).forEach(collection => {
      totalClaimFee += collection.claim_fee;
    });

    // Record transaction for each collection's claim fee
    for (const collectionId in collectionMap) {
      const collection = collectionMap[collectionId];

      if (collection.claim_fee > 0) {
        const [feeResult] = await dbConnection.query(
          'INSERT INTO transactions (wallet_address, transaction_type, amount, status, collection_id) VALUES (?, ?, ?, ?, ?)',
          [walletAddress, 'CLAIM_FEE', collection.claim_fee, 'PENDING', collectionId]
        );

        const feeTransactionId = feeResult.insertId;

        // In a real implementation, you would create a Solana transaction for the user to sign
        // to pay the claim fee. This is a simplified version assuming the fee has been paid.

        // Update fee transaction status
        await dbConnection.query(
          'UPDATE transactions SET status = ? WHERE id = ?',
          ['CONFIRMED', feeTransactionId]
        );
      }
    }

    // Get Solana connection and rewards wallet keypair
    const solanaConnection = getConnection();
    const rewardsKeypair = getKeypairFromPrivateKey(encryptedKey);

    // Process each token reward
    for (const reward of rewards) {
      // Round to token decimals
      const tokenAmount = Math.floor(reward.amount * Math.pow(10, reward.token_decimals));

      if (tokenAmount <= 0) continue;

      // Record transaction
      const [rewardResult] = await dbConnection.query(
        'INSERT INTO transactions (wallet_address, transaction_type, amount, token_address, status) VALUES (?, ?, ?, ?, ?)',
        [walletAddress, 'CLAIM', reward.amount, reward.token_address, 'PENDING']
      );

      const rewardTransactionId = rewardResult.insertId;

      try {
        // Get token accounts
        const tokenMint = new PublicKey(reward.token_address);
        const userPubkey = new PublicKey(walletAddress);

        // Get source token account (rewards wallet)
        const sourceTokenAccount = await getOrCreateTokenAccount(
          solanaConnection,
          tokenMint,
          rewardsKeypair.publicKey,
          rewardsKeypair
        );

        // Get destination token account (user wallet)
        const destinationTokenAccount = await getOrCreateTokenAccount(
          solanaConnection,
          tokenMint,
          userPubkey,
          rewardsKeypair
        );

        // Create token transfer instruction
        const transferInstruction = await createTokenTransferInstruction(
          sourceTokenAccount,
          destinationTokenAccount,
          rewardsKeypair.publicKey,
          tokenAmount
        );

        // Send transaction
        const signature = await sendTransaction([transferInstruction], rewardsKeypair);

        // Update transaction status
        await dbConnection.query(
          'UPDATE transactions SET status = ?, transaction_hash = ? WHERE id = ?',
          ['CONFIRMED', signature, rewardTransactionId]
        );
      } catch (error) {
        console.error(`Error sending reward for token ${reward.token_address}:`, error);

        // Update transaction status
        await dbConnection.query(
          'UPDATE transactions SET status = ? WHERE id = ?',
          ['FAILED', rewardTransactionId]
        );
      }
    }

    // Commit transaction
    await dbConnection.commit();

    return {
      success: true,
      message: 'Rewards claimed successfully',
      data: {
        rewards,
        claim_fees: Object.values(collectionMap).map(c => ({
          collection_id: c.id,
          collection_name: c.name,
          claim_fee: c.claim_fee
        })),
        total_claim_fee: totalClaimFee
      }
    };
  } catch (error) {
    // Rollback transaction
    await dbConnection.rollback();
    console.error('Error claiming rewards:', error);

    return {
      success: false,
      message: error.message
    };
  } finally {
    // Always release the connection back to the pool
    dbConnection.release();
  }
}

// Get transaction history for user
async function getTransactionHistory(walletAddress) {
  try {
    const connection = pool.promise();

    const [transactions] = await connection.query(
      `SELECT id, transaction_type, transaction_hash, amount, token_address, status, created_at
       FROM transactions
       WHERE wallet_address = ?
       ORDER BY created_at DESC`,
      [walletAddress]
    );

    return {
      success: true,
      data: transactions
    };
  } catch (error) {
    console.error('Error getting transaction history:', error);

    return {
      success: false,
      message: error.message
    };
  }
}

module.exports = {
  calculateRewards,
  claimRewards,
  getTransactionHistory
};