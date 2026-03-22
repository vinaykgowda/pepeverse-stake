/**
 * Validation Middleware
 * 
 * Provides reusable validation middleware for API requests.
 * Validates wallet addresses, transaction hashes, and other inputs.
 * 
 * Requirements: 8.1, 8.3
 */

const authService = require('../src/services/auth');
const bs58 = require('bs58');

/**
 * Validate wallet address in request
 * Checks req.body, req.params, and req.query for wallet address fields
 * Common field names: walletAddress, wallet, address, owner
 * 
 * @param {Object} options - Configuration options
 * @param {string[]} options.fields - Field names to check (default: ['walletAddress', 'wallet', 'address', 'owner'])
 * @param {boolean} options.required - Whether the field is required (default: true)
 * @returns {Function} Express middleware function
 */
const validateWalletAddress = (options = {}) => {
  const {
    fields = ['walletAddress', 'wallet', 'address', 'owner'],
    required = true
  } = options;

  return (req, res, next) => {
    // Check all possible locations for wallet address
    let walletAddress = null;
    let foundField = null;

    // Check each field in body, params, and query
    for (const field of fields) {
      if (req.body && field in req.body && req.body[field] !== undefined && req.body[field] !== null) {
        walletAddress = req.body[field];
        foundField = field;
        break;
      }
      if (req.params && field in req.params && req.params[field] !== undefined && req.params[field] !== null) {
        walletAddress = req.params[field];
        foundField = field;
        break;
      }
      if (req.query && field in req.query && req.query[field] !== undefined && req.query[field] !== null) {
        walletAddress = req.query[field];
        foundField = field;
        break;
      }
    }

    // If no wallet address found and it's required, return error
    if ((walletAddress === null || walletAddress === undefined) && required) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
        code: 'MISSING_WALLET_ADDRESS',
        expectedFields: fields
      });
    }

    // If wallet address found (even if empty string), validate it
    if (walletAddress !== null && walletAddress !== undefined) {
      if (!authService.isValidSolanaAddress(walletAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid wallet address format. Must be a valid Solana address (base58, 32-44 characters)',
          code: 'INVALID_WALLET_ADDRESS',
          field: foundField,
          value: walletAddress
        });
      }

      // Store validated wallet address in req for downstream use
      req.validatedWalletAddress = walletAddress;
    }

    next();
  };
};

/**
 * Validate array of wallet addresses
 * Useful for batch operations
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.field - Field name containing the array (default: 'walletAddresses')
 * @param {number} options.maxLength - Maximum array length (default: 10)
 * @param {boolean} options.required - Whether the field is required (default: true)
 * @returns {Function} Express middleware function
 */
const validateWalletAddressArray = (options = {}) => {
  const {
    field = 'walletAddresses',
    maxLength = 10,
    required = true
  } = options;

  return (req, res, next) => {
    const addresses = req.body[field];

    // Check if field exists
    if (!addresses && required) {
      return res.status(400).json({
        success: false,
        error: `${field} is required`,
        code: 'MISSING_FIELD'
      });
    }

    // If not required and not present, skip validation
    if (!addresses && !required) {
      return next();
    }

    // Validate it's an array
    if (!Array.isArray(addresses)) {
      return res.status(400).json({
        success: false,
        error: `${field} must be an array`,
        code: 'INVALID_ARRAY'
      });
    }

    // Check array is not empty
    if (addresses.length === 0) {
      return res.status(400).json({
        success: false,
        error: `${field} cannot be empty`,
        code: 'EMPTY_ARRAY'
      });
    }

    // Check array length
    if (addresses.length > maxLength) {
      return res.status(400).json({
        success: false,
        error: `${field} cannot contain more than ${maxLength} addresses`,
        code: 'ARRAY_TOO_LARGE',
        maxLength,
        actualLength: addresses.length
      });
    }

    // Validate each address
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      if (!authService.isValidSolanaAddress(address)) {
        return res.status(400).json({
          success: false,
          error: `Invalid wallet address at index ${i}: ${address}`,
          code: 'INVALID_WALLET_ADDRESS',
          index: i,
          value: address
        });
      }
    }

    // Store validated addresses in req for downstream use
    req.validatedWalletAddresses = addresses;

    next();
  };
};

