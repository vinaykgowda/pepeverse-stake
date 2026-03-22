# Mainnet Unstake Flow Testing Guide

## Overview

This guide provides step-by-step instructions for testing the NFT unstaking flow on Solana mainnet. The test verifies that the unstake flow works correctly in production after the 24-hour minimum staking period.

**IMPORTANT - Non-Custodial Staking**: This platform uses NON-CUSTODIAL soft staking. When you unstake:
- Your NFT was ALWAYS in your wallet (it never left)
- No NFT transfer occurs on the blockchain
- The platform only removes the staking record from its database
- Unstaking is just a database operation - no blockchain transaction needed
- The 24-hour "lock" was just a database rule preventing early unstaking

**Requirements Addressed:**
- Requirement 35.2: Platform completes end-to-end testing of unstake flow with real SOL on mainnet
- Requirement 35.4: Platform verifies transaction fees are calculated correctly
- Requirement 35.5: Platform verifies wallet balance updates correctly after each transaction type

---

## Prerequisites

### 1. Wallet Setup

- **Mainnet Wallet**: The same Solana wallet used for stake testing
  - Minimum: 0.02 SOL (for transaction fees)
  - Recommended: 0.05 SOL (buffer for multiple tests)
- **Supported Wallets**: Phantom, Solflare, or any Solana Wallet Adapter compatible wallet
- **Backup**: Ensure you have your seed phrase backed up securely

### 2. Staked NFT

- **Previously Staked NFT**: An NFT that was staked at least 24 hours ago
- **Lock Period**: The 24-hour minimum stake duration must have elapsed
- **Verification**: Confirm the NFT appears in "Staked NFTs" section with lock period expired

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
- [ ] Wallet has at least 0.02 SOL available for transaction fees
- [ ] Test NFT has been staked for at least 24 hours
- [ ] Platform shows lock period has expired (remaining lock time = 0)
- [ ] Unstake button is enabled for the test NFT
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

2. **Record Staked NFT Details**
   ```
   NFT Mint Address: __________
   NFT Name: __________
   Collection: __________
   Staked At: __________
   Stake Duration: __________ hours
   Accumulated Rewards: __________ tokens
   ```

3. **Check Platform State**
   - Navigate to the staking dashboard
   - Verify NFT appears in "Staked NFTs" section
   - Confirm remaining lock time shows 0 or "Ready to unstake"
   - Screenshot the dashboard for reference

### Step 2: Initiate Unstake Transaction

**Purpose**: Test the unstake flow initiation

1. **Select NFT to Unstake**
   - Locate the staked NFT in the dashboard
   - Click on the "Unstake" button for the test NFT
   - Verify the unstake confirmation dialog appears

2. **Review Transaction Details**
   - Check that the platform displays:
     - NFT to be unstaked
     - Total stake duration
     - Accumulated rewards (if any)
     - Estimated transaction fee
     - Warning about rewards (if claiming separately)
   - Record the estimated fee:
     ```
     Estimated Transaction Fee: __________ SOL
     ```

3. **Submit Unstake Request**
   - Click "Confirm Unstake" or equivalent button
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
     - Confirmation that NFT is returned to wallet
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
   - [ ] Transaction type is correct (program interaction)
   - [ ] Transaction type is correct (database update only - no NFT transfer)
   - [ ] No NFT transfer occurs (NFT was always in user wallet)
   - [ ] Block confirmation not needed (database operation only)

3. **Record Actual Fee**
   ```
   Actual Transaction Fee: __________ SOL
   (Found in "Fee" field on explorer)
   ```

4. **Verify NFT Ownership (Non-Custodial)**
   - Check your wallet - NFT should STILL BE THERE (it never left)
   - Verify NFT was NOT transferred (it was always in your wallet)
   - Platform only removed staking record from database
   - Record verification:
     ```
     NFT Still in Wallet: [ ] Yes [ ] No (should be Yes)
     NFT Mint Address: __________
     Current Owner (should be your wallet): __________
     ```

### Step 6: Verify Platform State Update

**Purpose**: Confirm platform reflects database state

1. **Dashboard Update**
   - Return to staking platform dashboard
   - Refresh page if necessary
   - Verify:
     - [ ] Staked NFTs count decreased by 1
     - [ ] Test NFT no longer appears in "Staked NFTs" section
     - [ ] Success message displayed
     - [ ] No errors in console

