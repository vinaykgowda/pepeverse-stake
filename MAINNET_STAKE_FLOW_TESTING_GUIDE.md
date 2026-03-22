# Mainnet Stake Flow Testing Guide

## Overview

This guide provides step-by-step instructions for testing the NFT staking flow on Solana mainnet with real SOL. The test uses a minimal amount (0.01 SOL recommended) to verify that the stake flow works correctly in production, including proper fee calculation and balance updates.

**IMPORTANT - Non-Custodial Staking**: This platform uses NON-CUSTODIAL soft staking. When you stake an NFT:
- Your NFT NEVER leaves your wallet
- No NFT transfer occurs on the blockchain
- The platform only records staking status in its database
- You can transfer your NFT anytime (but lose staking rewards if you do)
- The 24-hour "lock" is just a database rule preventing unstaking via platform

**Requirements Addressed:**
- Requirement 35.1: Platform completes end-to-end testing of stake flow with real SOL on mainnet
- Requirement 35.4: Platform verifies transaction fees are calculated correctly
- Requirement 35.5: Platform verifies wallet balance updates correctly after each transaction type

---

## Prerequisites

### 1. Wallet Setup

- **Mainnet Wallet**: A Solana wallet with sufficient SOL for testing
  - Minimum: 0.02 SOL (0.01 for testing + transaction fees)
  - Recommended: 0.05 SOL (buffer for multiple tests)
- **Supported Wallets**: Phantom, Solflare, or any Solana Wallet Adapter compatible wallet
- **Backup**: Ensure you have your seed phrase backed up securely

### 2. Test NFT

- **Eligible NFT**: An NFT from a collection configured in the staking platform
- **Ownership**: The test wallet must own the NFT
- **Verification**: Confirm the NFT appears in your wallet before testing

### 3. Environment Access

- **Platform URL**: Access to the deployed mainnet staking platform
- **Network Indicator**: Verify the platform shows "Mainnet" in the network indicator
- **Browser**: Modern browser with wallet extension installed

### 4. Monitoring Tools

- **Solana Explorer**: https://explorer.solana.com/ (for transaction verification)
- **Wallet Balance Tracker**: Notepad or spreadsheet to record balances
- **Browser DevTools**: For checking console logs and network requests

---

## Pre-Test Checklist

Before starting the test, complete this checklist:

- [ ] Wallet is connected to Solana mainnet (not devnet or testnet)
- [ ] Wallet has at least 0.02 SOL available
- [ ] Test NFT is visible in wallet and eligible for staking
- [ ] Platform network indicator shows "Mainnet"
- [ ] Browser DevTools console is open for monitoring
- [ ] Initial wallet balance is recorded
- [ ] Solana Explorer is open in another tab

---

## Test Procedure

### Step 1: Record Initial State

**Purpose**: Establish baseline for comparison

1. **Record Initial SOL Balance**
   ```
   Initial Balance: __________ SOL
   Timestamp: __________
   ```

2. **Record NFT Details**
   ```
   NFT Mint Address: __________
   NFT Name: __________
   Collection: __________
   ```

3. **Check Platform State**
   - Navigate to the staking dashboard
   - Verify no NFTs are currently staked (or record current staked count)
   - Screenshot the dashboard for reference

### Step 2: Initiate Stake Transaction

**Purpose**: Test the stake flow initiation

1. **Select NFT to Stake**
   - Click on the "Stake" or "Stake NFTs" button
   - Select the test NFT from the available NFTs list
   - Verify the NFT details are displayed correctly

2. **Review Transaction Details**
   - Check that the platform displays:
     - NFT to be staked
     - Expected rewards rate
     - Minimum stake duration (24 hours)
     - Estimated transaction fee
   - Record the estimated fee:
     ```
     Estimated Transaction Fee: __________ SOL
     ```

3. **Submit Stake Request**
   - Click "Confirm Stake" or equivalent button
   - Observe the loading state:
     - [ ] Loading spinner appears
     - [ ] Action buttons are disabled
     - [ ] Estimated transaction time is displayed

### Step 3: Approve Wallet Transaction

**Purpose**: Complete the blockchain transaction

1. **Wallet Popup Appears**
   - Verify wallet extension shows transaction approval request
   - Review transaction details in wallet:
     - Transaction type
     - Fee amount
     - Network (should be mainnet-beta)

2. **Record Wallet Fee**
   ```
   Wallet Displayed Fee: __________ SOL
   ```

3. **Approve Transaction**
   - Click "Approve" or "Confirm" in wallet
   - Wait for transaction to process
   - Note: This may take 15-60 seconds depending on network congestion

