// frontend/src/services/solana.js

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import wallet from './wallet';
import networkConfig from '../config/network';

// Initialize Solana connection using network config
const connection = new Connection(
  networkConfig.getRpcEndpoint(),
  'confirmed'
);

// Convert lamports to SOL
const lamportsToSol = (lamports) => {
  return lamports / LAMPORTS_PER_SOL;
};

// Convert SOL to lamports
const solToLamports = (sol) => {
  return sol * LAMPORTS_PER_SOL;
};

// Get SOL balance for wallet
const getSolBalance = async (walletAddress) => {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);

    return {
      success: true,
      balance: lamportsToSol(balance)
    };
  } catch (error) {
    console.error('Error getting SOL balance:', error);

    return {
      success: false,
      message: error.message || 'Failed to get SOL balance'
    };
  }
};

// Get token balance for wallet
const getTokenBalance = async (walletAddress, tokenAddress) => {
  try {
    const walletPublicKey = new PublicKey(walletAddress);
    const tokenPublicKey = new PublicKey(tokenAddress);

    // Get all token accounts for this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    // Find the token account for this specific token
    const tokenAccount = tokenAccounts.value.find(
      account => account.account.data.parsed.info.mint === tokenPublicKey.toString()
    );

    if (!tokenAccount) {
      return {
        success: true,
        balance: 0
      };
    }

    const balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;

    return {
      success: true,
      balance
    };
  } catch (error) {
    console.error('Error getting token balance:', error);

    return {
      success: false,
      message: error.message || 'Failed to get token balance'
    };
  }
};

// Get NFT metadata from URI
const getNFTMetadata = async (uri) => {
  try {
    const response = await fetch(uri);
    const metadata = await response.json();

    return {
      success: true,
      metadata
    };
  } catch (error) {
    console.error('Error getting NFT metadata:', error);

    return {
      success: false,
      message: error.message || 'Failed to get NFT metadata'
    };
  }
};

export default {
  connection,
  lamportsToSol,
  solToLamports,
  getSolBalance,
  getTokenBalance,
  getNFTMetadata
};