const express = require('express');
const router = express.Router();
const {
  createParameter,
  getParameters,
  getParameterById,
  updateParameter,
  deleteParameter,
  bulkImportParameters,
  searchParameters
} = require('../controllers/parameterMaster.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

console.log('[PARAMETER MASTER ROUTES] Loading routes');

// All routes require authentication
router.use(authenticate);

// Public search endpoint (for autocomplete)
router.get('/search', searchParameters);

// Admin-only routes
router.post('/', isAdmin, createParameter);
router.get('/', isAdmin, getParameters);
router.get('/:id', isAdmin, getParameterById);
router.put('/:id', isAdmin, updateParameter);
router.delete('/:id', isAdmin, deleteParameter);
router.post('/bulk-import', isAdmin, bulkImportParameters);

console.log('[PARAMETER MASTER ROUTES] Routes loaded successfully');

module.exports = router;
