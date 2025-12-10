const ParameterSuggestion = require('../models/ParameterSuggestion');
const ParameterMaster = require('../models/ParameterMaster');

// Create a new parameter suggestion
const createSuggestion = async (req, res) => {
  try {
    const {
      action,
      suggestedParameter,
      suggestedUnit,
      newParameterData,
      targetParameterId,
      targetParameterName,
      validationFlag,
      reportId
    } = req.body;

    const userId = req.user.userId;

    // Validate required fields based on action
    if (!action || !suggestedParameter) {
      return res.status(400).json({
        success: false,
        message: 'Action and suggested parameter are required'
      });
    }

    if (action === 'create' && (!newParameterData || !newParameterData.parameterId || !newParameterData.valueType)) {
      return res.status(400).json({
        success: false,
        message: 'Parameter ID and value type are required for creating new parameters'
      });
    }

    if ((action === 'update_alias' || action === 'update_unit') && !targetParameterId) {
      return res.status(400).json({
        success: false,
        message: 'Target parameter ID is required for update actions'
      });
    }

    // Check if parameter ID already exists (for create action)
    if (action === 'create') {
      const existingParam = await ParameterMaster.findOne({
        parameterId: newParameterData.parameterId
      });

      if (existingParam) {
        return res.status(400).json({
          success: false,
          message: `Parameter with ID "${newParameterData.parameterId}" already exists`
        });
      }
    }

    // Check for duplicate pending suggestions
    const duplicateSuggestion = await ParameterSuggestion.findOne({
      suggestedParameter,
      action,
      status: 'pending',
      ...(action !== 'create' && { targetParameterId })
    });

    if (duplicateSuggestion) {
      return res.status(400).json({
        success: false,
        message: 'A similar suggestion is already pending approval'
      });
    }

    // Create the suggestion
    const suggestion = new ParameterSuggestion({
      action,
      suggestedParameter,
      suggestedUnit,
      newParameterData: action === 'create' ? newParameterData : undefined,
      targetParameterId: action !== 'create' ? targetParameterId : undefined,
      targetParameterName: action !== 'create' ? targetParameterName : undefined,
      validationFlag,
      reportId,
      suggestedBy: userId
    });

    await suggestion.save();
    await suggestion.populate('suggestedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Parameter suggestion submitted successfully',
      data: suggestion
    });

  } catch (error) {
    console.error('[PARAMETER SUGGESTION] Error creating suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create parameter suggestion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all suggestions with filters
const getSuggestions = async (req, res) => {
  try {
    const {
      status = null,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    // If user is not admin, only show their own suggestions
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      filter.suggestedBy = req.user.userId;
    }

    const result = await ParameterSuggestion.getSuggestions(filter, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      message: 'Suggestions fetched successfully',
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('[PARAMETER SUGGESTION] Error fetching suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suggestions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get suggestion statistics
const getSuggestionStats = async (req, res) => {
  try {
    const baseFilter = {};

    // If not admin, show only user's own stats
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      baseFilter.suggestedBy = req.user.userId;
    }

    const [pending, approved, rejected, total] = await Promise.all([
      ParameterSuggestion.countDocuments({ ...baseFilter, status: 'pending' }),
      ParameterSuggestion.countDocuments({ ...baseFilter, status: 'approved' }),
      ParameterSuggestion.countDocuments({ ...baseFilter, status: 'rejected' }),
      ParameterSuggestion.countDocuments(baseFilter)
    ]);

    res.json({
      success: true,
      data: {
        pending,
        approved,
        rejected,
        total
      }
    });

  } catch (error) {
    console.error('[PARAMETER SUGGESTION] Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestion statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Approve a suggestion (Admin only)
const approveSuggestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user.userId;

    const suggestion = await ParameterSuggestion.findById(id);

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This suggestion has already been reviewed'
      });
    }

    // Approve and apply the suggestion
    await suggestion.approve(adminId, notes);

    await suggestion.populate(['suggestedBy', 'reviewedBy']);

    res.json({
      success: true,
      message: 'Suggestion approved and applied successfully',
      data: suggestion
    });

  } catch (error) {
    console.error('[PARAMETER SUGGESTION] Error approving suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve suggestion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reject a suggestion (Admin only)
const rejectSuggestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.userId;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const suggestion = await ParameterSuggestion.findById(id);

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This suggestion has already been reviewed'
      });
    }

    // Reject the suggestion
    await suggestion.reject(adminId, reason);

    await suggestion.populate(['suggestedBy', 'reviewedBy']);

    res.json({
      success: true,
      message: 'Suggestion rejected',
      data: suggestion
    });

  } catch (error) {
    console.error('[PARAMETER SUGGESTION] Error rejecting suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject suggestion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Search existing parameters (for nurses to find and add aliases)
const searchParameters = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    // Search in parameter master
    const parameters = await ParameterMaster.find({
      $or: [
        { parameterName: new RegExp(q, 'i') },
        { parameterId: new RegExp(q, 'i') },
        { aliases: { $elemMatch: { $regex: q, $options: 'i' } } }
      ]
    })
    .limit(10)
    .select('parameterId parameterName aliases possibleUnits valueType description');

    res.json({
      success: true,
      data: parameters
    });

  } catch (error) {
    console.error('[PARAMETER SUGGESTION] Error searching parameters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search parameters',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single suggestion details
const getSuggestionById = async (req, res) => {
  try {
    const { id } = req.params;

    const suggestion = await ParameterSuggestion.findById(id)
      .populate('suggestedBy', 'name email')
      .populate('reviewedBy', 'name email');

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    // Check if user has permission to view this suggestion
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const isOwner = suggestion.suggestedBy._id.toString() === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this suggestion'
      });
    }

    res.json({
      success: true,
      data: suggestion
    });

  } catch (error) {
    console.error('[PARAMETER SUGGESTION] Error fetching suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suggestion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createSuggestion,
  getSuggestions,
  getSuggestionStats,
  approveSuggestion,
  rejectSuggestion,
  searchParameters,
  getSuggestionById
};