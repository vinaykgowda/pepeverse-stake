// backend/middleware/auth.js

const jwt = require('jsonwebtoken');

// Verify JWT
const verifyJWT = (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token, authorization denied'
    });
  }

  try {
    // Verify token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: JWT_SECRET not configured'
      });
    }
    
    const decoded = jwt.verify(token, jwtSecret);

    // Add user from payload to request
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

module.exports = {
  verifyJWT,
  verifyAdmin: require('./admin').verifyAdmin
};