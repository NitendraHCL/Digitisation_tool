const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivity,
  getPerformanceMetrics,
  getSystemHealth,
  getLabAccuracyStats
} = require('../controllers/dashboard.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// All dashboard routes require admin authentication
router.use(authenticate);
router.use(isAdmin);

// Dashboard statistics
router.get('/stats', getDashboardStats);

// Recent activity
router.get('/activity', getRecentActivity);

// Performance metrics
router.get('/metrics', getPerformanceMetrics);

// System health
router.get('/health', getSystemHealth);

// Lab accuracy statistics
router.get('/lab-accuracy', getLabAccuracyStats);

console.log('[DASHBOARD ROUTES] Routes loaded successfully');

module.exports = router;