### Step 4: Monitor Transaction Confirmation

**Purpose**: Verify transaction processing

1. **Platform Loading State**
   - Observe the platform continues showing loading state
   - Check browser console for any errors
   - Wait for confirmation (typically 15-60 seconds)

2. **Transaction Signature**
   - When transaction completes, platform should display:
     - Success message
     - Transaction signature/hash
     - Link to Solana Explorer
   - Record the transaction signature:
     ```
     Transaction Signature: __________
     ```

3. **Copy Transaction Link**
   - Click the explorer link or copy the transaction signature
   - Open in Solana Explorer

### Step 5: Verify Transaction on Solana Explorer

**Purpose**: Confirm blockchain state

1. **Open Transaction in Explorer**
   - Navigate to: `https://explorer.solana.com/tx/[SIGNATURE]`
   - Verify transaction status shows "Success" or "Confirmed"

2. **Verify Transaction Details**
   - [ ] Transaction type is correct (database update only - no NFT transfer)
   - [ ] From address matches your wallet (for optional staking fee payment)
   - [ ] No NFT transfer occurs (non-custodial staking)
   - [ ] Block confirmation count is increasing (if fee payment required)

3. **Record Actual Fee**
   ```
   Actual Transaction Fee: __________ SOL
   (Found in "Fee" field on explorer)
   ```

4. **Verify NFT Ownership (Non-Custodial)**
   - Check your wallet - NFT should STILL BE THERE
   - Verify NFT was NOT transferred anywhere
   - Platform only records staking status in database
   - Record verification:
     ```
     NFT Still in Wallet: [ ] Yes [ ] No (should be Yes)
     NFT Mint Address: __________
     Current Owner (should be your wallet): __________
     ```

### Step 6: Verify Platform State Update

**Purpose**: Confirm platform reflects blockchain state

1. **Dashboard Update**
   - Return to staking platform dashboard
   - Refresh page if necessary
   - Verify:
     - [ ] Staked NFTs count increased by 1
     - [ ] Test NFT appears in "Staked NFTs" section
     - [ ] NFT shows correct staking timestamp
     - [ ] Remaining lock time displays (should be ~24 hours)

2. **NFT Details**
   - Click on the staked NFT to view details
   - Verify:
     - [ ] NFT metadata displays correctly
     - [ ] Staking start time is accurate
     - [ ] Rewards calculation is active
     - [ ] Unstake button is disabled (due to 24-hour lock)

3. **Available NFTs**
   - Check "Available NFTs" or "Wallet NFTs" section
   - Verify:
     - [ ] Test NFT is no longer in available list
     - [ ] Available count decreased by 1

### Step 7: Verify Wallet Balance Update

**Purpose**: Confirm correct fee deduction

1. **Check Current Balance**
   - Open wallet or check balance on platform
   - Record new balance:
     ```
     Final Balance: __________ SOL
     Timestamp: __________
     ```

2. **Calculate Balance Change**
   ```
   Initial Balance:     __________ SOL
   Final Balance:       __________ SOL
   Balance Difference:  __________ SOL
   
   Expected Difference: Transaction Fee Only
   Actual Fee Paid:     __________ SOL
   ```

3. **Verify Fee Accuracy**
   - Compare actual fee paid with:
     - Estimated fee from platform
     - Fee shown in wallet
     - Fee recorded on Solana Explorer
   - All values should match within 0.0001 SOL (100,000 lamports)
   - Record any discrepancies:
     ```
     Fee Discrepancy: __________ SOL
     Notes: __________
     ```

### Step 8: Verify Database State (Backend Access Required)

**Purpose**: Confirm database consistency (optional, requires backend access)

If you have access to the database or admin panel:

1. **Check staked_nfts Table**
   ```sql
   SELECT * FROM staked_nfts 
   WHERE mint_address = '[TEST_NFT_MINT]';
   ```
   - Verify record exists
   - Check `staked_at` timestamp is correct
   - Check `last_claim_timestamp` is set
   - Check `wallet_address` matches test wallet

2. **Check transactions Table**
   ```sql
   SELECT * FROM transactions 
   WHERE transaction_hash = '[TRANSACTION_SIGNATURE]';
   ```
   - Verify transaction is recorded
   - Check `transaction_type` is 'stake'
   - Check `nft_count` is 1
   - Check `collection_id` is set correctly

3. **Check Audit Logs**
   ```sql
   SELECT * FROM audit_logs 
   WHERE action LIKE '%stake%' 
   ORDER BY timestamp DESC 
   LIMIT 5;
   ```
   - Verify stake action is logged
   - Check timestamp matches transaction time

