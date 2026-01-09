const mongoose = require('mongoose');

const parameterExclusionSchema = new mongoose.Schema({
  excludedParameter: {
    type: String,
    required: true,
    trim: true,
    index: true,
    description: 'The exact parameter name to exclude'
  },
  unit: {
    type: String,
    trim: true,
    default: null,
    description: 'Optional specific unit to exclude. If null, excludes parameter regardless of unit'
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    description: 'Reason for exclusion'
  },
  excludedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'User who added this exclusion'
  },
  excludedAt: {
    type: Date,
    default: Date.now,
    description: 'Timestamp when exclusion was added'
  },
  isActive: {
    type: Boolean,
    default: true,
    description: 'Soft delete flag - false means exclusion is removed'
  },
  labName: {
    type: String,
    trim: true,
    default: null,
    description: 'Optional: Specific lab for which this exclusion applies. If null, applies to all labs'
  }
}, {
  timestamps: true
});

// Compound index for fast lookups
parameterExclusionSchema.index({ excludedParameter: 1, unit: 1, isActive: 1 });
parameterExclusionSchema.index({ excludedParameter: 'text' });
parameterExclusionSchema.index({ isActive: 1, excludedAt: -1 });

// Static method to check if a parameter is excluded
parameterExclusionSchema.statics.isExcluded = async function(parameterName, unit = null, labName = null) {
  try {
    // Escape special regex characters for safe matching (same as ParameterMaster.js:87)
    const escapedParamName = parameterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const query = {
      excludedParameter: new RegExp(`^${escapedParamName}$`, 'i'),
      isActive: true
    };

    // Check for exact unit match or general exclusion (unit = null)
    if (unit) {
      const escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { unit: null }, // General exclusion for this parameter
        { unit: new RegExp(`^${escapedUnit}$`, 'i') } // Specific unit exclusion
      ];
    } else {
      query.unit = null; // Only match general exclusions when no unit provided
    }

    // Check for lab-specific exclusion or general exclusion
    if (labName) {
      const escapedLabName = labName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { labName: null }, // General exclusion for all labs
        { labName: new RegExp(`^${escapedLabName}$`, 'i') } // Specific lab exclusion
      ];
    }

    const exclusion = await this.findOne(query);
    return exclusion ? { isExcluded: true, reason: exclusion.reason } : { isExcluded: false };
  } catch (error) {
    console.error('[PARAMETER_EXCLUSION] Error checking exclusion:', error.message, 'for:', parameterName);
    return { isExcluded: false, error: error.message };
  }
};

// Static method to get all active exclusions
parameterExclusionSchema.statics.getActiveExclusions = async function(page = 1, limit = 20, search = '') {
  const query = { isActive: true };

  if (search) {
    query.$or = [
      { excludedParameter: new RegExp(search, 'i') },
      { reason: new RegExp(search, 'i') },
      { unit: new RegExp(search, 'i') }
    ];
  }

  const skip = (page - 1) * limit;

  const [exclusions, total] = await Promise.all([
    this.find(query)
      .populate('excludedBy', 'name email')
      .sort({ excludedAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments(query)
  ]);

  return {
    data: exclusions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Instance method to soft delete
parameterExclusionSchema.methods.softDelete = function() {
  this.isActive = false;
  return this.save();
};

// Instance method to restore
parameterExclusionSchema.methods.restore = function() {
  this.isActive = true;
  return this.save();
};

// Pre-save hook to normalize parameter name and unit
parameterExclusionSchema.pre('save', function(next) {
  if (this.isModified('excludedParameter')) {
    this.excludedParameter = this.excludedParameter.trim();
  }
  if (this.isModified('unit') && this.unit) {
    this.unit = this.unit.trim();
  }
  next();
});

module.exports = mongoose.model('ParameterExclusion', parameterExclusionSchema);