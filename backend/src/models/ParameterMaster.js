const mongoose = require('mongoose');

const parameterMasterSchema = new mongoose.Schema({
  parameterId: {
    type: String,
    required: false,
    unique: true,
    index: true,
    description: 'Unique identifier for the parameter'
  },
  parameterName: {
    type: String,
    required: true,
    trim: true,
    index: true,
    description: 'Canonical parameter name (e.g., "HbA1c", "Hemoglobin")'
  },
  aliases: [{
    type: String,
    trim: true,
    description: 'Alternative names for this parameter (e.g., ["HBA1C", "Hemoglobin A1c", "Glycated Hemoglobin"])'
  }],
  possibleUnits: [{
    type: String,
    trim: true,
    description: 'Valid units for this parameter (e.g., ["%", "mmol/mol"])'
  }],
  valueType: {
    type: String,
    enum: ['numeric', 'text', 'alphanumeric', 'range'],
    required: true,
    description: 'Expected type of value for this parameter'
  },
  description: {
    type: String,
    trim: true,
    description: 'Brief description of what this parameter measures'
  }
}, {
  timestamps: true
});

// Indexes for fast searching
parameterMasterSchema.index({ parameterName: 'text', aliases: 'text' });
parameterMasterSchema.index({ parameterId: 1 });

// Generate parameterId before saving if not provided
parameterMasterSchema.pre('save', function(next) {
  if (!this.parameterId) {
    // Generate ID from parameter name (uppercase, replace spaces with underscore)
    this.parameterId = this.parameterName.toUpperCase().replace(/\s+/g, '_').replace(/[()]/g, '');
  }
  next();
});

// Instance method to check if a value matches this parameter's type
parameterMasterSchema.methods.validateValue = function(value) {
  switch (this.valueType) {
    case 'numeric':
      return !isNaN(parseFloat(value));
    case 'text':
      return typeof value === 'string' && isNaN(parseFloat(value));
    case 'alphanumeric':
      return typeof value === 'string';
    case 'range':
      // Check for patterns like "1-2", "2-3", "0-5"
      return /^\d+\.?\d*\s*-\s*\d+\.?\d*$/.test(value);
    default:
      return false;
  }
};

// Instance method to check if a unit is valid for this parameter
parameterMasterSchema.methods.validateUnit = function(unit) {
  if (!unit && this.possibleUnits.length === 0) {
    return true; // No unit expected, none provided
  }
  return this.possibleUnits.includes(unit);
};

// Static method to find parameter by name or alias
parameterMasterSchema.statics.findByNameOrAlias = async function(name) {
  const normalizedName = name.trim().toUpperCase();

  // Escape regex special characters for literal matching
  // This ensures characters like (), +, -, etc. are treated as literals, not regex metacharacters
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return await this.findOne({
    $or: [
      { parameterName: new RegExp(`^${escapedName}$`, 'i') },
      { aliases: new RegExp(`^${escapedName}$`, 'i') }
    ]
  });
};

// Static method to fuzzy search parameters
parameterMasterSchema.statics.fuzzySearch = async function(searchTerm) {
  return await this.find({
    $or: [
      { parameterName: new RegExp(searchTerm, 'i') },
      { aliases: new RegExp(searchTerm, 'i') }
    ]
  }).limit(10);
};

module.exports = mongoose.model('ParameterMaster', parameterMasterSchema);
