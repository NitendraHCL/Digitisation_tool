const LabConfig = require('../models/LabConfig');

// Get current lab configuration
const getConfig = async (req, res) => {
  try {
    console.log('[LAB CONFIG CONTROLLER] Fetching configuration');

    const config = await LabConfig.getConfig();

    // Transform labs array to include IDs
    const labsWithIds = config.labs.map(lab => ({
      id: lab._id.toString(),
      name: lab.name,
      createdAt: lab.createdAt,
      updatedAt: lab.updatedAt
    }));

    res.json({
      success: true,
      message: 'Configuration fetched successfully',
      data: {
        thresholds: config.thresholds || {
          criticalDeviation: config.thresholdPercentage || 200,
          warningDeviation: 50,
          flaggedParameterThreshold: config.flagThreshold || 50,
          autoApproveThreshold: 90
        },
        systemConfig: config.systemConfig || {
          enableAutoProcessing: true,
          processingTimeout: 60,
          maxFileSize: 10,
          allowedFileTypes: ['pdf'],
          retentionDays: 365,
          auditLogEnabled: true
        },
        labs: labsWithIds,
        // Legacy fields for backward compatibility
        labNames: config.labNames,
        thresholdPercentage: config.thresholdPercentage,
        flagThreshold: config.flagThreshold
      }
    });

  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Get config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update lab names
const updateLabNames = async (req, res) => {
  try {
    const { labNames } = req.body;
    console.log('[LAB CONFIG CONTROLLER] Updating lab names:', labNames);

    if (!Array.isArray(labNames) || labNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lab names must be a non-empty array'
      });
    }

    const config = await LabConfig.getConfig();
    config.labNames = labNames;
    config.updatedBy = req.user.id;
    await config.save();

    console.log('[LAB CONFIG CONTROLLER] Lab names updated successfully');

    res.json({
      success: true,
      message: 'Lab names updated successfully',
      data: {
        labNames: config.labNames
      }
    });

  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Update lab names error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lab names',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update threshold settings
const updateThresholds = async (req, res) => {
  try {
    const { thresholdPercentage, flagThreshold } = req.body;
    console.log('[LAB CONFIG CONTROLLER] Updating thresholds:', {
      thresholdPercentage,
      flagThreshold
    });

    const config = await LabConfig.getConfig();

    // Validate threshold percentage (0-1000%)
    if (thresholdPercentage !== undefined) {
      if (typeof thresholdPercentage !== 'number' || thresholdPercentage < 0 || thresholdPercentage > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Threshold percentage must be between 0 and 1000'
        });
      }
      config.thresholdPercentage = thresholdPercentage;
    }

    // Validate flag threshold (0-100%)
    if (flagThreshold !== undefined) {
      if (typeof flagThreshold !== 'number' || flagThreshold < 0 || flagThreshold > 100) {
        return res.status(400).json({
          success: false,
          message: 'Flag threshold must be between 0 and 100'
        });
      }
      config.flagThreshold = flagThreshold;
    }

    config.updatedBy = req.user.id;
    await config.save();

    console.log('[LAB CONFIG CONTROLLER] Thresholds updated successfully');

    res.json({
      success: true,
      message: 'Threshold settings updated successfully',
      data: {
        thresholdPercentage: config.thresholdPercentage,
        flagThreshold: config.flagThreshold
      }
    });

  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Update thresholds error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update thresholds',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Add a new lab name
const addLabName = async (req, res) => {
  try {
    const { labName } = req.body;
    console.log('[LAB CONFIG CONTROLLER] Adding lab name:', labName);

    if (!labName || typeof labName !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid lab name is required'
      });
    }

    const config = await LabConfig.getConfig();

    // Check if lab name already exists
    if (config.labNames.includes(labName)) {
      return res.status(400).json({
        success: false,
        message: 'Lab name already exists'
      });
    }

    config.labNames.push(labName);
    config.updatedBy = req.user.id;
    await config.save();

    console.log('[LAB CONFIG CONTROLLER] Lab name added successfully');

    res.json({
      success: true,
      message: 'Lab name added successfully',
      data: {
        labNames: config.labNames
      }
    });

  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Add lab name error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add lab name',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Remove a lab name
const removeLabName = async (req, res) => {
  try {
    const { labName } = req.body;
    console.log('[LAB CONFIG CONTROLLER] Removing lab name:', labName);

    if (!labName) {
      return res.status(400).json({
        success: false,
        message: 'Lab name is required'
      });
    }

    const config = await LabConfig.getConfig();

    const index = config.labNames.indexOf(labName);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Lab name not found'
      });
    }

    // Don't allow removing all lab names
    if (config.labNames.length === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the last lab name'
      });
    }

    config.labNames.splice(index, 1);
    config.updatedBy = req.user.id;
    await config.save();

    console.log('[LAB CONFIG CONTROLLER] Lab name removed successfully');

    res.json({
      success: true,
      message: 'Lab name removed successfully',
      data: {
        labNames: config.labNames
      }
    });

  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Remove lab name error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove lab name',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create new lab configuration
