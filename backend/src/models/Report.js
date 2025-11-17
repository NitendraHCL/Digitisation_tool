const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: false, // Optional during upload, required before approval/rejection
    unique: true,
    sparse: true, // Allow multiple null values, but enforce uniqueness when value exists
    trim: true,
    validate: {
      validator: function(v) {
        // If status is approved or rejected, orderId is required
        if (['approved', 'rejected'].includes(this.status)) {
          return !!v;
        }
        return true;
      },
      message: 'Order ID is required before approval or rejection'
    }
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pdfPath: {
    type: String,
    required: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  processingTime: {
    type: Number,
    default: null,
    description: 'Total processing time in seconds (measured from frontend)'
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'ready', 'approved', 'rejected', 'error'],
    default: 'uploaded'
  },
  processingError: {
    type: String,
    default: null
  },
  // Extraction method used for processing
  extractionMethod: {
    type: String,
    enum: ['text', 'image', 'hybrid', 'pdf'],
    default: 'text'
  },
  // Processing metadata (timing, tokens, cost)
  processingMetadata: {
    method: {
      type: String,
      enum: ['text', 'image', 'hybrid', 'pdf'],
      default: null
    },
    textExtractionTime: {
      type: Number,
      default: null
    },
    imageConversionTime: {
      type: Number,
      default: null
    },
    gptProcessingTime: {
      type: Number,
      default: null
    },
    totalProcessingTime: {
      type: Number,
      default: null
    },
    promptTokens: {
      type: Number,
      default: null
    },
    completionTokens: {
      type: Number,
      default: null
    },
    totalTokens: {
      type: Number,
      default: null
    },
    estimatedCost: {
      type: Number,
      default: null
    },
    pdfPages: {
      type: Number,
      default: null
    },
    imagesGenerated: {
      type: Number,
      default: null
    }
  },
  // Extracted data will be added in Phase 4
  extractedData: {
    gptRawResponse: {
      type: Object,
      default: null
    },
    labName: {
      type: String,
      default: null
    },
    // Patient demographics extracted from report
    patientName: {
      type: String,
      default: null
    },
    patientAge: {
      type: String,
      default: null
    },
    patientGender: {
      type: String,
      enum: ['male', 'female', 'other', null],
      default: null
    },
    dateOfTest: {
      type: Date,
      default: null
    },
    results: [{
      type: {
        type: String,
        default: 'path'
      },
      serviceItemName: String,
      value: String,
      unit: String,
      method: String,
      referenceRange: {
        high: Number,
        low: Number,
        referenceRange: String
      }
    }],
    extractedAt: Date,
    // Page-wise extraction data for improved verification
    pageWiseData: [{
      pageNumber: {
        type: Number,
        required: true
      },
      rawResponse: {
        type: String,
        default: null
      },
      results: [{
        type: {
          type: String,
          default: 'path'
        },
        serviceItemName: String,
        value: String,
        unit: String,
        method: String,
        referenceRange: {
          high: Number,
          low: Number,
          referenceRange: String
        }
      }],
      extractionMetadata: {
        responseLength: Number,
        parametersExtracted: Number,
        processingTime: Number,
        inputTokens: Number,
        outputTokens: Number,
        cost: Number
      },
      extractedAt: Date
    }]
  },
  // Flags for threshold checking (Phase 5)
  flags: {
    hasAbnormalValues: {
      type: Boolean,
      default: false
    },
    abnormalCount: {
      type: Number,
      default: 0
    },
    criticalCount: {
      type: Number,
      default: 0
    },
    abnormalParameters: [{
      parameter: String,
      value: String,
      unit: String,
      referenceRange: String,
      severity: String,
      deviation: Number,
      message: String
    }],
    criticalParameters: [{
      parameter: String,
      value: String,
      unit: String,
      referenceRange: String,
      severity: String,
      deviation: Number,
      message: String
    }],
    percentAbnormal: {
      type: Number,
      default: 0
    },
    requiresAttention: {
      type: Boolean,
      default: false
    },
    requiresUrgentAttention: {
      type: Boolean,
      default: false
    },
    summary: {
      type: String,
      default: ''
    }
  },

  // UI indicators for nurse display
  uiIndicators: {
    color: {
      type: String,
      enum: ['green', 'yellow', 'orange', 'red'],
      default: 'green'
    },
    icon: {
      type: String,
      default: '✓'
    },
    badge: {
      type: String,
      default: 'Normal'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'low'
    }
  },
  // Validation flags from Parameter Master validation
  validationFlags: [{
    resultIndex: {
      type: Number,
      description: 'Index in results array that this flag applies to'
    },
    parameterId: {
      type: String,
      default: null,
      description: 'ID from Parameter Master (null if parameter not found)'
    },
    parameterName: {
      type: String,
      description: 'Parameter name that was validated'
    },
    field: {
      type: String,
      enum: ['parameterName', 'unit', 'value'],
      description: 'Which field has the validation issue'
    },
    flagType: {
      type: String,
      enum: ['PARAMETER_NOT_FOUND', 'UNIT_MISMATCH', 'VALUE_TYPE_MISMATCH'],
      description: 'Type of validation flag'
    },
    expected: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Expected value(s) from Parameter Master'
    },
    actual: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Actual value found in extraction'
    },
    severity: {
      type: String,
      enum: ['warning', 'error'],
      default: 'warning',
      description: 'Severity level for UI display'
    },
    message: {
      type: String,
      description: 'Human-readable validation message'
    }
  }],
  // Edit history for nurse changes (Phase 6)
  editHistory: [{
    field: String,
    originalValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],
  // Approval info (Phase 6)
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  approvalComments: {
    type: String,
    default: null
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  // Validation warnings for data mismatches
  validationWarnings: [{
    type: {
      type: String,
      enum: ['NAME_MISMATCH', 'AGE_MISMATCH', 'GENDER_MISMATCH', 'DATE_MISMATCH', 'MISSING_DATA'],
      required: true
    },
    field: {
      type: String,
      required: true
    },
    orderValue: {
      type: String,
      default: null
    },
    reportValue: {
      type: String,
      default: null
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    acknowledgedAt: {
      type: Date,
      default: null
    },
    overrideReason: {
      type: String,
      default: null
    }
  }],
  // Final JSON data in Example.json format
  finalData: {
    type: Object,
    default: null
  },
  // Audit & Accuracy Summary
  auditSummary: {
    totalParameters: {
      type: Number,
      default: 0
    },
    editedParameters: {
      type: Number,
      default: 0
    },
    accuracyPercentage: {
      type: Number,
      default: 100
    },
    calculatedAt: {
      type: Date,
      default: null
    },
    reviewDuration: {
      type: Number, // in seconds
      default: null
    },
    secondsPerParameter: {
      type: Number, // calculated as reviewDuration / totalParameters
      default: null
    }
  }
}, {
  timestamps: true
});

// Add index for faster queries
// Note: orderId index is already created by unique+sparse in schema definition
reportSchema.index({ uploadedBy: 1, createdAt: -1 });
reportSchema.index({ status: 1 });

// Debug: Log when model is created
console.log('[REPORT MODEL] Report model loaded');

module.exports = mongoose.model('Report', reportSchema);