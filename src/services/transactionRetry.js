/**
 * Transaction Retry Service
 * 
 * Implements robust transaction retry logic for Solana mainnet with:
 * - Exponential backoff (3 attempts)
 * - Status checking before retry
 * - Priority fee increases on retry
 * - 60-second confirmation timeout
 * - Recent blockhash fetching
 * 
 * Requirements: 33.1, 33.2, 33.3, 33.4, 33.5
 */

const { Connection, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');

class TransactionRetryService {
  constructor() {
    this.maxRetries = 3;
    this.confirmationTimeout = 60000; // 60 seconds
    this.baseDelayMs = 1000; // 1 second base delay for exponential backoff
    this.basePriorityFee = 5000; // Base priority fee in microlamports
    this.networkConfig = null; // Lazy-loaded
  }

  /**
   * Get network config (lazy-loaded to avoid circular dependencies in tests)
   * @private
   */
  _getNetworkConfig() {
    if (!this.networkConfig) {
      this.networkConfig = require('../config/network');
    }
    return this.networkConfig;
  }

  /**
   * Get a connection with fallback support
   * @private
   * @returns {Connection} Solana connection
   */
  _getConnection() {
    const networkConfig = this._getNetworkConfig();
    try {
      return new Connection(networkConfig.getPrimaryRpc(), 'confirmed');
    } catch (error) {
      console.warn('Primary RPC failed, using fallback:', error.message);
      return new Connection(networkConfig.getFallbackRpc(), 'confirmed');
    }
  }

  /**
   * Get recent blockhash for transaction
   * @private
   * @param {Connection} connection - Solana connection
   * @returns {Promise<Object>} Blockhash and last valid block height
   */
  async _getRecentBlockhash(connection) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    return { blockhash, lastValidBlockHeight };
  }

  /**
   * Check transaction status on chain
   * @private
   * @param {Connection} connection - Solana connection
   * @param {string} signature - Transaction signature
   * @returns {Promise<Object>} Status object with confirmed flag and error
   */
  async _checkTransactionStatus(connection, signature) {
    try {
      const status = await connection.getSignatureStatus(signature);
      
      if (!status || !status.value) {
        return { confirmed: false, error: null };
      }

      if (status.value.err) {
        return { 
          confirmed: false, 
          error: `Transaction failed: ${JSON.stringify(status.value.err)}` 
        };
      }

      if (status.value.confirmationStatus === 'confirmed' || 
          status.value.confirmationStatus === 'finalized') {
        return { confirmed: true, error: null };
      }

      return { confirmed: false, error: null };
    } catch (error) {
      console.error('Error checking transaction status:', error);
      return { confirmed: false, error: error.message };
    }
  }

  /**
   * Add compute budget and priority fee instructions to transaction
   * @private
   * @param {Transaction} transaction - Transaction to modify
   * @param {number} priorityFee - Priority fee in microlamports
   */
  _addPriorityFee(transaction, priorityFee) {
    // Note: This requires @solana/web3.js v1.73.0 or higher
    // For older versions, you would need to use ComputeBudgetProgram manually
    try {
      const { ComputeBudgetProgram } = require('@solana/web3.js');
      
      // Set compute unit price (priority fee)
      const computePriceInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee
      });
      
      // Add as first instruction
      transaction.instructions.unshift(computePriceInstruction);
    } catch (error) {
      console.warn('Could not add priority fee (may need newer @solana/web3.js):', error.message);
    }
  }

  /**
   * Wait for transaction confirmation with timeout
   * @private
   * @param {Connection} connection - Solana connection
   * @param {string} signature - Transaction signature
   * @param {number} lastValidBlockHeight - Last valid block height
   * @returns {Promise<boolean>} True if confirmed, false if timeout
   */
  async _waitForConfirmation(connection, signature, lastValidBlockHeight) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.confirmationTimeout) {
      const status = await this._checkTransactionStatus(connection, signature);
      
      if (status.confirmed) {
        return true;
      }
      
      if (status.error) {
        throw new Error(status.error);
      }

      // Check if blockhash is still valid
      const currentBlockHeight = await connection.getBlockHeight();
      if (currentBlockHeight > lastValidBlockHeight) {
        console.warn('Transaction blockhash expired');
        return false;
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return false;
  }

  /**
   * Send transaction with retry logic
   * @param {Array} instructions - Array of transaction instructions
   * @param {Keypair} feePayer - Fee payer keypair
   * @param {Array} signers - Additional signers (optional)
   * @returns {Promise<string>} Transaction signature
   * @throws {Error} If transaction fails after all retries
   */
  async sendTransactionWithRetry(instructions, feePayer, signers = []) {
    const connection = this._getConnection();
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[TX Retry] Attempt ${attempt}/${this.maxRetries}`);

        // Get fresh blockhash for each attempt (Requirement 33.5)
        const { blockhash, lastValidBlockHeight } = await this._getRecentBlockhash(connection);
        console.log(`[TX Retry] Using blockhash: ${blockhash}`);

        // Create transaction
        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = feePayer.publicKey;

        // Add priority fee (increases with each retry - Requirement 33.2)
        const priorityFee = this.basePriorityFee * attempt;
        this._addPriorityFee(transaction, priorityFee);
        console.log(`[TX Retry] Priority fee: ${priorityFee} microlamports`);

        // Add instructions
        transaction.add(...instructions);

        // Sign transaction
        const allSigners = signers.length > 0 ? [feePayer, ...signers] : [feePayer];
        transaction.sign(...allSigners);

        // Send transaction
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });

        const networkConfig = this._getNetworkConfig();
        console.log(`[TX Retry] Transaction sent: ${signature}`);
        console.log(`[TX Retry] Explorer: ${networkConfig.getTransactionUrl(signature)}`);

        // Wait for confirmation with timeout (Requirement 33.3)
        const confirmed = await this._waitForConfirmation(
          connection, 
          signature, 
          lastValidBlockHeight
        );

        if (confirmed) {
          console.log(`[TX Retry] ✅ Transaction confirmed: ${signature}`);
          return signature;
        }

        // Check status before retry (Requirement 33.4)
        console.log(`[TX Retry] Timeout reached, checking status...`);
        const status = await this._checkTransactionStatus(connection, signature);
        
        if (status.confirmed) {
          console.log(`[TX Retry] ✅ Transaction confirmed on status check: ${signature}`);
          return signature;
        }

        if (status.error) {
          throw new Error(status.error);
        }

        lastError = new Error(`Transaction timeout after ${this.confirmationTimeout}ms`);
        console.warn(`[TX Retry] Attempt ${attempt} timed out, will retry...`);

      } catch (error) {
        lastError = error;
        console.error(`[TX Retry] Attempt ${attempt} failed:`, error.message);

        // Don't retry if it's a permanent error
        if (error.message.includes('insufficient funds') ||
            error.message.includes('invalid signature') ||
            error.message.includes('already processed')) {
          throw error;
        }

        // If not the last attempt, wait with exponential backoff (Requirement 33.1)
        if (attempt < this.maxRetries) {
          const delayMs = this.baseDelayMs * Math.pow(2, attempt - 1);
          console.log(`[TX Retry] Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries exhausted
    throw new Error(
      `Transaction failed after ${this.maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Send and confirm transaction with retry logic (convenience method)
   * This is a drop-in replacement for sendAndConfirmTransaction
   * @param {Connection} connection - Solana connection (optional, will use network config if not provided)
   * @param {Transaction} transaction - Transaction to send
   * @param {Array} signers - Array of signers
   * @returns {Promise<string>} Transaction signature
   */
  async sendAndConfirmTransactionWithRetry(connection, transaction, signers) {
    // Extract instructions from transaction
    const instructions = transaction.instructions;
    const feePayer = signers[0];
    const additionalSigners = signers.slice(1);

    return this.sendTransactionWithRetry(instructions, feePayer, additionalSigners);
  }
}

// Export singleton instance
module.exports = new TransactionRetryService();
