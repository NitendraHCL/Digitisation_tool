const express = require('express');
const router = express.Router();
const { authenticate, isAdmin, isSuperAdmin } = require('../middleware/auth.middleware');
const {
  getAuditSummary,
  getAuditReports,
  getMostEditedParameters,
  getAccuracyTrends,
  getMismatches,
  getMismatchStats,
  getUserMismatchHistory
} = require('../controllers/auditAnalytics.controller');

// Processing audit logs controller
const auditController = require('../controllers/audit.controller');

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

// ==========================================
// PROCESSING AUDIT LOGS (Real-time debugging)
// ==========================================

// GET /api/audit/processing/logs - Get all stored processing logs (max 6 reports)
router.get('/processing/logs', auditController.getReportLogs);

// GET /api/audit/processing/logs/:requestId - Get detailed log for specific request
router.get('/processing/logs/:requestId', auditController.getLogByRequestId);

// GET /api/audit/processing/active - Get currently active processing sessions
router.get('/processing/active', auditController.getActiveSessions);

// DELETE /api/audit/processing/logs - Clear all processing logs
router.delete('/processing/logs', auditController.clearLogs);

// ==========================================
// FILE-BASED LOG ACCESS (Admin only)
// ==========================================

// GET /api/audit/logs/:reportId - Get log file content for a report as JSON
router.get('/logs/:reportId', auditController.getLogFileByReportId);

// GET /api/audit/logs/:reportId/download - Download raw log file
router.get('/logs/:reportId/download', auditController.downloadLogFile);

// GET /api/audit/errors/today - Get today's error summary
router.get('/errors/today', auditController.getTodayErrorLog);

// GET /api/audit/errors/:date - Get error log for a specific date (YYYY-MM-DD)
router.get('/errors/:date', auditController.getErrorLogByDate);

// POST /api/audit/logs/cleanup - Trigger log cleanup (SuperAdmin only)
router.post('/logs/cleanup', isSuperAdmin, auditController.triggerLogCleanup);

module.exports = router;
