# Troubleshooting Guide

This guide covers common issues you may encounter with the Solana NFT Staking Platform and their solutions.

**IMPORTANT - Non-Custodial Architecture**: This platform uses NON-CUSTODIAL soft staking:
- NFTs never leave users' wallets
- No NFT transfers occur during stake/unstake
- Platform only tracks staking status in database
- 24-hour "lock" is a database rule, not a custody lock
- Users can transfer their NFTs anytime (but lose staking rewards)

## Table of Contents

1. [Deployment Issues](#deployment-issues)
2. [Database Connection Issues](#database-connection-issues)
3. [Wallet Connection Issues](#wallet-connection-issues)
4. [Transaction Issues](#transaction-issues)
5. [Authentication Issues](#authentication-issues)
6. [Rate Limiting Issues](#rate-limiting-issues)
7. [NFT Ownership Issues](#nft-ownership-issues)
8. [Reward Calculation Issues](#reward-calculation-issues)
9. [Frontend Issues](#frontend-issues)
10. [Performance Issues](#performance-issues)

---

## Deployment Issues

### Issue: Vercel Build Fails

**Symptoms**:
- Deployment fails during build phase
- Error messages in Vercel build logs

**Common Causes & Solutions**:

1. **Missing environment variables**
   ```
   Error: Environment variable DATABASE_URL is not defined
   ```
   **Solution**: Add all required environment variables in Vercel dashboard
   - Go to Settings → Environment Variables
   - Add missing variables
   - Redeploy

2. **Node version mismatch**
   ```
   Error: The engine "node" is incompatible with this module
   ```
   **Solution**: Specify Node version in `package.json`:
   ```json
   {
     "engines": {
       "node": ">=18.0.0"
     }
   }
   ```

3. **Dependency installation fails**
   ```
   Error: Cannot find module 'some-package'
   ```
   **Solution**: 
   - Verify `package.json` and `package-lock.json` are committed
   - Run `npm install` locally to regenerate lock file
   - Commit and push changes

### Issue: Deployment Succeeds but App Doesn't Work

**Symptoms**:
- Build completes successfully
- App loads but features don't work
- API calls fail

**Solutions**:

1. **Check environment variables**:
   - Verify all variables are set for Production environment
   - Check for typos in variable names
   - Ensure no trailing spaces in values

2. **Check CORS configuration**:
   - Verify `ALLOWED_ORIGINS` includes your Vercel domain
   - Format: `https://your-domain.vercel.app` (no trailing slash)

3. **Check API URL**:
   - Verify `VITE_API_URL` matches your backend URL
   - Should be your Vercel domain

---

## Database Connection Issues

### Issue: "Database connection failed"

**Symptoms**:
- Health endpoint returns `"database": "disconnected"`
- API calls return 503 errors
- Logs show database connection errors

**Solutions**:

1. **Verify connection string**:
   ```bash
   # Test connection locally
   psql "postgresql://user:pass@host/db?sslmode=require"
   ```
   - Ensure format is correct
   - Check username and password
   - Verify database name

2. **Check Neon DB status**:
   - Log in to Neon console
   - Verify project is not paused (auto-pauses after inactivity)
   - Click "Resume" if paused

3. **Check connection limits**:
   - Neon free tier: 100 connections
   - Check current connections in Neon dashboard
   - Upgrade plan if hitting limits

4. **Verify SSL mode**:
   - Connection string must include `?sslmode=require`
   - Neon requires SSL connections

### Issue: "Too many connections"

**Symptoms**:
```
Error: sorry, too many clients already
```

**Solutions**:

1. **Enable connection pooling**:
   - Use Neon's pooled connection string
   - In Neon console, copy "Pooled connection" string
   - Update `DATABASE_URL` environment variable

2. **Reduce connection timeout**:
   ```javascript
   // In backend/src/config/database.js
   connectionTimeoutMillis: 5000, // Reduce from 10000
   ```

3. **Upgrade Neon plan**:
   - Free tier: 100 connections
   - Pro tier: 1000+ connections

---

## Wallet Connection Issues

### Issue: Wallet Won't Connect

**Symptoms**:
- "Connect Wallet" button doesn't work
- Wallet popup doesn't appear
- Console shows wallet errors

**Solutions**:

1. **Check wallet extension installed**:
   - Verify Phantom, Solflare, or other wallet is installed
   - Try refreshing the page
   - Try different wallet

2. **Check network configuration**:
   - Verify wallet is set to Mainnet
   - In wallet settings, check network
   - Switch to Mainnet if on Devnet

3. **Clear browser cache**:
   - Clear site data for your domain
   - Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

4. **Check browser console**:
   - Open DevTools (F12)
   - Look for wallet-related errors
   - Common issue: wallet adapter not loaded

### Issue: "Wrong Network" Warning

**Symptoms**:
- Network indicator shows "Wrong Network"
- Transactions fail with network errors

**Solutions**:

1. **Switch wallet to Mainnet**:
   - Open wallet extension
   - Go to Settings → Network
   - Select "Mainnet Beta"

2. **Verify RPC endpoint**:
   - Check `VITE_SOLANA_RPC_URL` is mainnet URL
   - Should be: `https://api.mainnet-beta.solana.com`

---

## Transaction Issues

### Issue: Transaction Fails to Confirm

**Symptoms**:
- Transaction submitted but never confirms
- "Transaction timeout" error
- Transaction shows as pending indefinitely

**Solutions**:

1. **Check Solana network status**:
   - Visit https://status.solana.com
   - Check for network congestion or outages
   - Wait and retry if network is congested

2. **Increase confirmation timeout**:
   ```javascript
   // In transaction code
   const confirmation = await connection.confirmTransaction(
     signature,
     'confirmed', // or 'finalized' for more certainty
     { timeout: 60000 } // Increase timeout
   );
   ```

3. **Check transaction on explorer**:
   - Copy transaction signature
   - View on https://solscan.io
   - Check if transaction succeeded, failed, or is pending

4. **Retry with higher priority fee**:
   - Transaction may have been dropped due to low fee
   - Retry operation (system will increase priority fee)

### Issue: "Insufficient Funds" Error

**Symptoms**:
```
Error: Insufficient funds for transaction
```

**Solutions**:

1. **Check SOL balance**:
   - Verify wallet has enough SOL for:
     - Transaction fee (~0.000005 SOL)
     - Rent exemption for accounts (~0.002 SOL)
     - Any transfer amounts

2. **Add more SOL**:
   - Transfer SOL to wallet
   - Minimum recommended: 0.01 SOL

### Issue: Transaction Succeeds but Database Not Updated

**Symptoms**:
- Transaction confirms on-chain
- Database still shows old state
- Rewards not updated

**Solutions**:

1. **Check transaction verification**:
   - Backend verifies transactions before DB updates
   - Check logs for verification errors
   - Common issue: amount mismatch

2. **Verify transaction signature**:
   - Ensure correct signature is sent to backend
   - Check API request payload

3. **Check database logs**:
   - Look for database errors in Vercel logs
   - Check for constraint violations

---

## Authentication Issues

### Issue: "Invalid signature" Error

**Symptoms**:
```
Error: Signature verification failed
```

**Solutions**:

1. **Request new nonce**:
   - Call `/api/auth/nonce` again
   - Sign the new message
   - Submit within 5 minutes

2. **Check message format**:
   - Message must match exactly: `Sign this message to authenticate: {nonce}`
   - No extra spaces or characters

3. **Verify wallet is unlocked**:
   - Ensure wallet extension is unlocked
   - Try disconnecting and reconnecting

### Issue: "Nonce expired" Error

**Symptoms**:
```
Error: Nonce has expired
```

**Solutions**:

1. **Sign message faster**:
   - Nonces expire after 5 minutes
   - Request nonce and sign immediately

2. **Check system time**:
   - Verify your computer's clock is accurate
   - Sync time if needed

---

## Rate Limiting Issues

### Issue: "Too Many Requests" (429) Error

**Symptoms**:
```
Error: Rate limit exceeded. Please try again in X seconds.
```

**Solutions**:

1. **Wait for rate limit reset**:
   - Check `Retry-After` header for wait time
   - Wait specified seconds before retrying

2. **Check rate limits**:
   - Claim: 5 requests/minute per wallet
   - Stake: 20 requests/minute per wallet
   - Unstake: 20 requests/minute per wallet
   - Auth: 10 requests/minute per wallet

3. **Avoid rapid clicking**:
   - Don't spam buttons
   - Wait for transactions to complete

4. **Contact admin if legitimate use**:
   - If you're hitting limits with normal use
   - Admin can adjust limits in code

---

## NFT Ownership Issues

### Issue: "NFT ownership verification failed"

**Symptoms**:
```
Error: You do not own this NFT
```

**Solutions**:

1. **Verify NFT ownership**:
   - Check wallet on Solscan or Magic Eden
   - Ensure NFT is in connected wallet
   - Refresh page and try again

2. **Check NFT is not listed**:
   - If NFT is listed on marketplace, you may not be the owner
   - Cancel listing and try again

3. **Wait for Helius cache**:
   - Helius may have stale data
   - Wait 1-2 minutes and retry
   - Ownership data updates every ~30 seconds

### Issue: NFT Not Showing in Staking Interface

**Symptoms**:
- NFT is in wallet but doesn't appear in staking UI
- Other NFTs from collection appear

**Solutions**:

1. **Check collection is configured**:
   - Admin must add collection to platform
   - Contact admin if collection is missing

2. **Verify NFT is from correct collection**:
   - Check NFT's collection ID matches configured collection
   - Some NFTs may look similar but be from different collections

3. **Refresh NFT list**:
   - Disconnect and reconnect wallet
   - Hard refresh page (Cmd+Shift+R)

---

## Reward Calculation Issues

### Issue: Rewards Not Accumulating

**Symptoms**:
- Staked NFT shows 0 rewards
- Rewards don't increase over time

**Solutions**:

1. **Check minimum stake duration**:
   - Rewards may not show until minimum duration passes
   - Default: 24 hours
   - Check collection settings

2. **Verify collection reward rate**:
   - Admin must set reward rate > 0
   - Contact admin if rate is 0

3. **Check last claim timestamp**:
   - Rewards calculate from last claim or stake time
   - If recently claimed, rewards start from 0

### Issue: Reward Amount Seems Wrong

**Symptoms**:
- Calculated rewards don't match expected amount
- Rewards too high or too low

**Solutions**:

1. **Understand reward calculation**:
   ```
   Rewards = (current_time - last_claim_time) * reward_rate * trait_multiplier
   ```
   - Time in seconds
   - Reward rate in tokens per second
   - Trait multiplier (default: 1.0)

2. **Check trait multipliers**:
   - Some NFTs have trait multipliers
   - View in admin dashboard
   - Legendary traits may have 2x-5x multipliers

3. **Verify calculation window**:
   - Minimum window: 60 seconds
   - If claiming too quickly, may get 0 rewards

---

## Frontend Issues

### Issue: Page Won't Load

**Symptoms**:
- Blank white page
- Loading spinner forever
- Console shows errors

**Solutions**:

1. **Check browser console**:
   - Open DevTools (F12)
   - Look for JavaScript errors
   - Common issues:
     - API URL not set
     - CORS errors
     - Network errors

2. **Verify API is running**:
   ```bash
   curl https://your-domain.vercel.app/health
   ```
   - Should return `{"status": "healthy"}`
   - If not, check backend deployment

3. **Clear cache and reload**:
   - Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
   - Clear site data
   - Try incognito mode

### Issue: "Network Error" in Console

**Symptoms**:
```
Error: Network Error
Failed to fetch
```

**Solutions**:

1. **Check CORS configuration**:
   - Verify `ALLOWED_ORIGINS` includes your domain
   - Check for typos
   - Ensure no trailing slashes

2. **Verify API URL**:
   - Check `VITE_API_URL` is correct
   - Should match your backend domain
   - Include `https://` prefix

3. **Check backend is running**:
   - Test health endpoint
   - Check Vercel deployment status

### Issue: UI Shows Stale Data

**Symptoms**:
- Staked NFTs don't appear after staking
- Rewards don't update
- Balance doesn't change

**Solutions**:

1. **Refresh data**:
   - Most UIs have a refresh button
   - Disconnect and reconnect wallet
   - Reload page

2. **Check transaction confirmed**:
   - Verify transaction on Solscan
   - Wait for confirmation (5-30 seconds)

3. **Clear cache**:
   - Backend may have cached data
   - Wait for cache TTL (5 minutes for collections)

---

## Performance Issues

### Issue: Slow API Responses

**Symptoms**:
- API calls take >5 seconds
- Timeouts
- Poor user experience

**Solutions**:

1. **Check database performance**:
   - Log in to Neon console
   - Check query performance metrics
   - Look for slow queries

2. **Verify indexes exist**:
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'staked_nfts';
   ```
   - Should see indexes on frequently queried columns
   - Run migration 003 if missing

3. **Check Helius API**:
   - Helius may be slow during high traffic
   - Check Helius status page
   - Consider upgrading Helius plan

4. **Monitor Vercel function duration**:
   - Check Vercel dashboard for function metrics
   - Look for functions exceeding 5 seconds
   - Optimize slow functions

### Issue: High Database Connection Count

**Symptoms**:
- Neon dashboard shows many connections
- "Too many connections" errors
- Slow queries

**Solutions**:

1. **Use connection pooling**:
   - Switch to Neon's pooled connection string
   - Reduces connection overhead

2. **Check for connection leaks**:
   - Ensure all queries use `client.release()`
   - Check for unclosed connections in code

3. **Reduce connection timeout**:
   ```javascript
   connectionTimeoutMillis: 5000
   ```

---

## Getting Help

If you've tried the solutions above and still have issues:

1. **Check Vercel Logs**:
   - Go to Vercel dashboard → Logs
   - Look for error messages
   - Note the timestamp and error details

2. **Check Neon DB Logs**:
   - Go to Neon console → Monitoring
   - Look for query errors
   - Check connection issues

3. **Review Documentation**:
   - [User Guide](USER_GUIDE.md) - For user-facing features
   - [Admin Guide](ADMIN_GUIDE.md) - For platform management
   - [API Documentation](API_DOCUMENTATION.md) - For API details
   - [Deployment Guide](DEPLOYMENT_GUIDE.md) - For deployment issues

4. **Check Transaction on Explorer**:
   - Copy transaction signature
   - View on https://solscan.io or https://explorer.solana.com
   - Check transaction status and logs

5. **Test with Minimal Setup**:
   - Try with a fresh wallet
   - Test with small amounts
   - Isolate the issue

## Common Error Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Authentication failed |
| 403 | Forbidden | Ownership verification failed |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Backend error (check logs) |
| 503 | Service Unavailable | Database or RPC connection failed |

## Debug Mode

To enable verbose logging for debugging:

1. **Backend**:
   ```bash
   # In Vercel environment variables
   LOG_LEVEL=debug
   ```

2. **Frontend**:
   ```javascript
   // In browser console
   localStorage.setItem('debug', 'true');
   ```

3. **Check logs**:
   - Backend: Vercel dashboard → Logs
   - Frontend: Browser DevTools → Console

## Health Check Checklist

When troubleshooting, verify these basics:

- [ ] Health endpoint returns "healthy"
- [ ] Database connection works
- [ ] RPC connection works
- [ ] Wallet connects successfully
- [ ] Network is set to Mainnet
- [ ] Environment variables are set correctly
- [ ] CORS is configured properly
- [ ] API URL is correct
- [ ] Sufficient SOL in wallet
- [ ] No rate limiting active

## Prevention Tips

To avoid common issues:

1. **Monitor regularly**:
   - Check Vercel Analytics daily
   - Review error logs weekly
   - Monitor database performance

2. **Test before deploying**:
   - Run all tests locally
   - Test on staging environment
   - Verify environment variables

3. **Keep dependencies updated**:
   - Update npm packages regularly
   - Check for security vulnerabilities
   - Test after updates

4. **Document changes**:
   - Keep changelog updated
   - Document configuration changes
   - Note any custom modifications

5. **Have rollback plan**:
   - Keep previous deployment ready
   - Test rollback procedures
   - Document rollback steps
