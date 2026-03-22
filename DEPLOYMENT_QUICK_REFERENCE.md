# Quick Deployment Reference

## Order of Deployment
1. ✅ Setup NeonDB Database
2. ✅ Deploy Backend
3. ✅ Deploy Frontend
4. ✅ Update CORS
5. ✅ Configure Admin

---

## Backend Vercel Settings
```
Framework: Other
Root Directory: backend
Build Command: (empty)
Output Directory: (empty)
```

## Frontend Vercel Settings
```
Framework: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

---

## Generate Secure Keys

```bash
# JWT_SECRET (32+ chars)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# ENCRYPTION_KEY (64 chars)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

---

## Backend ENV (10 variables)
```bash
NODE_ENV=production
PORT=3001
API_BASE_URL=/api/v1
JWT_SECRET=<generated>
JWT_EXPIRY=24h
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
ALLOWED_ORIGINS=https://your-frontend.vercel.app
ENCRYPTION_KEY=<generated>
```

## Frontend ENV (3 variables)
```bash
VITE_API_URL=https://your-backend.vercel.app/api/v1
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_SOLANA_NETWORK=mainnet-beta
```

---

## Default Admin Login
```
Username: admin
Password: admin123
⚠️ CHANGE IMMEDIATELY AFTER FIRST LOGIN!
```

---

## Test URLs
- Backend Health: `https://your-backend.vercel.app/api/v1/health`
- Frontend: `https://your-frontend.vercel.app`
- Admin Panel: `https://your-frontend.vercel.app/admin/login`
