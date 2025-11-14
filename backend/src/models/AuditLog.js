const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Action type
  action: {
    type: String,
    enum: [
      'APPROVAL_WITH_MISMATCH',
      'NAME_UPDATE',
      'OVERRIDE_WARNING',
      'VALIDATION_FAILED',
      'VALIDATION_PASSED'
    ],
    required: true,
    index: true
  },

  // Related entities
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true,
    index: true
  },

  orderId: {
    type: String,
    required: true,
    index: true
  },

  // User who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Mismatch details
  mismatchType: {
    type: String,
    enum: ['PATIENT_NAME', 'PATIENT_AGE', 'PATIENT_GENDER', 'TEST_DATE', 'MULTIPLE'],
    default: null
  },

  mismatches: [{
    field: String,
    expectedValue: String,
    actualValue: String,
    type: String
  }],

  // Override details
  overrideReason: {
    type: String,
    default: null
  },

  wasOverridden: {
    type: Boolean,
    default: false
  },

  // Additional context
  metadata: {
    userAgent: String,
    ipAddress: String,
    sessionId: String,
    additionalNotes: String
  },

  // Timestamp is automatic but we can add specific action time if needed
  actionTimestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ action: 1, actionTimestamp: -1 });
auditLogSchema.index({ userId: 1, actionTimestamp: -1 });
auditLogSchema.index({ reportId: 1, action: 1 });
auditLogSchema.index({ wasOverridden: 1, actionTimestamp: -1 });

// Static methods for common queries
auditLogSchema.statics.getMismatchesByUser = async function(userId, startDate, endDate) {
  const query = {
    userId,
    action: 'APPROVAL_WITH_MISMATCH'
  };

  if (startDate || endDate) {
    query.actionTimestamp = {};
    if (startDate) query.actionTimestamp.$gte = startDate;
    if (endDate) query.actionTimestamp.$lte = endDate;
  }

  return this.find(query)
    .populate('reportId', 'orderId status')
    .populate('userId', 'name email role')
    .sort({ actionTimestamp: -1 });
};

auditLogSchema.statics.getMismatchStats = async function(startDate, endDate) {
  const matchQuery = {
    action: 'APPROVAL_WITH_MISMATCH'
  };

  if (startDate || endDate) {
    matchQuery.actionTimestamp = {};
    if (startDate) matchQuery.actionTimestamp.$gte = startDate;
    if (endDate) matchQuery.actionTimestamp.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          user: '$userId',
          mismatchType: '$mismatchType'
        },
        count: { $sum: 1 },
        lastOccurrence: { $max: '$actionTimestamp' }
      }
    },
    {
      $group: {
        _id: '$_id.user',
        mismatches: {
          $push: {
            type: '$_id.mismatchType',
            count: '$count',
            lastOccurrence: '$lastOccurrence'
          }
        },
        totalMismatches: { $sum: '$count' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        userName: '$user.name',
        userEmail: '$user.email',
        userRole: '$user.role',
        mismatches: 1,
        totalMismatches: 1
      }
    },
    { $sort: { totalMismatches: -1 } }
  ]);
};

// Instance methods
auditLogSchema.methods.toSummary = function() {
  return {
    action: this.action,
    reportId: this.reportId,
    orderId: this.orderId,
    userId: this.userId,
    mismatchType: this.mismatchType,
    mismatchCount: this.mismatches ? this.mismatches.length : 0,
    wasOverridden: this.wasOverridden,
    timestamp: this.actionTimestamp
  };
};

console.log('[AUDIT LOG MODEL] AuditLog model loaded');

module.exports = mongoose.model('AuditLog', auditLogSchema);