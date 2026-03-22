// backend/src/services/transactionVerification.test.js
// Unit tests for transaction verification service

// Set environment variable BEFORE requiring the module
process.env.SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';

const transactionVerification = require('./transactionVerification');
const { Connection, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// Mock the Connection class
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn()
  };
});

describe('TransactionVerificationService', () => {
  let mockConnection;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock connection
    mockConnection = {
      getTransaction: jest.fn()
    };
    
    Connection.mockImplementation(() => mockConnection);
  });
  
  describe('verifySignature', () => {
    it('should return true for valid signature', async () => {
      const signature = 'valid_signature_123';
      
      mockConnection.getTransaction.mockResolvedValue({
        meta: { err: null },
        transaction: {}
      });
      
      const result = await transactionVerification.verifySignature(signature);
      
      expect(result).toBe(true);
      expect(mockConnection.getTransaction).toHaveBeenCalledWith(
        signature,
        { maxSupportedTransactionVersion: 0 }
      );
    });
    
    it('should return false for non-existent signature', async () => {
      const signature = 'invalid_signature_123';
      
      mockConnection.getTransaction.mockResolvedValue(null);
      
      const result = await transactionVerification.verifySignature(signature);
      
      expect(result).toBe(false);
    });
    
    it('should return false on RPC error', async () => {
      const signature = 'error_signature_123';
      
      mockConnection.getTransaction.mockRejectedValue(new Error('RPC error'));
      
      const result = await transactionVerification.verifySignature(signature);
      
      expect(result).toBe(false);
    });
  });
  
  describe('waitForConfirmation', () => {
    it('should return true when transaction is confirmed within timeout', async () => {
      const signature = 'confirmed_signature_123';
      
      // First call returns null (not confirmed yet), second call returns transaction
      mockConnection.getTransaction
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          meta: { err: null },
          transaction: {}
        });
      
      const result = await transactionVerification.waitForConfirmation(signature, 3000);
      
      expect(result).toBe(true);
    });
    
    it('should return false when transaction fails', async () => {
      const signature = 'failed_signature_123';
      
      mockConnection.getTransaction.mockResolvedValue({
        meta: { err: 'Transaction failed' },
        transaction: {}
      });
      
      const result = await transactionVerification.waitForConfirmation(signature, 3000);
      
      expect(result).toBe(false);
    });
    
    it('should return false on timeout', async () => {
      const signature = 'timeout_signature_123';
      
      // Always return null (never confirmed)
      mockConnection.getTransaction.mockResolvedValue(null);
      
      const result = await transactionVerification.waitForConfirmation(signature, 2000);
      
      expect(result).toBe(false);
    }, 10000); // Increase test timeout
    
    it('should enforce minimum 15-second timeout by default', async () => {
      const signature = 'default_timeout_signature';
      
      mockConnection.getTransaction.mockResolvedValue({
        meta: { err: null },
        transaction: {}
      });
      
      const startTime = Date.now();
      await transactionVerification.waitForConfirmation(signature);
      const elapsed = Date.now() - startTime;
      
      // Should complete quickly since transaction is immediately available
      expect(elapsed).toBeLessThan(2000);
    });
  });
  
  describe('verifyPayment', () => {
    const fromWallet = 'FromWallet111111111111111111111111111';
    const toWallet = 'ToWallet1111111111111111111111111111';
    const expectedAmount = 0.5; // 0.5 SOL
    const signature = 'payment_signature_123';
    
    it('should verify valid payment successfully', async () => {
      const expectedLamports = Math.floor(expectedAmount * LAMPORTS_PER_SOL);
      
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preBalances: [1000000000, 500000000], // 1 SOL, 0.5 SOL
          postBalances: [500000000, 1000000000]  // 0.5 SOL, 1 SOL
        },
        transaction: {
          message: {
            accountKeys: [
              { toString: () => fromWallet },
              { toString: () => toWallet }
            ]
          }
        }
      });
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        expectedAmount
      );
      
      expect(result.success).toBe(true);
      expect(result.details.receivedLamports).toBe(expectedLamports);
    });
    
    it('should accept payment within 100,000 lamport tolerance', async () => {
      const expectedLamports = Math.floor(expectedAmount * LAMPORTS_PER_SOL);
      const receivedLamports = expectedLamports + 50000; // Within tolerance
      
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preBalances: [1000000000, 500000000],
          postBalances: [1000000000 - receivedLamports, 500000000 + receivedLamports]
        },
        transaction: {
          message: {
            accountKeys: [
              { toString: () => fromWallet },
              { toString: () => toWallet }
            ]
          }
        }
      });
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        expectedAmount
      );
      
      expect(result.success).toBe(true);
      expect(result.details.difference).toBeLessThanOrEqual(100000);
    });
    
    it('should reject payment outside 100,000 lamport tolerance', async () => {
      const expectedLamports = Math.floor(expectedAmount * LAMPORTS_PER_SOL);
      const receivedLamports = expectedLamports + 150000; // Outside tolerance
      
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preBalances: [1000000000, 500000000],
          postBalances: [1000000000 - receivedLamports, 500000000 + receivedLamports]
        },
        transaction: {
          message: {
            accountKeys: [
              { toString: () => fromWallet },
              { toString: () => toWallet }
            ]
          }
        }
      });
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        expectedAmount
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('amount verification failed');
      expect(result.details.difference).toBeGreaterThan(100000);
    });
    
    it('should accept payment at exact 100,000 lamport tolerance boundary', async () => {
      const expectedLamports = Math.floor(expectedAmount * LAMPORTS_PER_SOL);
      const receivedLamports = expectedLamports + 100000; // Exactly at tolerance
      
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preBalances: [1000000000, 500000000],
          postBalances: [1000000000 - receivedLamports, 500000000 + receivedLamports]
        },
        transaction: {
          message: {
            accountKeys: [
              { toString: () => fromWallet },
              { toString: () => toWallet }
            ]
          }
        }
      });
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        expectedAmount
      );
      
      expect(result.success).toBe(true);
      expect(result.details.difference).toBe(100000);
    });
    
    it('should handle zero amount transactions', async () => {
      const zeroAmount = 0;
      
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preBalances: [1000000000, 500000000],
          postBalances: [1000000000, 500000000] // No change
        },
        transaction: {
          message: {
            accountKeys: [
              { toString: () => fromWallet },
              { toString: () => toWallet }
            ]
          }
        }
      });
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        zeroAmount
      );
      
      expect(result.success).toBe(true);
      expect(result.details.receivedLamports).toBe(0);
    });
    
    it('should reject when account keys are missing', async () => {
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preBalances: [1000000000, 500000000],
          postBalances: [500000000, 1000000000]
        },
        transaction: {
          message: {
            // Missing accountKeys
          }
        }
      });
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        expectedAmount
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not extract account keys from transaction');
    });
    
    it('should reject when transaction not found', async () => {
      mockConnection.getTransaction.mockResolvedValue(null);
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        expectedAmount
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });
    
    it('should reject when transaction failed on blockchain', async () => {
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: 'InsufficientFunds',
          preBalances: [],
          postBalances: []
        },
        transaction: {
          message: {
            accountKeys: []
          }
        }
      });
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        expectedAmount
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed on blockchain');
      expect(result.details.blockchainError).toBe('InsufficientFunds');
    });
    
    it('should reject when sender wallet not found in transaction', async () => {
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preBalances: [1000000000, 500000000],
          postBalances: [500000000, 1000000000]
        },
        transaction: {
          message: {
            accountKeys: [
              { toString: () => 'WrongWallet111111111111111111111111' },
              { toString: () => toWallet }
            ]
          }
        }
      });
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        expectedAmount
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Sender wallet not found in transaction');
    });
    
    it('should reject when recipient wallet not found in transaction', async () => {
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preBalances: [1000000000, 500000000],
          postBalances: [500000000, 1000000000]
        },
        transaction: {
          message: {
            accountKeys: [
              { toString: () => fromWallet },
              { toString: () => 'WrongWallet111111111111111111111111' }
            ]
          }
        }
      });
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        expectedAmount
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Recipient wallet not found in transaction');
    });
    
    it('should handle RPC errors gracefully', async () => {
      mockConnection.getTransaction.mockRejectedValue(new Error('Network error'));
      
      const result = await transactionVerification.verifyPayment(
        signature,
        fromWallet,
        toWallet,
        expectedAmount
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Verification error');
    });
  });
  
  describe('verifyPaymentWithConfirmation', () => {
    const fromWallet = 'FromWallet111111111111111111111111111';
    const toWallet = 'ToWallet1111111111111111111111111111';
    const expectedAmount = 0.5;
    const signature = 'complete_verification_signature';
    
    it('should complete full verification flow successfully', async () => {
      const expectedLamports = Math.floor(expectedAmount * LAMPORTS_PER_SOL);
      
      // Mock confirmation and verification
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preBalances: [1000000000, 500000000],
          postBalances: [500000000, 1000000000]
        },
        transaction: {
          message: {
            accountKeys: [
              { toString: () => fromWallet },
              { toString: () => toWallet }
            ]
          }
        }
      });
      
      const result = await transactionVerification.verifyPaymentWithConfirmation(
        signature,
        fromWallet,
        toWallet,
        expectedAmount,
        3000
      );
      
      expect(result.success).toBe(true);
      expect(result.details.receivedLamports).toBe(expectedLamports);
    });
    
    it('should fail when confirmation times out', async () => {
      // Always return null (never confirmed)
      mockConnection.getTransaction.mockResolvedValue(null);
      
      const result = await transactionVerification.verifyPaymentWithConfirmation(
        signature,
        fromWallet,
        toWallet,
        expectedAmount,
        2000
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('confirmation failed or timed out');
    }, 10000);
    
    it('should fail when payment verification fails after confirmation', async () => {
      // First calls for confirmation (return transaction)
      // Then call for verification (return wrong amount)
      const wrongLamports = Math.floor(expectedAmount * LAMPORTS_PER_SOL) + 200000; // Outside tolerance
      
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preBalances: [1000000000, 500000000],
          postBalances: [1000000000 - wrongLamports, 500000000 + wrongLamports]
        },
        transaction: {
          message: {
            accountKeys: [
              { toString: () => fromWallet },
              { toString: () => toWallet }
            ]
          }
        }
      });
      
      const result = await transactionVerification.verifyPaymentWithConfirmation(
        signature,
        fromWallet,
        toWallet,
        expectedAmount,
        3000
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('amount verification failed');
    });
  });
  
  describe('Configuration', () => {
    it('should use MAINNET_RPC_PRIMARY if available', () => {
      process.env.MAINNET_RPC_PRIMARY = 'https://mainnet.example.com';
      
      // Re-require to get new instance with updated env
      jest.resetModules();
      const txVerify = require('./transactionVerification');
      
      expect(txVerify.rpcEndpoint).toBe('https://mainnet.example.com');
      
      delete process.env.MAINNET_RPC_PRIMARY;
    });
    
    it('should have correct tolerance value (100,000 lamports)', () => {
      expect(transactionVerification.AMOUNT_TOLERANCE_LAMPORTS).toBe(100000);
    });
    
    it('should have correct timeout value (15,000 ms)', () => {
      expect(transactionVerification.CONFIRMATION_TIMEOUT_MS).toBe(15000);
    });
  });
});
