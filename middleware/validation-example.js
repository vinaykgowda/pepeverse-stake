/**
 * Validation Middleware Usage Examples
 * 
 * This file demonstrates how to use the validation middleware in your routes.
 */

const express = require('express');
const { 
  validateWalletAddress, 
  validateWalletAddressArray,
  validateTransactionHash,
  validateTransactionHashArray,
  validateNumericRange,
  validateNumericRangeArray,
  validateNFTArray
} = require('./validation');

const router = express.Router();

// Example 1: Basic wallet address validation
// Validates walletAddress in body, params, or query
router.post('/stake', 
  validateWalletAddress(),
  (req, res) => {
    // Access the validated wallet address
    const walletAddress = req.validatedWalletAddress;
    
    res.json({
      success: true,
      message: `Staking for wallet: ${walletAddress}`
    });
  }
);

// Example 2: Custom field names
// Validates 'owner' field instead of default fields
router.get('/nfts/:owner',
  validateWalletAddress({ fields: ['owner'] }),
  (req, res) => {
    const owner = req.validatedWalletAddress;
    
    res.json({
      success: true,
      owner: owner,
      nfts: []
    });
  }
);

// Example 3: Optional wallet address
// Allows missing wallet address (for optional filters)
router.get('/transactions',
  validateWalletAddress({ required: false }),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    
    if (walletAddress) {
      // Filter by wallet address
      res.json({
        success: true,
        message: `Transactions for ${walletAddress}`
      });
    } else {
      // Return all transactions
      res.json({
        success: true,
        message: 'All transactions'
      });
    }
  }
);

// Example 4: Validate array of wallet addresses
// Useful for batch operations
router.post('/batch-stake',
  validateWalletAddressArray(),
  (req, res) => {
    const walletAddresses = req.validatedWalletAddresses;
    
    res.json({
      success: true,
      message: `Staking for ${walletAddresses.length} wallets`,
      wallets: walletAddresses
    });
  }
);

// Example 5: Custom array field and max length
// Validates 'owners' field with max 5 addresses
router.post('/batch-query',
  validateWalletAddressArray({ 
    field: 'owners',
    maxLength: 5
  }),
  (req, res) => {
    const owners = req.validatedWalletAddresses;
    
    res.json({
      success: true,
      owners: owners
    });
  }
);

// Example 6: Chaining with other middleware
const { verifyJWT } = require('./auth');

router.post('/claim-rewards',
  verifyJWT,                    // First verify JWT
  validateWalletAddress(),      // Then validate wallet address
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const userId = req.user.id;
    
    res.json({
      success: true,
      message: `Claiming rewards for ${walletAddress}`,
      userId: userId
    });
  }
);

// Example 7: Multiple validations
router.post('/transfer',
  validateWalletAddress({ fields: ['from'] }),
  (req, res, next) => {
    // Store 'from' address
    req.fromAddress = req.validatedWalletAddress;
    next();
  },
  validateWalletAddress({ fields: ['to'] }),
  (req, res) => {
    const fromAddress = req.fromAddress;
    const toAddress = req.validatedWalletAddress;
    
    res.json({
      success: true,
      message: `Transfer from ${fromAddress} to ${toAddress}`
    });
  }
);

module.exports = router;

// Example 8: Validate transaction hash/signature
// Validates Solana transaction signature (88 characters, base58)
router.post('/verify-transaction',
  validateTransactionHash(),
  (req, res) => {
    const signature = req.validatedTransactionHash;
    
    res.json({
      success: true,
      message: `Verifying transaction: ${signature}`
    });
  }
);

// Example 9: Validate transaction hash in URL params
// Useful for GET requests with transaction signature in URL
router.get('/transaction/:signature',
  validateTransactionHash({ fields: ['signature'] }),
  (req, res) => {
    const signature = req.validatedTransactionHash;
    
    res.json({
      success: true,
      signature: signature,
      status: 'confirmed'
    });
  }
);

