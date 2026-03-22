# Mainnet Claim Rewards Flow Testing Guide

## Overview

This guide provides step-by-step instructions for testing the reward claiming flow on Solana mainnet. The test verifies that the claim rewards flow works correctly in production, including proper reward calculation and token transfers. Due to the 60-second minimum window for reward calculations, this test requires careful timing.

**IMPORTANT - Non-Custodial Staking**: This platform uses NON-CUSTODIAL soft staking:
- Your NFT is ALWAYS in your wallet (never transferred)
- Claiming rewards only transfers reward tokens to you
- No NFT movement occurs during claim
- Platform verifies you still own the NFT before distributing rewards

**Requirements Addressed:**
- Requirement 35.3: Platform completes end-to-end testing of reward claim flow with real SOL on mainnet
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

### 2. Staked NFT with Accumulated Rewards

- **Previously Staked NFT**: An NFT that has been staked for at least 60 seconds
- **Minimum Wait Time**: 60 seconds since last claim (or initial stake)
- **Verification**: Confirm the NFT shows accumulated rewards in the dashboard

### 3. Environment Access

- **Platform URL**: Access to the deployed mainnet staking platform
- **Network Indicator**: Verify the platform shows "Mainnet" in the network indicator
- **Browser**: Modern browser with wallet extension installed

### 4. Monitoring Tools

- **Solana Explorer**: https://explorer.solana.com/ (for transaction verification)
- **Wallet Balance Tracker**: Notepad or spreadsheet to record balances
- **Browser DevTools**: For checking console logs and network requests
- **Timer**: To track 60-second minimum window between claims

---

## Pre-Test Checklist

Before starting the test, complete this checklist:

- [ ] Wallet is connected to Solana mainnet (not devnet or testnet)
- [ ] Wallet has at least 0.02 SOL available for transaction fees
- [ ] Test NFT has been staked for at least 60 seconds
- [ ] At least 60 seconds have passed since last claim (if any)
- [ ] Platform shows accumulated rewards for the staked NFT
- [ ] Claim rewards button is enabled
- [ ] Platform network indicator shows "Mainnet"
- [ ] Browser DevTools console is open for monitoring
- [ ] Initial wallet balance is recorded
- [ ] Solana Explorer is open in another tab
- [ ] Timer is ready to track claim timing

---

## Test Procedure

### Step 1: Record Initial State

**Purpose**: Establish baseline for comparison

1. **Record Initial SOL Balance**
   ```
   Initial SOL Balance: __________ SOL
   Timestamp: __________
   ```

2. **Record Initial Reward Token Balance (if applicable)**
   ```
   Initial Reward Token Balance: __________ tokens
   Token Mint Address: __________
   Timestamp: __________
   ```

3. **Record Staked NFT Details**
   ```
   NFT Mint Address: __________
   NFT Name: __________
   Collection: __________
   Staked At: __________
   Last Claim Timestamp: __________
   Time Since Last Claim: __________ seconds
   Accumulated Rewards Displayed: __________ tokens
   ```

4. **Check Platform State**
   - Navigate to the staking dashboard
   - Verify NFT appears in "Staked NFTs" section
   - Confirm accumulated rewards are displayed
   - Screenshot the dashboard showing rewards amount

### Step 2: Verify Minimum Wait Time

**Purpose**: Ensure 60-second minimum window has elapsed

1. **Calculate Time Since Last Claim**
   ```
   Last Claim Time: __________
   Current Time: __________
   Elapsed Time: __________ seconds
   
   Minimum Met (>= 60 seconds): [ ] Yes [ ] No
   ```

2. **Wait if Necessary**
   - If less than 60 seconds have elapsed, wait until 60 seconds pass
   - Use a timer to track the exact wait time
   - Refresh the dashboard to see updated reward amount

3. **Verify Claim Button State**
   - Confirm "Claim Rewards" button is enabled (not grayed out)
   - If disabled, check for error messages or timing restrictions

### Step 3: Initiate Claim Rewards Transaction

**Purpose**: Test the claim rewards flow initiation

1. **Select NFT for Claim**
   - Locate the staked NFT in the dashboard
   - Click on the "Claim Rewards" button for the test NFT
   - Verify the claim confirmation dialog appears

