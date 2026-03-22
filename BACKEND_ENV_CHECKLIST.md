# Backend Environment Variables Checklist

## ✅ Minimal Setup (Health Check Only)

These are already set by default - your backend should now start successfully:

```bash
NODE_ENV=production
```

Test: `https://pv-stake-backend.vercel.app/api/v1/health`

---

## 🔧 Required for Full Functionality

Add these in Vercel → Your Backend Project → Settings → Environment Variables:

### 1. Database (NeonDB) - REQUIRED
```bash
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
```
Get this from your NeonDB dashboard connection string.

### 2. JWT Authentication - REQUIRED
```bash
JWT_SECRET=<generate-with-command-below>
JWT_EXPIRY=24h
```

Generate secure JWT_SECRET (32+ characters):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Encryption Key - REQUIRED
```bash
ENCRYPTION_KEY=<generate-with-command-below>
```

Generate secure ENCRYPTION_KEY (64 characters):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 4. Solana Network - REQUIRED
```bash
MAINNET_RPC_PRIMARY=https://api.mainnet-beta.solana.com
MAINNET_RPC_FALLBACK=https://solana-api.projectserum.com
SOLANA_NETWORK=mainnet-beta
```

For devnet testing:
```bash
MAINNET_RPC_PRIMARY=https://api.devnet.solana.com
MAINNET_RPC_FALLBACK=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
```

### 5. Helius API - REQUIRED for NFT Features
```bash
HELIUS_MAINNET_ENDPOINT=https://mainnet.helius-rpc.com
HELIUS_API_KEY=<your-helius-api-key>
```

Get your Helius API key from: https://www.helius.dev/

### 6. API Configuration - REQUIRED
```bash
API_BASE_URL=/api/v1
PORT=3001
```

### 7. CORS - REQUIRED
```bash
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

Update this after deploying your frontend.

---

## 📋 Complete Environment Variables List

Copy this template and fill in your values:

```bash
# Server Configuration
NODE_ENV=production
PORT=3001
API_BASE_URL=/api/v1

# JWT Authentication
JWT_SECRET=<generate-secure-key>
JWT_EXPIRY=24h

# Database (NeonDB)
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require

# Solana Network
MAINNET_RPC_PRIMARY=https://api.mainnet-beta.solana.com
MAINNET_RPC_FALLBACK=https://solana-api.projectserum.com
SOLANA_NETWORK=mainnet-beta

# Helius API
HELIUS_MAINNET_ENDPOINT=https://mainnet.helius-rpc.com
HELIUS_API_KEY=<your-helius-api-key>

# CORS
ALLOWED_ORIGINS=https://your-frontend.vercel.app

# Encryption
ENCRYPTION_KEY=<generate-secure-key>
```

---

## 🚀 Deployment Steps

1. **First Deploy (Minimal)**
   - Deploy backend with just `NODE_ENV=production`
   - Test health endpoint: `/api/v1/health`
   - Should return: `{"status":"ok",...}`

2. **Add Database**
   - Run `database/neon-setup.sql` in NeonDB
   - Add `DATABASE_URL` to Vercel
   - Redeploy backend

3. **Add Authentication**
   - Generate and add `JWT_SECRET`
   - Generate and add `ENCRYPTION_KEY`
   - Redeploy backend

4. **Add Solana Network**
   - Add all `MAINNET_RPC_*` and `SOLANA_NETWORK` variables
   - Redeploy backend

5. **Add Helius (for NFT features)**
   - Get Helius API key
   - Add `HELIUS_MAINNET_ENDPOINT` and `HELIUS_API_KEY`
   - Redeploy backend

6. **Configure CORS**
   - Deploy frontend first
   - Get frontend URL
   - Add to `ALLOWED_ORIGINS`
   - Redeploy backend

---

## 🧪 Testing Each Step

### After Minimal Deploy:
```bash
curl https://pv-stake-backend.vercel.app/api/v1/health
# Should return: {"status":"ok","database":"not configured"}
```

### After Database Added:
```bash
curl https://pv-stake-backend.vercel.app/api/v1/health
# Should return: {"status":"ok","database":"configured"}
```

### After Full Setup:
- All API endpoints should work
- Admin login should work
- NFT staking features should work

---

## ⚠️ Important Notes

1. **Never commit these values to Git**
2. **Generate new secrets for production** (don't use examples)
3. **Use strong, random keys** (minimum 32 characters)
4. **Keep Helius API key secure**
5. **Update CORS after frontend deployment**

---

## 🔍 Troubleshooting

### Backend won't start:
- Check Vercel logs for specific errors
- Ensure DATABASE_URL format is correct
- Verify all required variables are set

### Database errors:
- Check NeonDB connection string
- Ensure `?sslmode=require` is in DATABASE_URL
- Verify tables are created (run neon-setup.sql)

### CORS errors:
- Add frontend URL to ALLOWED_ORIGINS
- Ensure no trailing slashes in URLs
- Redeploy backend after changing CORS

### NFT features not working:
- Verify HELIUS_API_KEY is valid
- Check Helius dashboard for API limits
- Ensure HELIUS_MAINNET_ENDPOINT is correct
