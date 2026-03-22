// backend/src/services/transactionVerification.js
// Transaction verification service for mainnet production
// Requirements: 14.1, 14.2, 14.3, 14.4, 14.5

const { Connection, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const logger = require('../utils/logger');

/**
 * Transaction Verification Service
 * Provides strict transaction verification for payment transactions
 */
class TransactionVerificationService {
  constructor() {
    // Get RPC endpoint from environment
    this.rpcEndpoint = process.env.MAINNET_RPC_PRIMARY || process.env.SOLANA_RPC_URL;
    
    if (!this.rpcEndpoint) {
      throw new Error('RPC endpoint not configured');
    }
    
    // Requirement 14.1: 100,000 lamport tolerance (0.0001 SOL)
    this.AMOUNT_TOLERANCE_LAMPORTS = 100000;
    
    // Requirement 14.5: 15-second minimum timeout
    this.CONFIRMATION_TIMEOUT_MS = 15000;
    
    logger.info('TX-VERIFY Service initialized', { rpcEndpoint: this.rpcEndpoint });
  }
  
  /**
   * Get Solana connection
   * @returns {Connection}
   */
  getConnection() {
    return new Connection(this.rpcEndpoint, 'confirmed');
  }
  
  /**
   * Verify transaction signature exists and is valid
   * Requirement 14.3: Verify signatures using RPC
   * 
   * @param {string} signature - Transaction signature
   * @returns {Promise<boolean>}
   */
  async verifySignature(signature) {
    try {
      const connection = this.getConnection();
      
      logger.info('TX-VERIFY: Verifying signature', { signature });
      
      const transaction = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });
      
      const isValid = transaction !== null;
      
      if (isValid) {
        logger.info('TX-VERIFY: Signature verified', { signature });
      } else {
        // Requirement 14.4: Log failures with details
        logger.error('TX-VERIFY: Signature not found', { signature });
      }
      
      return isValid;
    } catch (error) {
      // Requirement 14.4: Log failures with details
      logger.error('TX-VERIFY: Error verifying signature', {
        signature,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }
  
  /**
   * Wait for transaction confirmation with timeout
   * Requirement 14.2: Wait for confirmation before DB updates
   * Requirement 14.5: 15-second minimum timeout
   * 
   * @param {string} signature - Transaction signature
   * @param {number} timeoutMs - Timeout in milliseconds (default: 15000)
   * @returns {Promise<boolean>}
   */
  async waitForConfirmation(signature, timeoutMs = this.CONFIRMATION_TIMEOUT_MS) {
    try {
      const connection = this.getConnection();
      
      logger.info('TX-VERIFY: Waiting for confirmation', { 
        signature, 
        timeoutMs 
      });
      
      const startTime = Date.now();
      
      // Create a promise that resolves when transaction is confirmed
      const confirmationPromise = new Promise(async (resolve, reject) => {
        try {
          // Poll for transaction status
          const pollInterval = 1000; // Check every second
          const maxAttempts = Math.ceil(timeoutMs / pollInterval);
          
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const transaction = await connection.getTransaction(signature, {
              maxSupportedTransactionVersion: 0
            });
            
            if (transaction) {
              // Check if transaction was successful
              if (transaction.meta.err) {
                // Requirement 14.4: Log failures with details
                logger.error('TX-VERIFY: Transaction failed', {
                  signature,
                  error: transaction.meta.err
                });
                resolve(false);
                return;
              }
              
              const elapsed = Date.now() - startTime;
              logger.info('TX-VERIFY: Transaction confirmed', { 
                signature, 
                elapsedMs: elapsed 
              });
              resolve(true);
              return;
            }
            
            // Wait before next poll
            await new Promise(r => setTimeout(r, pollInterval));
          }
          
          // Timeout reached
          // Requirement 14.4: Log failures with details
          logger.error('TX-VERIFY: Confirmation timeout', { signature, timeoutMs });
          resolve(false);
        } catch (error) {
          // Requirement 14.4: Log failures with details
          logger.error('TX-VERIFY: Error waiting for confirmation', {
            signature,
            error: error.message,
            stack: error.stack
          });
          reject(error);
        }
      });
      
      return await confirmationPromise;
    } catch (error) {
      // Requirement 14.4: Log failures with details
      logger.error('TX-VERIFY: Fatal error in waitForConfirmation', {
        signature,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }
  
  /**
   * Verify payment transaction amount, sender, and recipient
   * Requirement 14.1: Verify amounts with 100,000 lamport tolerance
   * Requirement 14.3: Verify signatures using RPC
   * 
   * @param {string} signature - Transaction signature
   * @param {string} fromWallet - Expected sender wallet address
   * @param {string} toWallet - Expected recipient wallet address
   * @param {number} expectedAmountSOL - Expected amount in SOL
   * @returns {Promise<{success: boolean, error?: string, details?: object}>}
   */
  async verifyPayment(signature, fromWallet, toWallet, expectedAmountSOL) {
    try {
      logger.info('TX-VERIFY: Verifying payment', {
        signature,
        from: fromWallet,
        to: toWallet,
        expectedAmount: expectedAmountSOL
      });
      
      const connection = this.getConnection();
      
      // Requirement 14.3: Verify signature exists
      const transaction = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });
      
      if (!transaction) {
        // Requirement 14.4: Log failures with details
        const error = 'Transaction not found';
        logger.error('TX-VERIFY: Transaction not found', { signature });
        return {
          success: false,
          error,
          details: { signature }
        };
      }
      
      // Check if transaction was successful
      if (transaction.meta.err) {
        // Requirement 14.4: Log failures with details
        const error = 'Transaction failed on blockchain';
        logger.error('TX-VERIFY: Transaction failed on blockchain', {
          signature,
          blockchainError: transaction.meta.err
        });
        return {
          success: false,
          error,
          details: {
            signature,
            blockchainError: transaction.meta.err
          }
        };
      }
      
      // Get account keys from transaction
      const accountKeys = transaction.transaction.message.staticAccountKeys ||
                         transaction.transaction.message.accountKeys;
      
      if (!accountKeys) {
        // Requirement 14.4: Log failures with details
        const error = 'Could not extract account keys from transaction';
        logger.error('TX-VERIFY: Could not extract account keys', { signature });
        return {
          success: false,
          error,
          details: { signature }
        };
      }
      
      const accountKeyStrings = accountKeys.map(key => key.toString());
      
      // Find sender and recipient in transaction
      const fromIndex = accountKeyStrings.indexOf(fromWallet);
      const toIndex = accountKeyStrings.indexOf(toWallet);
      
      if (fromIndex === -1) {
        // Requirement 14.4: Log failures with details
        const error = 'Sender wallet not found in transaction';
        logger.error('TX-VERIFY: Sender wallet not found', {
          signature,
          expectedFrom: fromWallet,
          accountKeys: accountKeyStrings
        });
        return {
          success: false,
          error,
          details: {
            signature,
            expectedFrom: fromWallet,
            accountKeys: accountKeyStrings
          }
        };
      }
      
      if (toIndex === -1) {
        // Requirement 14.4: Log failures with details
        const error = 'Recipient wallet not found in transaction';
        logger.error('TX-VERIFY: Recipient wallet not found', {
          signature,
          expectedTo: toWallet,
          accountKeys: accountKeyStrings
        });
        return {
          success: false,
          error,
          details: {
            signature,
            expectedTo: toWallet,
            accountKeys: accountKeyStrings
          }
        };
      }
      
      // Check balance changes
      const preBalances = transaction.meta.preBalances;
      const postBalances = transaction.meta.postBalances;
      
      const fromBalanceChange = preBalances[fromIndex] - postBalances[fromIndex];
      const toBalanceChange = postBalances[toIndex] - preBalances[toIndex];
      
      // Convert expected amount to lamports
      const expectedLamports = Math.floor(expectedAmountSOL * LAMPORTS_PER_SOL);
      
      // Requirement 14.1: Verify amount with 100,000 lamport tolerance
      const amountDifference = Math.abs(toBalanceChange - expectedLamports);
      const isAmountValid = amountDifference <= this.AMOUNT_TOLERANCE_LAMPORTS;
      
      if (!isAmountValid) {
        // Requirement 14.4: Log failures with details
        const error = 'Payment amount verification failed';
        logger.error('TX-VERIFY: Payment amount verification failed', {
          signature,
          expectedLamports,
          receivedLamports: toBalanceChange,
          difference: amountDifference,
          toleranceLamports: this.AMOUNT_TOLERANCE_LAMPORTS,
          expectedSOL: expectedAmountSOL,
          receivedSOL: toBalanceChange / LAMPORTS_PER_SOL,
          differenceSOL: amountDifference / LAMPORTS_PER_SOL
        });
        return {
          success: false,
          error,
          details: {
            signature,
            expectedLamports,
            receivedLamports: toBalanceChange,
            difference: amountDifference,
            toleranceLamports: this.AMOUNT_TOLERANCE_LAMPORTS,
            expectedSOL: expectedAmountSOL,
            receivedSOL: toBalanceChange / LAMPORTS_PER_SOL,
            differenceSOL: amountDifference / LAMPORTS_PER_SOL
          }
        };
      }
      
      // All checks passed
      logger.info('TX-VERIFY: Payment verified successfully', {
        signature,
        from: fromWallet,
        to: toWallet,
        expectedSOL: expectedAmountSOL,
        receivedSOL: toBalanceChange / LAMPORTS_PER_SOL,
        differenceSOL: amountDifference / LAMPORTS_PER_SOL,
        fromBalanceChange: fromBalanceChange / LAMPORTS_PER_SOL
      });
      
      return {
        success: true,
        details: {
          signature,
          from: fromWallet,
          to: toWallet,
          expectedLamports,
          receivedLamports: toBalanceChange,
          difference: amountDifference,
          expectedSOL: expectedAmountSOL,
          receivedSOL: toBalanceChange / LAMPORTS_PER_SOL,
          differenceSOL: amountDifference / LAMPORTS_PER_SOL
        }
      };
      
    } catch (error) {
      // Requirement 14.4: Log failures with details
      logger.error('TX-VERIFY: Fatal error verifying payment', {
        signature,
        error: error.message,
        stack: error.stack,
        from: fromWallet,
        to: toWallet,
        expectedAmount: expectedAmountSOL
      });
      
      return {
        success: false,
        error: `Verification error: ${error.message}`,
        details: {
          signature,
          from: fromWallet,
          to: toWallet,
          expectedAmount: expectedAmountSOL,
          errorMessage: error.message
        }
      };
    }
  }
  
  /**
   * Complete verification flow: wait for confirmation then verify payment
   * Combines Requirements 14.1, 14.2, 14.3, 14.5
   * 
   * @param {string} signature - Transaction signature
   * @param {string} fromWallet - Expected sender wallet address
   * @param {string} toWallet - Expected recipient wallet address
   * @param {number} expectedAmountSOL - Expected amount in SOL
   * @param {number} timeoutMs - Confirmation timeout (default: 15000)
   * @returns {Promise<{success: boolean, error?: string, details?: object}>}
   */
  async verifyPaymentWithConfirmation(signature, fromWallet, toWallet, expectedAmountSOL, timeoutMs = this.CONFIRMATION_TIMEOUT_MS) {
    try {
      logger.info('TX-VERIFY: Starting complete verification flow', {
        signature,
        from: fromWallet,
        to: toWallet,
        expectedAmount: expectedAmountSOL,
        timeout: timeoutMs
      });
      
      // Requirement 14.2: Wait for confirmation before proceeding
      const isConfirmed = await this.waitForConfirmation(signature, timeoutMs);
      
      if (!isConfirmed) {
        // Requirement 14.4: Log failures with details
        const error = 'Transaction confirmation failed or timed out';
        logger.error('TX-VERIFY: Transaction confirmation failed or timed out', { signature });
        return {
          success: false,
          error,
          details: {
            signature,
            timeout: timeoutMs
          }
        };
      }
      
      // Requirement 14.1, 14.3: Verify payment details
      const verificationResult = await this.verifyPayment(signature, fromWallet, toWallet, expectedAmountSOL);
      
      return verificationResult;
      
    } catch (error) {
      // Requirement 14.4: Log failures with details
      logger.error('TX-VERIFY: Fatal error in complete verification flow', {
        signature,
        error: error.message,
        stack: error.stack,
        from: fromWallet,
        to: toWallet,
        expectedAmount: expectedAmountSOL
      });
      
      return {
        success: false,
        error: `Verification error: ${error.message}`,
        details: {
          signature,
          from: fromWallet,
          to: toWallet,
          expectedAmount: expectedAmountSOL,
          errorMessage: error.message
        }
      };
    }
  }
}

// Export singleton instance
module.exports = new TransactionVerificationService();
