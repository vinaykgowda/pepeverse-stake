// backend/src/utils/hashlistParser.test.js

const {
  isValidSolanaAddress,
  normalizeAddress,
  parseHashlist,
  serializeHashlist,
  isAddressInHashlist
} = require('./hashlistParser');

describe('hashlistParser', () => {
  // Valid Solana addresses for testing
  const validAddress1 = 'DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x';
  const validAddress2 = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  const validAddress3 = 'AKEWE7Bgh87GPvZbABgaBi2pzqUKbeT7rRvqBvBNqRqN';

  describe('isValidSolanaAddress', () => {
    it('should validate correct Solana addresses', () => {
      expect(isValidSolanaAddress(validAddress1)).toBe(true);
      expect(isValidSolanaAddress(validAddress2)).toBe(true);
      expect(isValidSolanaAddress(validAddress3)).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidSolanaAddress('')).toBe(false);
      expect(isValidSolanaAddress('invalid')).toBe(false);
      expect(isValidSolanaAddress('0x1234567890abcdef')).toBe(false);
      expect(isValidSolanaAddress(null)).toBe(false);
      expect(isValidSolanaAddress(undefined)).toBe(false);
      expect(isValidSolanaAddress(123)).toBe(false);
    });

    it('should reject addresses that are too short or too long', () => {
      expect(isValidSolanaAddress('short')).toBe(false);
      expect(isValidSolanaAddress('a'.repeat(100))).toBe(false);
    });
  });

  describe('normalizeAddress', () => {
    it('should normalize valid addresses', () => {
      expect(normalizeAddress(validAddress1)).toBe(validAddress1);
      expect(normalizeAddress(`  ${validAddress1}  `)).toBe(validAddress1);
    });

    it('should throw error for invalid addresses', () => {
      expect(() => normalizeAddress('invalid')).toThrow('Invalid Solana address');
      expect(() => normalizeAddress('')).toThrow('Invalid Solana address');
    });
  });

  describe('parseHashlist', () => {
    it('should parse valid newline-separated hashlist', () => {
      const hashlist = `${validAddress1}\n${validAddress2}\n${validAddress3}`;
      const result = parseHashlist(hashlist);

      expect(result.success).toBe(true);
      expect(result.addresses).toEqual([validAddress1, validAddress2, validAddress3]);
      expect(result.errors).toEqual([]);
    });

    it('should handle empty lines', () => {
      const hashlist = `${validAddress1}\n\n${validAddress2}\n\n\n${validAddress3}`;
      const result = parseHashlist(hashlist);

      expect(result.success).toBe(true);
      expect(result.addresses).toEqual([validAddress1, validAddress2, validAddress3]);
    });

    it('should handle whitespace around addresses', () => {
      const hashlist = `  ${validAddress1}  \n\t${validAddress2}\t\n ${validAddress3} `;
      const result = parseHashlist(hashlist);

      expect(result.success).toBe(true);
      expect(result.addresses).toEqual([validAddress1, validAddress2, validAddress3]);
    });

    it('should reject hashlist with invalid addresses', () => {
      const hashlist = `${validAddress1}\ninvalid_address\n${validAddress2}`;
      const result = parseHashlist(hashlist);

      expect(result.success).toBe(false);
      expect(result.addresses).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Line 2');
      expect(result.errors[0]).toContain('Invalid Solana address');
    });

    it('should reject duplicate addresses', () => {
      const hashlist = `${validAddress1}\n${validAddress2}\n${validAddress1}`;
      const result = parseHashlist(hashlist);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Duplicate address');
    });

    it('should reject empty or invalid input', () => {
      expect(parseHashlist('').success).toBe(false);
      expect(parseHashlist(null).success).toBe(false);
      expect(parseHashlist(undefined).success).toBe(false);
    });

    it('should handle single address', () => {
      const result = parseHashlist(validAddress1);

      expect(result.success).toBe(true);
      expect(result.addresses).toEqual([validAddress1]);
    });
  });

  describe('serializeHashlist', () => {
    it('should serialize array to newline-separated string', () => {
      const addresses = [validAddress1, validAddress2, validAddress3];
      const result = serializeHashlist(addresses);

      expect(result).toBe(`${validAddress1}\n${validAddress2}\n${validAddress3}`);
    });

    it('should throw error for invalid input', () => {
      expect(() => serializeHashlist('not an array')).toThrow('Addresses must be an array');
      expect(() => serializeHashlist(null)).toThrow('Addresses must be an array');
    });

    it('should throw error for array with invalid addresses', () => {
      const addresses = [validAddress1, 'invalid', validAddress2];
      expect(() => serializeHashlist(addresses)).toThrow('Invalid address in array');
    });

    it('should handle empty array', () => {
      const result = serializeHashlist([]);
      expect(result).toBe('');
    });
  });

  describe('isAddressInHashlist', () => {
    const hashlist = `${validAddress1}\n${validAddress2}\n${validAddress3}`;

    it('should find address in hashlist', () => {
      expect(isAddressInHashlist(validAddress1, hashlist)).toBe(true);
      expect(isAddressInHashlist(validAddress2, hashlist)).toBe(true);
      expect(isAddressInHashlist(validAddress3, hashlist)).toBe(true);
    });

    it('should not find address not in hashlist', () => {
      const notInList = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
      expect(isAddressInHashlist(notInList, hashlist)).toBe(false);
    });

    it('should handle invalid inputs', () => {
      expect(isAddressInHashlist('invalid', hashlist)).toBe(false);
      expect(isAddressInHashlist(validAddress1, 'invalid_hashlist')).toBe(false);
      expect(isAddressInHashlist('', hashlist)).toBe(false);
    });

    it('should handle whitespace in search address', () => {
      expect(isAddressInHashlist(`  ${validAddress1}  `, hashlist)).toBe(true);
    });
  });
});
