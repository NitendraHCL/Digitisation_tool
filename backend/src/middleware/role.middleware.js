// Role-based access control middleware

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // User should already be authenticated by auth middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role;

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(userRole)) {
      console.log(`[ROLE MIDDLEWARE] Access denied for role: ${userRole}. Required roles: ${allowedRoles.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }

    // User has the required role, proceed to next middleware
    next();
  };
};

module.exports = checkRole;