const createLab = async (req, res) => {
  try {
    const { name } = req.body;
    console.log('[LAB CONFIG CONTROLLER] Creating lab:', name);

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid lab name is required'
      });
    }

    const config = await LabConfig.getConfig();

    // Check if lab name already exists
    if (config.labs.some(lab => lab.name === name)) {
      return res.status(400).json({
        success: false,
        message: 'Lab with this name already exists'
      });
    }

    // Add new lab (name only - parameter ranges managed separately)
    config.labs.push({
      name,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    config.updatedBy = req.user.userId;
    await config.save();

    const newLab = config.labs[config.labs.length - 1];

    console.log('[LAB CONFIG CONTROLLER] Lab created successfully:', newLab._id);

    res.status(201).json({
      success: true,
      message: 'Lab configuration created successfully',
      data: {
        id: newLab._id.toString(),
        name: newLab.name,
        createdAt: newLab.createdAt,
        updatedAt: newLab.updatedAt
      }
    });

  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Create lab error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create lab configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update existing lab configuration
const updateLab = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    console.log('[LAB CONFIG CONTROLLER] Updating lab:', id);

    const config = await LabConfig.getConfig();

    // Find lab by subdocument ID
    const lab = config.labs.id(id);

    if (!lab) {
      return res.status(404).json({
        success: false,
        message: 'Lab configuration not found'
      });
    }

    // Update lab name (parameter ranges managed separately)
    if (name) lab.name = name;
    lab.updatedAt = new Date();

    config.updatedBy = req.user.userId;
    await config.save();

    console.log('[LAB CONFIG CONTROLLER] Lab updated successfully');

    res.json({
      success: true,
      message: 'Lab configuration updated successfully',
      data: {
        id: lab._id.toString(),
        name: lab.name,
        createdAt: lab.createdAt,
        updatedAt: lab.updatedAt
      }
    });

  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Update lab error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lab configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete lab configuration
const deleteLab = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[LAB CONFIG CONTROLLER] Deleting lab:', id);

    const config = await LabConfig.getConfig();

    // Find lab by subdocument ID
    const lab = config.labs.id(id);

    if (!lab) {
      return res.status(404).json({
        success: false,
        message: 'Lab configuration not found'
      });
    }

    // Don't allow deleting all labs
    if (config.labs.length === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last lab configuration'
      });
    }

    // Remove lab using pull (Mongoose subdocument removal)
    lab.deleteOne();

    config.updatedBy = req.user.userId;
    await config.save();

    console.log('[LAB CONFIG CONTROLLER] Lab deleted successfully');

    res.json({
      success: true,
      message: 'Lab configuration deleted successfully'
    });

  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Delete lab error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lab configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update system configuration
