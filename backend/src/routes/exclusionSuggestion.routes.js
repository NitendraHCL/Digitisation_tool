const express = require('express');
const router = express.Router();
const exclusionSuggestionController = require('../controllers/exclusionSuggestion.controller');
const { authenticate } = require('../middleware/auth.middleware');
const checkRole = require('../middleware/role.middleware');

// All routes require authentication
router.use(authenticate);

// Get suggestion statistics (shows user's own stats for non-admins)
router.get('/stats', exclusionSuggestionController.getSuggestionStats);

// Create a new suggestion (accessible by all authenticated users)
router.post('/', exclusionSuggestionController.createSuggestion);

// Get all suggestions (non-admins see only their own)
router.get('/', exclusionSuggestionController.getSuggestions);

// Get single suggestion by ID (owner or admin can view)
router.get('/:id', exclusionSuggestionController.getSuggestionById);

// Admin only routes
router.use(checkRole(['admin', 'super_admin']));

// Approve a suggestion
router.post('/:id/approve', exclusionSuggestionController.approveSuggestion);

// Reject a suggestion
router.post('/:id/reject', exclusionSuggestionController.rejectSuggestion);

module.exports = router;