2. **Review Transaction Details**
   - Check that the platform displays:
     - NFT being claimed from
     - Accumulated rewards amount
     - Reward calculation period
     - Estimated transaction fee
     - Expected reward token destination
   - Record the displayed information:
     ```
     Displayed Rewards Amount: __________ tokens
     Reward Calculation Period: __________ seconds
     Estimated Transaction Fee: __________ SOL
     ```

3. **Verify Reward Calculation**
   - Manually calculate expected rewards:
     ```
     Time Since Last Claim: __________ seconds
     Reward Rate: __________ tokens/second
     Expected Rewards: __________ tokens
     Platform Displayed: __________ tokens
     Match: [ ] Yes [ ] No
     Discrepancy: __________ tokens
     ```

4. **Submit Claim Request**
   - Click "Confirm Claim" or equivalent button
   - Observe the loading state:
     - [ ] Loading spinner appears
     - [ ] Action buttons are disabled
     - [ ] Estimated transaction time is displayed

### Step 4: Approve Wallet Transaction

**Purpose**: Complete the blockchain transaction

1. **Wallet Popup Appears**
   - Verify wallet extension shows transaction approval request
   - Review transaction details in wallet:
     - Transaction type
     - Fee amount
     - Network (should be mainnet-beta)
     - Token transfers (if reward tokens)

2. **Record Wallet Fee**
   ```
   Wallet Displayed Fee: __________ SOL
   ```

3. **Approve Transaction**
   - Click "Approve" or "Confirm" in wallet
   - Wait for transaction to process
   - Note: This may take 15-60 seconds depending on network congestion

### Step 5: Monitor Transaction Confirmation

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
     - Confirmation of rewards claimed
     - Updated reward balance (should be 0 or reset)
   - Record the transaction signature:
     ```
     Transaction Signature: __________
     Claim Completion Time: __________
     ```

3. **Copy Transaction Link**
   - Click the explorer link or copy the transaction signature
   - Open in Solana Explorer

### Step 6: Verify Transaction on Solana Explorer

**Purpose**: Confirm blockchain state

1. **Open Transaction in Explorer**
   - Navigate to: `https://explorer.solana.com/tx/[SIGNATURE]`
   - Verify transaction status shows "Success" or "Confirmed"

2. **Verify Transaction Details**
   - [ ] Transaction type is correct (program interaction)
   - [ ] From address is the staking program
   - [ ] To address matches your wallet (for reward tokens)
   - [ ] Transaction includes token transfer (if applicable)
   - [ ] Block confirmation count is increasing

3. **Record Actual Fee**
   ```
   Actual Transaction Fee: __________ SOL
   (Found in "Fee" field on explorer)
   ```

4. **Verify Reward Token Transfer**
   - Check "Token Balances" section
   - Verify reward tokens were transferred to your wallet
   - Record the transfer details:
     ```
     Reward Tokens Transferred: __________ tokens
     From (Staking Program): __________
     To (Your Wallet): __________
     ```

### Step 7: Verify Platform State Update

**Purpose**: Confirm platform reflects blockchain state

1. **Dashboard Update**
   - Return to staking platform dashboard
   - Refresh page if necessary
   - Verify:
     - [ ] Accumulated rewards reset to 0 (or very small amount)
     - [ ] Last claim timestamp updated to current time
     - [ ] NFT still shows as staked
     - [ ] Success message displayed
     - [ ] No errors in console

2. **NFT Details**
   - Click on the staked NFT to view details
   - Verify:
     - [ ] Last claim timestamp is accurate
     - [ ] Accumulated rewards shows 0 or minimal amount
     - [ ] Staking status unchanged (still staked)
     - [ ] Claim button is disabled (60-second cooldown)

3. **Rewards History (if available)**
   - Navigate to transaction history or rewards history
   - Verify:
     - [ ] Claim transaction is recorded
     - [ ] Timestamp is accurate
     - [ ] Reward amount matches claimed amount
     - [ ] Transaction signature is displayed

### Step 8: Verify Wallet Balance Updates

**Purpose**: Confirm correct fee deduction and reward receipt

1. **Check Current SOL Balance**
   - Open wallet or check balance on platform
   - Record new balance:
     ```
     Final SOL Balance: __________ SOL
     Timestamp: __________
     ```