2. **Available NFTs**
   - Check "Available NFTs" or "Wallet NFTs" section
   - Verify:
     - [ ] Test NFT now appears in available list
     - [ ] Available count increased by 1
     - [ ] NFT metadata displays correctly
     - [ ] NFT is selectable for re-staking

3. **Staking History (if available)**
   - Navigate to transaction history or staking history
   - Verify:
     - [ ] Unstake transaction is recorded
     - [ ] Timestamp is accurate
     - [ ] Stake duration is calculated correctly

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
   
   Expected Difference: Transaction Fee Only (negative)
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

### Step 8: Verify NFT in Wallet

**Purpose**: Confirm NFT ownership restored

1. **Check Wallet NFT Collection**
   - Open your Solana wallet
   - Navigate to NFTs/Collectibles section
   - Verify:
     - [ ] Test NFT appears in wallet
     - [ ] NFT image loads correctly
     - [ ] NFT metadata is intact
     - [ ] NFT is transferable (was never locked)

2. **Verify NFT Ownership on Explorer**
   - Search for NFT mint address on Solana Explorer
   - Check current owner field
   - Confirm owner is your wallet address:
     ```
     Current Owner: __________
     Expected Owner (Your Wallet): __________
     Match: [ ] Yes [ ] No
     ```

### Step 9: Verify Database State (Backend Access Required)

**Purpose**: Confirm database consistency (optional, requires backend access)

If you have access to the database or admin panel:

1. **Check staked_nfts Table**
   ```sql
   SELECT * FROM staked_nfts 
   WHERE mint_address = '[TEST_NFT_MINT]';
   ```
   - Verify record is deleted or marked as unstaked
   - If soft delete is used, check `unstaked_at` timestamp
   - Confirm no orphaned records exist

2. **Check transactions Table**
   ```sql
   SELECT * FROM transactions 
   WHERE transaction_hash = '[TRANSACTION_SIGNATURE]';
   ```
   - Verify transaction is recorded
   - Check `transaction_type` is 'unstake'
   - Check `nft_count` is 1
   - Check `collection_id` is set correctly
   - Verify timestamp matches transaction time

3. **Check Audit Logs**
   ```sql
   SELECT * FROM audit_logs 
   WHERE action LIKE '%unstake%' 
   ORDER BY timestamp DESC 
   LIMIT 5;
   ```
   - Verify unstake action is logged
   - Check timestamp matches transaction time
   - Confirm wallet address is recorded

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
- [ ] Dashboard shows NFT as unstaked
- [ ] Staked NFTs count decreased correctly
- [ ] NFT appears in available/wallet list
- [ ] Unstake timestamp is accurate
- [ ] No stale data or cache issues

#### Blockchain State
- [ ] NFT remains in user wallet (was always there - non-custodial)
- [ ] Database record removed
- [ ] No blockchain transaction needed (database operation only)
- [ ] No transaction errors or warnings
- [ ] NFT ownership updated correctly

#### Wallet State
- [ ] NFT visible in wallet
- [ ] NFT metadata intact
- [ ] NFT is transferable
- [ ] Balance updated correctly

#### Database State (if accessible)
- [ ] staked_nfts record removed or updated
- [ ] transactions record created for unstake
- [ ] All timestamps are accurate
- [ ] No orphaned records

### Acceptable Variations

Some minor variations are acceptable:

- **Fee Variation**: ±0.0001 SOL (100,000 lamports) due to network conditions
- **Confirmation Time**: 15-90 seconds depending on network congestion
- **UI Update Delay**: Up to 5 seconds for dashboard to reflect changes
- **Wallet Sync Delay**: Up to 10 seconds for NFT to appear in wallet

---

## Troubleshooting

### Issue: Unstake Button Disabled

**Symptoms**: Cannot click unstake button, button is grayed out

**Possible Causes**:
- 24-hour lock period not elapsed
- NFT not properly staked
- Platform state out of sync

**Resolution Steps**:
1. Check remaining lock time display
2. Verify at least 24 hours have passed since staking
3. Refresh page to update state
4. Disconnect and reconnect wallet
5. Check browser console for errors
6. Verify NFT is actually staked (check on explorer)

### Issue: Transaction Fails to Submit

**Symptoms**: Wallet doesn't show approval popup, or error occurs before wallet interaction

**Possible Causes**:
- Network configuration mismatch
- Insufficient SOL balance for fees
- NFT no longer staked (already unstaked)
- Rate limiting triggered
- Staking program error

