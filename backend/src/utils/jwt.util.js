const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (userId, email, role) => {
  console.log('[JWT UTIL] Generating token for:', email);

  const payload = {
    userId,
    email,
    role
  };

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    }
  );

  console.log('[JWT UTIL] Token generated successfully');
  return token;
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    console.log('[JWT UTIL] Verifying token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[JWT UTIL] Token verified for:', decoded.email);
    return decoded;
  } catch (error) {
    console.error('[JWT UTIL] Token verification failed:', error.message);
    throw error;
  }
};

module.exports = {
  generateToken,
  verifyToken
};