const express = require('express');
const router = express.Router();
const {
  createUser,
  getUsers,
  updateUser,
  updateUserStatus,
  deleteUser
} = require('../controllers/admin.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// Debug logging
console.log('[ADMIN ROUTES] Loading admin routes');

// All admin routes require authentication and admin role
router.use(authenticate, isAdmin);

// User management routes
router.post('/users', createUser);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// Test route for debugging
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Admin routes working',
    user: req.user,
    endpoints: [
      'POST /api/admin/users',
      'GET /api/admin/users',
      'PUT /api/admin/users/:id',
      'DELETE /api/admin/users/:id'
    ]
  });
});

console.log('[ADMIN ROUTES] Routes loaded successfully');

module.exports = router;