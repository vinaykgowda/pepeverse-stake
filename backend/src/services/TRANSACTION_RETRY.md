# Transaction Retry Service

## Overview

The Transaction Retry Service provides robust transaction handling for Solana mainnet with automatic retry logic, exponential backoff, and priority fee management. This service is critical for production environments where network congestion and transaction failures are common.

## Features

### 1. Automatic Retry Logic (Requirement 33.1)
- **3 retry attempts** with exponential backoff
- Base delay: 1 second
- Backoff schedule:
  - Attempt 1: Immediate
  - Attempt 2: Wait 1 second
  - Attempt 3: Wait 2 seconds

### 2. Priority Fee Management (Requirement 33.2)
- **Increases priority fee with each retry**
- Base priority fee: 5,000 microlamports
- Fee schedule:
  - Attempt 1: 5,000 microlamports
  - Attempt 2: 10,000 microlamports
  - Attempt 3: 15,000 microlamports

### 3. Confirmation Timeout (Requirement 33.3)
- **60-second timeout** for transaction confirmation
- Checks transaction status every 2 seconds
- Returns false if timeout is reached

### 4. Status Checking (Requirement 33.4)
- **Checks transaction status before retry**
- Verifies if transaction was confirmed despite timeout
- Prevents duplicate transactions

### 5. Fresh Blockhash (Requirement 33.5)
- **Fetches recent blockhash before each attempt**
- Ensures transactions don't fail due to expired blockhash
- Uses `getLatestBlockhash()` with 'confirmed' commitment

## Usage

### Basic Usage

```javascript
const transactionRetryService = require('./services/transactionRetry');
const { SystemProgram, Keypair } = require('@solana/web3.js');

// Create instructions
const instruction = SystemProgram.transfer({
  fromPubkey: senderKeypair.publicKey,
  toPubkey: recipientPublicKey,
  lamports: 1000000
});

// Send with retry logic
try {
  const signature = await transactionRetryService.sendTransactionWithRetry(
    [instruction],
    senderKeypair,
    [] // Additional signers (optional)
  );
  
  console.log('Transaction confirmed:', signature);
} catch (error) {
  console.error('Transaction failed after all retries:', error);
}
```

### Integration with Existing Code

The service is already integrated into `solana-transaction-utils.js`:

```javascript
const { sendTransaction } = require('./solana-transaction-utils');

// This now uses the retry service automatically
const signature = await sendTransaction(
  [instruction],
  feePayer,
  signers
);
```

## Error Handling

### Non-Retryable Errors

The service will NOT retry for these errors:
- `insufficient funds` - User doesn't have enough SOL
- `invalid signature` - Signature verification failed
- `already processed` - Transaction already executed

These errors are permanent and retrying won't help.

### Retryable Errors

The service WILL retry for:
- Network timeouts
- RPC errors
- Transaction not confirmed in time
- Blockhash expired

## Configuration

```javascript
class TransactionRetryService {
  constructor() {
    this.maxRetries = 3;                    // Maximum retry attempts
    this.confirmationTimeout = 60000;       // 60 seconds
    this.baseDelayMs = 1000;                // 1 second base delay
    this.basePriorityFee = 5000;            // 5000 microlamports
  }
}
```

## Logging

The service provides detailed logging for debugging:

```
[TX Retry] Attempt 1/3
[TX Retry] Using blockhash: ABC123...
[TX Retry] Priority fee: 5000 microlamports
[TX Retry] Transaction sent: XYZ789...
[TX Retry] Explorer: https://explorer.solana.com/tx/XYZ789...
[TX Retry] ✅ Transaction confirmed: XYZ789...
```

## Testing

Comprehensive unit tests are provided in `transactionRetry.test.js`:

```bash
npm test -- src/services/transactionRetry.test.js
```

Tests cover:
- Blockhash fetching
- Status checking
- Priority fee increases
- Exponential backoff
- Timeout handling
- Error handling
- Confirmation waiting

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Application Code                                        │
│  (solana-rewards-handler.js, solana-nft-staking.js)    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  solana-transaction-utils.js                            │
│  sendTransaction()                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  TransactionRetryService                                │
│  - sendTransactionWithRetry()                           │
│  - _getRecentBlockhash()                                │
│  - _checkTransactionStatus()                            │
│  - _waitForConfirmation()                               │
│  - _addPriorityFee()                                    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Solana Network (Mainnet)                               │
│  - Primary RPC                                          │
│  - Fallback RPC                                         │
└─────────────────────────────────────────────────────────┘
```

## Best Practices

### 1. Always Use Retry Service for Mainnet
```javascript
// ✅ Good - Uses retry logic
const signature = await sendTransaction(instructions, feePayer);

// ❌ Bad - Direct sendAndConfirmTransaction (no retry)
const signature = await web3.sendAndConfirmTransaction(connection, tx, signers);
```

### 2. Handle Errors Appropriately
```javascript
try {
  const signature = await sendTransaction(instructions, feePayer);
  // Update database, notify user, etc.
} catch (error) {
  if (error.message.includes('insufficient funds')) {
    // User needs more SOL
    return res.status(400).json({ error: 'Insufficient funds' });
  }
  
  // Other errors - log and return 500
  console.error('Transaction failed:', error);
  return res.status(500).json({ error: 'Transaction failed' });
}
```

### 3. Monitor Transaction Status
```javascript
const signature = await sendTransaction(instructions, feePayer);

// Provide explorer link to user
const explorerUrl = networkConfig.getTransactionUrl(signature);
console.log('View transaction:', explorerUrl);
```

## Troubleshooting

### Transaction Times Out After 60 Seconds

**Cause**: Network congestion or RPC issues

**Solution**:
1. Check Solana network status
2. Verify RPC endpoints are healthy
3. Consider increasing priority fee base amount
4. Check if transaction was actually confirmed despite timeout

### All Retries Exhausted

**Cause**: Persistent network issues or invalid transaction

**Solution**:
1. Check transaction logs for specific error
2. Verify wallet has sufficient SOL
3. Verify transaction instructions are valid
4. Try again later if network is congested

### Priority Fees Too High

**Cause**: Base priority fee is set too high

**Solution**:
1. Adjust `basePriorityFee` in service configuration
2. Monitor average priority fees on mainnet
3. Consider dynamic fee calculation based on network conditions

## Performance Considerations

- **Average confirmation time**: 2-10 seconds on mainnet
- **Worst case**: 60 seconds (timeout)
- **Network overhead**: ~3-6 RPC calls per transaction (status checks)
- **Memory usage**: Minimal (no caching or state storage)

## Future Enhancements

Potential improvements for future versions:

1. **Dynamic Priority Fees**: Calculate fees based on current network conditions
2. **Configurable Timeouts**: Allow per-transaction timeout configuration
3. **Metrics Collection**: Track success rates, retry counts, confirmation times
4. **Circuit Breaker**: Temporarily disable retries if RPC is consistently failing
5. **Transaction Simulation**: Pre-flight simulation to catch errors early

## Related Documentation

- [Network Configuration](../config/NETWORK_CONFIG.md)
- [Transaction Verification](./TRANSACTION_VERIFICATION.md)
- [Solana Transaction Utils](../solana-transaction-utils.js)

## Requirements Mapping

- **Requirement 33.1**: Exponential backoff with 3 attempts ✅
- **Requirement 33.2**: Priority fee increases on retry ✅
- **Requirement 33.3**: 60-second confirmation timeout ✅
- **Requirement 33.4**: Status checking before retry ✅
- **Requirement 33.5**: Fresh blockhash for each transaction ✅