// Example 10: Optional transaction hash validation
// Allows missing transaction hash (for optional filters)
router.get('/transactions',
  validateWalletAddress({ required: false }),
  validateTransactionHash({ required: false }),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const signature = req.validatedTransactionHash;
    
    let message = 'All transactions';
    if (walletAddress && signature) {
      message = `Transaction ${signature} for wallet ${walletAddress}`;
    } else if (walletAddress) {
      message = `Transactions for wallet ${walletAddress}`;
    } else if (signature) {
      message = `Transaction ${signature}`;
    }
    
    res.json({
      success: true,
      message: message
    });
  }
);

// Example 11: Validate array of transaction signatures
// Useful for batch transaction verification
router.post('/verify-batch',
  validateTransactionHashArray(),
  (req, res) => {
    const signatures = req.validatedTransactionHashes;
    
    res.json({
      success: true,
      message: `Verifying ${signatures.length} transactions`,
      signatures: signatures
    });
  }
);

// Example 12: Custom field name for transaction hash
// Validates 'txHash' field instead of default fields
router.post('/check-status',
  validateTransactionHash({ fields: ['txHash'] }),
  (req, res) => {
    const txHash = req.validatedTransactionHash;
    
    res.json({
      success: true,
      txHash: txHash,
      status: 'pending'
    });
  }
);

// Example 13: Validate both wallet and transaction
// Common pattern for transaction-related endpoints
router.post('/record-transaction',
  validateWalletAddress(),
  validateTransactionHash(),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const signature = req.validatedTransactionHash;
    
    res.json({
      success: true,
      message: `Recording transaction ${signature} for wallet ${walletAddress}`
    });
  }
);

// Example 14: Custom array field and max length for signatures
// Validates 'txSignatures' field with max 5 signatures
router.post('/batch-verify',
  validateTransactionHashArray({ 
    field: 'txSignatures',
    maxLength: 5
  }),
  (req, res) => {
    const signatures = req.validatedTransactionHashes;
    
    res.json({
      success: true,
      count: signatures.length,
      signatures: signatures
    });
  }
);

// Example 15: Complex validation chain
// Validates wallet, transaction, and applies authentication
const { verifyJWT } = require('./auth');

router.post('/claim-with-proof',
  verifyJWT,                          // First verify JWT
  validateWalletAddress(),            // Then validate wallet address
  validateTransactionHash(),          // Then validate transaction signature
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const signature = req.validatedTransactionHash;
    const userId = req.user.id;
    
    res.json({
      success: true,
      message: `Processing claim for user ${userId}`,
      wallet: walletAddress,
      proofTransaction: signature
    });
  }
);

module.exports = router;

// Example 16: Validate numeric range for reward amounts
// Validates amount is between 0 and 1000000
router.post('/claim-rewards',
  validateWalletAddress(),
  validateNumericRange({ 
    fields: ['amount'],
    min: 0,
    max: 1000000
  }),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const amount = req.validatedNumericValue;
    
    res.json({
      success: true,
      message: `Claiming ${amount} rewards for ${walletAddress}`
    });
  }
);

// Example 17: Validate NFT count with integer constraint
// Validates count is a positive integer between 1 and 10
router.post('/stake-nfts',
  validateWalletAddress(),
  validateNumericRange({ 
    fields: ['count'],
    min: 1,
    max: 10,
    integer: true
  }),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const count = req.validatedNumericValue;
    
    res.json({
      success: true,
      message: `Staking ${count} NFTs for ${walletAddress}`
    });
  }
);

// Example 18: Validate pagination limit
// Validates limit is between 1 and 100, defaults to optional
router.get('/nfts',
  validateNumericRange({ 
    fields: ['limit'],
    min: 1,
    max: 100,
    integer: true,
    required: false
  }),
  (req, res) => {
    const limit = req.validatedNumericValue || 20; // Default to 20
    
    res.json({
      success: true,
      limit: limit,
      nfts: []
    });
  }
);

