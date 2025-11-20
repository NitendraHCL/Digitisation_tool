const ParameterExclusion = require('../models/ParameterExclusion');

// Add a new exclusion
const addExclusion = async (req, res) => {
  try {
    const { excludedParameter, unit, reason, labName } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!excludedParameter || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Parameter name and reason are required'
      });
    }

    // Check if this exclusion already exists
    const existingExclusion = await ParameterExclusion.findOne({
      excludedParameter: new RegExp(`^${excludedParameter}$`, 'i'),
      unit: unit || null,
      labName: labName || null,
      isActive: true
    });

    if (existingExclusion) {
      return res.status(400).json({
        success: false,
        message: 'This parameter exclusion already exists'
      });
    }

    // Create new exclusion
    const exclusion = new ParameterExclusion({
      excludedParameter,
      unit: unit || null,
      labName: labName || null,
      reason,
      excludedBy: userId
    });

    await exclusion.save();

    // Populate user details before sending response
    await exclusion.populate('excludedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Parameter exclusion added successfully',
      data: exclusion
    });

  } catch (error) {
    console.error('[EXCLUSION CONTROLLER] Error adding exclusion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add parameter exclusion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all exclusions with pagination and search
const getExclusions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    const result = await ParameterExclusion.getActiveExclusions(
      parseInt(page),
      parseInt(limit),
      search
    );

    res.json({
      success: true,
      message: 'Exclusions fetched successfully',
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('[EXCLUSION CONTROLLER] Error fetching exclusions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exclusions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Check if a parameter is excluded
const checkExclusion = async (req, res) => {
  try {
    const { parameterName, unit, labName } = req.query;

    if (!parameterName) {
      return res.status(400).json({
        success: false,
        message: 'Parameter name is required'
      });
    }

    const result = await ParameterExclusion.isExcluded(parameterName, unit, labName);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[EXCLUSION CONTROLLER] Error checking exclusion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check exclusion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Remove an exclusion (hard delete - permanently removes from database)
const removeExclusion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const exclusion = await ParameterExclusion.findById(id);

    if (!exclusion) {
      return res.status(404).json({
        success: false,
        message: 'Exclusion not found'
      });
    }

    // Hard delete - permanently remove from database
    await ParameterExclusion.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Parameter exclusion permanently deleted'
    });

  } catch (error) {
    console.error('[EXCLUSION CONTROLLER] Error removing exclusion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove exclusion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Note: restoreExclusion function removed - hard delete cannot be restored

// Get exclusion statistics
const getExclusionStats = async (req, res) => {
  try {
    const [totalExclusions, parameterOnlyExclusions, unitSpecificExclusions, labSpecificExclusions] = await Promise.all([
      ParameterExclusion.countDocuments({ isActive: true }),
      ParameterExclusion.countDocuments({ isActive: true, unit: null, labName: null }),
      ParameterExclusion.countDocuments({ isActive: true, unit: { $ne: null } }),
      ParameterExclusion.countDocuments({ isActive: true, labName: { $ne: null } })
    ]);

    res.json({
      success: true,
      data: {
        total: totalExclusions,
        parameterOnly: parameterOnlyExclusions,
        unitSpecific: unitSpecificExclusions,
        labSpecific: labSpecificExclusions
      }
    });

  } catch (error) {
    console.error('[EXCLUSION CONTROLLER] Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get exclusion statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Bulk add exclusions
const bulkAddExclusions = async (req, res) => {
  try {
    const { exclusions } = req.body;
    const userId = req.user.userId;

    if (!Array.isArray(exclusions) || exclusions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of exclusions'
      });
    }

    const results = {
      added: [],
      skipped: [],
      failed: []
    };

    for (const exclusionData of exclusions) {
      try {
        const { excludedParameter, unit, reason, labName } = exclusionData;

        if (!excludedParameter || !reason) {
          results.failed.push({
            ...exclusionData,
            error: 'Missing required fields'
          });
          continue;
        }

        // Check if already exists
        const exists = await ParameterExclusion.findOne({
          excludedParameter: new RegExp(`^${excludedParameter}$`, 'i'),
          unit: unit || null,
          labName: labName || null,
          isActive: true
        });

        if (exists) {
          results.skipped.push({
            excludedParameter,
            unit,
            reason: 'Already exists'
          });
          continue;
        }

        // Create new exclusion
        const exclusion = await ParameterExclusion.create({
          excludedParameter,
          unit: unit || null,
          labName: labName || null,
          reason,
          excludedBy: userId
        });

        results.added.push(exclusion);

      } catch (error) {
        results.failed.push({
          ...exclusionData,
          error: error.message
        });
      }
    }

    // Bulk operation completed - no audit logging for exclusions

    res.json({
      success: true,
      message: 'Bulk exclusion operation completed',
      data: results
    });

  } catch (error) {
    console.error('[EXCLUSION CONTROLLER] Error in bulk add:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk exclusions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  addExclusion,
  getExclusions,
  checkExclusion,
  removeExclusion,
  getExclusionStats,
  bulkAddExclusions
};