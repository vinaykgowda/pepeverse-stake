# Solana NFT Staking Platform - Admin Guide

## Overview

This guide provides comprehensive instructions for platform administrators to manage the Solana NFT Staking Platform. It covers collection management, reward configuration, monitoring, troubleshooting, and security best practices.

**IMPORTANT - Non-Custodial Architecture**: This platform uses NON-CUSTODIAL soft staking. NFTs never leave users' wallets. The platform only:
- Tracks which NFTs are "staked" in the database
- Verifies ownership via Helius API when users claim rewards or unstake
- Enforces a 24-hour minimum staking period (database rule, not custody lock)
- Users can transfer their NFTs anytime (they just lose staking rewards if they do)

---

## Table of Contents

1. [Admin Access](#admin-access)
2. [Dashboard Overview](#dashboard-overview)
3. [Collection Management](#collection-management)
4. [Reward Configuration](#reward-configuration)
5. [User Management](#user-management)
6. [Monitoring & Analytics](#monitoring--analytics)
7. [Database Management](#database-management)
8. [Security & Audit Logs](#security--audit-logs)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance Procedures](#maintenance-procedures)

---

## Admin Access

### Authentication

Admins authenticate using wallet signature verification:

1. **Connect Admin Wallet**
   - Use your designated admin wallet
   - Connect through the platform
   - Sign authentication message

2. **Admin Verification**
   - Backend verifies wallet address against admin list
   - Admin privileges granted upon successful verification

3. **Session Management**
   - Sessions expire after inactivity
   - Re-authenticate when session expires

### Admin Wallet Configuration

Admin wallets are configured in the backend:

```javascript
// backend/middleware/admin.js
const ADMIN_WALLETS = [
  'AdminWallet1Address...',
  'AdminWallet2Address...',
  'AdminWallet3Address...'
];
```

**To add a new admin:**
1. Add wallet address to `ADMIN_WALLETS` array
2. Deploy updated code
3. Verify access in admin dashboard

### Security Best Practices

1. **Use Hardware Wallet**: Ledger or Trezor for admin operations
2. **Separate Admin Wallet**: Don't use personal wallet for admin tasks
3. **Multi-Signature**: Consider multi-sig for critical operations
4. **Regular Audits**: Review admin actions in audit logs
5. **Principle of Least Privilege**: Grant minimum necessary permissions

---

## Dashboard Overview

### Admin Dashboard Sections

#### 1. **Collections Panel**
- View all collections
- Add/edit/remove collections
- Configure reward rates
- Upload hashlists
- Enable/disable collections

#### 2. **Rewards Panel**
- View reward statistics
- Configure reward rates
- Monitor reward distribution
- Adjust trait multipliers

#### 3. **Users Panel**
- View active users
- Monitor staking activity
- View user statistics
- Handle user issues

#### 4. **Analytics Panel**
- Platform metrics
- Transaction volumes
- Reward distribution
- Performance metrics

#### 5. **Audit Logs Panel**
- View all admin actions
- Filter by action type
- Export logs
- Monitor security events

#### 6. **System Health Panel**
- Database status
- RPC connectivity
- Cache statistics
- Error rates

---

## Collection Management

### Adding a New Collection

#### Step 1: Prepare Collection Data

Gather the following information:
- Collection name
- Collection symbol
- Creator address
- Verified creator address
- Collection metadata URI
- Hashlist of eligible NFT mint addresses


#### Step 2: Create Hashlist File

Create a newline-separated file with NFT mint addresses:

```
MintAddress1111111111111111111111111
MintAddress2222222222222222222222222
MintAddress3333333333333333333333333
```

**Hashlist Requirements:**
- One mint address per line
- Valid Solana addresses (base58, 32-44 characters)
- No commas, brackets, or JSON formatting
- UTF-8 encoding

#### Step 3: Add Collection via Admin Panel

1. Navigate to "Collections" panel
2. Click "Add New Collection"
3. Fill in collection details:
   - Name
   - Symbol
   - Creator address
   - Description
4. Upload hashlist file
5. Click "Create Collection"

#### Step 4: Configure Reward Rate

1. Select the newly created collection
2. Click "Configure Rewards"
3. Set daily reward rate (tokens per day)
4. Set reward token address
5. Enable rewards
6. Click "Save"

#### Step 5: Verify Collection

1. Check collection appears in user dashboard
2. Test staking with an NFT from the collection
3. Verify rewards accumulate correctly
4. Monitor for any errors

### Editing a Collection

#### Update Collection Details

1. Navigate to "Collections" panel
2. Select collection to edit
3. Click "Edit"
4. Update fields as needed
5. Click "Save Changes"

**Editable Fields:**
- Collection name
- Description
- Active status
- Hashlist (add/remove NFTs)

**Non-Editable Fields:**
- Collection ID
- Creator address (requires new collection)

#### Update Hashlist

**Add NFTs to Collection:**
1. Select collection
2. Click "Manage Hashlist"
3. Click "Add NFTs"
4. Upload new hashlist or paste addresses
5. Click "Add"
6. Verify NFTs are added

**Remove NFTs from Collection:**
1. Select collection
2. Click "Manage Hashlist"
3. Select NFTs to remove
4. Click "Remove Selected"
5. Confirm removal

**Replace Entire Hashlist:**
1. Select collection
2. Click "Manage Hashlist"
3. Click "Replace Hashlist"
4. Upload new hashlist file
5. Confirm replacement
6. Verify all NFTs are updated

### Disabling a Collection

**Temporary Disable:**
1. Select collection
2. Toggle "Active" status to OFF
3. Click "Save"

**Effects:**
- Users cannot stake new NFTs from this collection
- Existing staked NFTs continue earning rewards
- Users can still claim and unstake

**Permanent Removal:**
1. Ensure no NFTs are currently staked from this collection
2. Select collection
3. Click "Delete Collection"
4. Confirm deletion
5. Collection is removed from database

**Warning:** Deleting a collection with staked NFTs will cause issues. Always disable first and wait for all NFTs to be unstaked.

---

## Reward Configuration

### Setting Reward Rates

#### Configure Daily Reward Rate

1. Navigate to "Rewards" panel
2. Select collection
3. Click "Configure Reward Rate"
4. Enter daily rate (tokens per day per NFT)
5. Set effective date (optional)
6. Click "Save"

**Example:**
- Daily rate: 10 tokens/day
- User stakes for 1 day
- User earns: 10 tokens

#### Reward Rate Best Practices

1. **Start Conservative**: Begin with lower rates and increase if needed
2. **Monitor Supply**: Ensure sufficient reward tokens available
3. **Gradual Changes**: Avoid sudden large rate changes
4. **Communicate**: Announce rate changes to community
5. **Test First**: Test rate changes on staging before production

### Configuring Trait Multipliers

Some NFTs earn bonus rewards based on traits:

#### Add Trait Multiplier

1. Navigate to "Rewards" panel
2. Select collection
3. Click "Trait Multipliers"
4. Click "Add Multiplier"
5. Enter trait name
6. Enter multiplier value (e.g., 1.5 for 50% bonus)
7. Click "Save"

**Example Multipliers:**
- Common traits: 1.0x (no bonus)
- Uncommon traits: 1.25x
- Rare traits: 1.5x
- Legendary traits: 2.0x

#### Edit Trait Multiplier

1. Select collection
2. Click "Trait Multipliers"
3. Select trait to edit
4. Update multiplier value
5. Click "Save"

#### Remove Trait Multiplier

1. Select collection
2. Click "Trait Multipliers"
3. Select trait to remove
4. Click "Delete"
5. Confirm deletion

#### Refresh NFT Metadata (Optional)

**AUTOMATIC REFRESH**: Metadata is automatically refreshed for users' NFTs every time they claim rewards. Manual refresh is optional and mainly for testing/troubleshooting.

**Why Automatic Refresh?**
- Ensures fair reward calculation (current claim uses old traits)
- Automatically picks up trait changes for future claims
- No admin intervention needed for normal operations

**Manual Refresh (Optional)**:

Admins can still manually refresh metadata for testing or troubleshooting:

**How to Refresh All Staked NFTs**:

1. Navigate to "Rewards" panel
2. Select collection (or leave blank for all collections)
3. Click "Refresh Metadata" button
4. Wait for refresh to complete (shows progress)
5. Review results:
   - Updated: NFTs with changed traits
   - Unchanged: NFTs with same traits
   - Failed: NFTs that couldn't be refreshed

**How to Refresh Single NFT**:

1. Navigate to "Staked NFTs" panel
2. Find the specific NFT
3. Click "Refresh Metadata" button
4. View before/after trait comparison

**When to Use Manual Refresh**:
- ✅ Testing after adding new trait multipliers
- ✅ Troubleshooting user-reported issues
- ✅ Verifying metadata is being fetched correctly
- ❌ NOT required for normal operations (automatic on claim)
- ✅ After NFT collection updates metadata format

**Performance Notes**:
- 10 NFTs: ~2 seconds
- 100 NFTs: ~15 seconds
- 1000 NFTs: ~2.5 minutes
- Processes in batches to avoid API rate limits

**API Usage**:

Refresh all staked NFTs:
```bash
curl -X POST https://your-domain.vercel.app/api/v1/admin/metadata/refresh \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json"
```

Refresh specific collection:
```bash
curl -X POST https://your-domain.vercel.app/api/v1/admin/metadata/refresh \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"collectionId": "YOUR_COLLECTION_ID"}'
```

Refresh single NFT:
```bash
curl -X POST https://your-domain.vercel.app/api/v1/admin/metadata/refresh/NFT_MINT_ADDRESS \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

### Reward Token Management

#### Configure Reward Token

1. Navigate to "Rewards" panel
2. Select collection
3. Click "Reward Token Settings"
4. Enter token details:
   - Token mint address
   - Token symbol
   - Token decimals
5. Click "Save"

#### Fund Reward Wallet

The platform distributes rewards from a designated wallet:

1. **Check Reward Wallet Balance**
   - View in admin dashboard
   - Monitor token balance
   - Set up low balance alerts

2. **Add Funds to Reward Wallet**
   - Transfer reward tokens to reward wallet address
   - Verify transaction on Solana Explorer
   - Confirm balance updated in dashboard

3. **Recommended Buffer**
   - Keep 30-day supply of rewards
   - Monitor daily distribution
   - Refill before running low

### Pausing Rewards

**Temporary Pause:**
1. Navigate to "Rewards" panel
2. Select collection
3. Toggle "Rewards Active" to OFF
4. Click "Save"

**Effects:**
- Rewards stop accumulating for new stakes
- Existing accumulated rewards can still be claimed
- Users can still stake/unstake

**Resume Rewards:**
1. Toggle "Rewards Active" to ON
2. Click "Save"
3. Rewards resume accumulating

---

## User Management

### Viewing User Activity

#### User Statistics

View platform-wide statistics:
- Total users
- Active stakers
- Total NFTs staked
- Total rewards distributed

#### Individual User Details

1. Navigate to "Users" panel
2. Search for user by wallet address
3. View user details:
   - Staked NFTs
   - Total rewards earned
   - Claim history
   - Stake/unstake history

### Handling User Issues

#### User Cannot Stake

**Troubleshooting Steps:**
1. Verify NFT is from supported collection
2. Check NFT is in user's wallet (Solana Explorer)
3. Verify collection is active
4. Check if user hit rate limit (20 stakes/min)
5. Review error logs for specific error

#### User Cannot Claim

**Troubleshooting Steps:**
1. Verify 60 seconds passed since last claim
2. Check user has accumulated rewards
3. Verify NFT is still staked
4. Check if user hit rate limit (5 claims/min)
5. Review error logs

#### User Cannot Unstake

**Troubleshooting Steps:**
1. Verify 24-hour minimum staking period expired
2. Check NFT is actually staked (database query)
3. Verify no pending transactions
4. Remind user: NFT is in their wallet, they can transfer it anytime (but lose rewards)
4. Check if user hit rate limit (20 unstakes/min)
5. Review error logs

### Manual Interventions

**When Manual Intervention May Be Needed:**
- Database inconsistency
- Failed transaction not rolled back
- User wallet compromised
- Platform bug affecting user

**Procedure:**
1. Document the issue thoroughly
2. Verify the problem in database
3. Create backup of affected records
4. Make necessary database changes
5. Log the intervention in audit logs
6. Verify fix with user
7. Document resolution

**Warning:** Manual database changes should be rare and carefully documented.

---

## Monitoring & Analytics

### Platform Health Monitoring

#### Health Check Endpoint

Monitor platform health at `/health`:

```bash
curl https://your-platform.com/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": "healthy",
    "solana_rpc": "healthy"
  }
}
```

**Status Values:**
- `healthy`: All systems operational
- `degraded`: Some systems experiencing issues
- `unhealthy`: Critical systems down

#### Monitoring Checklist

Check daily:
- [ ] Health endpoint returns 200
- [ ] Database connectivity is healthy
- [ ] RPC connectivity is healthy
- [ ] No critical errors in logs
- [ ] Reward wallet has sufficient balance

### Vercel Analytics

Access analytics in Vercel dashboard:

1. **Performance Metrics**
   - Page load times
   - API response times
   - Core Web Vitals

2. **Traffic Metrics**
   - Page views
   - Unique visitors
   - Geographic distribution

3. **Error Tracking**
   - Error rates
   - Error types
   - Affected users

### Vercel Logs

Monitor application logs:

1. **Access Logs**
   - Go to Vercel dashboard
   - Select your project
   - Click "Logs" tab

2. **Filter Logs**
   - By time range
   - By severity (info, warn, error)
   - By function/endpoint

3. **Search Logs**
   - Search by wallet address
   - Search by transaction signature
   - Search by error message

### Key Metrics to Monitor

#### Transaction Metrics
- **Stake transactions per day**
- **Unstake transactions per day**
- **Claim transactions per day**
- **Failed transaction rate** (should be <5%)

#### Performance Metrics
- **Average response time** (should be <500ms)
- **P95 response time** (should be <1000ms)
- **Database query time** (should be <100ms)
- **RPC response time** (should be <200ms)

#### User Metrics
- **Active stakers**
- **Total NFTs staked**
- **Average stake duration**
- **Reward claim frequency**

#### System Metrics
- **Database connections** (should be <20)
- **Memory usage** (monitor for leaks)
- **Cache hit rate** (should be >80%)
- **Error rate** (should be <1%)

### Setting Up Alerts

Configure alerts for critical issues:

1. **Health Check Failures**
   - Alert if health endpoint returns 503
   - Check every 5 minutes

2. **High Error Rate**
   - Alert if error rate >5%
   - Check every 15 minutes

3. **Slow Response Times**
   - Alert if P95 >1000ms
   - Check every 30 minutes

4. **Low Reward Balance**
   - Alert if reward wallet <7 days supply
   - Check daily

5. **Database Issues**
   - Alert if connection failures
   - Check every 5 minutes

---

## Database Management

### Accessing the Database

The platform uses Neon DB (PostgreSQL):

1. **Via Neon Dashboard**
   - Log in to Neon console
   - Select your project
   - Use SQL Editor

2. **Via psql CLI**
   ```bash
   psql "postgresql://user:password@host.neon.tech/dbname?sslmode=require"
   ```

3. **Via Database Client**
   - Use pgAdmin, DBeaver, or similar
   - Connect using DATABASE_URL from environment

### Database Schema

#### Main Tables

**collections**
- Stores collection configuration
- Fields: id, name, symbol, creator_address, is_active

**staked_nfts**
- Tracks all staked NFTs
- Fields: id, wallet_address, mint_address, collection_id, staked_at, last_claim_timestamp

**transactions**
- Records all transactions
- Fields: id, transaction_hash, wallet_address, transaction_type, collection_id, nft_count, timestamp

**audit_logs**
- Logs all admin actions
- Fields: id, admin_wallet, action, details, timestamp

**collection_rewards**
- Stores reward configuration
- Fields: id, collection_id, daily_rate, token_address, token_symbol, is_active


### Common Database Queries

#### View All Active Collections

```sql
SELECT c.*, cr.daily_rate, cr.token_symbol
FROM collections c
LEFT JOIN collection_rewards cr ON c.id = cr.collection_id
WHERE c.is_active = TRUE;
```

#### View All Staked NFTs

```sql
SELECT 
  sn.*,
  c.name as collection_name,
  TIMESTAMPDIFF(HOUR, sn.staked_at, NOW()) as hours_staked
FROM staked_nfts sn
JOIN collections c ON sn.collection_id = c.id
ORDER BY sn.staked_at DESC;
```

#### View Recent Transactions

```sql
SELECT *
FROM transactions
ORDER BY timestamp DESC
LIMIT 50;
```

#### View Reward Distribution

```sql
SELECT 
  c.name as collection,
  COUNT(DISTINCT sn.wallet_address) as unique_stakers,
  COUNT(sn.id) as total_nfts_staked,
  cr.daily_rate
FROM staked_nfts sn
JOIN collections c ON sn.collection_id = c.id
LEFT JOIN collection_rewards cr ON c.id = cr.collection_id
GROUP BY c.id, c.name, cr.daily_rate;
```

#### View User Staking History

```sql
SELECT 
  t.transaction_type,
  t.timestamp,
  t.transaction_hash,
  c.name as collection
FROM transactions t
LEFT JOIN collections c ON t.collection_id = c.id
WHERE t.wallet_address = 'UserWalletAddress...'
ORDER BY t.timestamp DESC;
```

### Database Maintenance

#### Running Migrations

**Apply New Migrations:**
```bash
cd database/migrations
node migrate.js up
```

**Rollback Last Migration:**
```bash
node migrate.js down
```

**Check Migration Status:**
```bash
node migrate.js status
```

#### Database Backups

**Neon DB Automatic Backups:**
- Neon provides automatic backups
- Access via Neon dashboard
- Point-in-time recovery available

**Manual Backup:**
```bash
pg_dump "postgresql://user:password@host.neon.tech/dbname" > backup.sql
```

**Restore from Backup:**
```bash
psql "postgresql://user:password@host.neon.tech/dbname" < backup.sql
```

#### Database Performance

**Check Slow Queries:**
```sql
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

**Check Index Usage:**
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

**Check Table Sizes:**
```sql
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Security & Audit Logs

### Viewing Audit Logs

#### Access Audit Logs

1. Navigate to "Audit Logs" panel in admin dashboard
2. View recent admin actions
3. Filter by:
   - Admin wallet
   - Action type
   - Date range

#### Audit Log Query

```sql
SELECT 
  admin_wallet,
  action,
  details,
  timestamp
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 100;
```

### What Gets Logged

All admin actions are automatically logged:

1. **Collection Management**
   - Collection created
   - Collection updated
   - Collection deleted
   - Hashlist modified

2. **Reward Configuration**
   - Reward rate changed
   - Trait multiplier added/updated
   - Rewards enabled/disabled

3. **User Management**
   - Manual interventions
   - User data accessed
   - Support actions

4. **System Configuration**
   - Environment variable changes
   - Admin access granted/revoked
   - Security settings modified

### Audit Log Retention

- **Retention Period**: 1 year minimum
- **Storage**: Append-only table
- **Compliance**: Meets audit requirements
- **Export**: Can export for external auditing

### Security Monitoring

#### Monitor for Suspicious Activity

Check audit logs for:
- Unusual admin actions
- Failed authentication attempts
- Unauthorized access attempts
- Bulk data exports
- Configuration changes during off-hours

#### Security Incident Response

If suspicious activity detected:

1. **Immediate Actions**
   - Document the incident
   - Preserve audit logs
   - Check for unauthorized changes
   - Verify system integrity

2. **Investigation**
   - Review audit logs
   - Check database for unauthorized changes
   - Verify admin wallet access
   - Check for data breaches

3. **Remediation**
   - Revoke compromised admin access
   - Rollback unauthorized changes
   - Update security measures
   - Notify affected users if necessary

4. **Post-Incident**
   - Document findings
   - Update security procedures
   - Implement additional safeguards
   - Train team on prevention

---

## Troubleshooting

### Platform Issues

#### Issue: High Error Rate

**Symptoms:** Error rate >5% in logs

**Diagnosis:**
1. Check Vercel logs for error patterns
2. Identify most common error types
3. Check database connectivity
4. Verify RPC endpoint status

**Solutions:**
- Database issues: Check Neon DB status, verify connection pool
- RPC issues: Switch to fallback RPC, check Helius status
- Code errors: Review recent deployments, rollback if needed

#### Issue: Slow Response Times

**Symptoms:** Response times >500ms average

**Diagnosis:**
1. Check database query performance
2. Monitor RPC response times
3. Review cache hit rates
4. Check server resource usage

**Solutions:**
- Slow queries: Add indexes, optimize queries
- RPC slow: Use dedicated RPC provider, increase timeout
- Low cache hits: Increase cache TTL, warm cache
- High load: Scale infrastructure, optimize code

#### Issue: Database Connection Errors

**Symptoms:** "Database connection failed" errors

**Diagnosis:**
1. Check Neon DB status
2. Verify connection string
3. Check connection pool settings
4. Monitor concurrent connections

**Solutions:**
- Neon DB down: Wait for service restoration
- Connection pool exhausted: Increase pool size
- Network issues: Check DNS, firewall rules
- Credentials invalid: Verify DATABASE_URL

#### Issue: RPC Endpoint Failures

**Symptoms:** "RPC request failed" errors

**Diagnosis:**
1. Check Solana network status
2. Test RPC endpoints manually
3. Verify Helius API key
4. Check rate limits

**Solutions:**
- Network congestion: Use fallback RPC
- API key invalid: Update Helius API key
- Rate limited: Upgrade Helius plan
- Endpoint down: Switch to alternative RPC

### User-Reported Issues

#### User Says NFT is Stuck

**Investigation:**
1. Query database for NFT:
   ```sql
   SELECT * FROM staked_nfts WHERE mint_address = 'MintAddress...';
   ```
2. Check transaction history
3. Verify NFT ownership on Solana Explorer
4. Check for pending transactions

**Resolution:**
- Database shows staked but user transferred NFT: Remove staking record (they lost rewards)
- User wants to unstake before 24 hours: Explain minimum period rule
- Transaction failed: Check logs and retry

#### User Says Rewards Incorrect

**Investigation:**
1. Query staking record:
   ```sql
   SELECT 
     staked_at,
     last_claim_timestamp,
     TIMESTAMPDIFF(SECOND, COALESCE(last_claim_timestamp, staked_at), NOW()) as seconds_since_claim
   FROM staked_nfts
   WHERE mint_address = 'MintAddress...';
   ```
2. Calculate expected rewards manually
3. Check reward rate for collection
4. Verify trait multipliers applied

**Resolution:**
- Calculation correct: Explain calculation to user
- Calculation incorrect: Investigate bug, fix if needed
- Rate changed: Explain rate change
- Multiplier missing: Add trait multiplier

#### User Says Transaction Failed

**Investigation:**
1. Get transaction signature from user
2. Check transaction on Solana Explorer
3. Review error logs for wallet address
4. Check rate limiting logs

**Resolution:**
- Transaction not found: User may have rejected in wallet
- Transaction failed: Check error reason, guide user to retry
- Rate limited: Explain rate limits, ask user to wait
- Network timeout: Guide user to retry

---

## Maintenance Procedures

### Routine Maintenance

#### Daily Tasks

- [ ] Check health endpoint status
- [ ] Review error logs
- [ ] Monitor reward wallet balance
- [ ] Check for user-reported issues
- [ ] Verify transaction volumes are normal

#### Weekly Tasks

- [ ] Review audit logs for unusual activity
- [ ] Check database performance metrics
- [ ] Monitor cache hit rates
- [ ] Review and respond to user feedback
- [ ] Update documentation if needed

#### Monthly Tasks

- [ ] Review and optimize database queries
- [ ] Analyze user growth trends
- [ ] Plan reward rate adjustments
- [ ] Review security measures
- [ ] Update dependencies
- [ ] Backup critical data

### Deployment Procedures

#### Deploying Updates

Vercel handles automatic deployments from Git:

1. **Prepare Update**
   - Test changes locally
   - Run all tests
   - Update documentation

2. **Deploy to Staging**
   - Push to staging branch
   - Vercel auto-deploys
   - Test on staging environment

3. **Deploy to Production**
   - Merge to main branch
   - Vercel auto-deploys
   - Monitor deployment logs

4. **Post-Deployment**
   - Run smoke tests
   - Check health endpoint
   - Monitor error rates
   - Verify functionality

#### Rollback Procedure

If deployment causes issues:

1. **Immediate Rollback**
   - Go to Vercel dashboard
   - Select "Deployments"
   - Find previous working deployment
   - Click "Promote to Production"

2. **Verify Rollback**
   - Check health endpoint
   - Test critical functionality
   - Monitor error rates

3. **Investigate Issue**
   - Review deployment logs
   - Identify root cause
   - Fix in development
   - Re-deploy when ready

### Database Migrations

#### Planning a Migration

1. **Review Schema Changes**
   - Document all changes
   - Identify affected tables
   - Estimate downtime

2. **Create Migration Script**
   - Write up migration
   - Write down migration (rollback)
   - Test on development database

3. **Test Migration**
   ```bash
   cd database/migrations
   node test-migration.js
   ```

4. **Schedule Maintenance Window**
   - Announce to users
   - Choose low-traffic time
   - Plan for 30-60 minute window

#### Executing a Migration

1. **Backup Database**
   ```bash
   pg_dump "postgresql://..." > pre-migration-backup.sql
   ```

2. **Run Migration**
   ```bash
   node migrate.js up
   ```

3. **Verify Migration**
   ```bash
   node validate-migration.js
   ```

4. **Test Functionality**
   - Run smoke tests
   - Test critical flows
   - Verify data integrity

5. **Monitor Post-Migration**
   - Watch error logs
   - Check performance metrics
   - Respond to user issues

#### Rollback Migration

If migration causes issues:

```bash
cd database/migrations
node migrate.js down
```

Then restore from backup if needed:
```bash
psql "postgresql://..." < pre-migration-backup.sql
```

### Cache Management

#### Invalidating Caches

**Collection Cache:**
```javascript
// Via admin API
POST /api/admin/cache/invalidate
{
  "cacheType": "collections",
  "collectionId": "optional-specific-collection"
}
```

**Helius Cache:**
```javascript
POST /api/admin/cache/invalidate
{
  "cacheType": "helius"
}
```

**All Caches:**
```javascript
POST /api/admin/cache/invalidate
{
  "cacheType": "all"
}
```

#### When to Invalidate Cache

- After updating collection settings
- After changing reward rates
- After modifying hashlists
- When users report stale data
- After database migrations

---

## Emergency Procedures

### Platform Down

**Immediate Actions:**
1. Check Vercel status
2. Check Neon DB status
3. Check Solana network status
4. Review recent deployments
5. Check error logs

**Communication:**
1. Post status update on social media
2. Update Discord announcement
3. Estimate resolution time
4. Provide regular updates

**Resolution:**
1. Identify root cause
2. Implement fix or rollback
3. Verify platform operational
4. Announce resolution
5. Post-mortem analysis

### Database Corruption

**Immediate Actions:**
1. Stop write operations if possible
2. Backup current state
3. Assess extent of corruption
4. Identify affected records

**Recovery:**
1. Restore from latest backup
2. Replay transactions if needed
3. Verify data integrity
4. Test functionality
5. Resume operations

**Prevention:**
- Regular backups
- Transaction isolation
- Foreign key constraints
- Validation before writes

### Security Breach

**Immediate Actions:**
1. Revoke compromised admin access
2. Change all credentials
3. Review audit logs
4. Assess damage

**Investigation:**
1. Identify breach vector
2. Check for unauthorized changes
3. Verify user data integrity
4. Document findings

**Remediation:**
1. Fix security vulnerability
2. Rollback unauthorized changes
3. Notify affected users
4. Implement additional security

**Post-Incident:**
1. Security audit
2. Update procedures
3. Team training
4. Implement monitoring

---

## Best Practices

### Admin Operations

1. **Document Everything**
   - Log all manual interventions
   - Document configuration changes
   - Keep runbooks updated

2. **Test Before Production**
   - Use staging environment
   - Test all changes thoroughly
   - Have rollback plan ready

3. **Communicate Changes**
   - Announce to users
   - Update documentation
   - Notify team members

4. **Monitor After Changes**
   - Watch error rates
   - Check user feedback
   - Verify functionality

5. **Regular Reviews**
   - Review audit logs weekly
   - Analyze metrics monthly
   - Update procedures quarterly

### Security Best Practices

1. **Access Control**
   - Limit admin access
   - Use hardware wallets
   - Regular access reviews

2. **Audit Everything**
   - Log all admin actions
   - Review logs regularly
   - Investigate anomalies

3. **Secure Credentials**
   - Use Vercel environment variables
   - Rotate credentials regularly
   - Never commit secrets to Git

4. **Incident Response**
   - Have response plan ready
   - Practice incident scenarios
   - Update plan regularly

5. **User Privacy**
   - Minimize data collection
   - Protect user information
   - Comply with regulations

---

## Admin API Reference

### Authentication

All admin endpoints require authentication:

```javascript
POST /api/admin/auth
{
  "walletAddress": "AdminWalletAddress...",
  "signature": "SignedMessage...",
  "message": "Nonce..."
}

Response:
{
  "token": "JWT_TOKEN...",
  "expiresIn": 3600
}
```

Use the JWT token in subsequent requests:
```
Authorization: Bearer JWT_TOKEN
```

### Collection Management Endpoints

#### Create Collection

```javascript
POST /api/admin/collections
Authorization: Bearer JWT_TOKEN

{
  "name": "Collection Name",
  "symbol": "SYMBOL",
  "creatorAddress": "CreatorAddress...",
  "hashlist": ["Mint1...", "Mint2...", "Mint3..."]
}

Response:
{
  "success": true,
  "collectionId": 123
}
```

#### Update Collection

```javascript
PUT /api/admin/collections/:id
Authorization: Bearer JWT_TOKEN

{
  "name": "Updated Name",
  "isActive": true
}

Response:
{
  "success": true,
  "collection": { ... }
}
```

#### Delete Collection

```javascript
DELETE /api/admin/collections/:id
Authorization: Bearer JWT_TOKEN

Response:
{
  "success": true,
  "message": "Collection deleted"
}
```

### Reward Configuration Endpoints

#### Set Reward Rate

```javascript
POST /api/admin/rewards/rate
Authorization: Bearer JWT_TOKEN

{
  "collectionId": 123,
  "dailyRate": 10.5,
  "tokenAddress": "TokenMintAddress...",
  "tokenSymbol": "REWARD",
  "tokenDecimals": 9
}

Response:
{
  "success": true,
  "rewardConfig": { ... }
}
```

#### Update Trait Multiplier

```javascript
POST /api/admin/rewards/multipliers
Authorization: Bearer JWT_TOKEN

{
  "collectionId": 123,
  "traitName": "Rare Background",
  "multiplier": 1.5
}

Response:
{
  "success": true,
  "multiplier": { ... }
}
```

### Cache Management Endpoints

#### Invalidate Cache

```javascript
POST /api/admin/cache/invalidate
Authorization: Bearer JWT_TOKEN

{
  "cacheType": "collections", // or "helius" or "all"
  "collectionId": 123 // optional, for specific collection
}

Response:
{
  "success": true,
  "message": "Cache invalidated"
}
```

### Analytics Endpoints

#### Get Platform Statistics

```javascript
GET /api/admin/analytics/stats
Authorization: Bearer JWT_TOKEN

Response:
{
  "totalUsers": 1250,
  "activeStakers": 450,
  "totalNFTsStaked": 3200,
  "totalRewardsDistributed": 125000,
  "averageStakeDuration": 168 // hours
}
```

#### Get Collection Statistics

```javascript
GET /api/admin/analytics/collections/:id
Authorization: Bearer JWT_TOKEN

Response:
{
  "collectionId": 123,
  "name": "Collection Name",
  "totalStaked": 450,
  "uniqueStakers": 120,
  "rewardsDistributed": 25000,
  "averageRewardPerNFT": 55.5
}
```

---

## Configuration Reference

### Environment Variables

Required environment variables in Vercel:

#### Database
```bash
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

#### Solana Network
```bash
MAINNET_RPC_PRIMARY=https://api.mainnet-beta.solana.com
MAINNET_RPC_FALLBACK=https://solana-api.projectserum.com
SOLANA_NETWORK=mainnet
```

#### Helius
```bash
HELIUS_MAINNET_ENDPOINT=https://mainnet.helius-rpc.com
HELIUS_API_KEY=your-helius-api-key
```

#### Authentication
```bash
JWT_SECRET=your-jwt-secret-here
```

#### Rewards
```bash
REWARDS_WALLET_PRIVATE_KEY=your-rewards-wallet-private-key
```

#### CORS
```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Updating Environment Variables

1. Go to Vercel dashboard
2. Select your project
3. Go to "Settings" > "Environment Variables"
4. Add/edit variables
5. Redeploy for changes to take effect

---

## Appendix

### Admin Checklist

#### New Admin Onboarding

- [ ] Add wallet address to admin list
- [ ] Deploy updated code
- [ ] Verify admin access
- [ ] Provide admin guide
- [ ] Train on procedures
- [ ] Grant necessary permissions
- [ ] Add to admin communication channels

#### Pre-Launch Checklist

- [ ] All collections configured
- [ ] Reward rates set
- [ ] Hashlists uploaded and verified
- [ ] Reward wallet funded
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Security testing completed
- [ ] Performance testing passed
- [ ] Documentation updated
- [ ] Support channels ready
- [ ] Monitoring configured
- [ ] Backup procedures tested

#### Post-Launch Checklist

- [ ] Monitor health endpoint
- [ ] Watch error rates
- [ ] Check user feedback
- [ ] Verify transactions processing
- [ ] Monitor reward distribution
- [ ] Check database performance
- [ ] Review audit logs
- [ ] Respond to support requests

### Contact Information

**Development Team:**
- Email: [dev team email]
- Discord: [dev channel]

**Infrastructure:**
- Vercel Support: https://vercel.com/support
- Neon DB Support: https://neon.tech/docs/introduction/support

**Security:**
- Security Email: [security email]
- Report vulnerabilities: [security reporting process]

---

## Conclusion

This admin guide provides comprehensive instructions for managing the Solana NFT Staking Platform. Regular monitoring, proactive maintenance, and following best practices will ensure smooth platform operation.

### Key Takeaways

1. **Monitor Continuously**: Use health checks and analytics
2. **Document Everything**: Log all actions and changes
3. **Test Thoroughly**: Test before deploying to production
4. **Communicate Clearly**: Keep users informed
5. **Respond Quickly**: Address issues promptly
6. **Stay Secure**: Follow security best practices
7. **Learn and Improve**: Analyze incidents and update procedures

### Additional Resources

- User Guide: `USER_GUIDE.md`
- API Documentation: `API_DOCUMENTATION.md`
- Deployment Guide: `DEPLOYMENT_GUIDE.md`
- Troubleshooting Guide: `TROUBLESHOOTING_GUIDE.md`

---

*Last Updated: [Date]*  
*Version: 1.0*  
*Platform: Solana NFT Staking - Admin Guide*
