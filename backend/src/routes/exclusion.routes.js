const express = require('express');
const router = express.Router();
const exclusionController = require('../controllers/exclusion.controller');
const { authenticate } = require('../middleware/auth.middleware');
const checkRole = require('../middleware/role.middleware');

// All routes require authentication
router.use(authenticate);

// Check if a parameter is excluded (accessible by all authenticated users)
router.get('/check', exclusionController.checkExclusion);

// Get exclusion statistics (accessible by all authenticated users)
router.get('/stats', exclusionController.getExclusionStats);

// Get all exclusions with pagination (accessible by all authenticated users)
router.get('/', exclusionController.getExclusions);

// Admin only routes
router.use(checkRole(['admin', 'super_admin']));

// Add a new exclusion
router.post('/', exclusionController.addExclusion);

// Bulk add exclusions
router.post('/bulk', exclusionController.bulkAddExclusions);

// Remove an exclusion (hard delete - permanently removes from database)
router.delete('/:id', exclusionController.removeExclusion);

module.exports = router;