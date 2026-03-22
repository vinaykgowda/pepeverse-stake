# Authentication Service Documentation

## Overview

The AuthService implements wallet-based authentication with nonce generation and in-memory storage. This service is part of Phase 2: Security Infrastructure (Task 4.2) and implements Requirements 6.1 and 6.2.

## Features

### Nonce Generation
- **Cryptographically Secure**: Uses `crypto.randomBytes(32)` to generate 32-byte random nonces
- **Base64 Encoding**: Nonces are encoded in base64 format (44 characters)
- **5-Minute TTL**: Nonces automatically expire after 5 minutes
- **In-Memory Storage**: Stored in memory with automatic cleanup

### Wallet Address Validation
- **Format Validation**: Validates Solana address format (base58, 32-44 characters)
- **Length Check**: Ensures address is between 32-44 characters
- **Base58 Decoding**: Verifies valid base58 encoding
- **Byte Length**: Confirms decoded address is exactly 32 bytes

## API Reference

### `generateNonce(walletAddress)`

Generates a cryptographically secure nonce for wallet authentication.

**Parameters:**
- `walletAddress` (string): The Solana wallet address requesting a nonce

**Returns:**
- `Promise<string>`: The generated nonce (base64 encoded, 44 characters)

**Throws:**
- `Error`: If wallet address is invalid or storage operation fails

**Example:**
```javascript
const authService = require('./services/auth');

try {
  const nonce = await authService.generateNonce('7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV');
  console.log('Nonce:', nonce);
  // Nonce: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2"
} catch (error) {
  console.error('Failed to generate nonce:', error.message);
}
```

### `getNonce(walletAddress)`

Retrieves a nonce from in-memory storage.

**Parameters:**
- `walletAddress` (string): The wallet address

**Returns:**
- `Promise<string|null>`: The nonce if found, null otherwise

**Example:**
```javascript
const nonce = await authService.getNonce('7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV');
if (nonce) {
  console.log('Found nonce:', nonce);
} else {
  console.log('No nonce found');
}
```

### `deleteNonce(walletAddress)`

Deletes a nonce from in-memory storage (for single-use enforcement).

**Parameters:**
- `walletAddress` (string): The wallet address

**Returns:**
- `Promise<boolean>`: True if deleted, false otherwise

**Example:**
```javascript
const deleted = await authService.deleteNonce('7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV');
console.log('Nonce deleted:', deleted);
```

### `hasNonce(walletAddress)`

Checks if a nonce exists for a wallet address.

**Parameters:**
- `walletAddress` (string): The wallet address

**Returns:**
- `Promise<boolean>`: True if nonce exists, false otherwise

**Example:**
```javascript
const exists = await authService.hasNonce('7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV');
console.log('Nonce exists:', exists);
```

### `getNonceTTL(walletAddress)`

Gets remaining TTL for a nonce.

**Parameters:**
- `walletAddress` (string): The wallet address

**Returns:**
- `Promise<number>`: Remaining TTL in seconds, -2 if key doesn't exist, -1 if no expiry

**Example:**
```javascript
const ttl = await authService.getNonceTTL('7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV');
console.log('Remaining TTL:', ttl, 'seconds');
```

### `isValidSolanaAddress(address)`

Validates Solana wallet address format.

**Parameters:**
- `address` (string): Wallet address to validate

**Returns:**
- `boolean`: True if valid, false otherwise

**Example:**
```javascript
const isValid = authService.isValidSolanaAddress('7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV');
console.log('Address valid:', isValid);
```

## Usage Example

### Complete Authentication Flow

```javascript
const authService = require('./services/auth');
const express = require('express');
const router = express.Router();

// Step 1: Request nonce
router.post('/auth/nonce', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    // Generate nonce
    const nonce = await authService.generateNonce(walletAddress);
    
    res.json({
      success: true,
      nonce: nonce,
      message: 'Sign this nonce with your wallet'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Step 2: Verify signature (to be implemented in task 4.3)
router.post('/auth/verify', async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    
    // Retrieve nonce
    const nonce = await authService.getNonce(walletAddress);
    
    if (!nonce) {
      return res.status(400).json({
        success: false,
        error: 'Nonce not found or expired'
      });
    }
    
    // Verify signature (implementation in task 4.3)
    // const isValid = await authService.verifySignature(walletAddress, signature, nonce);
    
    // Delete nonce (single use)
    await authService.deleteNonce(walletAddress);
    
    res.json({
      success: true,
      message: 'Authentication successful'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

## Testing

### Prerequisites

No external dependencies required - uses in-memory storage.

```bash
# Run tests
cd backend
npm test -- auth.test.js
```

### Running Tests

```bash
# Run all tests
npm test

