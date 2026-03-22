// backend/middleware/admin.js

// Verify admin role
const verifyAdmin = (req, res, next) => {
  // Check if user is admin
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  next();
};

// Verify super admin role
const verifySuperAdmin = (req, res, next) => {
  // Check if user is super admin
  if (!req.user || !req.user.isAdmin || !req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super admin privileges required.'
    });
  }

  next();
};

module.exports = {
  verifyAdmin,
  verifySuperAdmin
};