# Vercel Deployment Guide - Pepeverse Staking Platform

## Prerequisites
- GitHub repository: `https://github.com/vinaykgowda/pepeverse-stake.git`
- NeonDB PostgreSQL database created
- Vercel account

---

## STEP 1: Setup NeonDB Database

### 1.1 Get Your NeonDB Connection String
1. Go to your NeonDB dashboard
2. Copy your connection string (looks like):
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

### 1.2 Run the Database Setup Script
1. Open NeonDB SQL Editor
2. Copy and paste the entire content from `database/neon-setup.sql`
3. Click "Run" to execute
4. Verify all tables are created (should see 8 tables)

---

## STEP 2: Deploy Backend First

### 2.1 Import Project to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repository: `pepeverse-stake`
3. Configure the project:

**Project Settings:**
- **Project Name:** `pepeverse-stake-backend`
- **Framework Preset:** `Other`
- **Root Directory:** `backend` ⚠️ IMPORTANT
- **Build Command:** (leave empty)
- **Output Directory:** (leave empty)
- **Install Command:** `npm install`

### 2.2 Add Environment Variables

Click "Environment Variables" and add these:

```bash
# Server Configuration
NODE_ENV=production
PORT=3001
API_BASE_URL=/api/v1

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRY=24h

# Database Configuration (NeonDB)
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app

# Encryption Key (for wallet private keys)
ENCRYPTION_KEY=generate-a-64-char-random-string-here-use-crypto-randomBytes

# Admin Configuration (optional)
ADMIN_WALLET=your-admin-solana-wallet-address
```

### 2.3 Generate Secure Keys

**For JWT_SECRET (minimum 32 characters):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**For ENCRYPTION_KEY (64 characters):**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 2.4 Deploy Backend
1. Click "Deploy"
2. Wait for deployment to complete
3. Copy your backend URL (e.g., `https://pepeverse-stake-backend.vercel.app`)
4. Test it: `https://pepeverse-stake-backend.vercel.app/api/v1/health`

---

## STEP 3: Deploy Frontend

### 3.1 Import Project to Vercel Again
1. Go to https://vercel.com/new
2. Import the SAME GitHub repository: `pepeverse-stake`
3. Configure the project:

**Project Settings:**
- **Project Name:** `pepeverse-stake-frontend`
- **Framework Preset:** `Vite`
- **Root Directory:** `frontend` ⚠️ IMPORTANT
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### 3.2 Add Environment Variables

Click "Environment Variables" and add these:

```bash
# Backend API URL (use your backend Vercel URL from Step 2.4)
VITE_API_URL=https://pepeverse-stake-backend.vercel.app/api/v1

# Solana RPC URL
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Solana Network
VITE_SOLANA_NETWORK=mainnet-beta
```

### 3.3 Deploy Frontend
1. Click "Deploy"
2. Wait for deployment to complete
3. Copy your frontend URL (e.g., `https://pepeverse-stake-frontend.vercel.app`)

---

## STEP 4: Update CORS Configuration

### 4.1 Update Backend Environment Variables
1. Go to your backend Vercel project settings
2. Find the `ALLOWED_ORIGINS` environment variable
3. Update it with your frontend URL:
   ```
   ALLOWED_ORIGINS=https://pepeverse-stake-frontend.vercel.app
   ```
4. Redeploy the backend

---

## STEP 5: Configure Rewards Wallet

### 5.1 Login to Admin Panel
1. Go to `https://pepeverse-stake-frontend.vercel.app/admin/login`
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. ⚠️ **IMPORTANT:** Change the password immediately!

### 5.2 Setup Rewards Wallet
1. Go to Admin → Wallet Settings
2. Enter your Solana wallet private key (will be encrypted)
3. Save the configuration

---

## Environment Variables Summary

### Backend Environment Variables (8 required)
```
NODE_ENV=production
PORT=3001
API_BASE_URL=/api/v1
JWT_SECRET=<generate-secure-key>
JWT_EXPIRY=24h
DATABASE_URL=<your-neondb-connection-string>
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
ALLOWED_ORIGINS=<your-frontend-url>
ENCRYPTION_KEY=<generate-secure-key>
```

### Frontend Environment Variables (3 required)
```
VITE_API_URL=<your-backend-url>/api/v1
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_SOLANA_NETWORK=mainnet-beta
```

---

## Testing Checklist

- [ ] Backend health check: `GET /api/v1/health`
- [ ] Frontend loads without errors
- [ ] Admin login works
- [ ] Wallet connection works
- [ ] Database tables are created
- [ ] CORS is properly configured

---

## Troubleshooting

### Backend Issues
- Check Vercel logs for errors
- Verify DATABASE_URL is correct
- Test database connection in NeonDB dashboard
- Ensure all environment variables are set

### Frontend Issues
- Check browser console for errors
- Verify VITE_API_URL points to backend
- Check CORS configuration in backend
- Ensure backend is deployed and running

### Database Issues
- Run the setup script again if tables are missing
- Check NeonDB connection string format
- Verify SSL mode is enabled (`?sslmode=require`)

---

## Security Notes

1. **Change default admin password immediately**
2. **Never commit .env files to Git**
3. **Use strong JWT_SECRET and ENCRYPTION_KEY**
4. **Regularly rotate secrets**
5. **Monitor Vercel logs for suspicious activity**
6. **Enable Vercel's security features**

---

## Auto-Deployment

Both projects will auto-deploy when you push to GitHub:
- Push to `main` branch → Both frontend and backend redeploy automatically
- Vercel detects changes in respective directories

---

## Custom Domain (Optional)

### For Frontend:
1. Go to frontend project → Settings → Domains
2. Add your custom domain (e.g., `stake.pepeverse.com`)
3. Update DNS records as instructed

### For Backend:
1. Go to backend project → Settings → Domains
2. Add your custom domain (e.g., `api.pepeverse.com`)
3. Update frontend `VITE_API_URL` to use new domain
4. Update backend `ALLOWED_ORIGINS` to include new frontend domain

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console (F12)
3. Verify all environment variables
4. Test database connection
5. Check CORS configuration
