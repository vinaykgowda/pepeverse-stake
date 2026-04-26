// backend/middleware/daoAdmin.js

// Verify DAO admin role
const verifyDaoAdmin = (req, res, next) => {
  // Check if user is DAO admin
  if (!req.user || req.user.isDaoAdmin !== true) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. DAO admin privileges required.'
    });
  }

  next();
};

module.exports = {
  verifyDaoAdmin
};
