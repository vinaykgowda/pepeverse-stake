// backend/src/utils/hashlistParser.js

/**
 * Hashlist Parser Utility
 * 
 * Standardizes hashlist format to newline-separated mint addresses
 * Requirements: 15.1, 15.2, 15.4
 */

const bs58 = require('bs58');

/**
 * Validate if a string is a valid Solana address
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid
 */
function isValidSolanaAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  try {
    // Solana addresses are base58 encoded and should be 32-44 characters
    if (address.length < 32 || address.length > 44) {
      return false;
    }

    // Try to decode as base58
    const decoded = bs58.decode(address);
    
    // Solana public keys are 32 bytes
    return decoded.length === 32;
  } catch (error) {
    return false;
  }
}

/**
 * Normalize address to base58 format
 * @param {string} address - Address to normalize
 * @returns {string} - Normalized address
 */
function normalizeAddress(address) {
  // Trim whitespace
  const trimmed = address.trim();
  
  // Validate it's a proper Solana address
  if (!isValidSolanaAddress(trimmed)) {
    throw new Error(`Invalid Solana address: ${trimmed}`);
  }
  
  // Return as-is since it's already in base58 format
  return trimmed;
}

/**
 * Parse hashlist from newline-separated format
 * Requirements: 15.1, 15.2, 15.4
 * 
 * @param {string} hashlistString - Newline-separated mint addresses
 * @returns {Object} - { success: boolean, addresses: string[], errors: string[] }
 */
function parseHashlist(hashlistString) {
  if (!hashlistString || typeof hashlistString !== 'string') {
    return {
      success: false,
      addresses: [],
      errors: ['Hashlist must be a non-empty string']
    };
  }

  const lines = hashlistString.split('\n');
  const addresses = [];
  const errors = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) {
      continue;
    }

    // Validate each address (Requirement 15.2)
    if (!isValidSolanaAddress(line)) {
      errors.push(`Line ${i + 1}: Invalid Solana address "${line}"`);
      continue;
    }

    try {
      // Normalize to base58 (Requirement 15.4)
      const normalized = normalizeAddress(line);
      
      // Check for duplicates
      if (seen.has(normalized)) {
        errors.push(`Line ${i + 1}: Duplicate address "${normalized}"`);
        continue;
      }
      
      seen.add(normalized);
      addresses.push(normalized);
    } catch (error) {
      errors.push(`Line ${i + 1}: ${error.message}`);
    }
  }

  // Requirement 15.3: Reject hashlists containing invalid addresses
  if (errors.length > 0) {
    return {
      success: false,
      addresses: [],
      errors
    };
  }

  return {
    success: true,
    addresses,
    errors: []
  };
}

/**
 * Convert hashlist to newline-separated string
 * @param {string[]} addresses - Array of addresses
 * @returns {string} - Newline-separated string
 */
function serializeHashlist(addresses) {
  if (!Array.isArray(addresses)) {
    throw new Error('Addresses must be an array');
  }

  // Validate and normalize each address
  const normalized = addresses.map(addr => {
    if (!isValidSolanaAddress(addr)) {
      throw new Error(`Invalid address in array: ${addr}`);
    }
    return normalizeAddress(addr);
  });

  return normalized.join('\n');
}

/**
 * Check if an address exists in a hashlist
 * @param {string} mintAddress - Address to check
 * @param {string} hashlistString - Newline-separated hashlist
 * @returns {boolean} - True if address exists
 */
function isAddressInHashlist(mintAddress, hashlistString) {
  const result = parseHashlist(hashlistString);
  
  if (!result.success) {
    return false;
  }

  // Normalize the search address
  try {
    const normalizedSearch = normalizeAddress(mintAddress);
    return result.addresses.includes(normalizedSearch);
  } catch (error) {
    return false;
  }
}

module.exports = {
  isValidSolanaAddress,
  normalizeAddress,
  parseHashlist,
  serializeHashlist,
  isAddressInHashlist
};
