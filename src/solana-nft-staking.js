// backend/src/solana-nft-staking.js

const web3 = require('@solana/web3.js');
const { PublicKey } = web3;

// FIXED: Single import statement with all needed functions
const { getConnection, sendTransaction, createSolTransferInstruction, getKeypairFromPrivateKey, verifyTransactionSignature } = require('./solana-transaction-utils');
const { getPool } = require('./db');
const pool = getPool();
const ownershipVerification = require('./services/ownershipVerification');
const transactionVerification = require('./services/transactionVerification');
// Import Metaplex libraries with version compatibility
let Metadata;
try {
  // Try to import from newer versions
  const mplTokenMetadata = require('@metaplex-foundation/mpl-token-metadata');
  Metadata = mplTokenMetadata.Metadata;
} catch (error) {
  try {
    // Fall back to older version structure if needed
    const { programs } = require('@metaplex-foundation/js');
    Metadata = programs.tokenMetadata.Metadata;
  } catch (fallbackError) {
    console.error("Failed to import Metadata from Metaplex:", fallbackError);
    // Create a minimal placeholder if imports fail
    Metadata = {
      PROGRAM_ID: new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),
      deserialize: (data) => ({ data: { uri: '', name: '', symbol: '', attributes: [] } })
    };
  }
}

// Rest of your code...

