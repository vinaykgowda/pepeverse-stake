# Transaction Verification Service

## Overview

The Transaction Verification Service provides strict verification of Solana payment transactions for the NFT staking platform. It ensures that all payment transactions are valid before processing stakes or claims.

## Requirements Implemented

- **Requirement 14.1**: Verify amounts with 100,000 lamport tolerance (0.0001 SOL)
- **Requirement 14.2**: Wait for confirmation before DB updates
- **Requirement 14.3**: Verify signatures using RPC
- **Requirement 14.4**: Log failures with details
- **Requirement 14.5**: 15-second minimum timeout

## Features

### 1. Signature Verification

Verifies that a transaction signature exists on the blockchain and is valid.

```javascript
const result = await transactionVerification.verifySignature(signature);
// Returns: boolean
```

### 2. Confirmation Waiting

Waits for transaction confirmation with configurable timeout (minimum 15 seconds).

```javascript
const isConfirmed = await transactionVerification.waitForConfirmation(
  signature,
  timeoutMs // Optional, defaults to 15000ms
);
// Returns: boolean
```

### 3. Payment Verification

Verifies payment transaction details including sender, recipient, and amount.

```javascript
const result = await transactionVerification.verifyPayment(
  signature,
  fromWallet,
  toWallet,
  expectedAmountSOL
);
// Returns: { success: boolean, error?: string, details?: object }
```

### 4. Complete Verification Flow

Combines confirmation waiting and payment verification in a single call.

```javascript
const result = await transactionVerification.verifyPaymentWithConfirmation(
  signature,
  fromWallet,
  toWallet,
  expectedAmountSOL,
  timeoutMs // Optional, defaults to 15000ms
);
// Returns: { success: boolean, error?: string, details?: object }
```

## Configuration

The service is configured via environment variables:

- `MAINNET_RPC_PRIMARY`: Primary RPC endpoint (preferred)
- `SOLANA_RPC_URL`: Fallback RPC endpoint

### Constants

- `AMOUNT_TOLERANCE_LAMPORTS`: 100,000 lamports (0.0001 SOL)
- `CONFIRMATION_TIMEOUT_MS`: 15,000 milliseconds (15 seconds)

## Logging

The service implements comprehensive logging for all verification operations:

### Success Logs

```
✅ [TX-VERIFY] Signature verified: {signature}
✅ [TX-VERIFY] Transaction confirmed: {signature} ({elapsed}ms)
✅ [TX-VERIFY] Payment verified successfully: {details}
```

### Failure Logs

All failures are logged with detailed information (Requirement 14.4):

```
❌ [TX-VERIFY] Signature not found: {signature}
❌ [TX-VERIFY] Transaction failed: {signature} {error}
❌ [TX-VERIFY] Confirmation timeout: {signature} ({timeout}ms)
❌ [TX-VERIFY] Payment amount verification failed: {details}
❌ [TX-VERIFY] Sender wallet not found in transaction: {details}
❌ [TX-VERIFY] Recipient wallet not found in transaction: {details}
❌ [TX-VERIFY] Transaction failed on blockchain: {signature} {error}
❌ [TX-VERIFY] Fatal error verifying payment: {details}
```

Each failure log includes:
- Transaction signature
- Error message
- Relevant details (amounts, wallets, differences, etc.)
- Stack traces for exceptions

## Usage Examples

### Example 1: Verify Stake Payment

```javascript
const transactionVerification = require('./services/transactionVerification');

async function verifyStakePayment(signature, userWallet, feeWallet, totalFee) {
  const result = await transactionVerification.verifyPaymentWithConfirmation(
    signature,
    userWallet,
    feeWallet,
    totalFee
  );
  
  if (!result.success) {
    console.error('Payment verification failed:', result.error);
    throw new Error(result.error);
  }
  
  console.log('Payment verified:', result.details);
  return true;
}
```

### Example 2: Verify Claim Fee Payment

