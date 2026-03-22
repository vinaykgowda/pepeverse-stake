// backend/routes/auth.js

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getPool } = require('../src/db');
const authService = require('../src/services/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const pool = getPool();

// Generate nonce for wallet authentication
router.post('/nonce', authLimiter, async (req, res) => {
  try {
    const { wallet } = req.body;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    // Generate nonce using AuthService
    const nonce = await authService.generateNonce(wallet);

    return res.json({
      success: true,
      nonce
    });
  } catch (error) {
    console.error('Error generating nonce:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to generate nonce'
    });
  }
});

// Verify signature and authenticate wallet
router.post('/verify', authLimiter, async (req, res) => {
  try {
    const { wallet, signature, message } = req.body;

    if (!wallet || !signature || !message) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address, signature, and message are required'
      });
    }

    // Verify signature using AuthService
    // This will:
    // 1. Verify nonce matches message
    // 2. Verify signature using nacl
    // 3. Delete nonce after use (single use)
    const result = await authService.verifySignature(wallet, signature, message);

    if (!result.valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // Check if wallet is admin
    const result = await pool.query(
      'SELECT id FROM admins WHERE wallet_address = $1',
      [wallet]
    );

    const isAdmin = result.rows.length > 0;

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }
    
    const token = jwt.sign(
      {
        walletAddress: wallet,
        isAdmin
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      user: {
        walletAddress: wallet,
        isAdmin
      }
    });
  } catch (error) {
    console.error('Error verifying signature:', error);

    // Return appropriate error status based on error type
    const statusCode = error.message.includes('nonce') || 
                       error.message.includes('Invalid') ? 401 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error verifying signature'
    });
  }
});

// Admin login
router.post('/admin/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // PostgreSQL query (not MySQL)
    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const admin = result.rows[0];

    // Verify password using bcrypt
    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await pool.query(
      'UPDATE admins SET last_login = NOW() WHERE id = $1',
      [admin.id]
    );

    // Generate token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }
    
    const token = jwt.sign(
      {
        adminId: admin.id,
        username: admin.username,
        isAdmin: true,
        isSuperAdmin: admin.is_super_admin
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      user: {
        adminId: admin.id,
        username: admin.username,
        isAdmin: true,
        isSuperAdmin: admin.is_super_admin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
