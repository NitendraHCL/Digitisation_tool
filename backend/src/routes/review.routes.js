const express = require('express');
const router = express.Router();
const {
  getReportForReview,
  editParameter,
  editDemographics,
  bulkEditParameters,
  updateOrderId,
  approveReport,
  rejectReport,
  getEditHistory,
  getValidationData,
  deleteParameter,
  publishReport
} = require('../controllers/review.controller');
const { authenticate, isNurseOrAdmin } = require('../middleware/auth.middleware');

// All review routes require nurse or admin authentication
router.use(authenticate);
router.use(isNurseOrAdmin);

// Get report for review
router.get('/:id', getReportForReview);

// Edit single parameter
router.put('/:id/parameter', editParameter);

// Delete parameter
router.delete('/:id/parameter/:parameterId', deleteParameter);

// Edit patient demographics
router.put('/:id/demographics', editDemographics);

// Bulk edit parameters
router.put('/:id/bulk-edit', bulkEditParameters);

// Update Order ID
router.patch('/:id/orderId', updateOrderId);

// Get validation data for approval
router.get('/:id/validation', getValidationData);

// Approve report
router.post('/:id/approve', approveReport);

// Reject report
router.post('/:id/reject', rejectReport);

// Get edit history
router.get('/:id/history', getEditHistory);

// Publish report to digitization_observation
router.post('/:id/publish', publishReport);

console.log('[REVIEW ROUTES] Routes loaded successfully');

module.exports = router;