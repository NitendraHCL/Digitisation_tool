const express = require('express');
const router = express.Router();
const parameterSuggestionController = require('../controllers/parameterSuggestion.controller');
const { authenticate } = require('../middleware/auth.middleware');
const checkRole = require('../middleware/role.middleware');

// All routes require authentication
router.use(authenticate);

// Search existing parameters (accessible by all authenticated users)
router.get('/search-parameters', parameterSuggestionController.searchParameters);

// Get suggestion statistics (shows user's own stats for non-admins)
router.get('/stats', parameterSuggestionController.getSuggestionStats);

// Create a new suggestion (accessible by all authenticated users)
router.post('/', parameterSuggestionController.createSuggestion);

// Get all suggestions (non-admins see only their own)
router.get('/', parameterSuggestionController.getSuggestions);

// Get single suggestion by ID (owner or admin can view)
router.get('/:id', parameterSuggestionController.getSuggestionById);

// Admin only routes
router.use(checkRole(['admin', 'super_admin']));

// Approve a suggestion
router.post('/:id/approve', parameterSuggestionController.approveSuggestion);

// Reject a suggestion
router.post('/:id/reject', parameterSuggestionController.rejectSuggestion);

module.exports = router;