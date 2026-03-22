// backend/src/solana-transaction-utils.js - MAINNET VERSION WITH RETRY LOGIC

const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const crypto = require('crypto');
const dotenv = require('dotenv');
const transactionRetryService = require('./services/transactionRetry');

dotenv.config();

// Initialize Solana connection
const getConnection = () => {
  const endpoint = process.env.SOLANA_RPC_URL;
  if (!endpoint) {
    throw new Error('SOLANA_RPC_URL environment variable is required');
  }
  console.log('🌐 Using Solana RPC:', endpoint);
  return new web3.Connection(endpoint, 'confirmed');
};

// Decrypt private key
const decryptPrivateKey = (encryptedKey) => {
  if (!encryptedKey || !process.env.ENCRYPTION_KEY) {
    throw new Error('Missing encrypted key or encryption key');
  }

  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

    // Split the encrypted text into IV and encrypted parts
    const [ivHex, encryptedHex] = encryptedKey.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  } catch (error) {
    console.error('Error decrypting private key:', error);
    throw new Error('Failed to decrypt private key');
  }
};

// Encrypt private key
const encryptPrivateKey = (privateKey) => {
  if (!privateKey || !process.env.ENCRYPTION_KEY) {
    throw new Error('Missing private key or encryption key');
  }

  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(privateKey);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error) {
    console.error('Error encrypting private key:', error);
    throw new Error('Failed to encrypt private key');
  }
};

// Load and create Keypair from private key
const getKeypairFromPrivateKey = (encryptedKey) => {
  const privateKeyString = decryptPrivateKey(encryptedKey);
  const privateKey = bs58.decode(privateKeyString);
  return web3.Keypair.fromSecretKey(privateKey);
};

// Create and send transaction with retry logic
const sendTransaction = async (instructions, feePayer, signers = []) => {
  // Use the transaction retry service for robust mainnet transaction handling
  // This provides:
  // - 3 retry attempts with exponential backoff
  // - Status checking before retry
  // - Priority fee increases on retry
  // - 60-second confirmation timeout
  // - Fresh blockhash for each attempt
  return await transactionRetryService.sendTransactionWithRetry(
    instructions,
    feePayer,
    signers
  );
};

// Create SOL transfer instruction
const createSolTransferInstruction = (fromPubkey, toPubkey, lamports) => {
  return web3.SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports
  });
};

// Create SPL token transfer instruction
const createTokenTransferInstruction = async (fromTokenAccount, toTokenAccount, ownerPubkey, amount) => {
  return splToken.createTransferInstruction(
    fromTokenAccount,
    toTokenAccount,
    ownerPubkey,
    amount
  );
};

// Check if an SPL token account exists for the given owner
const getOrCreateTokenAccount = async (connection, tokenMint, ownerPubkey, feePayer) => {
  // Find token account associated with the owner address
  const associatedTokenAddress = await splToken.getAssociatedTokenAddress(
    new web3.PublicKey(tokenMint),
    ownerPubkey
  );

  try {
    // Check if account exists
    await splToken.getAccount(connection, associatedTokenAddress);
    return associatedTokenAddress;
  } catch (error) {
    // Create token account if it doesn't exist
    const createAccountInstruction = splToken.createAssociatedTokenAccountInstruction(
      feePayer.publicKey,
      associatedTokenAddress,
      ownerPubkey,
      new web3.PublicKey(tokenMint)
    );

    await sendTransaction([createAccountInstruction], feePayer);
    return associatedTokenAddress;
  }
};

// Verify a transaction signature - DEVNET VERSION
const verifyTransactionSignature = async (transactionSignature) => {
  try {
    const connection = getConnection();
    console.log('🔍 Verifying transaction on:', connection.rpcEndpoint);
    const transaction = await connection.getTransaction(transactionSignature);
    const isValid = transaction !== null;
    console.log('✅ Transaction verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('❌ Error verifying transaction:', error);
    return false;
  }
};

module.exports = {
  getConnection,
  getKeypairFromPrivateKey,
  encryptPrivateKey,
  decryptPrivateKey,
  sendTransaction,
  createSolTransferInstruction,
  createTokenTransferInstruction,
  getOrCreateTokenAccount,
  verifyTransactionSignature
};