```javascript
async function verifyClaimFee(signature, userWallet, feeWallet, claimFee) {
  // Wait for confirmation first
  const isConfirmed = await transactionVerification.waitForConfirmation(
    signature,
    20000 // 20 second timeout
  );
  
  if (!isConfirmed) {
    throw new Error('Transaction not confirmed within timeout');
  }
  
  // Then verify payment details
  const result = await transactionVerification.verifyPayment(
    signature,
    userWallet,
    feeWallet,
    claimFee
  );
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  return result.details;
}
```

### Example 3: Quick Signature Check

```javascript
async function isTransactionValid(signature) {
  return await transactionVerification.verifySignature(signature);
}
```

## Amount Tolerance

The service uses a tolerance of 100,000 lamports (0.0001 SOL) when verifying payment amounts. This accounts for:

- Rounding differences in lamport conversion
- Small transaction fee variations
- Network precision differences

**Example:**
- Expected: 0.5 SOL (500,000,000 lamports)
- Received: 0.50005 SOL (500,050,000 lamports)
- Difference: 50,000 lamports
- Result: ✅ PASS (within 100,000 lamport tolerance)

**Example:**
- Expected: 0.5 SOL (500,000,000 lamports)
- Received: 0.50015 SOL (500,150,000 lamports)
- Difference: 150,000 lamports
- Result: ❌ FAIL (exceeds 100,000 lamport tolerance)

## Confirmation Timeout

The service enforces a minimum 15-second timeout for transaction confirmation (Requirement 14.5). This ensures:

- Sufficient time for network propagation
- Proper finality on mainnet
- Reduced false negatives from premature timeout

The timeout can be increased for specific use cases but cannot be reduced below 15 seconds.

## Error Handling

All errors are caught and logged with full details. The service never throws exceptions; instead, it returns structured error responses:

```javascript
{
  success: false,
  error: "Human-readable error message",
  details: {
    signature: "...",
    // Additional context-specific details
  }
}
```

This allows calling code to handle errors gracefully without try-catch blocks.

## Testing

The service includes comprehensive unit tests covering:

- Valid signature verification
- Invalid signature handling
- Confirmation waiting with various scenarios
- Payment verification with correct amounts
- Payment verification with tolerance boundaries
- Missing transaction handling
- Failed transaction handling
- Wrong wallet address detection
- RPC error handling
- Complete verification flow
- Configuration validation

Run tests:
```bash
npm test -- transactionVerification.test.js
```

## Integration

To integrate the verification service into existing payment flows:

1. Import the service:
```javascript
const transactionVerification = require('./services/transactionVerification');
```

2. Replace existing verification logic with service calls:
```javascript
// Old approach
const isValid = await verifyTransactionSignature(signature);

// New approach
const result = await transactionVerification.verifyPaymentWithConfirmation(
  signature,
  fromWallet,
  toWallet,
  expectedAmount
);

if (!result.success) {
  throw new Error(result.error);
}
```

3. Update database operations to occur AFTER verification:
```javascript
// Wait for confirmation before DB updates (Requirement 14.2)
const result = await transactionVerification.verifyPaymentWithConfirmation(...);

if (result.success) {
  // Now safe to update database
  await dbConnection.query('INSERT INTO transactions ...');
}
```

## Production Considerations

1. **RPC Endpoint**: Ensure `MAINNET_RPC_PRIMARY` is set to a reliable mainnet RPC endpoint
2. **Timeout Tuning**: Monitor confirmation times and adjust timeout if needed (minimum 15s)
3. **Logging**: All verification failures are logged automatically for debugging
4. **Monitoring**: Track verification success/failure rates in production
5. **Tolerance**: The 100,000 lamport tolerance is appropriate for most cases but can be adjusted if needed

## Security Notes

- The service verifies both sender and recipient addresses to prevent payment redirection
- Amount verification includes tolerance to handle precision differences
- All blockchain errors are logged for audit purposes
- Confirmation waiting prevents race conditions with database updates
- Signature verification ensures transaction authenticity

## Maintenance

The service is designed to be maintenance-free. Key points:

- No external dependencies beyond @solana/web3.js
- Singleton pattern ensures consistent configuration
- Comprehensive logging aids debugging
- Unit tests ensure reliability
- Clear error messages simplify troubleshooting
