const mongoose = require('mongoose');

const exclusionSuggestionSchema = new mongoose.Schema({
  // The parameter being suggested for exclusion (from the report)
  suggestedParameter: {
    type: String,
    required: true,
    trim: true,
    description: 'The parameter name from the report that should be excluded'
  },

  suggestedUnit: {
    type: String,
    trim: true,
    default: null,
    description: 'Optional: specific unit to exclude. If null, excludes parameter regardless of unit'
  },

  suggestedLabName: {
    type: String,
    trim: true,
    default: null,
    description: 'Optional: specific lab for which this exclusion should apply'
  },

  reason: {
    type: String,
    required: true,
    trim: true,
    description: 'Reason for suggesting this exclusion'
  },

  // Suggestion metadata
  suggestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  suggestedAt: {
    type: Date,
    default: Date.now
  },

  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    description: 'Reference to the report where this suggestion originated'
  },

  // Approval workflow
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  reviewedAt: {
    type: Date,
    default: null
  },

  reviewNotes: {
    type: String,
    default: null,
    description: 'Admin notes on why suggestion was approved/rejected'
  },

  // Track if exclusion was created
  applied: {
    type: Boolean,
    default: false,
    description: 'Whether the approved suggestion has been applied to Exclusion Master'
  },

  appliedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
exclusionSuggestionSchema.index({ status: 1, suggestedAt: -1 });
exclusionSuggestionSchema.index({ suggestedBy: 1, status: 1 });
exclusionSuggestionSchema.index({ suggestedParameter: 'text' });

// Static method to get pending suggestions count
exclusionSuggestionSchema.statics.getPendingCount = async function() {
  return await this.countDocuments({ status: 'pending' });
};

// Static method to get suggestions with pagination
exclusionSuggestionSchema.statics.getSuggestions = async function(filter = {}, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const query = { ...filter };

  const [suggestions, total] = await Promise.all([
    this.find(query)
      .populate('suggestedBy', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ suggestedAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments(query)
  ]);

  return {
    data: suggestions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Instance method to approve and apply suggestion
exclusionSuggestionSchema.methods.approve = async function(adminId, notes = null) {
  const ParameterExclusion = require('./ParameterExclusion');

  this.status = 'approved';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;

  try {
    // Create the exclusion
    const newExclusion = new ParameterExclusion({
      excludedParameter: this.suggestedParameter,
      unit: this.suggestedUnit || null,
      labName: this.suggestedLabName || null,
      reason: this.reason,
      excludedBy: adminId,
      isActive: true
    });
    await newExclusion.save();

    this.applied = true;
    this.appliedAt = new Date();
    await this.save();

    return { success: true, exclusion: newExclusion };
  } catch (error) {
    // If application fails, still save the approval status
    await this.save();
    throw error;
  }
};

// Instance method to reject suggestion
exclusionSuggestionSchema.methods.reject = async function(adminId, reason) {
  this.status = 'rejected';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.reviewNotes = reason;
  await this.save();
  return { success: true };
};

// Virtual to include in JSON
exclusionSuggestionSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('ExclusionSuggestion', exclusionSuggestionSchema);