/**
 * Validate Solana transaction hash/signature in request
 * Checks req.body, req.params, and req.query for transaction hash fields
 * Common field names: signature, txHash, transactionHash, txSignature, transaction
 * 
 * Solana transaction signatures are base58 encoded strings, typically 88 characters
 * 
 * @param {Object} options - Configuration options
 * @param {string[]} options.fields - Field names to check (default: ['signature', 'txHash', 'transactionHash', 'txSignature', 'transaction'])
 * @param {boolean} options.required - Whether the field is required (default: true)
 * @returns {Function} Express middleware function
 */
const validateTransactionHash = (options = {}) => {
  const {
    fields = ['signature', 'txHash', 'transactionHash', 'txSignature', 'transaction'],
    required = true
  } = options;

  return (req, res, next) => {
    // Check all possible locations for transaction hash
    let transactionHash = null;
    let foundField = null;

    // Check each field in body, params, and query
    for (const field of fields) {
      if (req.body && field in req.body && req.body[field] !== undefined && req.body[field] !== null) {
        transactionHash = req.body[field];
        foundField = field;
        break;
      }
      if (req.params && field in req.params && req.params[field] !== undefined && req.params[field] !== null) {
        transactionHash = req.params[field];
        foundField = field;
        break;
      }
      if (req.query && field in req.query && req.query[field] !== undefined && req.query[field] !== null) {
        transactionHash = req.query[field];
        foundField = field;
        break;
      }
    }

    // If no transaction hash found and it's required, return error
    if ((transactionHash === null || transactionHash === undefined) && required) {
      return res.status(400).json({
        success: false,
        error: 'Transaction hash is required',
        code: 'MISSING_TRANSACTION_HASH',
        expectedFields: fields
      });
    }

    // If transaction hash found (even if empty string), validate it
    if (transactionHash !== null && transactionHash !== undefined) {
      // Validate it's a string
      if (typeof transactionHash !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Transaction hash must be a string',
          code: 'INVALID_TRANSACTION_HASH',
          field: foundField,
          value: transactionHash
        });
      }

      // Validate length (Solana signatures are typically 88 characters)
      if (transactionHash.length !== 88) {
        return res.status(400).json({
          success: false,
          error: 'Invalid transaction hash format. Solana signatures must be 88 characters (base58 encoded)',
          code: 'INVALID_TRANSACTION_HASH',
          field: foundField,
          value: transactionHash,
          expectedLength: 88,
          actualLength: transactionHash.length
        });
      }

      // Validate base58 encoding
      try {
        bs58.decode(transactionHash);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid transaction hash encoding. Must be valid base58',
          code: 'INVALID_TRANSACTION_HASH',
          field: foundField,
          value: transactionHash
        });
      }

      // Store validated transaction hash in req for downstream use
      req.validatedTransactionHash = transactionHash;
    }

    next();
  };
};

/**
 * Validate array of transaction hashes
 * Useful for batch transaction verification
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.field - Field name containing the array (default: 'signatures')
 * @param {number} options.maxLength - Maximum array length (default: 10)
 * @param {boolean} options.required - Whether the field is required (default: true)
 * @returns {Function} Express middleware function
 */