2. **Calculate SOL Balance Change**
   ```
   Initial SOL Balance:     __________ SOL
   Final SOL Balance:       __________ SOL
   SOL Balance Difference:  __________ SOL
   
   Expected Difference: Transaction Fee Only (negative)
   Actual Fee Paid:     __________ SOL
   ```

3. **Check Reward Token Balance**
   - Open wallet and check reward token balance
   - Record new balance:
     ```
     Final Reward Token Balance: __________ tokens
     Timestamp: __________
     ```

4. **Calculate Reward Token Balance Change**
   ```
   Initial Reward Token Balance: __________ tokens
   Final Reward Token Balance:   __________ tokens
   Token Balance Increase:       __________ tokens
   
   Expected Increase: Displayed Rewards Amount
   Actual Increase:   __________ tokens
   Match: [ ] Yes [ ] No
   Discrepancy: __________ tokens
   ```

5. **Verify Fee Accuracy**
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

### Step 9: Verify Reward Calculation Accuracy

**Purpose**: Confirm rewards were calculated correctly

1. **Manual Reward Calculation**
   ```
   Staking Start Time: __________
   Last Claim Time: __________
   Current Claim Time: __________
   
   Time Period for Rewards: __________ seconds
   Reward Rate: __________ tokens/second
   
   Manual Calculation: __________ tokens
   Platform Displayed: __________ tokens
   Actual Received: __________ tokens
   
   Calculation Accurate: [ ] Yes [ ] No
   Discrepancy: __________ tokens
   ```

2. **Verify Minimum Window Enforcement**
   - Confirm at least 60 seconds elapsed since last claim
   - Verify platform enforced the minimum window
   - Check that rewards were calculated for the full period

3. **Check for Timing Exploits**
   - Verify no rewards were granted for periods less than 60 seconds
   - Confirm timestamp updates prevent double-claiming
   - Check database consistency (if accessible)

### Step 10: Verify Database State (Backend Access Required)

**Purpose**: Confirm database consistency (optional, requires backend access)

If you have access to the database or admin panel:

1. **Check staked_nfts Table**
   ```sql
   SELECT * FROM staked_nfts 
   WHERE mint_address = '[TEST_NFT_MINT]';
   ```
   - Verify `last_claim_timestamp` is updated to claim time
   - Check NFT is still marked as staked
   - Verify `staked_at` timestamp unchanged

2. **Check transactions Table**
   ```sql
   SELECT * FROM transactions 
   WHERE transaction_hash = '[TRANSACTION_SIGNATURE]';
   ```
   - Verify transaction is recorded
   - Check `transaction_type` is 'claim' or 'claim_rewards'
   - Check reward amount is recorded
   - Verify timestamp matches transaction time

3. **Check Audit Logs**
   ```sql
   SELECT * FROM audit_logs 
   WHERE action LIKE '%claim%' 
   ORDER BY timestamp DESC 
   LIMIT 5;
   ```
   - Verify claim action is logged
   - Check timestamp matches transaction time
   - Confirm wallet address and reward amount are recorded

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
- [ ] Wallet SOL balance decreased by exactly the transaction fee
- [ ] No unexpected SOL deductions occurred
- [ ] Fee is reasonable (typically 0.000005 - 0.00001 SOL)

#### Reward Calculation Accuracy
- [ ] Rewards calculated correctly based on time period
- [ ] Minimum 60-second window enforced
- [ ] Reward amount matches platform display
- [ ] Reward tokens received match calculated amount
- [ ] No timing exploits possible

#### Platform State
- [ ] Dashboard shows updated last claim timestamp
- [ ] Accumulated rewards reset to 0
- [ ] NFT remains staked
- [ ] Claim button disabled for 60 seconds
- [ ] Success message displayed

#### Blockchain State
- [ ] Reward tokens transferred to user wallet
- [ ] Transaction recorded on Solana mainnet
- [ ] Block confirmations increasing
- [ ] No transaction errors or warnings

#### Wallet State
- [ ] SOL balance decreased by fee only
- [ ] Reward token balance increased by claimed amount
- [ ] All balances accurate and verifiable

#### Database State (if accessible)
- [ ] last_claim_timestamp updated
- [ ] transactions record created for claim
- [ ] All timestamps are accurate
- [ ] NFT still marked as staked

### Acceptable Variations

Some minor variations are acceptable:

- **Fee Variation**: ±0.0001 SOL (100,000 lamports) due to network conditions
- **Reward Variation**: ±0.01 tokens due to rounding or timing precision
- **Confirmation Time**: 15-90 seconds depending on network congestion
- **UI Update Delay**: Up to 5 seconds for dashboard to reflect changes

---

## Troubleshooting

### Issue: Claim Button Disabled

**Symptoms**: Cannot click claim button, button is grayed out

**Possible Causes**:
- 60-second minimum window not elapsed
- No accumulated rewards
- NFT not properly staked
- Platform state out of sync

**Resolution Steps**:
1. Check time since last claim (must be >= 60 seconds)
2. Verify accumulated rewards are displayed
3. Refresh page to update state
4. Disconnect and reconnect wallet
5. Check browser console for errors
6. Verify NFT is actually staked (check on explorer)

### Issue: Transaction Fails to Submit

**Symptoms**: Wallet doesn't show approval popup, or error occurs before wallet interaction

**Possible Causes**:
- Network configuration mismatch
- Insufficient SOL balance for fees
- NFT no longer staked
- Rate limiting triggered (5 claims per minute)
- Reward calculation error

**Resolution Steps**:
1. Verify wallet is connected to mainnet
2. Check SOL balance is sufficient (>0.01 SOL)
3. Confirm NFT is still staked (check on explorer)
4. Wait 1 minute and retry (rate limiting)
5. Check browser console for error messages
6. Verify platform network indicator shows "Mainnet"
7. Try refreshing page and reconnecting wallet

### Issue: Reward Calculation Mismatch

**Symptoms**: Displayed rewards don't match expected calculation

**Possible Causes**:
- Incorrect reward rate
- Time calculation error
- Previous claim not recorded
- Clock skew between client and server

**Resolution Steps**:
1. Verify reward rate for the collection
2. Check last claim timestamp in database
3. Manually calculate expected rewards
4. Compare with platform display
5. Check for any rate changes or updates
6. If significant discrepancy (>10%), report as bug

### Issue: Transaction Rejected by Wallet

**Symptoms**: Wallet shows transaction but user rejects or it fails

**Possible Causes**:
- Insufficient SOL for fees
- Wallet on wrong network
- Transaction timeout
- Blockhash expired
- Reward token account doesn't exist

**Resolution Steps**:
1. Ensure wallet is on mainnet-beta
2. Check SOL balance includes fee buffer
3. Verify reward token account exists (may need creation fee)
4. Retry transaction immediately
5. If repeated failures, wait 30 seconds for new blockhash

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
5. Verify reward tokens are in wallet
6. If explorer shows success but platform doesn't update after 5 minutes, contact support

### Issue: Rewards Not Received in Wallet

**Symptoms**: Transaction succeeds but reward tokens don't appear in wallet

**Possible Causes**:
- Wallet not synced yet
- Token account not created
- Wrong token mint address
- Transaction actually failed

**Resolution Steps**:
1. Wait 30 seconds and refresh wallet
2. Check transaction on explorer to verify token transfer
3. Verify token mint address matches expected reward token
4. Check if token account creation was needed (may require separate transaction)
5. Try importing token manually in wallet using mint address
6. If tokens transferred on explorer but not in wallet after 5 minutes, contact wallet support

### Issue: Balance Discrepancy

**Symptoms**: Wallet balance changed by more than expected

**Possible Causes**:
- Multiple transactions occurred
- Token account creation fee charged (~0.002 SOL)
- Other concurrent transactions
- Rent-exempt balance for new account

**Resolution Steps**:
1. Check wallet transaction history for all recent transactions
2. Verify only one claim transaction occurred
3. Check if token account creation fee was charged
4. Review all transactions on Solana Explorer
5. Calculate total fees from all transactions
6. If unexplained discrepancy >0.01 SOL, contact support

### Issue: Claim Cooldown Not Enforced

**Symptoms**: Can claim rewards again immediately after claiming

**Possible Causes**:
- Frontend validation bypassed
- Backend validation missing
- Database timestamp not updated
- Critical security bug

**Resolution Steps**:
1. **DO NOT EXPLOIT** - This is a critical bug
2. Document the issue with screenshots
3. Record transaction signatures
4. Report immediately to development team
5. Do not attempt multiple rapid claims
6. This violates Requirement 13 and must be fixed before mainnet launch

