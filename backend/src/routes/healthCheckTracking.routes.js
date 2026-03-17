const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const controller = require('../controllers/healthCheckTracking.controller');

console.log('[HC TRACKING ROUTES] Loading routes');

// All routes require authentication (any role can access)
router.use(authenticate);

router.get('/', controller.getRecords);
router.get('/stats', controller.getStats);
router.get('/sync-status', controller.getSyncStatus);
router.get('/filters', controller.getFilters);
router.get('/export', controller.exportData);
router.post('/sync', controller.triggerSync);

console.log('[HC TRACKING ROUTES] Routes loaded successfully');

module.exports = router;
