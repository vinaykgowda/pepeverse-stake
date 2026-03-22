# Deployment Guide: Vercel + Neon DB

This guide walks you through deploying the Solana NFT Staking Platform to production using Vercel (hosting) and Neon DB (PostgreSQL database).

## Prerequisites

Before you begin, ensure you have:
- [ ] GitHub account with your code repository
- [ ] Vercel account (sign up at https://vercel.com)
- [ ] Neon DB account (sign up at https://neon.tech)
- [ ] Helius API key (get from https://helius.dev)
- [ ] Admin wallet address (your Solana wallet for admin access)
- [ ] All code committed and pushed to GitHub

## Part 1: Database Setup (Neon DB)

### Step 1: Create Neon DB Project

1. Log in to https://console.neon.tech
2. Click "Create Project"
3. Configure your project:
   - **Name**: solana-nft-staking-prod
   - **Region**: Choose closest to your users (US East, EU West, etc.)
   - **PostgreSQL Version**: 15 or later
4. Click "Create Project"

### Step 2: Get Database Connection String

1. In your Neon project dashboard, click "Connection Details"
2. Copy the connection string (it looks like):
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Save this securely - you'll need it for Vercel environment variables

### Step 3: Run Database Migrations

You need to run migrations on your production database before deploying the application.

**Option A: Run locally against production DB**

1. Create a temporary `.env.production` file in the `backend` directory:
   ```bash
   DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

2. Run the migration script:
   ```bash
   cd backend
   NODE_ENV=production node database/migrations/migrate.js
   ```

3. Verify migrations completed successfully:
   ```bash
   # You should see output like:
   # ✓ Migration 001_add_missing_columns.js completed
   # ✓ Migration 002_add_cascade_foreign_keys.js completed
   # ✓ Migration 003_add_performance_indexes.js completed
   # ✓ Migration 004_create_audit_logs_table.js completed
   ```

4. **IMPORTANT**: Delete the `.env.production` file after migrations complete

**Option B: Use Neon SQL Editor**

1. In Neon console, go to "SQL Editor"
2. Copy and paste the SQL from each migration file in order:
   - `database/migrations/001_add_missing_columns.js`
   - `database/migrations/002_add_cascade_foreign_keys.js`
   - `database/migrations/003_add_performance_indexes.js`
   - `database/migrations/004_create_audit_logs_table.js`
3. Execute each migration and verify success

### Step 4: Verify Database Schema

Run this query in Neon SQL Editor to verify all tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- audit_logs
- collections
- nft_traits
- staked_nfts
- transactions
- users

## Part 2: Vercel Deployment

### Step 1: Connect Repository to Vercel

1. Log in to https://vercel.com
2. Click "Add New..." → "Project"
3. Import your Git repository:
   - Select your GitHub account
   - Find and select your repository
   - Click "Import"

### Step 2: Configure Project Settings

1. **Framework Preset**: Vercel should auto-detect "Other" or "Node.js"
2. **Root Directory**: Leave as `.` (root)
3. **Build Command**: Leave default or set to `npm run build` if needed
4. **Output Directory**: Leave default
5. Click "Deploy" (it will fail without environment variables - that's expected)

### Step 3: Configure Environment Variables

After the initial deployment attempt, go to your project settings:

1. Navigate to: **Settings** → **Environment Variables**

2. Add the following variables for **Production** environment:

#### Backend Variables

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `DATABASE_URL` | `postgresql://...` | Your Neon DB connection string |
| `JWT_SECRET` | `[generate-random-string]` | Random 64+ character string for JWT signing |
| `HELIUS_API_KEY` | `your-helius-key` | Your Helius API key |
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Primary Solana RPC endpoint |
| `SOLANA_RPC_FALLBACK_URL` | `https://solana-api.projectserum.com` | Fallback RPC endpoint |
| `HELIUS_RPC_URL` | `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY` | Helius RPC endpoint |
| `ADMIN_WALLET_ADDRESS` | `your-wallet-address` | Your admin Solana wallet address |
| `NODE_ENV` | `production` | Environment mode |
| `ALLOWED_ORIGINS` | `https://your-domain.vercel.app` | Comma-separated list of allowed CORS origins |

#### Frontend Variables

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `VITE_API_URL` | `https://your-domain.vercel.app` | Your Vercel deployment URL |
| `VITE_SOLANA_NETWORK` | `mainnet-beta` | Solana network |
| `VITE_SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |

#### How to Generate JWT_SECRET

```bash
# On macOS/Linux:
openssl rand -base64 64

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Step 4: Configure Vercel Settings

1. **Build & Development Settings**:
   - Build Command: `npm run build` (if you have a build script)
   - Output Directory: Leave default
   - Install Command: `npm install`

2. **Functions**:
   - Region: Choose closest to your Neon DB region
   - Max Duration: 10s (default is fine)

3. **Git**:
   - Production Branch: `main` or `master`
   - Enable automatic deployments on push

### Step 5: Deploy

1. Go to **Deployments** tab
2. Click "Redeploy" on the latest deployment
3. Check "Use existing Build Cache" (optional)
4. Click "Redeploy"

### Step 6: Verify Deployment

Once deployment completes:

1. **Check Health Endpoint**:
   ```bash
   curl https://your-domain.vercel.app/health
   ```
   
   Expected response:
   ```json
   {
     "status": "healthy",
     "timestamp": "2026-03-10T...",
     "database": "connected",
     "rpc": "connected"
   }
   ```

2. **Check Frontend**:
   - Visit https://your-domain.vercel.app
   - Verify the page loads
   - Check browser console for errors

3. **Test Wallet Connection**:
   - Connect your wallet
   - Verify network indicator shows "Mainnet"

### Step 7: Update CORS Configuration

After your first deployment, update the `ALLOWED_ORIGINS` environment variable:

1. Go to **Settings** → **Environment Variables**
2. Edit `ALLOWED_ORIGINS`
3. Set to your actual Vercel domain: `https://your-actual-domain.vercel.app`
4. Redeploy for changes to take effect

## Part 3: Post-Deployment Configuration

### Step 1: Configure Collections

Use the admin dashboard to add your NFT collections:

1. Navigate to `/admin` (requires admin wallet connection)
2. Click "Add Collection"
3. Enter collection details:
   - Collection ID (mint address)
   - Name
   - Base reward rate (tokens per second)
   - Minimum stake duration (default: 86400 seconds = 24 hours)
4. Click "Save"

See [Admin Guide](ADMIN_GUIDE.md) for detailed instructions.

### Step 2: Configure Trait Multipliers (Optional)

If your NFTs have traits that should affect rewards:

1. In admin dashboard, select a collection
2. Click "Manage Traits"
3. Add trait multipliers:
   - Trait name (e.g., "Legendary")
   - Multiplier (e.g., 2.0 for 2x rewards)
4. Click "Save"

### Step 3: Test Core Flows

Before announcing to users, test all critical flows:

1. **Stake Flow**: Follow [Mainnet Stake Flow Testing Guide](MAINNET_STAKE_FLOW_TESTING_GUIDE.md)
2. **Claim Flow**: Follow [Mainnet Claim Rewards Testing Guide](MAINNET_CLAIM_REWARDS_FLOW_TESTING_GUIDE.md)
3. **Unstake Flow**: Follow [Mainnet Unstake Flow Testing Guide](MAINNET_UNSTAKE_FLOW_TESTING_GUIDE.md)

Use small amounts of SOL for testing (0.01-0.05 SOL).

## Part 4: Monitoring & Maintenance

### Vercel Logs

Access logs in Vercel dashboard:
1. Go to your project
2. Click "Logs" tab
3. Filter by:
   - Time range
   - Log level (info, warn, error)
   - Search terms

### Vercel Analytics

Monitor performance:
1. Go to "Analytics" tab
2. View:
   - Page views
   - Response times
   - Error rates
   - Geographic distribution

### Database Monitoring

Monitor Neon DB:
1. Log in to Neon console
2. Go to "Monitoring" tab
3. Check:
   - Connection count
   - Query performance
   - Storage usage
   - CPU usage

### Audit Logs

Review administrative actions:
1. Connect to your database
2. Query audit_logs table:
   ```sql
   SELECT * FROM audit_logs 
   ORDER BY timestamp DESC 
   LIMIT 100;
   ```

## Part 5: Scaling Considerations

### Database Scaling

Neon DB automatically scales, but monitor:
- **Connection limits**: Upgrade plan if hitting limits
- **Storage**: Neon auto-scales storage
- **Compute**: Upgrade for better performance

### Rate Limiting

Current limits (per wallet):
- Claim: 5 requests/minute
- Stake: 20 requests/minute
- Unstake: 20 requests/minute
- Auth: 10 requests/minute

Adjust in `backend/middleware/rateLimiter.js` if needed.

### Caching

Current cache settings:
- Collection metadata: 5-minute TTL, 1000 entry limit
- Helius API responses: 1-hour TTL, 10,000 entry limit

Adjust in respective service files if needed.

## Part 6: Rollback Procedures

If you need to rollback a deployment:

### Rollback Application

1. In Vercel dashboard, go to "Deployments"
2. Find the last working deployment
3. Click "..." → "Promote to Production"

### Rollback Database

See `database/migrations/ROLLBACK_PROCEDURES.md` for detailed instructions.

Quick rollback:
```bash
cd backend
node database/migrations/rollback.js --to=003
```

## Part 7: Custom Domain Setup (Optional)

### Add Custom Domain

1. In Vercel project, go to **Settings** → **Domains**
2. Click "Add Domain"
3. Enter your domain (e.g., `stake.yourdomain.com`)
4. Follow DNS configuration instructions
5. Wait for DNS propagation (can take up to 48 hours)

### Update Environment Variables

After adding custom domain:
1. Update `ALLOWED_ORIGINS` to include your custom domain
2. Update `VITE_API_URL` in frontend environment variables
3. Redeploy

## Troubleshooting

For common deployment issues, see [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md).

### Quick Checks

**Deployment fails**:
- Check Vercel build logs for errors
- Verify all environment variables are set
- Check for syntax errors in code

**Database connection fails**:
- Verify DATABASE_URL is correct
- Check Neon DB is running (not paused)
- Verify IP allowlist in Neon (should allow all for Vercel)

**Frontend can't reach backend**:
- Verify VITE_API_URL matches your Vercel domain
- Check CORS configuration
- Verify ALLOWED_ORIGINS includes your frontend domain

## Security Checklist

Before going live:
- [ ] All environment variables set (no fallback values)
- [ ] JWT_SECRET is cryptographically random (64+ characters)
- [ ] ALLOWED_ORIGINS contains only your domains (no wildcards)
- [ ] Admin wallet address is correct
- [ ] Database migrations completed successfully
- [ ] Health endpoint returns "healthy"
- [ ] All tests passing
- [ ] Security tests passing
- [ ] Mainnet testing completed with real transactions
- [ ] Error boundaries working in frontend
- [ ] Rate limiting tested and working
- [ ] Audit logging verified

## Support & Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Neon DB Documentation**: https://neon.tech/docs
- **Solana Documentation**: https://docs.solana.com
- **Helius Documentation**: https://docs.helius.dev

## Next Steps

After successful deployment:
1. Monitor logs for the first 24 hours
2. Watch for any error patterns
3. Verify transaction confirmations are working
4. Check database performance metrics
5. Announce to your community

For ongoing maintenance, see the [Admin Guide](ADMIN_GUIDE.md).
