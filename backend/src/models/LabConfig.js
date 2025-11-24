const mongoose = require('mongoose');

const labConfigSchema = new mongoose.Schema({
  // Legacy field - kept for backward compatibility
  labNames: [{
    type: String,
    required: true,
    trim: true
  }],

  // Lab configurations (names only - parameter ranges managed in separate Admin Labs section)
  labs: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Thresholds configuration
  thresholds: {
    criticalDeviation: {
      type: Number,
      default: 200,
      min: 0,
      max: 1000
    },
    warningDeviation: {
      type: Number,
      default: 50,
      min: 0,
      max: 1000
    },
    flaggedParameterThreshold: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    autoApproveThreshold: {
      type: Number,
      default: 90,
      min: 0,
      max: 100
    }
  },

  // System configuration
  systemConfig: {
    enableAutoProcessing: {
      type: Boolean,
      default: true
    },
    processingTimeout: {
      type: Number,
      default: 60,
      min: 10,
      max: 300
    },
    maxFileSize: {
      type: Number,
      default: 10,
      min: 1,
      max: 50
    },
    allowedFileTypes: [{
      type: String,
      default: 'pdf'
    }],
    retentionDays: {
      type: Number,
      default: 365,
      min: 30,
      max: 3650
    },
    auditLogEnabled: {
      type: Boolean,
      default: true
    },
    // Processing defaults
    defaultExtractionMethod: {
      type: String,
      enum: ['text', 'image', 'hybrid', 'pdf'],
      default: 'hybrid'
    },
    defaultModel: {
      type: String,
      enum: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gpt-4o', 'gpt-4.1'],
      default: 'gemini-2.5-flash'
    }
  },

  // Legacy threshold fields - kept for backward compatibility
  thresholdPercentage: {
    type: Number,
    default: 200,
    min: 0,
    max: 1000
  },
  flagThreshold: {
    type: Number,
    default: 50,
    min: 0,
    max: 100,
    description: 'Percentage of abnormal parameters to flag report'
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Ensure only one config document exists
labConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    // Create default config if none exists
    config = await this.create({
      labNames: ['Agilus Diagnostics', 'LabCorp', 'Quest Diagnostics', 'Thyrocare', 'Redcliffe Labs'],
      labs: [
        { name: 'Quest Diagnostics' },
        { name: 'LabCorp' },
        { name: 'Prognosis Laboratories' }
      ],
      thresholds: {
        criticalDeviation: 200,
        warningDeviation: 50,
        flaggedParameterThreshold: 50,
        autoApproveThreshold: 90
      },
      systemConfig: {
        enableAutoProcessing: true,
        processingTimeout: 60,
        maxFileSize: 10,
        allowedFileTypes: ['pdf'],
        retentionDays: 365,
        auditLogEnabled: true,
        defaultExtractionMethod: 'hybrid',
        defaultModel: 'gemini-2.5-flash'
      },
      thresholdPercentage: 200,
      flagThreshold: 50
    });
    console.log('[LAB CONFIG] Created default configuration');
  }
  return config;
};

// Debug: Log when model is created
console.log('[LAB CONFIG MODEL] LabConfig model loaded');

module.exports = mongoose.model('LabConfig', labConfigSchema);