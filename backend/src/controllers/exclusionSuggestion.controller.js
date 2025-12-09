const ExclusionSuggestion = require('../models/ExclusionSuggestion');
const ParameterExclusion = require('../models/ParameterExclusion');

// Create a new exclusion suggestion
const createSuggestion = async (req, res) => {
  try {
    const {
      suggestedParameter,
      suggestedUnit,
      suggestedLabName,
      reason,
      reportId
    } = req.body;

    const userId = req.user.userId;

    // Validate required fields
    if (!suggestedParameter || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Parameter name and reason are required'
      });
    }

    // Check if this parameter is already excluded
    const existingExclusion = await ParameterExclusion.findOne({
      excludedParameter: new RegExp(`^${suggestedParameter}$`, 'i'),
      isActive: true,
      ...(suggestedUnit ? { unit: new RegExp(`^${suggestedUnit}$`, 'i') } : { unit: null })
    });

    if (existingExclusion) {
      return res.status(400).json({
        success: false,
        message: 'This parameter is already excluded'
      });
    }

    // Check for duplicate pending suggestions
    const duplicateSuggestion = await ExclusionSuggestion.findOne({
      suggestedParameter: new RegExp(`^${suggestedParameter}$`, 'i'),
      status: 'pending',
      ...(suggestedUnit ? { suggestedUnit: new RegExp(`^${suggestedUnit}$`, 'i') } : {})
    });

    if (duplicateSuggestion) {
      return res.status(400).json({
        success: false,
        message: 'A similar exclusion suggestion is already pending approval'
      });
    }

    // Create the suggestion
    const suggestion = new ExclusionSuggestion({
      suggestedParameter: suggestedParameter.trim(),
      suggestedUnit: suggestedUnit?.trim() || null,
      suggestedLabName: suggestedLabName?.trim() || null,
      reason: reason.trim(),
      reportId,
      suggestedBy: userId
    });

    await suggestion.save();
    await suggestion.populate('suggestedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Exclusion suggestion submitted successfully',
      data: suggestion
    });

  } catch (error) {
    console.error('[EXCLUSION SUGGESTION] Error creating suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create exclusion suggestion',
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

    const result = await ExclusionSuggestion.getSuggestions(filter, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      message: 'Suggestions fetched successfully',
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('[EXCLUSION SUGGESTION] Error fetching suggestions:', error);
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
      ExclusionSuggestion.countDocuments({ ...baseFilter, status: 'pending' }),
      ExclusionSuggestion.countDocuments({ ...baseFilter, status: 'approved' }),
      ExclusionSuggestion.countDocuments({ ...baseFilter, status: 'rejected' }),
      ExclusionSuggestion.countDocuments(baseFilter)
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
    console.error('[EXCLUSION SUGGESTION] Error getting stats:', error);
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

    const suggestion = await ExclusionSuggestion.findById(id);

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
      message: 'Suggestion approved and exclusion created successfully',
      data: suggestion
    });

  } catch (error) {
    console.error('[EXCLUSION SUGGESTION] Error approving suggestion:', error);
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

    const suggestion = await ExclusionSuggestion.findById(id);

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
    console.error('[EXCLUSION SUGGESTION] Error rejecting suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject suggestion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single suggestion details
const getSuggestionById = async (req, res) => {
  try {
    const { id } = req.params;

    const suggestion = await ExclusionSuggestion.findById(id)
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
    console.error('[EXCLUSION SUGGESTION] Error fetching suggestion:', error);
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
  getSuggestionById
};
