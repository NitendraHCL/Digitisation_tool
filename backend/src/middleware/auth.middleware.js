const { verifyToken } = require('../utils/jwt.util');

// Authenticate user
const authenticate = async (req, res, next) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    console.log(`[AUTH MIDDLEWARE ${requestId}] ========== AUTHENTICATION START ==========`);
    console.log(`[AUTH MIDDLEWARE ${requestId}] Timestamp:`, new Date().toISOString());
    console.log(`[AUTH MIDDLEWARE ${requestId}] Request: ${req.method} ${req.url}`);
    console.log(`[AUTH MIDDLEWARE ${requestId}] IP:`, req.ip);

    // Get token from header
    console.log(`[AUTH MIDDLEWARE ${requestId}] Step 1: Checking for Authorization header...`);
    const authHeader = req.headers.authorization;
    console.log(`[AUTH MIDDLEWARE ${requestId}] Authorization header present:`, !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[AUTH MIDDLEWARE ${requestId}] ✗ No valid Authorization header`);
      console.log(`[AUTH MIDDLEWARE ${requestId}] Header value:`, authHeader ? authHeader.substring(0, 20) + '...' : 'null');
      console.log(`[AUTH MIDDLEWARE ${requestId}] Duration: ${Date.now() - startTime}ms`);
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login.'
      });
    }
    console.log(`[AUTH MIDDLEWARE ${requestId}] ✓ Authorization header found`);

    // Extract token
    console.log(`[AUTH MIDDLEWARE ${requestId}] Step 2: Extracting token...`);
    const token = authHeader.substring(7);
    console.log(`[AUTH MIDDLEWARE ${requestId}] ✓ Token extracted (length: ${token.length})`);
    console.log(`[AUTH MIDDLEWARE ${requestId}] Token preview: ${token.substring(0, 20)}...`);

    // Verify token
    console.log(`[AUTH MIDDLEWARE ${requestId}] Step 3: Verifying JWT token...`);
    const verifyStart = Date.now();
    const decoded = verifyToken(token);
    const verifyDuration = Date.now() - verifyStart;
    console.log(`[AUTH MIDDLEWARE ${requestId}] ✓ Token verified in ${verifyDuration}ms`);
    console.log(`[AUTH MIDDLEWARE ${requestId}] Decoded token data:`);
    console.log(`[AUTH MIDDLEWARE ${requestId}]   - User ID: ${decoded.userId}`);
    console.log(`[AUTH MIDDLEWARE ${requestId}]   - Email: ${decoded.email}`);
    console.log(`[AUTH MIDDLEWARE ${requestId}]   - Role: ${decoded.role}`);
    console.log(`[AUTH MIDDLEWARE ${requestId}]   - Issued at: ${new Date(decoded.iat * 1000).toISOString()}`);
    console.log(`[AUTH MIDDLEWARE ${requestId}]   - Expires at: ${new Date(decoded.exp * 1000).toISOString()}`);

    // Attach user info to request
    console.log(`[AUTH MIDDLEWARE ${requestId}] Step 4: Attaching user to request...`);
    req.user = decoded;
    console.log(`[AUTH MIDDLEWARE ${requestId}] ✓ User info attached to request`);

    const totalDuration = Date.now() - startTime;
    console.log(`[AUTH MIDDLEWARE ${requestId}] ========== AUTHENTICATION SUCCESSFUL ==========`);
    console.log(`[AUTH MIDDLEWARE ${requestId}] ✓✓✓ User authenticated: ${decoded.email}`);
    console.log(`[AUTH MIDDLEWARE ${requestId}] Role: ${decoded.role}`);
    console.log(`[AUTH MIDDLEWARE ${requestId}] Total duration: ${totalDuration}ms`);
    console.log(`[AUTH MIDDLEWARE ${requestId}] ========================================`);

    next();
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[AUTH MIDDLEWARE ${requestId}] ========================================`);
    console.error(`[AUTH MIDDLEWARE ${requestId}] ✗✗✗ AUTHENTICATION FAILED ✗✗✗`);
    console.error(`[AUTH MIDDLEWARE ${requestId}] ========================================`);
    console.error(`[AUTH MIDDLEWARE ${requestId}] Error type:`, error.constructor.name);
    console.error(`[AUTH MIDDLEWARE ${requestId}] Error name:`, error.name);
    console.error(`[AUTH MIDDLEWARE ${requestId}] Error message:`, error.message);
    console.error(`[AUTH MIDDLEWARE ${requestId}] Error stack:`, error.stack);
    console.error(`[AUTH MIDDLEWARE ${requestId}] Total duration: ${totalDuration}ms`);
    console.error(`[AUTH MIDDLEWARE ${requestId}] ========================================`);

    if (error.name === 'TokenExpiredError') {
      console.error(`[AUTH MIDDLEWARE ${requestId}] ⚠️  Token has expired`);
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      console.error(`[AUTH MIDDLEWARE ${requestId}] ⚠️  Invalid JWT token`);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  console.log('[AUTH MIDDLEWARE] Checking admin role for:', req.user?.email);

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    console.log('[AUTH MIDDLEWARE] Access denied. User role:', req.user.role);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }

  console.log('[AUTH MIDDLEWARE] Admin access granted');
  next();
};

// Check if user is nurse or admin
const isNurseOrAdmin = (req, res, next) => {
  console.log('[AUTH MIDDLEWARE] Checking nurse/admin role for:', req.user?.email);

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const allowedRoles = ['nurse', 'admin', 'super_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    console.log('[AUTH MIDDLEWARE] Access denied. User role:', req.user.role);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Nurse or Admin role required.'
    });
  }

  console.log('[AUTH MIDDLEWARE] Access granted');
  next();
};

// Check if user is super admin only
const isSuperAdmin = (req, res, next) => {
  console.log('[AUTH MIDDLEWARE] Checking super_admin role for:', req.user?.email);

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'super_admin') {
    console.log('[AUTH MIDDLEWARE] Access denied. User role:', req.user.role);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super Admin role required.'
    });
  }

  console.log('[AUTH MIDDLEWARE] Super Admin access granted');
  next();
};

module.exports = {
  authenticate,
  isAdmin,
  isNurseOrAdmin,
  isSuperAdmin
};