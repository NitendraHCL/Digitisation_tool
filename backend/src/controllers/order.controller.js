const Order = require('../models/Order');
const Report = require('../models/Report');

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const {
      order_id,
      cug_code,
      VISIT_CODE,
      patient_age,
      gender,
      date_of_test,
      lab_name,
      location,
      ...otherFields
    } = req.body;

    // Check if order_id already exists
    const existingOrder = await Order.findOne({ order_id });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'Order ID already exists'
      });
    }

    // Create new order
    const order = new Order({
      order_id,
      cug_code,
      VISIT_CODE,
      patient_age,
      gender,
      date_of_test: new Date(date_of_test),
      lab_name,
      location,
      ...otherFields,
      created_by: req.user ? req.user._id : null
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    console.error('[ORDER CONTROLLER] Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
};

// Get all orders with pagination and filters
exports.getOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      lab_name,
      location,
      start_date,
      end_date,
      search
    } = req.query;

    const query = { is_deleted: false };

    // Apply filters
    if (status) query.status = status;
    if (lab_name) query.lab_name = new RegExp(lab_name, 'i');
    if (location) query.location = new RegExp(location, 'i');

    // Date range filter
    if (start_date || end_date) {
      query.date_of_test = {};
      if (start_date) query.date_of_test.$gte = new Date(start_date);
      if (end_date) query.date_of_test.$lte = new Date(end_date);
    }

    // Search filter (search in order_id, VISIT_CODE, patient_name)
    if (search) {
      query.$or = [
        { order_id: new RegExp(search, 'i') },
        { VISIT_CODE: new RegExp(search, 'i') },
        { patient_name: new RegExp(search, 'i') }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email')
      .populate('report_id', 'status extractedData')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(skip);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[ORDER CONTROLLER] Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
};

// Get single order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      order_id: id,
      is_deleted: false
    })
    .populate('created_by', 'name email role')
    .populate('updated_by', 'name email role')
    .populate('report_id');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('[ORDER CONTROLLER] Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
};

// Update order
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.order_id;
    delete updateData.created_by;
    delete updateData.createdAt;

    // Add updated_by field
    if (req.user) {
      updateData.updated_by = req.user._id;
    }

    const order = await Order.findOneAndUpdate(
      { order_id: id, is_deleted: false },
      updateData,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: order
    });
  } catch (error) {
    console.error('[ORDER CONTROLLER] Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  }
};

// Delete order (soft delete)
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOneAndUpdate(
      { order_id: id, is_deleted: false },
      {
        is_deleted: true,
        deleted_at: new Date(),
        updated_by: req.user ? req.user._id : null
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('[ORDER CONTROLLER] Delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting order',
      error: error.message
    });
  }
};