const validateTransactionHashArray = (options = {}) => {
  const {
    field = 'signatures',
    maxLength = 10,
    required = true
  } = options;

  return (req, res, next) => {
    const hashes = req.body[field];

    // Check if field exists
    if (!hashes && required) {
      return res.status(400).json({
        success: false,
        error: `${field} is required`,
        code: 'MISSING_FIELD'
      });
    }

    // If not required and not present, skip validation
    if (!hashes && !required) {
      return next();
    }

    // Validate it's an array
    if (!Array.isArray(hashes)) {
      return res.status(400).json({
        success: false,
        error: `${field} must be an array`,
        code: 'INVALID_ARRAY'
      });
    }

    // Check array is not empty
    if (hashes.length === 0) {
      return res.status(400).json({
        success: false,
        error: `${field} cannot be empty`,
        code: 'EMPTY_ARRAY'
      });
    }

    // Check array length
    if (hashes.length > maxLength) {
      return res.status(400).json({
        success: false,
        error: `${field} cannot contain more than ${maxLength} transaction hashes`,
        code: 'ARRAY_TOO_LARGE',
        maxLength,
        actualLength: hashes.length
      });
    }

    // Validate each transaction hash
    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      
      // Validate it's a string
      if (typeof hash !== 'string') {
        return res.status(400).json({
          success: false,
          error: `Transaction hash at index ${i} must be a string`,
          code: 'INVALID_TRANSACTION_HASH',
          index: i,
          value: hash
        });
      }

      // Validate length
      if (hash.length !== 88) {
        return res.status(400).json({
          success: false,
          error: `Invalid transaction hash at index ${i}: must be 88 characters`,
          code: 'INVALID_TRANSACTION_HASH',
          index: i,
          value: hash,
          expectedLength: 88,
          actualLength: hash.length
        });
      }

      // Validate base58 encoding
      try {
        bs58.decode(hash);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: `Invalid transaction hash at index ${i}: must be valid base58`,
          code: 'INVALID_TRANSACTION_HASH',
          index: i,
          value: hash
        });
      }
    }

    // Store validated hashes in req for downstream use
    req.validatedTransactionHashes = hashes;

    next();
  };
};

/**
 * Validate numeric value with range constraints
 * Checks req.body, req.params, and req.query for numeric fields
 * Common field names: amount, count, limit, offset, quantity, balance, price, fee
 * 
 * Validates:
 * - Value is a number (not string, object, array, etc.)
 * - Value is not NaN, Infinity, or -Infinity
 * - Value is within specified min/max range
 * - Value meets integer constraint if specified
 * 
 * @param {Object} options - Configuration options
 * @param {string[]} options.fields - Field names to check (default: ['amount', 'count', 'limit', 'offset', 'quantity', 'balance'])
 * @param {number} options.min - Minimum allowed value (inclusive, default: 0)
 * @param {number} options.max - Maximum allowed value (inclusive, default: Number.MAX_SAFE_INTEGER)
 * @param {boolean} options.integer - Whether value must be an integer (default: false)
 * @param {boolean} options.required - Whether the field is required (default: true)
 * @returns {Function} Express middleware function
 */