// Fetch NFT metadata from on-chain
async function getNFTMetadata(mintAddress) {
  try {
    const connection = getConnection();
    const mintPubkey = new PublicKey(mintAddress);

    // Get PDA for metadata using the correct method
    let metadataPDA;

    if (typeof Metadata.getPDA === 'function') {
      // Newer Metaplex versions
      metadataPDA = Metadata.getPDA(mintPubkey);
    } else {
      // Older or custom implementation
      [metadataPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('metadata'), Metadata.PROGRAM_ID.toBytes(), mintPubkey.toBytes()],
        Metadata.PROGRAM_ID
      );
    }

    // Fetch metadata
    const { data } = await connection.getAccountInfo(metadataPDA);
    let metadata;

    // Handle different deserialization methods
    if (typeof Metadata.deserialize === 'function') {
      metadata = Metadata.deserialize(data);
    } else if (typeof Metadata.fromAccountInfo === 'function') {
      metadata = Metadata.fromAccountInfo(data);
    } else {
      console.warn("Metadata deserialization method not found, using fallback");
      // Simple fallback parsing if methods not available
      metadata = { data: { uri: '', name: '', symbol: '', attributes: [] } };
    }

    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata for ${mintAddress}:`, error);
    return null;
  }
}

// Check if NFT belongs to a collection based on hashlist
// Requirements: 15.1, 15.2, 15.4 - Use newline-separated format
async function verifyNFTInCollection(mintAddress, collectionId) {
  try {
    const { isAddressInHashlist } = require('./utils/hashlistParser');
    
    const collectionsResult = await pool.query(
      'SELECT hashlist FROM collections WHERE id = $1',
      [collectionId]
    );

    if (collectionsResult.rows.length === 0) {
      return false;
    }

    const hashlistString = collectionsResult.rows[0].hashlist;
    
    // Use the standardized parser (Requirement 15.1)
    return isAddressInHashlist(mintAddress, hashlistString);
  } catch (error) {
    console.error('Error verifying NFT in collection:', error);
    return false;
  }
}

// Check if NFT is owned by wallet
async function verifyNFTOwnership(mintAddress, walletAddress) {
  try {
    const connection = getConnection();
    const mintPubkey = new PublicKey(mintAddress);

    // Find the token account that holds this NFT
    const tokenAccounts = await connection.getTokenLargestAccounts(mintPubkey);

    if (tokenAccounts.value.length === 0) {
      return false;
    }

    // Get the largest account (should be the only one with amount 1 for NFTs)
    const largestAccount = tokenAccounts.value[0].address;

    // Get the owner of this token account
    const accountInfo = await connection.getAccountInfo(largestAccount);

    if (!accountInfo) {
      return false;
    }

    // Parse token account data to get owner
    const owner = accountInfo.owner.toString();

    return owner === walletAddress;
  } catch (error) {
    console.error(`Error verifying ownership for ${mintAddress}:`, error);
    return false;
  }
}

// Stake NFT
// Stake NFTs with fee collection
async function stakeNFTs(walletAddress, nfts, collectionId, paymentSignature = null) {
  const connection = await pool.getConnection();

  try {
    await connection.query('BEGIN');

    console.log(`Starting stake process for ${nfts.length} NFTs for wallet ${walletAddress}`);

    // Validate collection exists and get fees
    const collectionsResult = await connection.query(
      'SELECT id, name, stake_fee FROM collections WHERE id = $1',
      [collectionId]
    );

    if (collectionsResult.rows.length === 0) {
      throw new Error('Collection not found');
    }

    const collection = collectionsResult.rows[0];
    const stakeFee = parseFloat(collection.stake_fee) || 0;
    const totalFee = stakeFee * nfts.length;

    console.log(`Collection: ${collection.name}, Stake fee per NFT: ${stakeFee}, Total fee: ${totalFee}`);

    // Get fee recipient wallet from settings
    let feeRecipientWallet = null;
    if (totalFee > 0) {
      const feeRecipientResult = await connection.query(
        'SELECT value FROM settings WHERE key_name = $1',
        ['rewards_wallet']
      );

      if (feeRecipientResult.rows.length === 0 || !feeRecipientResult.rows[0].value) {
        throw new Error('Fee recipient wallet not configured in settings');
      }

      feeRecipientWallet = feeRecipientResult.rows[0].value;
      console.log(`Fee recipient wallet: ${feeRecipientWallet}`);

      // Verify payment if fee is required
      if (!paymentSignature) {
        throw new Error(`Payment signature required. Please pay ${totalFee} SOL to ${feeRecipientWallet}`);
      }

      // Verify the payment transaction
      console.log('Verifying payment signature:', paymentSignature);
      const isValidPayment = await verifyStakingPayment(
        paymentSignature,
        walletAddress,
        feeRecipientWallet,
        totalFee
      );

      if (!isValidPayment) {
        throw new Error('Payment verification failed. Please ensure you paid the correct amount to the correct wallet.');
      }

      console.log('✅ Payment verified successfully');
    }

    // Verify NFT ownership before processing stake
    // Requirements: 11.1, 11.2, 11.3, 11.4
    console.log(`🔍 Verifying ownership of ${nfts.length} NFTs for wallet ${walletAddress}`);
    const mintAddresses = nfts.map(nft => nft.mintAddress);
    
    const ownershipResult = await ownershipVerification.verifyMultipleOwnership(
      walletAddress,
      mintAddresses
    );
    
    if (!ownershipResult.allOwned) {
      // Requirement 11.3: Return HTTP 403 if verification fails
      const failedMints = ownershipResult.failedMints.map(f => 
        `${f.mintAddress} (${f.reason}${f.currentOwner ? `, owned by ${f.currentOwner}` : ''})`
      ).join(', ');
      
      throw new Error(`Ownership verification failed for: ${failedMints}`);
    }
    
    console.log(`✅ Ownership verified for all ${nfts.length} NFTs`);

    // Check if NFTs are already staked
    const placeholders = mintAddresses.map((_, i) => `$${i + 1}`).join(',');

    const existingStakesResult = await connection.query(
      `SELECT mint_address FROM staked_nfts WHERE mint_address IN (${placeholders})`,
      mintAddresses
    );

    if (existingStakesResult.rows.length > 0) {
      const alreadyStaked = existingStakesResult.rows.map(stake => stake.mint_address);
      throw new Error(`Some NFTs are already staked: ${alreadyStaked.join(', ')}`);
    }

    // Insert staked NFTs
    const stakePromises = nfts.map(nft => {
      return connection.query(
        'INSERT INTO staked_nfts (wallet_address, mint_address, collection_id, stake_timestamp, traits) VALUES ($1, $2, $3, NOW(), $4)',
        [
          walletAddress,
          nft.mintAddress,
          collectionId,
          JSON.stringify(nft.traits || [])
        ]
      );
    });

    await Promise.all(stakePromises);

    // Record the fee transaction if there was one
    if (totalFee > 0 && paymentSignature) {
      await connection.query(
        'INSERT INTO transactions (wallet_address, transaction_type, amount, status, collection_id, nft_count, transaction_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [walletAddress, 'STAKE_FEE', totalFee, 'CONFIRMED', collectionId, nfts.length, paymentSignature]
      );
    }

    await connection.query('COMMIT');

    console.log(`Successfully staked ${nfts.length} NFTs for wallet ${walletAddress}`);

    return {
      success: true,
      message: `Successfully staked ${nfts.length} NFTs`,
      data: {
        stakedCount: nfts.length,
        totalFee: totalFee,
        collection: collection.name,
        paymentSignature: paymentSignature,
        feeRecipient: feeRecipientWallet
      }
    };

  } catch (error) {
    await connection.query('ROLLBACK');
    console.error('Error staking NFTs:', error);

    return {
      success: false,
      message: error.message || 'Failed to stake NFTs'
    };

  } finally {
    connection.release();
  }
}

// Helper function to verify staking payment
// Uses the new transaction verification service (Requirements 14.1, 14.2, 14.3, 14.4, 14.5)
async function verifyStakingPayment(paymentSignature, fromWallet, toWallet, expectedAmount) {
  try {
    console.log('🔐 [STAKE] Verifying payment with new verification service:', {
      signature: paymentSignature,
      from: fromWallet,
      to: toWallet,
      expectedAmount
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
      console.error('❌ [STAKE] Payment verification failed:', result.error);
      return false;
    }

    console.log('✅ [STAKE] Payment verification successful:', result.details);
    return true;

  } catch (error) {
    console.error('❌ [STAKE] Error verifying payment:', error);
    return false;
  }
}

async function unstakeNFTs(walletAddress, nftIds) {
  // Get a connection from the pool
  const connection = await pool.getConnection();

  try {
    // Start transaction
    await connection.query('BEGIN');

    console.log(`Starting unstake process for ${nftIds.length} NFTs for wallet ${walletAddress}`);

    // Get NFT details and validate ownership
    const placeholders = nftIds.map((_, i) => `$${i + 1}`).join(',');
    const stakedNFTsResult = await connection.query(
      `SELECT sn.*, c.unstake_fee, c.name as collection_name
       FROM staked_nfts sn
       JOIN collections c ON sn.collection_id = c.id
       WHERE sn.id IN (${placeholders}) AND sn.wallet_address = $${nftIds.length + 1}`,
      [...nftIds, walletAddress]
    );
    
    const stakedNFTs = stakedNFTsResult.rows;

    if (stakedNFTs.length === 0) {
      throw new Error('No staked NFTs found for this wallet');
    }

    if (stakedNFTs.length !== nftIds.length) {
      throw new Error('Some NFTs not found or not owned by this wallet');
    }

    // Requirement 25.1, 25.2: Enforce 24-hour minimum stake duration
    const MINIMUM_STAKE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const now = Date.now();
    
    const nftsLockedTooEarly = [];
    
    for (const nft of stakedNFTs) {
      const stakeTime = new Date(nft.stake_timestamp).getTime();
      const elapsedTime = now - stakeTime;
      
      if (elapsedTime < MINIMUM_STAKE_DURATION_MS) {
        const remainingMs = MINIMUM_STAKE_DURATION_MS - elapsedTime;
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        
        nftsLockedTooEarly.push({
          id: nft.id,
          mintAddress: nft.mint_address,
          remainingHours: remainingHours
        });
      }
    }
    
    // Requirement 25.2: Return HTTP 400 if too early
    if (nftsLockedTooEarly.length > 0) {
      throw new Error(
        `Cannot unstake yet. Minimum stake duration is 24 hours. ` +
        `${nftsLockedTooEarly.length} NFT(s) still locked: ` +
        nftsLockedTooEarly.map(n => `${n.mintAddress} (${n.remainingHours}h remaining)`).join(', ')
      );
    }

    // Calculate total unstake fee
    const totalUnstakeFee = stakedNFTs.reduce((total, nft) => {
      return total + (parseFloat(nft.unstake_fee) || 0);
    }, 0);

    console.log(`Total unstake fee: ${totalUnstakeFee}`);

    // Remove NFTs from staked_nfts table
    await connection.query(
      `DELETE FROM staked_nfts WHERE id IN (${placeholders}) AND wallet_address = $${nftIds.length + 1}`,
      [...nftIds, walletAddress]
    );

    // Record transaction if there's a fee
    if (totalUnstakeFee > 0) {
      await connection.query(
        'INSERT INTO transactions (wallet_address, transaction_type, amount, status, nft_count) VALUES ($1, $2, $3, $4, $5)',
        [walletAddress, 'UNSTAKE', totalUnstakeFee, 'CONFIRMED', nftIds.length]
      );
    }

    // Commit transaction
    await connection.query('COMMIT');

    console.log(`Successfully unstaked ${nftIds.length} NFTs for wallet ${walletAddress}`);

    return {
      success: true,
      message: `Successfully unstaked ${nftIds.length} NFTs`,
      data: {
        unstakedCount: nftIds.length,
        totalFee: totalUnstakeFee
      }
    };

  } catch (error) {
    // Rollback transaction on error
    await connection.query('ROLLBACK');
    console.error('Error unstaking NFTs:', error);

    return {
      success: false,
      message: error.message || 'Failed to unstake NFTs'
    };

  } finally {
    // Always release the connection back to the pool
    connection.release();
  }
}

async function getStakedNFTs(walletAddress) {
  try {
    const stakedNFTsResult = await pool.query(
      `SELECT sn.*, c.name as collection_name
       FROM staked_nfts sn
       JOIN collections c ON sn.collection_id = c.id
       WHERE sn.wallet_address = $1
       ORDER BY sn.stake_timestamp DESC`,
      [walletAddress]
    );
    
    const stakedNFTs = stakedNFTsResult.rows;

    // Requirement 25.4: Calculate and return remaining lock time for each NFT
    const MINIMUM_STAKE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    const stakedNFTsWithLockTime = stakedNFTs.map(nft => {
      const stakeTime = new Date(nft.stake_timestamp).getTime();
      const elapsedTime = now - stakeTime;
      const remainingMs = Math.max(0, MINIMUM_STAKE_DURATION_MS - elapsedTime);
      
      return {
        ...nft,
        remainingLockTimeMs: remainingMs,
        remainingLockTimeHours: Math.ceil(remainingMs / (60 * 60 * 1000)),
        canUnstake: remainingMs === 0
      };
    });

    return {
      success: true,
      data: stakedNFTsWithLockTime
    };

  } catch (error) {
    console.error('Error getting staked NFTs:', error);

    return {
      success: false,
      message: error.message || 'Failed to get staked NFTs',
      data: []
    };
  }
}

async function getStakingStats(walletAddress) {
  try {
    const statsResult = await pool.query(
      `SELECT
        c.id,
        c.name,
        COUNT(sn.id) as staked_count
       FROM collections c
       LEFT JOIN staked_nfts sn ON c.id = sn.collection_id AND sn.wallet_address = $1
       GROUP BY c.id, c.name
       ORDER BY c.name`,
      [walletAddress]
    );

    return {
      success: true,
      data: statsResult.rows
    };

  } catch (error) {
    console.error('Error getting staking stats:', error);

    return {
      success: false,
      message: error.message || 'Failed to get staking stats',
      data: []
    };
  }
}


module.exports = {
  stakeNFTs,
  unstakeNFTs,
  getStakedNFTs,
  getStakingStats,
  verifyNFTInCollection,
  verifyNFTOwnership,
  getNFTMetadata,
  verifyStakingPayment
};