const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Public routes (if needed)
// router.get('/public/search', orderController.searchOrders);

// Protected routes - require authentication
router.use(authenticate); // Apply auth middleware to all routes below

// CRUD Operations
router.post('/', orderController.createOrder); // Create new order
router.get('/', orderController.getOrders); // Get all orders with pagination
router.get('/stats', orderController.getOrderStats); // Get order statistics
router.get('/search', orderController.searchOrders); // Search orders
router.get('/:id', orderController.getOrderById); // Get single order
router.put('/:id', orderController.updateOrder); // Update order
router.delete('/:id', orderController.deleteOrder); // Soft delete order

// Patient name update endpoint
router.patch('/:id/patient-name', orderController.updatePatientName); // Update patient name

// Bulk operations
router.post('/bulk', orderController.bulkCreateOrders); // Bulk create orders

// Link order to report
router.post('/link-report', orderController.linkOrderToReport); // Link order to report

module.exports = router;