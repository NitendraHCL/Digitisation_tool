const express = require('express');
const router = express.Router();
const {
  getConfig,
  updateConfig,
  updateLabNames,
  updateThresholds,
  addLabName,
  removeLabName,
  createLab,
  updateLab,
  deleteLab,
  updateSystemConfig
} = require('../controllers/labConfig.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// All lab config routes require admin authentication
router.use(authenticate);
router.use(isAdmin);

// Get current configuration
router.get('/', getConfig);

// Update entire configuration (including experimental features)
router.put('/', updateConfig);

// Lab configuration CRUD routes
router.post('/labs', createLab);
router.put('/labs/:id', updateLab);
router.delete('/labs/:id', deleteLab);

// Update lab names (replace all) - legacy support
router.put('/lab-names', updateLabNames);

// Add a single lab name - legacy support
router.post('/lab-names', addLabName);

// Remove a lab name - legacy support
router.delete('/lab-names', removeLabName);

// Update threshold settings
router.put('/thresholds', updateThresholds);

// Update system configuration
router.put('/system', updateSystemConfig);

console.log('[LAB CONFIG ROUTES] Routes loaded successfully');

module.exports = router;