// Example 19: Validate pagination offset
// Validates offset is a non-negative integer
router.get('/transactions',
  validateNumericRange({ 
    fields: ['offset'],
    min: 0,
    integer: true,
    required: false
  }),
  (req, res) => {
    const offset = req.validatedNumericValue || 0;
    
    res.json({
      success: true,
      offset: offset,
      transactions: []
    });
  }
);

// Example 20: Validate token balance (supports decimals)
// Validates balance is a positive decimal number
router.post('/check-balance',
  validateWalletAddress(),
  validateNumericRange({ 
    fields: ['balance'],
    min: 0,
    max: 1000000000,
    integer: false  // Allow decimals
  }),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const balance = req.validatedNumericValue;
    
    res.json({
      success: true,
      wallet: walletAddress,
      balance: balance
    });
  }
);

// Example 21: Validate price with custom range
// Validates price is between 0.01 and 10000
router.post('/set-price',
  validateNumericRange({ 
    fields: ['price'],
    min: 0.01,
    max: 10000
  }),
  (req, res) => {
    const price = req.validatedNumericValue;
    
    res.json({
      success: true,
      message: `Price set to ${price}`
    });
  }
);

// Example 22: Validate array of reward amounts
// Validates multiple amounts for batch reward distribution
router.post('/batch-distribute-rewards',
  validateWalletAddressArray({ field: 'recipients' }),
  validateNumericRangeArray({ 
    field: 'amounts',
    min: 0,
    max: 1000000,
    maxLength: 10
  }),
  (req, res) => {
    const recipients = req.validatedWalletAddresses;
    const amounts = req.validatedNumericValues;
    
    if (recipients.length !== amounts.length) {
      return res.status(400).json({
        success: false,
        error: 'Recipients and amounts arrays must have the same length'
      });
    }
    
    res.json({
      success: true,
      message: `Distributing rewards to ${recipients.length} recipients`,
      recipients: recipients,
      amounts: amounts
    });
  }
);

// Example 23: Validate array of NFT counts with integer constraint
// Validates multiple counts for batch operations
router.post('/batch-stake',
  validateWalletAddressArray({ field: 'wallets' }),
  validateNumericRangeArray({ 
    field: 'counts',
    min: 1,
    max: 10,
    integer: true,
    maxLength: 10
  }),
  (req, res) => {
    const wallets = req.validatedWalletAddresses;
    const counts = req.validatedNumericValues;
    
    res.json({
      success: true,
      message: `Batch staking for ${wallets.length} wallets`,
      wallets: wallets,
      counts: counts
    });
  }
);

// Example 24: Validate quantity with custom field name
// Validates quantity field instead of default fields
router.post('/mint-nfts',
  validateNumericRange({ 
    fields: ['quantity'],
    min: 1,
    max: 100,
    integer: true
  }),
  (req, res) => {
    const quantity = req.validatedNumericValue;
    
    res.json({
      success: true,
      message: `Minting ${quantity} NFTs`
    });
  }
);

// Example 25: Complex validation chain with multiple numeric fields
// Validates multiple numeric fields in sequence
router.post('/create-listing',
  validateWalletAddress(),
  validateNumericRange({ 
    fields: ['price'],
    min: 0.01,
    max: 1000000
  }),
  (req, res, next) => {
    req.validatedPrice = req.validatedNumericValue;
    next();
  },
  validateNumericRange({ 
    fields: ['quantity'],
    min: 1,
    max: 100,
    integer: true
  }),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const price = req.validatedPrice;
    const quantity = req.validatedNumericValue;
    
    res.json({
      success: true,
      message: `Creating listing for ${quantity} items at ${price} each`,
      wallet: walletAddress,
      price: price,
      quantity: quantity
    });
  }
);

// Example 26: Validate fee percentage (0-100 range)
// Common use case for percentage values
router.post('/set-fee',
  validateNumericRange({ 
    fields: ['feePercentage'],
    min: 0,
    max: 100
  }),
  (req, res) => {
    const feePercentage = req.validatedNumericValue;
    
    res.json({
      success: true,
      message: `Fee set to ${feePercentage}%`
    });
  }
);

