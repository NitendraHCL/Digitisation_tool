const User = require('../models/User');
const { generateToken } = require('../utils/jwt.util');

// Login controller
const login = async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log(`[AUTH ${requestId}] ========== LOGIN ATTEMPT START ==========`);
    console.log(`[AUTH ${requestId}] Timestamp:`, new Date().toISOString());
    console.log(`[AUTH ${requestId}] Email:`, req.body.email);
    console.log(`[AUTH ${requestId}] Password provided:`, !!req.body.password);
    console.log(`[AUTH ${requestId}] Password length:`, req.body.password?.length);
    console.log(`[AUTH ${requestId}] Request IP:`, req.ip);
    console.log(`[AUTH ${requestId}] User-Agent:`, req.get('user-agent'));

    const { email, password } = req.body;

    // Validate input
    console.log(`[AUTH ${requestId}] Step 1: Validating input...`);
    if (!email || !password) {
      console.log(`[AUTH ${requestId}] ✗ Validation failed - email or password missing`);
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    console.log(`[AUTH ${requestId}] ✓ Input validation passed`);

    // Find user
    console.log(`[AUTH ${requestId}] Step 2: Searching for user in database...`);
    console.log(`[AUTH ${requestId}] Query: { email: "${email}" }`);
    const userLookupStart = Date.now();
    const user = await User.findOne({ email });
    const userLookupDuration = Date.now() - userLookupStart;
    console.log(`[AUTH ${requestId}] Database query completed in ${userLookupDuration}ms`);

    if (!user) {
      console.log(`[AUTH ${requestId}] ✗ User not found in database: ${email}`);
      console.log(`[AUTH ${requestId}] Total duration: ${Date.now() - startTime}ms`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    console.log(`[AUTH ${requestId}] ✓ User found:`);
    console.log(`[AUTH ${requestId}]   - ID: ${user._id}`);
    console.log(`[AUTH ${requestId}]   - Email: ${user.email}`);
    console.log(`[AUTH ${requestId}]   - Name: ${user.name}`);
    console.log(`[AUTH ${requestId}]   - Role: ${user.role}`);
    console.log(`[AUTH ${requestId}]   - Active: ${user.isActive}`);
    console.log(`[AUTH ${requestId}]   - Last Login: ${user.lastLogin || 'Never'}`);

    // Check if user is active
    console.log(`[AUTH ${requestId}] Step 3: Checking if user is active...`);
    if (!user.isActive) {
      console.log(`[AUTH ${requestId}] ✗ User account is inactive: ${email}`);
      console.log(`[AUTH ${requestId}] Total duration: ${Date.now() - startTime}ms`);
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Contact admin.'
      });
    }
    console.log(`[AUTH ${requestId}] ✓ User account is active`);

    // Verify password
    console.log(`[AUTH ${requestId}] Step 4: Verifying password...`);
    console.log(`[AUTH ${requestId}] Calling user.comparePassword() with bcrypt...`);
    const passwordCheckStart = Date.now();
    const isMatch = await user.comparePassword(password);
    const passwordCheckDuration = Date.now() - passwordCheckStart;
    console.log(`[AUTH ${requestId}] Password comparison completed in ${passwordCheckDuration}ms`);

    if (!isMatch) {
      console.log(`[AUTH ${requestId}] ✗ Password verification failed for: ${email}`);
      console.log(`[AUTH ${requestId}] Total duration: ${Date.now() - startTime}ms`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    console.log(`[AUTH ${requestId}] ✓ Password verified successfully`);

    // Update last login
    console.log(`[AUTH ${requestId}] Step 5: Updating last login timestamp...`);
    const updateStart = Date.now();
    user.lastLogin = new Date();
    await user.save();
    const updateDuration = Date.now() - updateStart;
    console.log(`[AUTH ${requestId}] ✓ Last login updated in ${updateDuration}ms`);

    // Generate token
    console.log(`[AUTH ${requestId}] Step 6: Generating JWT token...`);
    const tokenStart = Date.now();
    const token = generateToken(user._id, user.email, user.role);
    const tokenDuration = Date.now() - tokenStart;
    console.log(`[AUTH ${requestId}] ✓ Token generated in ${tokenDuration}ms`);
    console.log(`[AUTH ${requestId}] Token preview: ${token.substring(0, 20)}...`);

    const totalDuration = Date.now() - startTime;
    console.log(`[AUTH ${requestId}] ========== LOGIN SUCCESSFUL ==========`);
    console.log(`[AUTH ${requestId}] ✓✓✓ Login successful for: ${email}`);
    console.log(`[AUTH ${requestId}] User role: ${user.role}`);
    console.log(`[AUTH ${requestId}] Total duration: ${totalDuration}ms`);
    console.log(`[AUTH ${requestId}]   - User lookup: ${userLookupDuration}ms`);
    console.log(`[AUTH ${requestId}]   - Password check: ${passwordCheckDuration}ms`);
    console.log(`[AUTH ${requestId}]   - DB update: ${updateDuration}ms`);
    console.log(`[AUTH ${requestId}]   - Token generation: ${tokenDuration}ms`);
    console.log(`[AUTH ${requestId}] ========================================`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[AUTH ${requestId}] ========================================`);
    console.error(`[AUTH ${requestId}] ✗✗✗ LOGIN ERROR ✗✗✗`);
    console.error(`[AUTH ${requestId}] ========================================`);
    console.error(`[AUTH ${requestId}] Error type:`, error.constructor.name);
    console.error(`[AUTH ${requestId}] Error message:`, error.message);
    console.error(`[AUTH ${requestId}] Error stack:`, error.stack);
    console.error(`[AUTH ${requestId}] Total duration: ${totalDuration}ms`);
    console.error(`[AUTH ${requestId}] ========================================`);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify token controller
const verify = async (req, res) => {
  try {
    console.log('[AUTH CONTROLLER] Token verification for:', req.user.email);

    // Get fresh user data
    const user = await User.findById(req.user.userId).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('[AUTH CONTROLLER] Verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Logout controller (optional - mainly for client-side token removal)
const logout = async (req, res) => {
  console.log('[AUTH CONTROLLER] Logout for:', req.user?.email);

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};

module.exports = {
  login,
  verify,
  logout
};