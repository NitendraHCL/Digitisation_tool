const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const {
  getAuditSummary,
  getAuditReports,
  getMostEditedParameters,
  getAccuracyTrends,
  getMismatches,
  getMismatchStats,
  getUserMismatchHistory
} = require('../controllers/auditAnalytics.controller');

// All routes require authentication and admin role
router.use(authenticate, isAdmin);

// GET /api/audit/summary - Get overall audit statistics
router.get('/summary', getAuditSummary);

// GET /api/audit/reports - Get paginated list of reports with audit data
router.get('/reports', getAuditReports);

// GET /api/audit/parameters - Get most edited parameters
router.get('/parameters', getMostEditedParameters);

// GET /api/audit/trends - Get accuracy trends over time
router.get('/trends', getAccuracyTrends);

// Mismatch tracking endpoints
// GET /api/audit/mismatches - Get all mismatch records with filters
router.get('/mismatches', getMismatches);

// GET /api/audit/mismatches/stats - Get mismatch statistics
router.get('/mismatches/stats', getMismatchStats);

// GET /api/audit/mismatches/by-user/:userId - Get user-specific mismatch history
router.get('/mismatches/by-user/:userId', getUserMismatchHistory);

module.exports = router;