// Example 27: Validate with negative numbers allowed
// Useful for balance adjustments or deltas
router.post('/adjust-balance',
  validateWalletAddress(),
  validateNumericRange({ 
    fields: ['adjustment'],
    min: -1000000,
    max: 1000000
  }),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const adjustment = req.validatedNumericValue;
    
    res.json({
      success: true,
      message: `Adjusting balance by ${adjustment} for ${walletAddress}`
    });
  }
);

module.exports = router;

// Example 28: Validate NFT array for stake operations
// Enforces maximum 10 NFTs per transaction (Requirement 26.1, 26.2)
router.post('/stake-nfts',
  validateWalletAddress(),
  validateNFTArray(),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const nftMints = req.validatedNFTMints;
    
    res.json({
      success: true,
      message: `Staking ${nftMints.length} NFTs for ${walletAddress}`,
      nftMints: nftMints
    });
  }
);

// Example 29: Validate NFT array for unstake operations
// Uses custom field name for unstake operations
router.post('/unstake-nfts',
  validateWalletAddress(),
  validateNFTArray({ field: 'unstakeNfts' }),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const nftMints = req.validatedNFTMints;
    
    res.json({
      success: true,
      message: `Unstaking ${nftMints.length} NFTs for ${walletAddress}`,
      nftMints: nftMints
    });
  }
);

// Example 30: Validate NFT array with custom max length
// Useful for operations with different transaction size limits
router.post('/batch-transfer-nfts',
  validateWalletAddress({ fields: ['from'] }),
  validateWalletAddress({ fields: ['to'] }),
  validateNFTArray({ 
    field: 'nftMints',
    maxLength: 5  // Smaller limit for transfers
  }),
  (req, res) => {
    const fromAddress = req.validatedWalletAddress;
    const nftMints = req.validatedNFTMints;
    
    res.json({
      success: true,
      message: `Transferring ${nftMints.length} NFTs`,
      from: fromAddress,
      nfts: nftMints
    });
  }
);

// Example 31: Optional NFT array validation
// Allows missing NFT array for optional batch operations
router.post('/update-metadata',
  validateWalletAddress(),
  validateNFTArray({ required: false }),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const nftMints = req.validatedNFTMints;
    
    if (nftMints) {
      res.json({
        success: true,
        message: `Updating metadata for ${nftMints.length} specific NFTs`,
        nfts: nftMints
      });
    } else {
      res.json({
        success: true,
        message: `Updating metadata for all NFTs owned by ${walletAddress}`
      });
    }
  }
);

// Example 32: Complex validation chain with NFT array
// Validates wallet, NFT array, and transaction signature
router.post('/stake-with-proof',
  validateWalletAddress(),
  validateNFTArray(),
  validateTransactionHash(),
  (req, res) => {
    const walletAddress = req.validatedWalletAddress;
    const nftMints = req.validatedNFTMints;
    const signature = req.validatedTransactionHash;
    
    res.json({
      success: true,
      message: `Staking ${nftMints.length} NFTs with proof`,
      wallet: walletAddress,
      nfts: nftMints,
      proofTransaction: signature
    });
  }
);

// Example 33: NFT array validation with authentication
// Common pattern for authenticated NFT operations
const { verifyJWT } = require('./auth');

router.post('/claim-nft-rewards',
  verifyJWT,
  validateWalletAddress(),
  validateNFTArray(),
  (req, res) => {
    const userId = req.user.id;
    const walletAddress = req.validatedWalletAddress;
    const nftMints = req.validatedNFTMints;
    
    res.json({
      success: true,
      message: `Claiming rewards for ${nftMints.length} NFTs`,
      userId: userId,
      wallet: walletAddress,
      nfts: nftMints
    });
  }
);

module.exports = router;