---

## Post-Test Validation

After completing the test, validate the following:

### Data Integrity
- [ ] All recorded data is accurate and complete
- [ ] Transaction signature is saved
- [ ] Screenshots are captured
- [ ] Balance calculations are correct
- [ ] Reward calculations are verified

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
- [ ] Verify can claim again after 60 seconds

---

## Test Results Template

Use this template to document your test results:

```
MAINNET CLAIM REWARDS FLOW TEST RESULTS
========================================

Test Date: __________
Tester: __________
Platform URL: __________
Wallet Address: __________

INITIAL STATE
-------------
Initial SOL Balance: __________ SOL
Initial Reward Token Balance: __________ tokens
Test NFT Mint: __________
Test NFT Name: __________
Collection: __________
Staked At: __________
Last Claim Timestamp: __________
Time Since Last Claim: __________ seconds
Accumulated Rewards Displayed: __________ tokens

REWARD CALCULATION
------------------
Time Period: __________ seconds
Reward Rate: __________ tokens/second
Expected Rewards: __________ tokens
Platform Displayed: __________ tokens
Calculation Match: [ ] Yes [ ] No
Discrepancy: __________ tokens

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
SOL Balance Change: __________ SOL
Final Reward Token Balance: __________ tokens
Reward Tokens Received: __________ tokens
Last Claim Timestamp Updated: [ ] Yes [ ] No
Accumulated Rewards Reset: [ ] Yes [ ] No
Dashboard Updated: [ ] Yes [ ] No

FEE VERIFICATION
----------------
Platform Estimated Fee: __________ SOL
Wallet Displayed Fee: __________ SOL
Explorer Recorded Fee: __________ SOL
Fee Discrepancy: __________ SOL
Within Tolerance (±0.0001 SOL): [ ] Yes [ ] No

REWARD VERIFICATION
-------------------
Expected Reward Amount: __________ tokens
Platform Displayed Amount: __________ tokens
Actual Received Amount: __________ tokens
Reward Discrepancy: __________ tokens
Within Tolerance (±0.01 tokens): [ ] Yes [ ] No

TIMING VERIFICATION
-------------------
Minimum 60s Window Enforced: [ ] Yes [ ] No
Last Claim Timestamp Updated: [ ] Yes [ ] No
Claim Cooldown Active: [ ] Yes [ ] No

REQUIREMENTS VALIDATION
-----------------------
Req 35.3 - Claim flow completed: [ ] Pass [ ] Fail
Req 35.4 - Fees calculated correctly: [ ] Pass [ ] Fail
Req 35.5 - Balance updated correctly: [ ] Pass [ ] Fail
Req 13 - 60s minimum window enforced: [ ] Pass [ ] Fail

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
5. **Understand Timing**: Be aware of the 60-second minimum window requirement

### During Testing
1. **Double-Check Network**: Always verify "Mainnet" indicator before transactions
2. **Review Fees**: Don't approve transactions with unexpectedly high fees
3. **Track Timing**: Use a timer to ensure 60-second window has elapsed
4. **One at a Time**: Complete one full test before attempting another
5. **Monitor Closely**: Watch for any unexpected behavior or errors
6. **Verify Amounts**: Check reward amounts match expectations before claiming

### After Testing
1. **Verify Balances**: Confirm both SOL and reward token balances are correct
2. **Document Everything**: Save all transaction signatures and screenshots
3. **Report Issues**: Immediately report any security concerns or bugs
4. **Test Cooldown**: Optionally wait 60 seconds and test claiming again
5. **Check Exploit Prevention**: Verify rapid claims are prevented

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

## Comparison with Other Flows

Understanding the differences between transaction flows:

| Aspect | Stake Flow | Unstake Flow | Claim Rewards Flow |
|--------|-----------|--------------|-------------------|
| **Asset Direction** | NFT: Wallet → Program | NFT: Program → Wallet | Tokens: Program → Wallet |
| **Prerequisites** | Own NFT, sufficient SOL | NFT staked 24+ hours | NFT staked 60+ seconds |
| **Timing Requirement** | None | 24-hour lock period | 60-second minimum window |
| **Balance Change** | SOL decreases by fee | SOL decreases by fee | SOL decreases by fee, tokens increase |
| **NFT Status** | Becomes staked | Becomes unstaked | Remains staked |
| **Rewards** | Starts accumulating | Stops accumulating | Resets to 0, continues accumulating |
| **Reversibility** | Can unstake after 24h | Can re-stake immediately | Can claim again after 60s |
| **Rate Limiting** | 20 req/min | 20 req/min | 5 req/min |
| **Common Issues** | Ownership verification | Lock period not expired | Timing window not met |

---

## Conclusion

This guide provides a comprehensive framework for testing the mainnet claim rewards flow with real SOL. By following these procedures, you can verify that:

1. The claim rewards transaction completes successfully on mainnet
2. Reward calculations are accurate and based on correct time periods
3. The 60-second minimum window is enforced to prevent timing exploits
4. Transaction fees are calculated and charged correctly
5. Wallet balances (both SOL and reward tokens) update accurately
6. The platform state reflects blockchain state correctly
7. All requirements (35.3, 35.4, 35.5, and 13) are satisfied

Remember to document all results thoroughly and report any issues immediately. The claim rewards flow is critical for user experience and platform security, as it involves reward distribution and must prevent timing exploits.

**Important**: This is a production test with real SOL and real reward tokens. Exercise caution, verify all calculations, track timing carefully, and ensure the 60-second minimum window is properly enforced before considering the test complete.

---

## Appendix A: Reward Calculation Verification

### Manual Reward Calculation Formula

```
Rewards = (Current Time - Last Claim Time) × Reward Rate

