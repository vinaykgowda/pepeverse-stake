/**
 * Tests for Validation Middleware
 * 
 * Tests wallet address and transaction hash validation middleware functionality
 */

const { 
  validateWalletAddress, 
  validateWalletAddressArray,
  validateTransactionHash,
  validateTransactionHashArray,
  validateNumericRange,
  validateNumericRangeArray,
  validateNFTArray
} = require('./validation');
const authService = require('../src/services/auth');

// Mock authService
jest.mock('../src/services/auth', () => ({
  isValidSolanaAddress: jest.fn()
}));

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup request, response, and next function
    req = {
      body: {},
      params: {},
      query: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });

  describe('validateWalletAddress', () => {
    describe('with default options', () => {
      it('should validate wallet address in req.body.walletAddress', () => {
        const validAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        req.body.walletAddress = validAddress;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateWalletAddress();
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledWith(validAddress);
        expect(req.validatedWalletAddress).toBe(validAddress);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should validate wallet address in req.params.wallet', () => {
        const validAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        req.params.wallet = validAddress;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateWalletAddress();
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledWith(validAddress);
        expect(req.validatedWalletAddress).toBe(validAddress);
        expect(next).toHaveBeenCalled();
      });

      it('should validate wallet address in req.query.address', () => {
        const validAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        req.query.address = validAddress;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateWalletAddress();
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledWith(validAddress);
        expect(req.validatedWalletAddress).toBe(validAddress);
        expect(next).toHaveBeenCalled();
      });

      it('should validate wallet address in req.body.owner', () => {
        const validAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        req.body.owner = validAddress;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateWalletAddress();
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledWith(validAddress);
        expect(req.validatedWalletAddress).toBe(validAddress);
        expect(next).toHaveBeenCalled();
      });

      it('should return 400 if wallet address is missing', () => {
        const middleware = validateWalletAddress();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Wallet address is required',
          code: 'MISSING_WALLET_ADDRESS',
          expectedFields: ['walletAddress', 'wallet', 'address', 'owner']
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if wallet address is invalid', () => {
        const invalidAddress = 'invalid-address';
        req.body.walletAddress = invalidAddress;
        authService.isValidSolanaAddress.mockReturnValue(false);

        const middleware = validateWalletAddress();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid wallet address format. Must be a valid Solana address (base58, 32-44 characters)',
          code: 'INVALID_WALLET_ADDRESS',
          field: 'walletAddress',
          value: invalidAddress
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should prioritize body over params and query', () => {
        const bodyAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        const paramsAddress = 'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        req.body.walletAddress = bodyAddress;
        req.params.wallet = paramsAddress;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateWalletAddress();
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledWith(bodyAddress);
        expect(req.validatedWalletAddress).toBe(bodyAddress);
      });
    });

    describe('with custom options', () => {
      it('should validate custom field names', () => {
        const validAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        req.body.customField = validAddress;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateWalletAddress({ fields: ['customField'] });
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledWith(validAddress);
        expect(req.validatedWalletAddress).toBe(validAddress);
        expect(next).toHaveBeenCalled();
      });

      it('should allow missing address when required is false', () => {
        const middleware = validateWalletAddress({ required: false });
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should still validate address when present and required is false', () => {
        const invalidAddress = 'invalid';
        req.body.walletAddress = invalidAddress;
        authService.isValidSolanaAddress.mockReturnValue(false);

        const middleware = validateWalletAddress({ required: false });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle empty string as invalid', () => {
        req.body.walletAddress = '';
        authService.isValidSolanaAddress.mockReturnValue(false);

        const middleware = validateWalletAddress();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_WALLET_ADDRESS'
          })
        );
      });

      it('should handle null as missing', () => {
        req.body.walletAddress = null;

        const middleware = validateWalletAddress();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MISSING_WALLET_ADDRESS'
          })
        );
      });

      it('should handle undefined as missing', () => {
        req.body.walletAddress = undefined;

        const middleware = validateWalletAddress();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MISSING_WALLET_ADDRESS'
          })
        );
      });
    });
  });

  describe('validateWalletAddressArray', () => {
    describe('with default options', () => {
      it('should validate array of wallet addresses', () => {
        const validAddresses = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'FYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.walletAddresses = validAddresses;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateWalletAddressArray();
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledTimes(3);
        expect(req.validatedWalletAddresses).toEqual(validAddresses);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should return 400 if field is missing', () => {
        const middleware = validateWalletAddressArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'walletAddresses is required',
          code: 'MISSING_FIELD'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if field is not an array', () => {
        req.body.walletAddresses = 'not-an-array';

        const middleware = validateWalletAddressArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'walletAddresses must be an array',
          code: 'INVALID_ARRAY'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if array is empty', () => {
        req.body.walletAddresses = [];

        const middleware = validateWalletAddressArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'walletAddresses cannot be empty',
          code: 'EMPTY_ARRAY'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if array exceeds max length', () => {
        const tooManyAddresses = Array(11).fill('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK');
        req.body.walletAddresses = tooManyAddresses;

        const middleware = validateWalletAddressArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'walletAddresses cannot contain more than 10 addresses',
          code: 'ARRAY_TOO_LARGE',
          maxLength: 10,
          actualLength: 11
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if any address is invalid', () => {
        const addresses = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'invalid-address',
          'FYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.walletAddresses = addresses;
        
        // Mock: first is valid, second is invalid
        authService.isValidSolanaAddress
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false);

        const middleware = validateWalletAddressArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid wallet address at index 1: invalid-address',
          code: 'INVALID_WALLET_ADDRESS',
          index: 1,
          value: 'invalid-address'
        });
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('with custom options', () => {
      it('should validate custom field name', () => {
        const validAddresses = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.customField = validAddresses;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateWalletAddressArray({ field: 'customField' });
        middleware(req, res, next);

        expect(req.validatedWalletAddresses).toEqual(validAddresses);
        expect(next).toHaveBeenCalled();
      });

      it('should respect custom max length', () => {
        const addresses = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'FYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.walletAddresses = addresses;

        const middleware = validateWalletAddressArray({ maxLength: 2 });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'walletAddresses cannot contain more than 2 addresses',
          code: 'ARRAY_TOO_LARGE',
          maxLength: 2,
          actualLength: 3
        });
      });

      it('should allow missing array when required is false', () => {
        const middleware = validateWalletAddressArray({ required: false });
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should still validate array when present and required is false', () => {
        req.body.walletAddresses = 'not-an-array';

        const middleware = validateWalletAddressArray({ required: false });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_ARRAY'
          })
        );
      });
    });

    describe('edge cases', () => {
      it('should handle single address in array', () => {
        const validAddresses = ['DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'];
        req.body.walletAddresses = validAddresses;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateWalletAddressArray();
        middleware(req, res, next);

        expect(req.validatedWalletAddresses).toEqual(validAddresses);
        expect(next).toHaveBeenCalled();
      });

      it('should handle maximum allowed addresses', () => {
        const validAddresses = Array(10).fill('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK');
        req.body.walletAddresses = validAddresses;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateWalletAddressArray();
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledTimes(10);
        expect(req.validatedWalletAddresses).toEqual(validAddresses);
        expect(next).toHaveBeenCalled();
      });

      it('should detect invalid address at first position', () => {
        const addresses = [
          'invalid-address',
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.walletAddresses = addresses;
        authService.isValidSolanaAddress.mockReturnValue(false);

        const middleware = validateWalletAddressArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            index: 0,
            value: 'invalid-address'
          })
        );
      });

      it('should detect invalid address at last position', () => {
        const addresses = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'invalid-address'
        ];
        req.body.walletAddresses = addresses;
        
        authService.isValidSolanaAddress
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false);

        const middleware = validateWalletAddressArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            index: 2,
            value: 'invalid-address'
          })
        );
      });
    });
  });

  describe('validateTransactionHash', () => {
    describe('with default options', () => {
      it('should validate transaction hash in req.body.signature', () => {
        // Valid Solana transaction signature (88 characters, base58)
        const validSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        req.body.signature = validSignature;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(req.validatedTransactionHash).toBe(validSignature);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should validate transaction hash in req.params.txHash', () => {
        const validSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        req.params.txHash = validSignature;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(req.validatedTransactionHash).toBe(validSignature);
        expect(next).toHaveBeenCalled();
      });

      it('should validate transaction hash in req.query.transactionHash', () => {
        const validSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        req.query.transactionHash = validSignature;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(req.validatedTransactionHash).toBe(validSignature);
        expect(next).toHaveBeenCalled();
      });

      it('should validate transaction hash in req.body.txSignature', () => {
        const validSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        req.body.txSignature = validSignature;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(req.validatedTransactionHash).toBe(validSignature);
        expect(next).toHaveBeenCalled();
      });

      it('should return 400 if transaction hash is missing', () => {
        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Transaction hash is required',
          code: 'MISSING_TRANSACTION_HASH',
          expectedFields: ['signature', 'txHash', 'transactionHash', 'txSignature', 'transaction']
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if transaction hash is not a string', () => {
        req.body.signature = 12345;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Transaction hash must be a string',
          code: 'INVALID_TRANSACTION_HASH',
          field: 'signature',
          value: 12345
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if transaction hash is too short', () => {
        const shortSignature = 'tooshort';
        req.body.signature = shortSignature;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid transaction hash format. Solana signatures must be 88 characters (base58 encoded)',
          code: 'INVALID_TRANSACTION_HASH',
          field: 'signature',
          value: shortSignature,
          expectedLength: 88,
          actualLength: 8
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if transaction hash is too long', () => {
        const longSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUWextra';
        req.body.signature = longSignature;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid transaction hash format. Solana signatures must be 88 characters (base58 encoded)',
          code: 'INVALID_TRANSACTION_HASH',
          field: 'signature',
          value: longSignature,
          expectedLength: 88,
          actualLength: 93
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if transaction hash has invalid base58 encoding', () => {
        // 88 characters but contains invalid base58 characters (0, O, I, l)
        const invalidSignature = '0OIl' + 'a'.repeat(84);
        req.body.signature = invalidSignature;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid transaction hash encoding. Must be valid base58',
          code: 'INVALID_TRANSACTION_HASH',
          field: 'signature',
          value: invalidSignature
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should prioritize body over params and query', () => {
        const bodySignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        const paramsSignature = '4VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        req.body.signature = bodySignature;
        req.params.txHash = paramsSignature;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(req.validatedTransactionHash).toBe(bodySignature);
        expect(next).toHaveBeenCalled();
      });
    });

    describe('with custom options', () => {
      it('should validate custom field names', () => {
        const validSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
        req.body.customField = validSignature;

        const middleware = validateTransactionHash({ fields: ['customField'] });
        middleware(req, res, next);

        expect(req.validatedTransactionHash).toBe(validSignature);
        expect(next).toHaveBeenCalled();
      });

      it('should allow missing transaction hash when required is false', () => {
        const middleware = validateTransactionHash({ required: false });
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should still validate transaction hash when present and required is false', () => {
        const invalidSignature = 'invalid';
        req.body.signature = invalidSignature;

        const middleware = validateTransactionHash({ required: false });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle empty string as invalid', () => {
        req.body.signature = '';

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_TRANSACTION_HASH'
          })
        );
      });

      it('should handle null as missing', () => {
        req.body.signature = null;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MISSING_TRANSACTION_HASH'
          })
        );
      });

      it('should handle undefined as missing', () => {
        req.body.signature = undefined;

        const middleware = validateTransactionHash();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MISSING_TRANSACTION_HASH'
          })
        );
      });

      it('should validate multiple valid signatures with different characters', () => {
        // Test with different valid base58 characters
        const validSignatures = [
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          '2ZE7R7ZKGzyNZy1T6iKQw9ZP4qU8kKNvdh8yGEA1PC5s4MoN4jjSMfK7cZitrRvhtBvoXJYfxV7eyKpTfUp5yDRv'
        ];

        validSignatures.forEach(sig => {
          // Reset req for each test
          req = {
            body: { signature: sig },
            params: {},
            query: {}
          };
          
          const middleware = validateTransactionHash();
          middleware(req, res, next);
          expect(req.validatedTransactionHash).toBe(sig);
        });
      });
    });
  });

  describe('validateTransactionHashArray', () => {
    describe('with default options', () => {
      it('should validate array of transaction hashes', () => {
        const validSignatures = [
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          '4VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          '3VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        ];
        req.body.signatures = validSignatures;

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(req.validatedTransactionHashes).toEqual(validSignatures);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should return 400 if field is missing', () => {
        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'signatures is required',
          code: 'MISSING_FIELD'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if field is not an array', () => {
        req.body.signatures = 'not-an-array';

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'signatures must be an array',
          code: 'INVALID_ARRAY'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if array is empty', () => {
        req.body.signatures = [];

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'signatures cannot be empty',
          code: 'EMPTY_ARRAY'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if array exceeds max length', () => {
        const tooManySignatures = Array(11).fill('5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW');
        req.body.signatures = tooManySignatures;

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'signatures cannot contain more than 10 transaction hashes',
          code: 'ARRAY_TOO_LARGE',
          maxLength: 10,
          actualLength: 11
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if any signature is not a string', () => {
        const signatures = [
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          12345,
          '3VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        ];
        req.body.signatures = signatures;

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Transaction hash at index 1 must be a string',
          code: 'INVALID_TRANSACTION_HASH',
          index: 1,
          value: 12345
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if any signature has wrong length', () => {
        const signatures = [
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          'tooshort',
          '3VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        ];
        req.body.signatures = signatures;

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid transaction hash at index 1: must be 88 characters',
          code: 'INVALID_TRANSACTION_HASH',
          index: 1,
          value: 'tooshort',
          expectedLength: 88,
          actualLength: 8
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if any signature has invalid base58 encoding', () => {
        const invalidSignature = '0OIl' + 'a'.repeat(84);
        const signatures = [
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          invalidSignature,
          '3VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        ];
        req.body.signatures = signatures;

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid transaction hash at index 1: must be valid base58',
          code: 'INVALID_TRANSACTION_HASH',
          index: 1,
          value: invalidSignature
        });
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('with custom options', () => {
      it('should validate custom field name', () => {
        const validSignatures = [
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          '4VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        ];
        req.body.customField = validSignatures;

        const middleware = validateTransactionHashArray({ field: 'customField' });
        middleware(req, res, next);

        expect(req.validatedTransactionHashes).toEqual(validSignatures);
        expect(next).toHaveBeenCalled();
      });

      it('should respect custom max length', () => {
        const signatures = [
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          '4VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          '3VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        ];
        req.body.signatures = signatures;

        const middleware = validateTransactionHashArray({ maxLength: 2 });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'signatures cannot contain more than 2 transaction hashes',
          code: 'ARRAY_TOO_LARGE',
          maxLength: 2,
          actualLength: 3
        });
      });

      it('should allow missing array when required is false', () => {
        const middleware = validateTransactionHashArray({ required: false });
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should still validate array when present and required is false', () => {
        req.body.signatures = 'not-an-array';

        const middleware = validateTransactionHashArray({ required: false });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_ARRAY'
          })
        );
      });
    });

    describe('edge cases', () => {
      it('should handle single signature in array', () => {
        const validSignatures = ['5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'];
        req.body.signatures = validSignatures;

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(req.validatedTransactionHashes).toEqual(validSignatures);
        expect(next).toHaveBeenCalled();
      });

      it('should handle maximum allowed signatures', () => {
        const validSignatures = Array(10).fill('5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW');
        req.body.signatures = validSignatures;

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(req.validatedTransactionHashes).toEqual(validSignatures);
        expect(next).toHaveBeenCalled();
      });

      it('should detect invalid signature at first position', () => {
        const signatures = [
          'invalid',
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        ];
        req.body.signatures = signatures;

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            index: 0,
            value: 'invalid'
          })
        );
      });

      it('should detect invalid signature at last position', () => {
        const signatures = [
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          '4VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
          'invalid'
        ];
        req.body.signatures = signatures;

        const middleware = validateTransactionHashArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            index: 2,
            value: 'invalid'
          })
        );
      });
    });
  });

  describe('validateNumericRange', () => {
    describe('with default options', () => {
      it('should validate numeric value in req.body.amount', () => {
        req.body.amount = 100;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(100);
        expect(req.validatedNumericField).toBe('amount');
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should validate numeric value in req.params.count', () => {
        req.params.count = 50;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(50);
        expect(req.validatedNumericField).toBe('count');
        expect(next).toHaveBeenCalled();
      });

      it('should validate numeric value in req.query.limit', () => {
        req.query.limit = 25;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(25);
        expect(req.validatedNumericField).toBe('limit');
        expect(next).toHaveBeenCalled();
      });

      it('should validate zero as valid', () => {
        req.body.amount = 0;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(0);
        expect(next).toHaveBeenCalled();
      });

      it('should validate decimal numbers', () => {
        req.body.amount = 123.456;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(123.456);
        expect(next).toHaveBeenCalled();
      });

      it('should convert string numbers to numbers', () => {
        req.body.amount = '100';

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(100);
        expect(next).toHaveBeenCalled();
      });

      it('should convert string decimals to numbers', () => {
        req.body.amount = '123.456';

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(123.456);
        expect(next).toHaveBeenCalled();
      });

      it('should return 400 if numeric value is missing', () => {
        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Numeric value is required',
          code: 'MISSING_NUMERIC_VALUE',
          expectedFields: ['amount', 'count', 'limit', 'offset', 'quantity', 'balance']
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if value is NaN', () => {
        req.body.amount = 'not-a-number';

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount must be a valid number',
          code: 'INVALID_NUMBER',
          field: 'amount',
          value: 'not-a-number'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if value is Infinity', () => {
        req.body.amount = Infinity;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount must be a finite number',
          code: 'INVALID_NUMBER',
          field: 'amount',
          value: Infinity
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if value is -Infinity', () => {
        req.body.amount = -Infinity;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount must be a finite number',
          code: 'INVALID_NUMBER',
          field: 'amount',
          value: -Infinity
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if value is an object', () => {
        req.body.amount = { value: 100 };

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount must be a number',
          code: 'INVALID_NUMBER_TYPE',
          field: 'amount',
          value: { value: 100 },
          receivedType: 'object'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if value is an array', () => {
        req.body.amount = [100];

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount must be a number',
          code: 'INVALID_NUMBER_TYPE',
          field: 'amount',
          value: [100],
          receivedType: 'object'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if value is below default min (0)', () => {
        req.body.amount = -10;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount must be at least 0',
          code: 'VALUE_TOO_LOW',
          field: 'amount',
          value: -10,
          min: 0
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should prioritize body over params and query', () => {
        req.body.amount = 100;
        req.params.count = 50;
        req.query.limit = 25;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(100);
        expect(req.validatedNumericField).toBe('amount');
      });
    });

    describe('with custom options', () => {
      it('should validate custom field names', () => {
        req.body.customField = 100;

        const middleware = validateNumericRange({ fields: ['customField'] });
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(100);
        expect(req.validatedNumericField).toBe('customField');
        expect(next).toHaveBeenCalled();
      });

      it('should enforce custom min value', () => {
        req.body.amount = 5;

        const middleware = validateNumericRange({ min: 10 });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount must be at least 10',
          code: 'VALUE_TOO_LOW',
          field: 'amount',
          value: 5,
          min: 10
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should enforce custom max value', () => {
        req.body.amount = 150;

        const middleware = validateNumericRange({ max: 100 });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount must be at most 100',
          code: 'VALUE_TOO_HIGH',
          field: 'amount',
          value: 150,
          max: 100
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should validate value at min boundary', () => {
        req.body.amount = 10;

        const middleware = validateNumericRange({ min: 10, max: 100 });
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(10);
        expect(next).toHaveBeenCalled();
      });

      it('should validate value at max boundary', () => {
        req.body.amount = 100;

        const middleware = validateNumericRange({ min: 10, max: 100 });
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(100);
        expect(next).toHaveBeenCalled();
      });

      it('should enforce integer constraint', () => {
        req.body.count = 10.5;

        const middleware = validateNumericRange({ integer: true });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'count must be an integer',
          code: 'INVALID_INTEGER',
          field: 'count',
          value: 10.5
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should validate integer values when integer constraint is set', () => {
        req.body.count = 10;

        const middleware = validateNumericRange({ integer: true });
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(10);
        expect(next).toHaveBeenCalled();
      });

      it('should allow negative numbers when min is negative', () => {
        req.body.amount = -50;

        const middleware = validateNumericRange({ min: -100, max: 100 });
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(-50);
        expect(next).toHaveBeenCalled();
      });

      it('should allow missing value when required is false', () => {
        const middleware = validateNumericRange({ required: false });
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should still validate value when present and required is false', () => {
        req.body.amount = -10;

        const middleware = validateNumericRange({ required: false });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle null as missing', () => {
        req.body.amount = null;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MISSING_NUMERIC_VALUE'
          })
        );
      });

      it('should handle undefined as missing', () => {
        req.body.amount = undefined;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MISSING_NUMERIC_VALUE'
          })
        );
      });

      it('should handle negative zero', () => {
        req.body.amount = -0;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        // In JavaScript, -0 is preserved as -0
        expect(req.validatedNumericValue).toBe(-0);
        expect(next).toHaveBeenCalled();
      });

      it('should handle very large numbers within MAX_SAFE_INTEGER', () => {
        const largeNumber = Number.MAX_SAFE_INTEGER - 1;
        req.body.amount = largeNumber;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(largeNumber);
        expect(next).toHaveBeenCalled();
      });

      it('should handle very small decimal numbers', () => {
        req.body.amount = 0.000001;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(0.000001);
        expect(next).toHaveBeenCalled();
      });

      it('should handle scientific notation strings', () => {
        req.body.amount = '1e5';

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(100000);
        expect(next).toHaveBeenCalled();
      });

      it('should reject boolean values', () => {
        req.body.amount = true;

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_NUMBER_TYPE',
            receivedType: 'boolean'
          })
        );
      });

      it('should handle string with leading/trailing spaces', () => {
        req.body.amount = '  100  ';

        const middleware = validateNumericRange();
        middleware(req, res, next);

        expect(req.validatedNumericValue).toBe(100);
        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('validateNumericRangeArray', () => {
    describe('with default options', () => {
      it('should validate array of numeric values', () => {
        const values = [10, 20, 30, 40, 50];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(req.validatedNumericValues).toEqual(values);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should validate array with decimal values', () => {
        const values = [10.5, 20.75, 30.25];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(req.validatedNumericValues).toEqual(values);
        expect(next).toHaveBeenCalled();
      });

      it('should convert string numbers to numbers', () => {
        const values = ['10', '20', '30'];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(req.validatedNumericValues).toEqual([10, 20, 30]);
        expect(next).toHaveBeenCalled();
      });

      it('should validate array with zero values', () => {
        const values = [0, 10, 0, 20];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(req.validatedNumericValues).toEqual(values);
        expect(next).toHaveBeenCalled();
      });

      it('should return 400 if field is missing', () => {
        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amounts is required',
          code: 'MISSING_FIELD'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if field is not an array', () => {
        req.body.amounts = 'not-an-array';

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amounts must be an array',
          code: 'INVALID_ARRAY'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if array is empty', () => {
        req.body.amounts = [];

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amounts cannot be empty',
          code: 'EMPTY_ARRAY'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if array exceeds max length', () => {
        const tooManyValues = Array(101).fill(10);
        req.body.amounts = tooManyValues;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amounts cannot contain more than 100 values',
          code: 'ARRAY_TOO_LARGE',
          maxLength: 100,
          actualLength: 101
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if any value is NaN', () => {
        const values = [10, 'not-a-number', 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Value at index 1 must be a valid number',
          code: 'INVALID_NUMBER',
          index: 1,
          value: 'not-a-number'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if any value is Infinity', () => {
        const values = [10, Infinity, 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Value at index 1 must be a finite number',
          code: 'INVALID_NUMBER',
          index: 1,
          value: Infinity
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if any value is an object', () => {
        const values = [10, { value: 20 }, 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Value at index 1 must be a number',
          code: 'INVALID_NUMBER_TYPE',
          index: 1,
          value: { value: 20 },
          receivedType: 'object'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if any value is below default min (0)', () => {
        const values = [10, -5, 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Value at index 1 must be at least 0',
          code: 'VALUE_TOO_LOW',
          index: 1,
          value: -5,
          min: 0
        });
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('with custom options', () => {
      it('should validate custom field name', () => {
        const values = [10, 20, 30];
        req.body.customField = values;

        const middleware = validateNumericRangeArray({ field: 'customField' });
        middleware(req, res, next);

        expect(req.validatedNumericValues).toEqual(values);
        expect(next).toHaveBeenCalled();
      });

      it('should enforce custom min value', () => {
        const values = [10, 5, 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray({ min: 10 });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Value at index 1 must be at least 10',
          code: 'VALUE_TOO_LOW',
          index: 1,
          value: 5,
          min: 10
        });
      });

      it('should enforce custom max value', () => {
        const values = [10, 150, 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray({ max: 100 });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Value at index 1 must be at most 100',
          code: 'VALUE_TOO_HIGH',
          index: 1,
          value: 150,
          max: 100
        });
      });

      it('should enforce integer constraint', () => {
        const values = [10, 20.5, 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray({ integer: true });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Value at index 1 must be an integer',
          code: 'INVALID_INTEGER',
          index: 1,
          value: 20.5
        });
      });

      it('should validate integer values when integer constraint is set', () => {
        const values = [10, 20, 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray({ integer: true });
        middleware(req, res, next);

        expect(req.validatedNumericValues).toEqual(values);
        expect(next).toHaveBeenCalled();
      });

      it('should respect custom max length', () => {
        const values = [10, 20, 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray({ maxLength: 2 });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amounts cannot contain more than 2 values',
          code: 'ARRAY_TOO_LARGE',
          maxLength: 2,
          actualLength: 3
        });
      });

      it('should allow missing array when required is false', () => {
        const middleware = validateNumericRangeArray({ required: false });
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should still validate array when present and required is false', () => {
        req.body.amounts = 'not-an-array';

        const middleware = validateNumericRangeArray({ required: false });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_ARRAY'
          })
        );
      });
    });

    describe('edge cases', () => {
      it('should handle single value in array', () => {
        const values = [100];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(req.validatedNumericValues).toEqual(values);
        expect(next).toHaveBeenCalled();
      });

      it('should handle maximum allowed values', () => {
        const values = Array(100).fill(10);
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(req.validatedNumericValues).toEqual(values);
        expect(next).toHaveBeenCalled();
      });

      it('should detect invalid value at first position', () => {
        const values = ['invalid', 20, 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            index: 0,
            value: 'invalid'
          })
        );
      });

      it('should detect invalid value at last position', () => {
        const values = [10, 20, 'invalid'];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            index: 2,
            value: 'invalid'
          })
        );
      });

      it('should handle mixed string and number values', () => {
        const values = [10, '20', 30, '40'];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        expect(req.validatedNumericValues).toEqual([10, 20, 30, 40]);
        expect(next).toHaveBeenCalled();
      });

      it('should handle negative zero in array', () => {
        const values = [10, -0, 30];
        req.body.amounts = values;

        const middleware = validateNumericRangeArray();
        middleware(req, res, next);

        // In JavaScript, -0 is preserved as -0
        expect(req.validatedNumericValues).toEqual([10, -0, 30]);
        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('validateNFTArray', () => {
    describe('with default options', () => {
      it('should validate array of NFT mint addresses', () => {
        const validMints = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'FYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.nftMints = validMints;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledTimes(3);
        expect(req.validatedNFTMints).toEqual(validMints);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should return 400 if field is missing', () => {
        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'nftMints is required',
          code: 'MISSING_FIELD'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if field is not an array', () => {
        req.body.nftMints = 'not-an-array';

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'nftMints must be an array',
          code: 'INVALID_ARRAY'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if array is empty', () => {
        req.body.nftMints = [];

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'nftMints cannot be empty',
          code: 'EMPTY_ARRAY'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if array exceeds max length of 10 (transaction limit)', () => {
        const tooManyMints = Array(11).fill('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK');
        req.body.nftMints = tooManyMints;

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'nftMints cannot contain more than 10 NFTs per transaction',
          code: 'ARRAY_TOO_LARGE',
          maxLength: 10,
          actualLength: 11
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 if any mint address is invalid', () => {
        const mints = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'invalid-mint-address',
          'FYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.nftMints = mints;
        
        // Mock: first is valid, second is invalid
        authService.isValidSolanaAddress
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false);

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid NFT mint address at index 1: invalid-mint-address',
          code: 'INVALID_MINT_ADDRESS',
          index: 1,
          value: 'invalid-mint-address'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should validate exactly 10 NFTs (maximum allowed)', () => {
        const validMints = Array(10).fill('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK');
        req.body.nftMints = validMints;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledTimes(10);
        expect(req.validatedNFTMints).toEqual(validMints);
        expect(next).toHaveBeenCalled();
      });

      it('should validate single NFT in array', () => {
        const validMints = ['DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'];
        req.body.nftMints = validMints;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(req.validatedNFTMints).toEqual(validMints);
        expect(next).toHaveBeenCalled();
      });
    });

    describe('with custom options', () => {
      it('should validate custom field name', () => {
        const validMints = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.customField = validMints;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateNFTArray({ field: 'customField' });
        middleware(req, res, next);

        expect(req.validatedNFTMints).toEqual(validMints);
        expect(next).toHaveBeenCalled();
      });

      it('should respect custom max length', () => {
        const mints = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'FYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.nftMints = mints;

        const middleware = validateNFTArray({ maxLength: 2 });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'nftMints cannot contain more than 2 NFTs per transaction',
          code: 'ARRAY_TOO_LARGE',
          maxLength: 2,
          actualLength: 3
        });
      });

      it('should allow missing array when required is false', () => {
        const middleware = validateNFTArray({ required: false });
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should still validate array when present and required is false', () => {
        req.body.nftMints = 'not-an-array';

        const middleware = validateNFTArray({ required: false });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_ARRAY'
          })
        );
      });
    });

    describe('edge cases', () => {
      it('should detect invalid mint address at first position', () => {
        const mints = [
          'invalid-address',
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.nftMints = mints;
        authService.isValidSolanaAddress.mockReturnValue(false);

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_MINT_ADDRESS',
            index: 0,
            value: 'invalid-address'
          })
        );
      });

      it('should detect invalid mint address at last position', () => {
        const mints = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'invalid-address'
        ];
        req.body.nftMints = mints;
        
        authService.isValidSolanaAddress
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false);

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_MINT_ADDRESS',
            index: 2,
            value: 'invalid-address'
          })
        );
      });

      it('should handle null as missing', () => {
        req.body.nftMints = null;

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MISSING_FIELD'
          })
        );
      });

      it('should handle undefined as missing', () => {
        req.body.nftMints = undefined;

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MISSING_FIELD'
          })
        );
      });

      it('should validate all addresses even when some are duplicates', () => {
        const mints = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.nftMints = mints;
        authService.isValidSolanaAddress.mockReturnValue(true);

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(authService.isValidSolanaAddress).toHaveBeenCalledTimes(3);
        expect(req.validatedNFTMints).toEqual(mints);
        expect(next).toHaveBeenCalled();
      });

      it('should reject array with mixed valid and invalid addresses', () => {
        const mints = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          'EYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          '',
          'FYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ];
        req.body.nftMints = mints;
        
        authService.isValidSolanaAddress
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false);

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_MINT_ADDRESS',
            index: 2,
            value: ''
          })
        );
      });

      it('should enforce transaction size limit for stake operations', () => {
        // Test that 11 NFTs are rejected (exceeds limit)
        const tooManyMints = Array(11).fill('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK');
        req.body.nftMints = tooManyMints;

        const middleware = validateNFTArray();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'nftMints cannot contain more than 10 NFTs per transaction',
            code: 'ARRAY_TOO_LARGE',
            maxLength: 10,
            actualLength: 11
          })
        );
      });

      it('should enforce transaction size limit for unstake operations', () => {
        // Test with custom field name for unstake
        const tooManyMints = Array(11).fill('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK');
        req.body.unstakeNfts = tooManyMints;

        const middleware = validateNFTArray({ field: 'unstakeNfts' });
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'unstakeNfts cannot contain more than 10 NFTs per transaction',
            code: 'ARRAY_TOO_LARGE'
          })
        );
      });
    });
  });
});
