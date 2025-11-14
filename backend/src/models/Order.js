const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Primary identifier - must be unique
  order_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
    description: 'Unique order identifier'
  },

  // CUG Code (encrypted or encoded customer/user group code)
  cug_code: {
    type: String,
    required: true,
    trim: true,
    description: 'Customer User Group code - encrypted/encoded identifier'
  },

  // Visit Code
  VISIT_CODE: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    description: 'Visit identifier code'
  },

  // Patient Demographics
  patient_age: {
    type: String,
    required: true,
    trim: true,
    description: 'Patient age in format like "37 Y,4 M,15 D"'
  },

  gender: {
    type: String,
    required: true,
    lowercase: true,
    enum: ['male', 'female', 'other'],
    description: 'Patient gender'
  },

  // Test Information
  date_of_test: {
    type: Date,
    required: true,
    index: true,
    description: 'Date when the test was conducted'
  },

  // Lab Information
  lab_name: {
    type: String,
    required: true,
    trim: true,
    description: 'Name of the laboratory'
  },

  location: {
    type: String,
    required: true,
    trim: true,
    description: 'Location of the lab/test center'
  },

  // Additional fields that might be useful

  // Patient Information (optional but useful)
  patient_name: {
    type: String,
    trim: true,
    default: null,
    description: 'Patient name (if available)'
  },

  patient_contact: {
    type: String,
    trim: true,
    default: null,
    description: 'Patient contact number'
  },

  // Report linkage (if needed to link with existing Report model)
  report_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    default: null,
    description: 'Reference to associated lab report'
  },

  // Order Status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    description: 'Current status of the order'
  },

  // Test Types (array to support multiple tests in one order)
  test_types: [{
    type: String,
    trim: true,
    description: 'Types of tests ordered'
  }],

  // Referring Doctor Information
  referring_doctor: {
    name: {
      type: String,
      trim: true,
      default: null
    },
    registration_number: {
      type: String,
      trim: true,
      default: null
    },
    contact: {
      type: String,
      trim: true,
      default: null
    }
  },

  // Sample Information
  sample_collected_at: {
    type: Date,
    default: null,
    description: 'When the sample was collected'
  },

  sample_type: {
    type: String,
    trim: true,
    default: null,
    description: 'Type of sample (blood, urine, etc.)'
  },

  // Barcode/QR Code for tracking
  barcode: {
    type: String,
    trim: true,
    sparse: true,  // This allows multiple null values
    index: {
      unique: true,
      sparse: true  // Ensures the unique constraint only applies to non-null values
    },
    default: undefined,  // Use undefined instead of null for sparse index
    description: 'Barcode or QR code for tracking'
  },

  // Priority
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'stat'],
    default: 'normal',
    description: 'Priority level of the order'
  },

  // Billing Information
  billing: {
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    payment_status: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'refunded'],
      default: 'pending'
    },
    payment_method: {
      type: String,
      enum: ['cash', 'card', 'online', 'insurance', 'other'],
      default: null
    }
  },

  // Notes and Comments
  notes: {
    type: String,
    default: null,
    description: 'Additional notes or special instructions'
  },

  // Metadata
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Soft delete flag
  is_deleted: {
    type: Boolean,
    default: false
  },

  deleted_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'orders'
});

// Indexes for better query performance
orderSchema.index({ order_id: 1, cug_code: 1 });
orderSchema.index({ VISIT_CODE: 1 });
orderSchema.index({ date_of_test: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'billing.payment_status': 1 });
orderSchema.index({ lab_name: 1, location: 1 });
orderSchema.index({ created_at: -1 });

// Virtual for formatted patient age
orderSchema.virtual('formatted_age').get(function() {
  return this.patient_age;
});

// Method to check if order is editable
orderSchema.methods.isEditable = function() {
  return !['completed', 'cancelled'].includes(this.status);
};

// Method to format order for display
orderSchema.methods.toDisplay = function() {
  return {
    orderId: this.order_id,
    visitCode: this.VISIT_CODE,
    patientAge: this.patient_age,
    gender: this.gender,
    testDate: this.date_of_test,
    labName: this.lab_name,
    location: this.location,
    status: this.status,
    priority: this.priority
  };
};

// Static method to find by order ID
orderSchema.statics.findByOrderId = async function(orderId) {
  return await this.findOne({ order_id: orderId, is_deleted: false });
};

// Static method to find orders by date range
orderSchema.statics.findByDateRange = async function(startDate, endDate) {
  return await this.find({
    date_of_test: {
      $gte: startDate,
      $lte: endDate
    },
    is_deleted: false
  }).sort({ date_of_test: -1 });
};

// Static method to find orders by lab
orderSchema.statics.findByLab = async function(labName, location) {
  const query = { is_deleted: false };
  if (labName) query.lab_name = labName;
  if (location) query.location = location;
  return await this.find(query).sort({ created_at: -1 });
};

// Pre-save middleware to validate date_of_test
orderSchema.pre('save', function(next) {
  // Ensure date_of_test is not in the future
  if (this.date_of_test && this.date_of_test > new Date()) {
    return next(new Error('Test date cannot be in the future'));
  }
  next();
});

// Pre-save middleware to update the updated_at timestamp
orderSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Add toJSON transformation
orderSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    if (ret.is_deleted) {
      delete ret.cug_code; // Hide sensitive data if deleted
    }
    return ret;
  }
});

console.log('[ORDER MODEL] Order model loaded');

module.exports = mongoose.model('Order', orderSchema);