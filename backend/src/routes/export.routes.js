const express = require('express');
const router = express.Router();
const {
  exportToCSV,
  exportToExcel,
  exportReportJSON,
  generateSummaryReport
} = require('../controllers/export.controller');
const { authenticate, isNurseOrAdmin } = require('../middleware/auth.middleware');

// All export routes require authentication
router.use(authenticate);
router.use(isNurseOrAdmin);

// Export to CSV
router.get('/csv', exportToCSV);

// Export to Excel
router.get('/excel', exportToExcel);

// Export single report as JSON
router.get('/json/:id', exportReportJSON);

// Generate summary report
router.get('/summary', generateSummaryReport);

console.log('[EXPORT ROUTES] Routes loaded successfully');

module.exports = router;