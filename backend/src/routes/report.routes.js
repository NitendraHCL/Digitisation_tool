const express = require('express');
const router = express.Router();
const {
  uploadPDF,
  uploadMultiplePDFs,
  getReports,
  getReportById,
  downloadPDF,
  updateReport,
  deleteReport,
  cleanupStuckReports,
  revalidateParameters
} = require('../controllers/report.controller');
const {
  processReport,
  processMultipleReports,
  getExtractedData,
  reprocessReport
} = require('../controllers/process.controller');
const { authenticate, isNurseOrAdmin, isAdmin } = require('../middleware/auth.middleware');
const { uploadPDF: uploadMiddleware, uploadMultiplePDFs: uploadMultipleMiddleware, handleUploadError } = require('../middleware/upload.middleware');
const LabConfig = require('../models/LabConfig');

// Debug logging
console.log('[REPORT ROUTES] Loading report routes');

// All report routes require authentication
router.use(authenticate);

// Nurse and Admin routes
router.post('/upload', isNurseOrAdmin, uploadMiddleware, handleUploadError, uploadPDF);
router.post('/upload/multiple', isNurseOrAdmin, uploadMultipleMiddleware, handleUploadError, uploadMultiplePDFs);
router.get('/', isNurseOrAdmin, getReports);

// Get configured lab names (accessible to nurses and admins for lab name editing)
// IMPORTANT: This must be BEFORE /:id routes to prevent "config" from being matched as an id
router.get('/config/lab-names', isNurseOrAdmin, async (req, res) => {
  try {
    const config = await LabConfig.getConfig();
    const labNames = config.labs.map(lab => lab.name);
    console.log('[REPORT ROUTES] Returning lab names:', labNames);
    res.json({
      success: true,
      data: labNames
    });
  } catch (error) {
    console.error('[REPORT ROUTES] Get lab names error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lab names'
    });
  }
});

router.get('/:id', isNurseOrAdmin, getReportById);
router.get('/:id/pdf', isNurseOrAdmin, downloadPDF);
router.patch('/:id', isNurseOrAdmin, updateReport);

// Processing routes
router.post('/:id/process', isNurseOrAdmin, processReport);
router.post('/process-multiple', isNurseOrAdmin, processMultipleReports);
router.get('/:id/extracted', isNurseOrAdmin, getExtractedData);
router.post('/:id/revalidate', isNurseOrAdmin, revalidateParameters);
router.post('/:id/reprocess', isNurseOrAdmin, reprocessReport);

// Delete report (nurses can delete their own, admins can delete any)
router.delete('/:id', isNurseOrAdmin, deleteReport);
router.post('/cleanup/stuck', isAdmin, cleanupStuckReports);

// Test route for debugging
router.get('/test/info', (req, res) => {
  res.json({
    success: true,
    message: 'Report routes working',
    user: req.user,
    endpoints: [
      'POST /api/reports/upload',
      'GET /api/reports',
      'GET /api/reports/:id',
      'GET /api/reports/:id/pdf',
      'DELETE /api/reports/:id (admin only)'
    ]
  });
});

console.log('[REPORT ROUTES] Routes loaded successfully');

module.exports = router;