const validateNumericRange = (options = {}) => {
  const {
    fields = ['amount', 'count', 'limit', 'offset', 'quantity', 'balance'],
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    integer = false,
    required = true
  } = options;

  return (req, res, next) => {
    // Check all possible locations for numeric value
    let value = null;
    let foundField = null;

    // Check each field in body, params, and query
    for (const field of fields) {
      if (req.body && field in req.body && req.body[field] !== undefined && req.body[field] !== null) {
        value = req.body[field];
        foundField = field;
        break;
      }
      if (req.params && field in req.params && req.params[field] !== undefined && req.params[field] !== null) {
        value = req.params[field];
        foundField = field;
        break;
      }
      if (req.query && field in req.query && req.query[field] !== undefined && req.query[field] !== null) {
        value = req.query[field];
        foundField = field;
        break;
      }
    }

    // If no value found and it's required, return error
    if ((value === null || value === undefined) && required) {
      return res.status(400).json({
        success: false,
        error: `Numeric value is required`,
        code: 'MISSING_NUMERIC_VALUE',
        expectedFields: fields
      });
    }

    // If value found (even if 0), validate it
    if (value !== null && value !== undefined) {
      // Convert to number if it's a string
      const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);

      // Check if it's a valid number
      if (typeof value !== 'number' && typeof value !== 'string') {
        return res.status(400).json({
          success: false,
          error: `${foundField} must be a number`,
          code: 'INVALID_NUMBER_TYPE',
          field: foundField,
          value: value,
          receivedType: typeof value
        });
      }

      // Check for NaN
      if (isNaN(numValue)) {
        return res.status(400).json({
          success: false,
          error: `${foundField} must be a valid number`,
          code: 'INVALID_NUMBER',
          field: foundField,
          value: value
        });
      }

      // Check for Infinity
      if (!isFinite(numValue)) {
        return res.status(400).json({
          success: false,
          error: `${foundField} must be a finite number`,
          code: 'INVALID_NUMBER',
          field: foundField,
          value: value
        });
      }

      // Check integer constraint
      if (integer && !Number.isInteger(numValue)) {
        return res.status(400).json({
          success: false,
          error: `${foundField} must be an integer`,
          code: 'INVALID_INTEGER',
          field: foundField,
          value: numValue
        });
      }

      // Check minimum value
      if (numValue < min) {
        return res.status(400).json({
          success: false,
          error: `${foundField} must be at least ${min}`,
          code: 'VALUE_TOO_LOW',
          field: foundField,
          value: numValue,
          min: min
        });
      }

      // Check maximum value
      if (numValue > max) {
        return res.status(400).json({
          success: false,
          error: `${foundField} must be at most ${max}`,
          code: 'VALUE_TOO_HIGH',
          field: foundField,
          value: numValue,
          max: max
        });
      }

      // Store validated numeric value in req for downstream use
      req.validatedNumericValue = numValue;
      req.validatedNumericField = foundField;
    }

    next();
  };
};

/**
 * Validate array of numeric values with range constraints
 * Useful for batch operations with amounts or counts
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.field - Field name containing the array (default: 'amounts')
 * @param {number} options.min - Minimum allowed value (inclusive, default: 0)
 * @param {number} options.max - Maximum allowed value (inclusive, default: Number.MAX_SAFE_INTEGER)
 * @param {boolean} options.integer - Whether values must be integers (default: false)
 * @param {number} options.maxLength - Maximum array length (default: 100)
 * @param {boolean} options.required - Whether the field is required (default: true)
 * @returns {Function} Express middleware function
 */