---

## Expected Results

### Success Criteria

The test is considered successful if ALL of the following are true:

#### Transaction Success
- [ ] Transaction completes without errors
- [ ] Transaction signature is generated
- [ ] Solana Explorer shows "Success" status
- [ ] Transaction confirms within 60 seconds

#### Fee Accuracy
- [ ] Estimated fee matches actual fee within 0.0001 SOL
- [ ] Wallet balance decreased by exactly the transaction fee
- [ ] No unexpected SOL deductions occurred
- [ ] Fee is reasonable (typically 0.000005 - 0.00001 SOL)

#### Platform State
- [ ] Dashboard shows NFT as staked
- [ ] Staked NFTs count increased correctly
- [ ] NFT removed from available list
- [ ] Staking timestamp is accurate
- [ ] Lock time displays correctly (~24 hours)
- [ ] Rewards calculation is active

#### Blockchain State
- [ ] Optional staking fee paid (if configured)
- [ ] NFT remains in user wallet (non-custodial)
- [ ] Transaction recorded on Solana mainnet (if fee payment)
- [ ] Block confirmations increasing (if fee payment)
- [ ] No transaction errors or warnings

#### Database State (if accessible)
- [ ] staked_nfts record created
- [ ] transactions record created
- [ ] All timestamps are accurate
- [ ] Foreign keys are correct

### Acceptable Variations

Some minor variations are acceptable:

- **Fee Variation**: ±0.0001 SOL (100,000 lamports) due to network conditions
- **Confirmation Time**: 15-90 seconds depending on network congestion
- **UI Update Delay**: Up to 5 seconds for dashboard to reflect changes

---

## Troubleshooting

### Issue: Transaction Fails to Submit

**Symptoms**: Wallet doesn't show approval popup, or error occurs before wallet interaction

**Possible Causes**:
- Network configuration mismatch
- Insufficient SOL balance
- NFT ownership verification failed
- Rate limiting triggered

**Resolution Steps**:
1. Verify wallet is connected to mainnet
2. Check SOL balance is sufficient (>0.02 SOL)
3. Confirm you own the NFT (check in wallet)
4. Wait 1 minute and retry (rate limiting)
5. Check browser console for error messages
6. Verify platform network indicator shows "Mainnet"

### Issue: Transaction Rejected by Wallet

**Symptoms**: Wallet shows transaction but user rejects or it fails

**Possible Causes**:
- Insufficient SOL for fees
- Wallet on wrong network
- Transaction timeout
- Blockhash expired

**Resolution Steps**:
1. Ensure wallet is on mainnet-beta
2. Check SOL balance includes fee buffer
3. Retry transaction immediately
4. If repeated failures, wait 30 seconds for new blockhash

### Issue: Transaction Pending for Too Long

**Symptoms**: Transaction submitted but not confirming after 90+ seconds

**Possible Causes**:
- Network congestion
- Low priority fee
- Transaction dropped

**Resolution Steps**:
1. Check Solana status: https://status.solana.com/
2. Search for transaction signature on explorer
3. If not found after 2 minutes, retry transaction
4. If found but pending, wait up to 5 minutes
5. Contact support if still pending after 5 minutes

### Issue: Platform Doesn't Update After Transaction

**Symptoms**: Transaction succeeds on blockchain but platform doesn't reflect change

**Possible Causes**:
- Cache not invalidated
- Database update failed
- Frontend polling issue

**Resolution Steps**:
1. Wait 10 seconds and refresh page
2. Clear browser cache and reload
3. Disconnect and reconnect wallet
4. Check transaction on explorer to confirm success
5. If explorer shows success but platform doesn't update after 5 minutes, contact support

### Issue: Balance Discrepancy

**Symptoms**: Wallet balance decreased by more than transaction fee

**Possible Causes**:
- Multiple transactions occurred
- Rent-exempt balance for token account
- Other concurrent transactions

**Resolution Steps**:
1. Check wallet transaction history for all recent transactions
2. Verify only one stake transaction occurred
3. Check if token account creation fee was charged (~0.002 SOL)
4. Review all transactions on Solana Explorer
5. Calculate total fees from all transactions
6. If unexplained discrepancy >0.01 SOL, contact support

### Issue: NFT Not Showing as Staked

**Symptoms**: Transaction succeeds but NFT doesn't appear in staked list

**Possible Causes**:
- Metadata fetch failed
- Collection verification failed
- Database sync issue

**Resolution Steps**:
1. Refresh page and wait 30 seconds
2. Verify NFT is still in your wallet (check on Solscan)
3. Check database to see if staking was recorded
4. If NFT is in wallet but not showing as staked, retry staking
5. Check browser console for errors
6. Contact support with transaction signature

