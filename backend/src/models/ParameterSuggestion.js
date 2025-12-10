const mongoose = require('mongoose');

const parameterSuggestionSchema = new mongoose.Schema({
  // Action type
  action: {
    type: String,
    enum: ['create', 'update_alias', 'update_unit'],
    required: true,
    description: 'Type of suggestion: create new parameter, add as alias, or add new unit'
  },

  // For the parameter being suggested (from the report)
  suggestedParameter: {
    type: String,
    required: true,
    trim: true,
    description: 'The parameter name from the report that needs to be added'
  },

  suggestedUnit: {
    type: String,
    trim: true,
    default: null,
    description: 'The unit from the report (for unit mismatches)'
  },

  // For CREATE action - new parameter details
  newParameterData: {
    parameterId: {
      type: String,
      trim: true,
      uppercase: true,
      description: 'User-defined key for new parameter (e.g., HEMOGLOBIN)'
    },
    parameterName: {
      type: String,
      trim: true,
      description: 'Canonical name for the new parameter'
    },
    valueType: {
      type: String,
      enum: ['numeric', 'text', 'alphanumeric', 'range'],
      description: 'Data type of the parameter value'
    },
    possibleUnits: [{
      type: String,
      trim: true
    }],
    description: {
      type: String,
      trim: true
    }
  },

  // For UPDATE actions - target existing parameter
  targetParameterId: {
    type: String,
    default: null,
    description: 'ID of existing parameter to update (for alias/unit additions)'
  },

  targetParameterName: {
    type: String,
    default: null,
    description: 'Name of existing parameter (for display purposes)'
  },

  // Validation flag that triggered this suggestion
  validationFlag: {
    flagType: {
      type: String,
      enum: ['PARAMETER_NOT_FOUND', 'UNIT_MISMATCH']
    },
    expected: mongoose.Schema.Types.Mixed,
    actual: mongoose.Schema.Types.Mixed
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

  // Track if changes were applied
  applied: {
    type: Boolean,
    default: false,
    description: 'Whether the approved suggestion has been applied to Parameter Master'
  },

  appliedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
parameterSuggestionSchema.index({ status: 1, suggestedAt: -1 });
parameterSuggestionSchema.index({ suggestedBy: 1, status: 1 });
parameterSuggestionSchema.index({ suggestedParameter: 'text' });

// Virtual for display
parameterSuggestionSchema.virtual('displayAction').get(function() {
  switch(this.action) {
    case 'create':
      return 'Create New Parameter';
    case 'update_alias':
      return 'Add as Alias';
    case 'update_unit':
      return 'Add Unit';
    default:
      return this.action;
  }
});

// Static method to get pending suggestions count
parameterSuggestionSchema.statics.getPendingCount = async function() {
  return await this.countDocuments({ status: 'pending' });
};

// Static method to get suggestions with pagination
parameterSuggestionSchema.statics.getSuggestions = async function(filter = {}, page = 1, limit = 20) {
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
parameterSuggestionSchema.methods.approve = async function(adminId, notes = null) {
  const ParameterMaster = require('./ParameterMaster');

  this.status = 'approved';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;

  try {
    // Apply the changes based on action type
    switch(this.action) {
      case 'create':
        // Create new parameter
        const newParam = new ParameterMaster({
          parameterId: this.newParameterData.parameterId,
          parameterName: this.newParameterData.parameterName,
          aliases: [this.suggestedParameter], // Add suggested name as alias
          possibleUnits: this.newParameterData.possibleUnits || [],
          valueType: this.newParameterData.valueType,
          description: this.newParameterData.description
        });
        await newParam.save();
        break;

      case 'update_alias':
        // Add as alias to existing parameter
        const paramForAlias = await ParameterMaster.findOne({ parameterId: this.targetParameterId });
        if (paramForAlias) {
          if (!paramForAlias.aliases.includes(this.suggestedParameter)) {
            paramForAlias.aliases.push(this.suggestedParameter);
            await paramForAlias.save();
          }
        }
        break;

      case 'update_unit':
        // Add unit to existing parameter
        const paramForUnit = await ParameterMaster.findOne({ parameterId: this.targetParameterId });
        if (paramForUnit && this.suggestedUnit) {
          if (!paramForUnit.possibleUnits.includes(this.suggestedUnit)) {
            paramForUnit.possibleUnits.push(this.suggestedUnit);
            await paramForUnit.save();
          }
        }
        break;
    }

    this.applied = true;
    this.appliedAt = new Date();
    await this.save();

    return { success: true };
  } catch (error) {
    // If application fails, still save the approval status
    await this.save();
    throw error;
  }
};

// Instance method to reject suggestion
parameterSuggestionSchema.methods.reject = async function(adminId, reason) {
  this.status = 'rejected';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.reviewNotes = reason;
  await this.save();
  return { success: true };
};

// Virtual to include in JSON
parameterSuggestionSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('ParameterSuggestion', parameterSuggestionSchema);