const updateSystemConfig = async (req, res) => {
  try {
    const systemConfig = req.body;
    console.log('[LAB CONFIG CONTROLLER] Updating system configuration');

    const config = await LabConfig.getConfig();

    // Update system config fields
    if (systemConfig.enableAutoProcessing !== undefined) {
      config.systemConfig.enableAutoProcessing = systemConfig.enableAutoProcessing;
    }
    if (systemConfig.processingTimeout !== undefined) {
      config.systemConfig.processingTimeout = systemConfig.processingTimeout;
    }
    if (systemConfig.maxFileSize !== undefined) {
      config.systemConfig.maxFileSize = systemConfig.maxFileSize;
    }
    if (systemConfig.allowedFileTypes !== undefined) {
      config.systemConfig.allowedFileTypes = systemConfig.allowedFileTypes;
    }
    if (systemConfig.retentionDays !== undefined) {
      config.systemConfig.retentionDays = systemConfig.retentionDays;
    }
    if (systemConfig.auditLogEnabled !== undefined) {
      config.systemConfig.auditLogEnabled = systemConfig.auditLogEnabled;
    }
    if (systemConfig.defaultExtractionMethod !== undefined) {
      config.systemConfig.defaultExtractionMethod = systemConfig.defaultExtractionMethod;
    }
    if (systemConfig.defaultModel !== undefined) {
      config.systemConfig.defaultModel = systemConfig.defaultModel;
    }
    if (systemConfig.disableBulkUpload !== undefined) {
      config.systemConfig.disableBulkUpload = systemConfig.disableBulkUpload;
    }

    config.updatedBy = req.user.userId;
    await config.save();

    console.log('[LAB CONFIG CONTROLLER] System configuration updated successfully');

    res.json({
      success: true,
      message: 'System configuration updated successfully',
      data: config.systemConfig
    });

  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Update system config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update system configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update entire config (including experimental features)
const updateConfig = async (req, res) => {
  try {
    const updates = req.body;
    console.log('[LAB CONFIG CONTROLLER] Updating configuration');

    const config = await LabConfig.getConfig();

    // Update experimental features if provided
    if (updates.experimentalFeatures) {
      if (!config.experimentalFeatures) {
        config.experimentalFeatures = {};
      }

      // Deep merge experimental features
      Object.keys(updates.experimentalFeatures).forEach(featureName => {
        if (!config.experimentalFeatures[featureName]) {
          config.experimentalFeatures[featureName] = {};
        }

        Object.assign(config.experimentalFeatures[featureName], updates.experimentalFeatures[featureName]);
      });
    }

    // Update other fields if provided
    if (updates.thresholds) {
      Object.assign(config.thresholds, updates.thresholds);
    }

    if (updates.systemConfig) {
      Object.assign(config.systemConfig, updates.systemConfig);
    }

    config.updatedBy = req.user.userId;
    await config.save();

    console.log('[LAB CONFIG CONTROLLER] Configuration updated successfully');

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: {
        experimentalFeatures: config.experimentalFeatures,
        thresholds: config.thresholds,
        systemConfig: config.systemConfig
      }
    });

  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Update config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get upload configuration (accessible to all authenticated users)
const getUploadConfig = async (req, res) => {
  try {
    const config = await LabConfig.getConfig();

    res.json({
      success: true,
      data: {
        disableBulkUpload: config.systemConfig?.disableBulkUpload || false,
        maxFileSize: config.systemConfig?.maxFileSize || 10
      }
    });
  } catch (error) {
    console.error('[LAB CONFIG CONTROLLER] Get upload config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upload configuration'
    });
  }
};

module.exports = {
  getConfig,
  getUploadConfig,
  updateConfig,
  updateLabNames,
  updateThresholds,
  addLabName,
  removeLabName,
  createLab,
  updateLab,
  deleteLab,
  updateSystemConfig
};