const ParameterMaster = require('../models/ParameterMaster');

/**
 * Create a new parameter in the master table
 */
const createParameter = async (req, res) => {
  try {
    const { parameterName, aliases, possibleUnits, valueType, description } = req.body;

    console.log('[PARAMETER MASTER] Creating parameter:', parameterName);

    // Validate required fields
    if (!parameterName || !valueType) {
      return res.status(400).json({
        success: false,
        message: 'Parameter name and value type are required'
      });
    }

    // Check if parameter already exists
    const existing = await ParameterMaster.findByNameOrAlias(parameterName);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Parameter "${parameterName}" already exists`
      });
    }

    // Create new parameter
    const parameter = new ParameterMaster({
      parameterName,
      aliases: aliases || [],
      possibleUnits: possibleUnits || [],
      valueType,
      description
    });

    await parameter.save();

    console.log('[PARAMETER MASTER] Parameter created successfully:', parameter.parameterId);

    res.status(201).json({
      success: true,
      message: 'Parameter created successfully',
      data: parameter
    });
  } catch (error) {
    console.error('[PARAMETER MASTER] Create error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create parameter',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all parameters with pagination and search
 */
const getParameters = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', valueType } = req.query;

    console.log('[PARAMETER MASTER] Fetching parameters - Page:', page, 'Search:', search);

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { parameterName: new RegExp(search, 'i') },
        { aliases: new RegExp(search, 'i') }
      ];
    }

    if (valueType) {
      query.valueType = valueType;
    }

    // Execute query with pagination
    const parameters = await ParameterMaster.find(query)
      .sort({ parameterName: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await ParameterMaster.countDocuments(query);

    console.log('[PARAMETER MASTER] Found', parameters.length, 'parameters (Total:', total, ')');

    res.json({
      success: true,
      message: 'Parameters fetched successfully',
      data: parameters,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[PARAMETER MASTER] Get parameters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parameters',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get single parameter by ID
 */
const getParameterById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[PARAMETER MASTER] Fetching parameter:', id);

    const parameter = await ParameterMaster.findById(id);

    if (!parameter) {
      return res.status(404).json({
        success: false,
        message: 'Parameter not found'
      });
    }

    res.json({
      success: true,
      message: 'Parameter fetched successfully',
      data: parameter
    });
  } catch (error) {
    console.error('[PARAMETER MASTER] Get parameter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parameter',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update a parameter
 */
const updateParameter = async (req, res) => {
  try {
    const { id } = req.params;
    const { parameterName, aliases, possibleUnits, valueType, description } = req.body;

    console.log('[PARAMETER MASTER] Updating parameter:', id);

    const parameter = await ParameterMaster.findById(id);

    if (!parameter) {
      return res.status(404).json({
        success: false,
        message: 'Parameter not found'
      });
    }

    // Update fields
    if (parameterName) parameter.parameterName = parameterName;
    if (aliases !== undefined) parameter.aliases = aliases;
    if (possibleUnits !== undefined) parameter.possibleUnits = possibleUnits;
    if (valueType) parameter.valueType = valueType;
    if (description !== undefined) parameter.description = description;

    await parameter.save();

    console.log('[PARAMETER MASTER] Parameter updated successfully');

    res.json({
      success: true,
      message: 'Parameter updated successfully',
      data: parameter
    });
  } catch (error) {
    console.error('[PARAMETER MASTER] Update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update parameter',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a parameter (hard delete)
 */
const deleteParameter = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[PARAMETER MASTER] Deleting parameter:', id);

    const parameter = await ParameterMaster.findByIdAndDelete(id);

    if (!parameter) {
      return res.status(404).json({
        success: false,
        message: 'Parameter not found'
      });
    }

    console.log('[PARAMETER MASTER] Parameter deleted successfully');

    res.json({
      success: true,
      message: 'Parameter deleted successfully'
    });
  } catch (error) {
    console.error('[PARAMETER MASTER] Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete parameter',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Bulk import parameters from array
 */
const bulkImportParameters = async (req, res) => {
  try {
    const { parameters } = req.body;

    if (!Array.isArray(parameters) || parameters.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Parameters array is required'
      });
    }

    console.log('[PARAMETER MASTER] Bulk importing', parameters.length, 'parameters');

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const param of parameters) {
      try {
        if (!param.parameterName || !param.valueType) {
          results.skipped++;
          results.errors.push({
            parameter: param.parameterName || 'Unknown',
            error: 'Missing required fields'
          });
          continue;
        }

        // Check if parameter exists
        const existing = await ParameterMaster.findByNameOrAlias(param.parameterName);

        if (existing) {
          // Update existing
          existing.aliases = param.aliases || existing.aliases;
          existing.possibleUnits = param.possibleUnits || existing.possibleUnits;
          existing.valueType = param.valueType || existing.valueType;
          existing.description = param.description || existing.description;
          await existing.save();
          results.updated++;
        } else {
          // Create new
          const newParam = new ParameterMaster({
            parameterName: param.parameterName,
            aliases: param.aliases || [],
            possibleUnits: param.possibleUnits || [],
            valueType: param.valueType,
            description: param.description
          });
          await newParam.save();
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          parameter: param.parameterName,
          error: error.message
        });
      }
    }

    console.log('[PARAMETER MASTER] Bulk import complete:', results);

    res.json({
      success: true,
      message: `Bulk import complete: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`,
      data: results
    });
  } catch (error) {
    console.error('[PARAMETER MASTER] Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk import parameters',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Search parameters by name or alias (for autocomplete)
 */
const searchParameters = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    console.log('[PARAMETER MASTER] Searching for:', q);

    const parameters = await ParameterMaster.fuzzySearch(q);

    res.json({
      success: true,
      data: parameters
    });
  } catch (error) {
    console.error('[PARAMETER MASTER] Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search parameters',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createParameter,
  getParameters,
  getParameterById,
  updateParameter,
  deleteParameter,
  bulkImportParameters,
  searchParameters
};