// Bulk create orders
exports.bulkCreateOrders = async (req, res) => {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid orders data'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const orderData of orders) {
      try {
        // Check if order exists
        const existingOrder = await Order.findOne({ order_id: orderData.order_id });

        if (existingOrder) {
          results.failed.push({
            order_id: orderData.order_id,
            reason: 'Order ID already exists'
          });
          continue;
        }

        // Create order
        const order = new Order({
          ...orderData,
          date_of_test: new Date(orderData.date_of_test),
          created_by: req.user ? req.user._id : null
        });

        await order.save();
        results.success.push(order.order_id);
      } catch (error) {
        results.failed.push({
          order_id: orderData.order_id || 'unknown',
          reason: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk import completed. Success: ${results.success.length}, Failed: ${results.failed.length}`,
      results
    });
  } catch (error) {
    console.error('[ORDER CONTROLLER] Bulk create error:', error);
    res.status(500).json({
      success: false,
      message: 'Error in bulk order creation',
      error: error.message
    });
  }
};

// Link order with report
exports.linkOrderToReport = async (req, res) => {
  try {
    const { orderId, reportId } = req.body;

    // Find the order
    const order = await Order.findOne({
      order_id: orderId,
      is_deleted: false
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Find the report
    const report = await Report.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Update order with report reference
    order.report_id = reportId;
    order.status = 'completed';
    await order.save();

    // Update report with order ID if not already set
    if (!report.orderId) {
      report.orderId = orderId;
      await report.save();
    }

    res.json({
      success: true,
      message: 'Order linked to report successfully',
      data: {
        order: order,
        report: report
      }
    });
  } catch (error) {
    console.error('[ORDER CONTROLLER] Link order to report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error linking order to report',
      error: error.message
    });
  }
};

// Get order statistics
exports.getOrderStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const matchQuery = { is_deleted: false };

    // Add date filter if provided
    if (start_date || end_date) {
      matchQuery.date_of_test = {};
      if (start_date) matchQuery.date_of_test.$gte = new Date(start_date);
      if (end_date) matchQuery.date_of_test.$lte = new Date(end_date);
    }

    const stats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          in_progress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get lab-wise distribution
    const labDistribution = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            lab: '$lab_name',
            location: '$location'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get gender distribution
    const genderDistribution = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {
          total: 0,
          pending: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0
        },
        labDistribution,
        genderDistribution
      }
    });
  } catch (error) {
    console.error('[ORDER CONTROLLER] Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order statistics',
      error: error.message
    });
  }
};

// Update patient name in order
exports.updatePatientName = async (req, res) => {
  try {
    const { id } = req.params;
    const { patientName, reason } = req.body;

    if (!patientName || !patientName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Patient name is required'
      });
    }

    console.log(`[ORDER CONTROLLER] Updating patient name for order ${id} to: ${patientName}`);

    const order = await Order.findOne({
      order_id: id,
      is_deleted: false
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const previousName = order.patient_name;
    order.patient_name = patientName.trim();
    order.updated_by = req.user ? req.user._id : null;

    await order.save();

    // Create audit log for name update
    const AuditLog = require('../models/AuditLog');
    const auditEntry = new AuditLog({
      action: 'NAME_UPDATE',
      reportId: order.report_id || null,
      orderId: order.order_id,
      userId: req.user ? req.user._id : null,
      mismatchType: 'PATIENT_NAME',
      mismatches: [{
        field: 'patient_name',
        expectedValue: previousName || 'null',
        actualValue: patientName,
        type: 'UPDATE'
      }],
      overrideReason: reason || 'Manual update of patient name',
      metadata: {
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
        additionalNotes: `Patient name updated from "${previousName || 'empty'}" to "${patientName}"`
      }
    });

    await auditEntry.save();

    console.log(`[ORDER CONTROLLER] Patient name updated successfully. Previous: "${previousName}", New: "${patientName}"`);

    res.json({
      success: true,
      message: 'Patient name updated successfully',
      data: {
        order_id: order.order_id,
        previous_name: previousName,
        new_name: patientName,
        updated_by: req.user ? req.user.email : 'system'
      }
    });
  } catch (error) {
    console.error('[ORDER CONTROLLER] Update patient name error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating patient name',
      error: error.message
    });
  }
};

// Search orders by various criteria
exports.searchOrders = async (req, res) => {
  try {
    const {
      cug_code,
      visit_code,
      date_from,
      date_to,
      gender,
      status
    } = req.query;

    const query = { is_deleted: false };

    if (cug_code) query.cug_code = cug_code;
    if (visit_code) query.VISIT_CODE = new RegExp(visit_code, 'i');
    if (gender) query.gender = gender.toLowerCase();
    if (status) query.status = status;

    if (date_from || date_to) {
      query.date_of_test = {};
      if (date_from) query.date_of_test.$gte = new Date(date_from);
      if (date_to) query.date_of_test.$lte = new Date(date_to);
    }

    const orders = await Order.find(query)
      .populate('report_id', 'status extractedData')
      .sort({ date_of_test: -1 })
      .limit(100);

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('[ORDER CONTROLLER] Search orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching orders',
      error: error.message
    });
  }
};