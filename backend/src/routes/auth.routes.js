const express = require('express');
const router = express.Router();
const { login, verify, logout } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Debug logging
console.log('[AUTH ROUTES] Loading authentication routes');

// Public routes
router.post('/login', login);

// Protected routes
router.get('/verify', authenticate, verify);
router.post('/logout', authenticate, logout);

// Test route for debugging
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes working',
    endpoints: [
      'POST /api/auth/login',
      'GET /api/auth/verify',
      'POST /api/auth/logout'
    ]
  });
});

console.log('[AUTH ROUTES] Routes loaded successfully');

module.exports = router;