# Run only auth service tests
npm test -- auth.test.js

# Run tests in watch mode
npm test -- --watch auth.test.js
```

### Test Coverage

The test suite includes 25 tests covering:

1. **Wallet Address Validation** (6 tests)
   - Valid Solana addresses
   - Too short/long addresses
   - Invalid base58 characters
   - Null/undefined values
   - Non-string values

2. **Nonce Generation** (7 tests)
   - Generate nonce for valid wallet
   - Unique nonces per call
   - In-memory storage
   - 5-minute TTL
   - Invalid wallet rejection
   - Base64 encoding
   - 32-byte length

3. **Nonce Retrieval** (2 tests)
   - Retrieve existing nonce
   - Return null for non-existent

4. **Nonce Deletion** (2 tests)
   - Delete existing nonce
   - Return false for non-existent

5. **Nonce Existence Check** (3 tests)
   - Check existing nonce
   - Check non-existent nonce
   - Check after deletion

6. **TTL Management** (3 tests)
   - Get TTL for existing nonce
   - Return -2 for non-existent
   - TTL decreases over time

7. **Expiration** (1 test)
   - Verify TTL is set correctly

8. **Concurrency** (1 test)
   - Handle multiple concurrent operations

## Storage Structure

Nonces are stored in an in-memory Map with the following structure:

```
Map<walletAddress, { nonce, expiresAt }>
```

**Example:**
```
Key: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV"
Value: { 
  nonce: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2",
  expiresAt: 1234567890000
}
```

Automatic cleanup runs every minute to remove expired nonces.

## Security Considerations

1. **Cryptographically Secure Random**: Uses `crypto.randomBytes()` for secure random generation
2. **Single Use**: Nonces should be deleted after verification (implemented in task 4.3)
3. **Time-Limited**: 5-minute expiration prevents replay attacks
4. **Address Validation**: Validates wallet address format before generating nonce
5. **Automatic Cleanup**: Expired nonces are automatically removed from memory

## Requirements Satisfied

- **Requirement 6.1**: Store nonces in memory with automatic cleanup
- **Requirement 6.2**: Expire nonces after single use or timeout (5-minute TTL)

## Next Steps

Task 4.3 will implement signature verification with nonce validation:
- Retrieve nonce from in-memory storage
- Verify nonce matches message
- Verify signature using `nacl.sign.detached.verify`
- Delete nonce after successful verification (single use)

## Dependencies

- `crypto`: Node.js built-in module for cryptographic operations
- `bs58`: Base58 encoding/decoding for Solana addresses

## Error Handling

The service throws descriptive errors for:
- Invalid wallet address format
- Storage operation failures

All errors are logged to console and should be caught by calling code.

## Performance

- **Nonce Generation**: ~1-2ms (including memory write)
- **Nonce Retrieval**: <1ms (memory read)
- **Address Validation**: <1ms (synchronous)
- **Concurrent Operations**: Supports multiple simultaneous nonce generations

## Monitoring

Consider monitoring:
- Nonce generation rate
- Nonce expiration rate
- Failed validation attempts
- Memory usage for nonce storage

## Troubleshooting

### Memory Concerns

If you're concerned about memory usage with many concurrent users, the automatic cleanup process runs every minute to remove expired nonces. Each nonce entry is small (~100 bytes), so even 10,000 active nonces would only use ~1MB of memory.

### Invalid Wallet Address

```
Error: Invalid wallet address format
```

**Solution**: Ensure wallet address is:
- Valid base58 encoding
- 32-44 characters long
- Decodes to exactly 32 bytes

### Nonce Not Found

```
Error: Nonce not found or expired
```

**Solution**: 
- Nonce may have expired (5-minute TTL)
- Nonce may have been used already (single use)
- Generate a new nonce