---

## Post-Test Validation

After completing the test, validate the following:

### Data Integrity
- [ ] All recorded data is accurate and complete
- [ ] Transaction signature is saved
- [ ] Screenshots are captured
- [ ] Balance calculations are correct

### Documentation
- [ ] Test results are documented
- [ ] Any issues encountered are noted
- [ ] Discrepancies are explained
- [ ] Recommendations are recorded

### Follow-Up Actions
- [ ] Determine if test passed or failed
- [ ] Identify any bugs or issues
- [ ] Create tickets for any problems found
- [ ] Schedule retest if necessary
- [ ] Plan for unstake test (after 24-hour lock period)

---

## Test Results Template

Use this template to document your test results:

```
MAINNET STAKE FLOW TEST RESULTS
================================

Test Date: __________
Tester: __________
Platform URL: __________
Wallet Address: __________

INITIAL STATE
-------------
Initial SOL Balance: __________ SOL
Test NFT Mint: __________
Test NFT Name: __________
Collection: __________

TRANSACTION DETAILS
-------------------
Transaction Signature: __________
Estimated Fee: __________ SOL
Actual Fee: __________ SOL
Confirmation Time: __________ seconds
Explorer Link: __________

FINAL STATE
-----------
Final SOL Balance: __________ SOL
Balance Change: __________ SOL
NFT Staked Successfully: [ ] Yes [ ] No
Dashboard Updated: [ ] Yes [ ] No
Lock Time Displayed: [ ] Yes [ ] No

FEE VERIFICATION
----------------
Platform Estimated Fee: __________ SOL
Wallet Displayed Fee: __________ SOL
Explorer Recorded Fee: __________ SOL
Fee Discrepancy: __________ SOL
Within Tolerance (±0.0001 SOL): [ ] Yes [ ] No

REQUIREMENTS VALIDATION
-----------------------
Req 35.1 - Stake flow completed: [ ] Pass [ ] Fail
Req 35.4 - Fees calculated correctly: [ ] Pass [ ] Fail
Req 35.5 - Balance updated correctly: [ ] Pass [ ] Fail

ISSUES ENCOUNTERED
------------------
(List any issues, errors, or unexpected behavior)

OVERALL RESULT
--------------
[ ] PASS - All requirements met
[ ] FAIL - One or more requirements not met
[ ] PARTIAL - Some issues but core functionality works

NOTES
-----
(Additional observations, recommendations, or comments)

NEXT STEPS
----------
(Actions to take based on test results)
```

---

## Safety Recommendations

### Before Testing
1. **Use Minimal SOL**: Only load 0.05 SOL or less for testing
2. **Test Wallet**: Consider using a dedicated test wallet, not your main wallet
3. **Backup**: Ensure seed phrase is backed up before any mainnet transactions
4. **Verify Platform**: Confirm you're on the legitimate platform URL (check for phishing)

### During Testing
1. **Double-Check Network**: Always verify "Mainnet" indicator before transactions
2. **Review Fees**: Don't approve transactions with unexpectedly high fees
3. **One at a Time**: Complete one full test before attempting another
4. **Monitor Closely**: Watch for any unexpected behavior or errors

### After Testing
1. **Secure Wallet**: Lock wallet when not in use
2. **Document Everything**: Save all transaction signatures and screenshots
3. **Report Issues**: Immediately report any security concerns or bugs
4. **Plan Unstake**: Remember 24-hour lock period before unstake test

---

## Additional Resources

### Solana Network
- **Solana Explorer**: https://explorer.solana.com/
- **Solana Status**: https://status.solana.com/
- **Solana Docs**: https://docs.solana.com/

### Wallet Support
- **Phantom**: https://phantom.app/help
- **Solflare**: https://solflare.com/support

### Platform Support
- **Support Email**: [Your support email]
- **Discord**: [Your Discord link]
- **Documentation**: [Your docs link]

---

## Conclusion

This guide provides a comprehensive framework for testing the mainnet stake flow with real SOL. By following these procedures, you can verify that:

1. The stake transaction completes successfully on mainnet
2. Transaction fees are calculated and charged correctly
3. Wallet balances update accurately
4. The platform state reflects blockchain state
5. All requirements (35.1, 35.4, 35.5) are satisfied

Remember to document all results thoroughly and report any issues immediately. After the 24-hour lock period, you can proceed with the unstake flow test using a similar methodology.

**Important**: This is a production test with real SOL. Exercise caution, use minimal amounts, and ensure all safety measures are in place before proceeding.