**Resolution Steps**:
1. Verify wallet is connected to mainnet
2. Check SOL balance is sufficient (>0.01 SOL)
3. Confirm NFT is still staked (check on explorer)
4. Wait 1 minute and retry (rate limiting)
5. Check browser console for error messages
6. Verify platform network indicator shows "Mainnet"
7. Try refreshing page and reconnecting wallet

### Issue: Transaction Rejected by Wallet

**Symptoms**: Wallet shows transaction but user rejects or it fails

**Possible Causes**:
- Insufficient SOL for fees
- Wallet on wrong network
- Transaction timeout
- Blockhash expired
- Staking account closed

**Resolution Steps**:
1. Ensure wallet is on mainnet-beta
2. Check SOL balance includes fee buffer
3. Retry transaction immediately
4. If repeated failures, wait 30 seconds for new blockhash
5. Verify staking account still exists on explorer

### Issue: Transaction Pending for Too Long

**Symptoms**: Transaction submitted but not confirming after 90+ seconds

**Possible Causes**:
- Network congestion
- Low priority fee
- Transaction dropped
- RPC node issues

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
- WebSocket connection dropped

**Resolution Steps**:
1. Wait 10 seconds and refresh page
2. Clear browser cache and reload
3. Disconnect and reconnect wallet
4. Check transaction on explorer to confirm success
5. Verify NFT is in wallet (check wallet directly)
6. If explorer shows success but platform doesn't update after 5 minutes, contact support

### Issue: NFT Not Returned to Wallet

**Symptoms**: Transaction succeeds but NFT doesn't appear in wallet

**Possible Causes**:
- Wallet not synced yet
- NFT metadata not loaded
- Wallet cache issue
- Transaction actually failed

**Resolution Steps**:
1. Wait 30 seconds and refresh wallet
2. Check NFT is in your wallet (it should be - it never left)
3. Verify database shows NFT as unstaked
4. If still showing as staked, contact admin
   - Closing and reopening wallet
   - Switching networks and back to mainnet
   - Using a different wallet interface (e.g., Phantom web vs extension)
5. Clear wallet cache if option available
6. If NFT owner is still staking program after 5 minutes, contact support immediately

### Issue: Balance Discrepancy

**Symptoms**: Wallet balance decreased by more than transaction fee

**Possible Causes**:
- Multiple transactions occurred
- Rent reclaim not processed
- Other concurrent transactions
- Token account closure fee

**Resolution Steps**:
1. Check wallet transaction history for all recent transactions
2. Verify only one unstake transaction occurred
3. Check if rent was reclaimed (should add ~0.002 SOL back)
4. Review all transactions on Solana Explorer
5. Calculate total fees from all transactions
6. If unexplained discrepancy >0.01 SOL, contact support

### Issue: NFT Shows as Staked on Platform but Not on Blockchain

**Symptoms**: Platform shows NFT as staked but explorer shows it's in your wallet

**Possible Causes**:
- Database out of sync
- Previous unstake not recorded
- Cache serving stale data

**Resolution Steps**:
1. Refresh page multiple times
2. Clear browser cache completely
3. Check database directly if you have access
4. Verify current owner on Solana Explorer
5. If NFT is definitely in your wallet, it's a platform bug - report it
6. Do not attempt to stake again until issue is resolved

---

## Post-Test Validation

After completing the test, validate the following:

### Data Integrity
- [ ] All recorded data is accurate and complete
- [ ] Transaction signature is saved
- [ ] Screenshots are captured
- [ ] Balance calculations are correct
- [ ] NFT ownership is verified

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
- [ ] Verify NFT can be re-staked if needed
- [ ] Plan for claim rewards test (if not yet completed)

---

## Test Results Template

Use this template to document your test results:

