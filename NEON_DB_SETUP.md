# Neon DB Setup Guide

This guide covers setting up and configuring Neon DB (serverless PostgreSQL) for the Solana NFT Staking Platform.

## What is Neon DB?

Neon is a serverless PostgreSQL database that:
- Automatically scales based on demand
- Pauses when inactive (free tier)
- Provides connection pooling
- Offers branching for development/staging
- Integrates seamlessly with Vercel

## Prerequisites

- Neon account (sign up at https://neon.tech)
- Basic understanding of PostgreSQL
- Access to terminal for running migrations

## Part 1: Creating Your Neon Project

### Step 1: Sign Up / Log In

1. Go to https://console.neon.tech
2. Sign up with GitHub, Google, or email
3. Verify your email if required

### Step 2: Create a New Project

1. Click "Create Project" or "New Project"
2. Configure your project:

   **Project Name**: `solana-nft-staking-prod`
   - Use descriptive name for easy identification
   
   **Region**: Choose based on your users' location
   - `US East (Ohio)` - Best for US East Coast
   - `US West (Oregon)` - Best for US West Coast
   - `Europe (Frankfurt)` - Best for European users
   - `Asia Pacific (Singapore)` - Best for Asian users
   
   **PostgreSQL Version**: 15 or later
   - Use latest stable version
   
   **Compute Size**: 
   - Free tier: 0.25 vCPU (sufficient for testing)
   - Pro tier: Scale up as needed

3. Click "Create Project"

### Step 3: Get Connection Details

After project creation, you'll see connection details:

1. **Connection String** (Pooled):
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   - This is what you'll use in your application
   - Copy and save securely

2. **Connection String** (Direct):
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   - Use for migrations and admin tasks
   - Higher connection limit

3. **Individual Components**:
   - Host: `ep-xxx-xxx.region.aws.neon.tech`
   - Database: `neondb`
   - Username: `username`
   - Password: `[hidden]` (click to reveal)
   - Port: `5432`

**IMPORTANT**: Save these credentials securely. You'll need them for:
- Vercel environment variables
- Local development
- Running migrations

## Part 2: Database Schema Setup

### Understanding the Schema

The platform uses 6 main tables:

1. **users** - User accounts and wallet addresses
2. **collections** - NFT collection configurations
3. **nft_traits** - Trait multipliers for rewards
4. **staked_nfts** - Currently staked NFTs
5. **transactions** - Transaction history
6. **audit_logs** - Administrative action logs

### Migration Files

Located in `database/migrations/`:

1. `001_add_missing_columns.js` - Adds missing columns to existing tables
2. `002_add_cascade_foreign_keys.js` - Updates foreign key constraints
3. `003_add_performance_indexes.js` - Adds indexes for query optimization
4. `004_create_audit_logs_table.js` - Creates audit logging table

### Running Migrations

**Option A: Using Migration Script (Recommended)**

1. Set up environment variable:
   ```bash
   export DATABASE_URL="postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require"
   ```

2. Run migrations:
   ```bash
   cd backend
   node database/migrations/migrate.js
   ```

3. Verify output:
   ```
   Starting database migrations...
   ✓ Migration 001_add_missing_columns.js completed
   ✓ Migration 002_add_cascade_foreign_keys.js completed
   ✓ Migration 003_add_performance_indexes.js completed
   ✓ Migration 004_create_audit_logs_table.js completed
   All migrations completed successfully!
   ```

**Option B: Using Neon SQL Editor**

1. In Neon console, click "SQL Editor"
2. Copy SQL from each migration file
3. Execute in order (001, 002, 003, 004)
4. Verify each completes without errors

**Option C: Using psql CLI**

1. Install PostgreSQL client:
   ```bash
   # macOS
   brew install postgresql
   
   # Ubuntu/Debian
   sudo apt-get install postgresql-client
   ```

2. Connect to database:
   ```bash
   psql "postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require"
   ```

3. Run migrations:
   ```sql
   \i database/migrations/001_add_missing_columns.js
   \i database/migrations/002_add_cascade_foreign_keys.js
   \i database/migrations/003_add_performance_indexes.js
   \i database/migrations/004_create_audit_logs_table.js
   ```

### Verifying Schema

After migrations, verify tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected output:
```
 table_name
--------------
 audit_logs
 collections
 nft_traits
 staked_nfts
 transactions
 users
```

Verify indexes:

```sql
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

Should see indexes on:
- `staked_nfts`: wallet_address, collection_id, mint_address
- `transactions`: wallet_address, collection_id, type, timestamp
- `audit_logs`: admin_wallet, action, timestamp

## Part 3: Initial Data Setup

### Create Admin User

```sql
INSERT INTO users (wallet_address, created_at)
VALUES ('YOUR_ADMIN_WALLET_ADDRESS', NOW())
ON CONFLICT (wallet_address) DO NOTHING;
```

Replace `YOUR_ADMIN_WALLET_ADDRESS` with your actual Solana wallet address.

### Add Your First Collection

```sql
INSERT INTO collections (
  collection_id,
  name,
  reward_rate,
  min_stake_duration,
  is_active,
  created_at
) VALUES (
  'YOUR_COLLECTION_MINT_ADDRESS',
  'Your Collection Name',
  0.0001, -- 0.0001 tokens per second = ~8.64 tokens per day
  86400, -- 24 hours in seconds
  true,
  NOW()
);
```

Replace:
- `YOUR_COLLECTION_MINT_ADDRESS` - Your NFT collection's mint address
- `Your Collection Name` - Display name for your collection
- `0.0001` - Reward rate (adjust as needed)

### Add Trait Multipliers (Optional)

If your NFTs have traits that should affect rewards:

```sql
INSERT INTO nft_traits (
  collection_id,
  trait_type,
  trait_value,
  multiplier
) VALUES (
  'YOUR_COLLECTION_MINT_ADDRESS',
  'Rarity',
  'Legendary',
  2.0 -- 2x rewards for Legendary NFTs
);
```

## Part 4: Connection Configuration

### For Local Development

Create `backend/.env`:

```bash
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
```

### For Vercel Production

In Vercel dashboard:
1. Go to Settings → Environment Variables
2. Add `DATABASE_URL` with your connection string
3. Select "Production" environment
4. Save

### Connection Pooling

Neon provides two connection types:

**Pooled Connection** (Recommended for Vercel):
```
postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
```
- Uses PgBouncer for connection pooling
- Better for serverless (Vercel Functions)
- Lower connection overhead
- Use this for `DATABASE_URL`

**Direct Connection** (For migrations):
```
postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
```
- Direct PostgreSQL connection
- Better for long-running operations
- Use for migrations and admin tasks

## Part 5: Neon Configuration

### Auto-Pause Settings

Free tier projects auto-pause after inactivity:

1. In Neon console, go to Settings
2. Find "Auto-pause" settings
3. Configure:
   - **Delay**: 5 minutes (default)
   - **Auto-resume**: Enabled (default)

**Note**: First request after pause may be slower (~1-2 seconds) as database resumes.

### Compute Settings

Configure compute resources:

1. Go to Settings → Compute
2. Set:
   - **Min compute**: 0.25 vCPU (free tier)
   - **Max compute**: 0.25 vCPU (free tier) or higher (paid)
   - **Autoscaling**: Enable for paid tiers

### Connection Limits

Connection limits by tier:

| Tier | Pooled Connections | Direct Connections |
|------|-------------------|-------------------|
| Free | 100 | 100 |
| Pro | 1000 | 1000 |
| Enterprise | Custom | Custom |

Monitor connections:
```sql
SELECT count(*) FROM pg_stat_activity;
```

### Storage

Neon automatically manages storage:
- Free tier: 3 GB
- Pro tier: 200 GB+
- Auto-scales as needed

Check storage usage:
```sql
SELECT pg_size_pretty(pg_database_size('neondb'));
```

## Part 6: Branching (Development/Staging)

Neon supports database branching for development:

### Create a Branch

1. In Neon console, click "Branches"
2. Click "Create Branch"
3. Configure:
   - **Name**: `development` or `staging`
   - **Parent**: `main`
   - **Copy data**: Yes (to include existing data)
4. Click "Create"

### Use Branch for Development

Each branch gets its own connection string:

```bash
# Development branch
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require&options=project%3Ddev-branch-id
```

Use this for:
- Local development
- Testing migrations
- Staging environment

### Merge Changes

After testing on branch:
1. Verify migrations work
2. Test application functionality
3. Run migrations on main branch
4. Deploy to production

## Part 7: Monitoring & Maintenance

### Monitor Performance

In Neon console, go to "Monitoring":

**Metrics to watch**:
- **Connection count**: Should stay below limit
- **Query duration**: Most queries < 100ms
- **CPU usage**: Should be < 80% average
- **Storage**: Monitor growth rate

### Query Performance

Find slow queries:

```sql
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Connection Monitoring

Check active connections:

```sql
SELECT 
  datname,
  usename,
  application_name,
  client_addr,
  state,
  query
FROM pg_stat_activity
WHERE datname = 'neondb';
```

### Vacuum and Analyze

Neon automatically runs VACUUM, but you can manually trigger:

```sql
VACUUM ANALYZE;
```

Run weekly or after large data changes.

## Part 8: Backup & Recovery

### Automatic Backups

Neon automatically backs up your data:
- **Frequency**: Continuous (point-in-time recovery)
- **Retention**: 7 days (free), 30 days (pro)
- **Location**: Same region as database

### Point-in-Time Recovery

To restore to a specific time:

1. In Neon console, go to "Branches"
2. Click "Create Branch"
3. Select "Point in time"
4. Choose timestamp
5. Create branch with restored data

### Manual Backup

Export data using pg_dump:

```bash
pg_dump "postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require" > backup.sql
```

Restore from backup:

```bash
psql "postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require" < backup.sql
```

## Part 9: Security Best Practices

### Connection Security

1. **Always use SSL**:
   - Connection string must include `?sslmode=require`
   - Never disable SSL in production

2. **Rotate passwords regularly**:
   - In Neon console, go to Settings → Reset Password
   - Update environment variables after rotation

3. **Use environment variables**:
   - Never commit connection strings to Git
   - Use Vercel environment variables
   - Use `.env` files locally (add to `.gitignore`)

### Access Control

1. **Limit database users**:
   - Create separate users for different purposes
   - Grant minimum required permissions

2. **IP allowlist** (Pro tier):
   - Restrict connections to known IPs
   - Add Vercel IPs if using IP restrictions

### Audit Logging

Enable query logging for security audits:

```sql
-- Check audit_logs table
SELECT * FROM audit_logs 
ORDER BY timestamp DESC 
LIMIT 100;
```

## Part 10: Troubleshooting

### Issue: Connection Timeout

**Symptoms**:
```
Error: Connection timeout
```

**Solutions**:
1. Check Neon project is not paused
2. Verify connection string is correct
3. Check network connectivity
4. Increase timeout in code:
   ```javascript
   connectionTimeoutMillis: 10000
   ```

### Issue: Too Many Connections

**Symptoms**:
```
Error: sorry, too many clients already
```

**Solutions**:
1. Use pooled connection string
2. Check for connection leaks in code
3. Reduce connection timeout
4. Upgrade to Pro tier for more connections

### Issue: Slow Queries

**Symptoms**:
- Queries take > 1 second
- Timeouts

**Solutions**:
1. Check indexes exist (run migration 003)
2. Analyze query plan:
   ```sql
   EXPLAIN ANALYZE SELECT ...;
   ```
3. Add missing indexes
4. Optimize query logic

### Issue: Database Paused

**Symptoms**:
- First request after inactivity is slow
- "Database is starting" message

**Solutions**:
1. Wait for auto-resume (~1-2 seconds)
2. Upgrade to Pro tier (no auto-pause)
3. Implement health check to keep database active

## Part 11: Scaling Considerations

### When to Upgrade

Consider upgrading from Free to Pro when:
- Connection count regularly > 50
- Storage > 2 GB
- Need faster compute
- Need longer backup retention
- Need IP allowlist
- Need priority support

### Optimization Tips

1. **Use indexes**: Ensure all foreign keys and frequently queried columns are indexed
2. **Connection pooling**: Always use pooled connection string
3. **Query optimization**: Use JOINs instead of multiple queries
4. **Caching**: Implement application-level caching for frequently accessed data
5. **Batch operations**: Group multiple inserts/updates into transactions

### Monitoring Thresholds

Set up alerts for:
- Connection count > 80% of limit
- Query duration > 1 second
- Storage > 80% of limit
- CPU usage > 90%

## Resources

- **Neon Documentation**: https://neon.tech/docs
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Neon Status Page**: https://neonstatus.com
- **Neon Discord**: https://discord.gg/neon

## Next Steps

After setting up Neon DB:
1. ✅ Run all migrations
2. ✅ Verify schema is correct
3. ✅ Add initial data (admin user, collections)
4. ✅ Configure Vercel environment variables
5. ✅ Test connection from application
6. ✅ Deploy to production
7. ✅ Monitor performance

For deployment instructions, see [Deployment Guide](DEPLOYMENT_GUIDE.md).