Where:
- Current Time: Timestamp when claim is processed
- Last Claim Time: Timestamp of last claim (or staking time if never claimed)
- Reward Rate: Tokens per second for the collection
```

### Example Calculation

```
Scenario:
- NFT staked at: 2024-01-15 10:00:00
- Last claim at: 2024-01-15 10:05:00
- Current claim at: 2024-01-15 10:07:30
- Reward rate: 0.01 tokens/second

Calculation:
- Time since last claim: 150 seconds (2 minutes 30 seconds)
- Expected rewards: 150 × 0.01 = 1.5 tokens

Verification:
- Platform should display: ~1.5 tokens
- Wallet should receive: ~1.5 tokens
- Acceptable variance: ±0.01 tokens
```

### Common Calculation Errors

1. **Using Staking Time Instead of Last Claim Time**
   - Incorrect: Current Time - Staking Time
   - Correct: Current Time - Last Claim Time
   - Impact: Rewards double-counted

2. **Not Enforcing Minimum Window**
   - Incorrect: Allow claims every second
   - Correct: Enforce 60-second minimum
   - Impact: Timing exploits possible

3. **Rounding Errors**
   - Acceptable: ±0.01 tokens due to floating point
   - Unacceptable: >0.1 tokens discrepancy
   - Impact: User trust and fairness

---

## Appendix B: 60-Second Window Enforcement

### Why 60 Seconds?

The 60-second minimum window (Requirement 13) prevents:

1. **Rapid Claim Exploits**: Users claiming every second to maximize rewards
2. **Database Race Conditions**: Concurrent claims causing double-rewards
3. **Network Spam**: Excessive transactions congesting the network
4. **Gas Fee Waste**: Users spending more on fees than earning in rewards

### How to Verify Enforcement

1. **Attempt Rapid Claims**
   - Claim rewards successfully
   - Immediately try to claim again
   - Expected: Button disabled or error message
   - If successful: **CRITICAL BUG** - report immediately

2. **Check Database Timestamps**
   ```sql
   SELECT 
     mint_address,
     last_claim_timestamp,
     NOW() - last_claim_timestamp AS time_since_claim
   FROM staked_nfts
   WHERE mint_address = '[TEST_NFT_MINT]';
   ```
   - Verify last_claim_timestamp updates on each claim
   - Confirm backend checks this timestamp

3. **Monitor Frontend State**
   - Claim button should disable after successful claim
   - Should re-enable after 60 seconds
   - Timer should display remaining cooldown time

### Security Implications

If the 60-second window is not enforced:

- **High Severity**: Users can exploit timing to claim excess rewards
- **Financial Impact**: Platform loses tokens to exploiters
- **Mainnet Blocker**: Must be fixed before production launch
- **Requirement Violation**: Fails Requirement 13

**Action**: If this test reveals the window is not enforced, immediately halt mainnet deployment and fix the issue.