```
MAINNET UNSTAKE FLOW TEST RESULTS
==================================

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
Staked At: __________
Stake Duration: __________ hours
Lock Period Expired: [ ] Yes [ ] No

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
NFT Unstaked Successfully: [ ] Yes [ ] No
NFT in Wallet: [ ] Yes [ ] No
Dashboard Updated: [ ] Yes [ ] No
Staked Count Decreased: [ ] Yes [ ] No

FEE VERIFICATION
----------------
Platform Estimated Fee: __________ SOL
Wallet Displayed Fee: __________ SOL
Explorer Recorded Fee: __________ SOL
Fee Discrepancy: __________ SOL
Within Tolerance (±0.0001 SOL): [ ] Yes [ ] No

NFT OWNERSHIP VERIFICATION
--------------------------
NFT Visible in Wallet: [ ] Yes [ ] No
NFT Owner on Explorer: __________
Expected Owner (Your Wallet): __________
Ownership Match: [ ] Yes [ ] No
NFT Still in Wallet: [ ] Yes [ ] No (should be Yes - non-custodial)

REQUIREMENTS VALIDATION
-----------------------
Req 35.2 - Unstake flow completed: [ ] Pass [ ] Fail
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
1. **Verify Lock Period**: Ensure 24 hours have passed since staking
2. **Check Balance**: Confirm sufficient SOL for transaction fees
3. **Backup Data**: Record all NFT details before unstaking
4. **Verify Platform**: Confirm you're on the legitimate platform URL

### During Testing
1. **Double-Check Network**: Always verify "Mainnet" indicator before transactions
2. **Review Fees**: Don't approve transactions with unexpectedly high fees
3. **One at a Time**: Complete one full test before attempting another
4. **Monitor Closely**: Watch for any unexpected behavior or errors
5. **Verify NFT**: Confirm the correct NFT is being unstaked

### After Testing
1. **Verify Ownership**: Confirm NFT is back in your wallet
2. **Check Metadata**: Ensure NFT data is intact
3. **Document Everything**: Save all transaction signatures and screenshots
4. **Report Issues**: Immediately report any security concerns or bugs
5. **Test Re-staking**: Optionally verify NFT can be staked again

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

## Comparison with Stake Flow

Understanding the differences between stake and unstake flows:

| Aspect | Stake Flow | Unstake Flow |
|--------|-----------|--------------|
| **NFT Direction** | Wallet → Staking Program | Staking Program → Wallet |
| **Prerequisites** | Own NFT, sufficient SOL | NFT staked 24+ hours |
| **Lock Period** | Starts 24-hour lock | Must wait for lock to expire |
| **Balance Change** | Decrease by fee only | Decrease by fee only |
| **Rewards** | Starts accumulating | Stops accumulating |
| **Reversibility** | Can unstake after 24h | Can re-stake immediately |
| **Common Issues** | Ownership verification | Lock period not expired |

---

## Conclusion

This guide provides a comprehensive framework for testing the mainnet unstake flow with real SOL. By following these procedures, you can verify that:

1. The unstake transaction completes successfully on mainnet after the lock period
2. Transaction fees are calculated and charged correctly
3. Wallet balances update accurately
4. The NFT is returned to the user's wallet
5. The platform state reflects blockchain state correctly
6. All requirements (35.2, 35.4, 35.5) are satisfied

Remember to document all results thoroughly and report any issues immediately. The unstake flow is critical for user trust, as it demonstrates that users can always retrieve their NFTs after the lock period.

**Important**: This is a production test with real SOL and real NFTs. Exercise caution, verify all state changes, and ensure the NFT is safely returned to your wallet before considering the test complete.

---

## Appendix: Lock Period Verification

### How to Verify Lock Period Has Expired

1. **Platform Display**
   - Check "Remaining Lock Time" field
   - Should show "0 hours" or "Ready to unstake"
   - Unstake button should be enabled (not grayed out)

2. **Manual Calculation**
   ```
   Staked At: [TIMESTAMP]
   Current Time: [TIMESTAMP]
   Elapsed Time: [DIFFERENCE IN HOURS]
   
   Lock Period Expired: [ELAPSED TIME >= 24 hours]
   ```

3. **Database Query (if accessible)**
   ```sql
   SELECT 
     mint_address,
     staked_at,
     NOW() - staked_at AS elapsed_time,
     CASE 
       WHEN NOW() - staked_at >= INTERVAL '24 hours' 
       THEN 'Expired' 
       ELSE 'Locked' 
     END AS lock_status
   FROM staked_nfts
   WHERE mint_address = '[TEST_NFT_MINT]';
   ```

### What If Lock Period Not Expired?

If you attempt to test before 24 hours:

- **Expected Behavior**: Unstake button should be disabled
- **Error Message**: "NFT is locked for 24 hours after staking"
- **Action**: Wait until lock period expires
- **Verification**: Platform should display remaining time

If the platform allows unstaking before 24 hours, this is a **critical bug** that violates Requirement 25.1 and must be reported immediately.