const validateNumericRangeArray = (options = {}) => {
  const {
    field = 'amounts',
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    integer = false,
    maxLength = 100,
    required = true
  } = options;

  return (req, res, next) => {
    const values = req.body[field];

    // Check if field exists
    if (!values && required) {
      return res.status(400).json({
        success: false,
        error: `${field} is required`,
        code: 'MISSING_FIELD'
      });
    }

    // If not required and not present, skip validation
    if (!values && !required) {
      return next();
    }

    // Validate it's an array
    if (!Array.isArray(values)) {
      return res.status(400).json({
        success: false,
        error: `${field} must be an array`,
        code: 'INVALID_ARRAY'
      });
    }

    // Check array is not empty
    if (values.length === 0) {
      return res.status(400).json({
        success: false,
        error: `${field} cannot be empty`,
        code: 'EMPTY_ARRAY'
      });
    }

    // Check array length
    if (values.length > maxLength) {
      return res.status(400).json({
        success: false,
        error: `${field} cannot contain more than ${maxLength} values`,
        code: 'ARRAY_TOO_LARGE',
        maxLength,
        actualLength: values.length
      });
    }

    // Validate each numeric value
    const validatedValues = [];
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      
      // Convert to number if it's a string
      const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);

      // Check if it's a valid number type
      if (typeof value !== 'number' && typeof value !== 'string') {
        return res.status(400).json({
          success: false,
          error: `Value at index ${i} must be a number`,
          code: 'INVALID_NUMBER_TYPE',
          index: i,
          value: value,
          receivedType: typeof value
        });
      }

      // Check for NaN
      if (isNaN(numValue)) {
        return res.status(400).json({
          success: false,
          error: `Value at index ${i} must be a valid number`,
          code: 'INVALID_NUMBER',
          index: i,
          value: value
        });
      }

      // Check for Infinity
      if (!isFinite(numValue)) {
        return res.status(400).json({
          success: false,
          error: `Value at index ${i} must be a finite number`,
          code: 'INVALID_NUMBER',
          index: i,
          value: value
        });
      }

      // Check integer constraint
      if (integer && !Number.isInteger(numValue)) {
        return res.status(400).json({
          success: false,
          error: `Value at index ${i} must be an integer`,
          code: 'INVALID_INTEGER',
          index: i,
          value: numValue
        });
      }

      // Check minimum value
      if (numValue < min) {
        return res.status(400).json({
          success: false,
          error: `Value at index ${i} must be at least ${min}`,
          code: 'VALUE_TOO_LOW',
          index: i,
          value: numValue,
          min: min
        });
      }

      // Check maximum value
      if (numValue > max) {
        return res.status(400).json({
          success: false,
          error: `Value at index ${i} must be at most ${max}`,
          code: 'VALUE_TOO_HIGH',
          index: i,
          value: numValue,
          max: max
        });
      }

      validatedValues.push(numValue);
    }

    // Store validated values in req for downstream use
    req.validatedNumericValues = validatedValues;

    next();
  };
};

/**
 * Validate array of NFT mint addresses
 * Enforces transaction size limits and validates each mint address
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.field - Field name containing the array (default: 'nftMints')
 * @param {number} options.maxLength - Maximum array length (default: 10)
 * @param {boolean} options.required - Whether the field is required (default: true)
 * @returns {Function} Express middleware function
 */
const validateNFTArray = (options = {}) => {
  const {
    field = 'nftMints',
    maxLength = 10,
    required = true
  } = options;

  return (req, res, next) => {
    const nftMints = req.body[field];

    // Check if field exists
    if (!nftMints && required) {
      return res.status(400).json({
        success: false,
        error: `${field} is required`,
        code: 'MISSING_FIELD'
      });
    }

    // If not required and not present, skip validation
    if (!nftMints && !required) {
      return next();
    }

    // Validate it's an array
    if (!Array.isArray(nftMints)) {
      return res.status(400).json({
        success: false,
        error: `${field} must be an array`,
        code: 'INVALID_ARRAY'
      });
    }

    // Check array is not empty
    if (nftMints.length === 0) {
      return res.status(400).json({
        success: false,
        error: `${field} cannot be empty`,
        code: 'EMPTY_ARRAY'
      });
    }

    // Check array length (transaction size limit)
    if (nftMints.length > maxLength) {
      return res.status(400).json({
        success: false,
        error: `${field} cannot contain more than ${maxLength} NFTs per transaction`,
        code: 'ARRAY_TOO_LARGE',
        maxLength,
        actualLength: nftMints.length
      });
    }

    // Validate each mint address
    for (let i = 0; i < nftMints.length; i++) {
      const mintAddress = nftMints[i];
      if (!authService.isValidSolanaAddress(mintAddress)) {
        return res.status(400).json({
          success: false,
          error: `Invalid NFT mint address at index ${i}: ${mintAddress}`,
          code: 'INVALID_MINT_ADDRESS',
          index: i,
          value: mintAddress
        });
      }
    }

    // Store validated NFT mints in req for downstream use
    req.validatedNFTMints = nftMints;

    next();
  };
};

module.exports = {
  validateWalletAddress,
  validateWalletAddressArray,
  validateTransactionHash,
  validateTransactionHashArray,
  validateNumericRange,
  validateNumericRangeArray,
  validateNFTArray
};
