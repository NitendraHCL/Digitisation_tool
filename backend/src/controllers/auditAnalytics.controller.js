const Report = require('../models/Report');
const User = require('../models/User');

// Get overall audit summary statistics
const getAuditSummary = async (req, res) => {
  try {
    console.log('[AUDIT ANALYTICS] Getting overall audit summary');

    // Get all approved and rejected reports with audit summaries
    const reports = await Report.find({
      status: { $in: ['approved', 'rejected'] },
      'auditSummary.totalParameters': { $gt: 0 }
    }).select('auditSummary status');

    const totalReports = reports.length;

    // Calculate average accuracy
    const avgAccuracy = reports.length > 0
      ? reports.reduce((sum, r) => sum + (r.auditSummary?.accuracyPercentage || 0), 0) / reports.length
      : 0;

    // Count total edits across all reports
    const totalEdits = reports.reduce((sum, r) => sum + (r.auditSummary?.editedParameters || 0), 0);

    // Group reports by accuracy ranges
    const reportsByAccuracy = {
      '90-100%': 0,
      '70-90%': 0,
      '50-70%': 0,
      '0-50%': 0
    };

    reports.forEach(report => {
      const accuracy = report.auditSummary?.accuracyPercentage || 0;
      if (accuracy >= 90) reportsByAccuracy['90-100%']++;
      else if (accuracy >= 70) reportsByAccuracy['70-90%']++;
      else if (accuracy >= 50) reportsByAccuracy['50-70%']++;
      else reportsByAccuracy['0-50%']++;
    });

    res.json({
      success: true,
      data: {
        totalReports,
        avgAccuracy: Math.round(avgAccuracy * 100) / 100,
        totalEdits,
        reportsByAccuracy: Object.entries(reportsByAccuracy).map(([range, count]) => ({
          range,
          count
        }))
      }
    });

  } catch (error) {
    console.error('[AUDIT ANALYTICS] Error getting audit summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get paginated list of reports with audit data
const getAuditReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      minAccuracy,
      maxAccuracy,
      labName,
      reviewedBy
    } = req.query;

    console.log('[AUDIT ANALYTICS] Getting audit reports with filters:', {
      page,
      limit,
      startDate,
      endDate,
      minAccuracy,
      maxAccuracy,
      labName,
      reviewedBy
    });

    // Build query
    const query = {
      status: { $in: ['approved', 'rejected'] },
      'auditSummary.totalParameters': { $gt: 0 }
    };

    // Date range filter
    if (startDate || endDate) {
      query.$or = [
        { approvedAt: {} },
        { rejectedAt: {} }
      ];
      if (startDate) {
        query.$or[0].approvedAt.$gte = new Date(startDate);
        query.$or[1].rejectedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.$or[0].approvedAt.$lte = new Date(endDate);
        query.$or[1].rejectedAt.$lte = new Date(endDate);
      }
    }

    // Accuracy range filter
    if (minAccuracy !== undefined) {
      query['auditSummary.accuracyPercentage'] = {
        ...query['auditSummary.accuracyPercentage'],
        $gte: parseFloat(minAccuracy)
      };
    }
    if (maxAccuracy !== undefined) {
      query['auditSummary.accuracyPercentage'] = {
        ...query['auditSummary.accuracyPercentage'],
        $lte: parseFloat(maxAccuracy)
      };
    }

    // Lab name filter
    if (labName) {
      query['extractedData.labName'] = { $regex: labName, $options: 'i' };
    }

    // Reviewed by filter
    if (reviewedBy) {
      query.$or = [
        { approvedBy: reviewedBy },
        { rejectedBy: reviewedBy }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reports = await Report.find(query)
      .select('orderId extractedData.labName auditSummary status approvedBy rejectedBy approvedAt rejectedAt')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .sort({ approvedAt: -1, rejectedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Report.countDocuments(query);

    const formattedReports = reports.map(report => {
      // Safely extract reviewer name, handling cases where populate failed
      let reviewedBy = 'N/A';
      if (report.approvedBy && typeof report.approvedBy === 'object' && report.approvedBy.name) {
        reviewedBy = report.approvedBy.name;
      } else if (report.rejectedBy && typeof report.rejectedBy === 'object' && report.rejectedBy.name) {
        reviewedBy = report.rejectedBy.name;
      } else if (report.approvedBy || report.rejectedBy) {
        console.warn(`[AUDIT] Failed to populate reviewer for report ${report._id}`);
      }

      return {
        reportId: report._id,
        orderId: report.orderId,
        labName: report.extractedData?.labName || 'N/A',
        totalParameters: report.auditSummary?.totalParameters || 0,
        editedParameters: report.auditSummary?.editedParameters || 0,
        accuracyPercentage: report.auditSummary?.accuracyPercentage || 0,
        reviewDuration: report.auditSummary?.reviewDuration || null,
        secondsPerParameter: report.auditSummary?.secondsPerParameter || null,
        reviewedBy: reviewedBy,
        reviewedAt: report.approvedAt || report.rejectedAt,
        status: report.status
      };
    });

    res.json({
      success: true,
      data: {
        reports: formattedReports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('[AUDIT ANALYTICS] Error getting audit reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit reports',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get most edited parameters across all reports
const getMostEditedParameters = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log('[AUDIT ANALYTICS] Getting most edited parameters');

    const reports = await Report.find({
      status: { $in: ['approved', 'rejected'] },
      'editHistory.0': { $exists: true }
    }).select('editHistory');

    // Count parameter edits
    const parameterCounts = {};
    reports.forEach(report => {
      const editedParams = new Set();
      report.editHistory.forEach(edit => {
        const paramName = edit.field.split('.')[0];
        editedParams.add(paramName);
      });
      editedParams.forEach(param => {
        parameterCounts[param] = (parameterCounts[param] || 0) + 1;
      });
    });

    // Sort and get top N
    const sortedParams = Object.entries(parameterCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, parseInt(limit))
      .map(([parameter, count]) => ({ parameter, count }));

    res.json({
      success: true,
      data: sortedParams
    });

  } catch (error) {
    console.error('[AUDIT ANALYTICS] Error getting most edited parameters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get most edited parameters',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get accuracy trends over time
const getAccuracyTrends = async (req, res) => {
  try {
    const { period = 'day', limit = 30 } = req.query;

    console.log('[AUDIT ANALYTICS] Getting accuracy trends, period:', period);

    // Determine date grouping based on period
    let dateFormat;
    switch (period) {
      case 'week':
        dateFormat = { $week: { $ifNull: ['$approvedAt', '$rejectedAt'] } };
        break;
      case 'month':
        dateFormat = { $month: { $ifNull: ['$approvedAt', '$rejectedAt'] } };
        break;
      default: // day
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: { $ifNull: ['$approvedAt', '$rejectedAt'] } } };
    }

    const trends = await Report.aggregate([
      {
        $match: {
          status: { $in: ['approved', 'rejected'] },
          'auditSummary.totalParameters': { $gt: 0 }
        }
      },
      {
        $group: {
          _id: dateFormat,
          avgAccuracy: { $avg: '$auditSummary.accuracyPercentage' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.json({
      success: true,
      data: trends.map(t => ({
        date: t._id,
        avgAccuracy: Math.round(t.avgAccuracy * 100) / 100,
        reportCount: t.count
      }))
    });

  } catch (error) {
    console.error('[AUDIT ANALYTICS] Error getting accuracy trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get accuracy trends',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all mismatch records
const getMismatches = async (req, res) => {
  try {
    console.log('[AUDIT ANALYTICS] Getting mismatch records');

    const { startDate, endDate, userId, mismatchType, page = 1, limit = 10 } = req.query;

    // Import AuditLog model
    const AuditLog = require('../models/AuditLog');

    const query = {
      action: 'APPROVAL_WITH_MISMATCH'
    };

    if (startDate || endDate) {
      query.actionTimestamp = {};
      if (startDate) query.actionTimestamp.$gte = new Date(startDate);
      if (endDate) query.actionTimestamp.$lte = new Date(endDate);
    }

    if (userId) query.userId = userId;
    if (mismatchType) query.mismatchType = mismatchType;

    const skip = (page - 1) * limit;

    const mismatches = await AuditLog.find(query)
      .populate('userId', 'name email role')
      .populate('reportId', 'orderId status')
      .sort({ actionTimestamp: -1 })
      .limit(limit * 1)
      .skip(skip);

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: mismatches,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('[AUDIT ANALYTICS] Error getting mismatches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mismatch records',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get mismatch statistics
const getMismatchStats = async (req, res) => {
  try {
    console.log('[AUDIT ANALYTICS] Getting mismatch statistics');

    const { startDate, endDate } = req.query;

    const AuditLog = require('../models/AuditLog');

    const stats = await AuditLog.getMismatchStats(
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    // Get overall mismatch summary
    const summary = await AuditLog.aggregate([
      {
        $match: {
          action: 'APPROVAL_WITH_MISMATCH',
          ...(startDate || endDate ? {
            actionTimestamp: {
              ...(startDate && { $gte: new Date(startDate) }),
              ...(endDate && { $lte: new Date(endDate) })
            }
          } : {})
        }
      },
      {
        $group: {
          _id: '$mismatchType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        userStats: stats,
        mismatchTypeDistribution: summary,
        totalMismatches: summary.reduce((sum, item) => sum + item.count, 0)
      }
    });

  } catch (error) {
    console.error('[AUDIT ANALYTICS] Error getting mismatch stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mismatch statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user-specific mismatch history
const getUserMismatchHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    console.log('[AUDIT ANALYTICS] Getting mismatch history for user:', userId);

    const AuditLog = require('../models/AuditLog');

    const history = await AuditLog.getMismatchesByUser(
      userId,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    // Get summary statistics for the user
    const stats = await AuditLog.aggregate([
      {
        $match: {
          userId: require('mongoose').Types.ObjectId(userId),
          action: 'APPROVAL_WITH_MISMATCH'
        }
      },
      {
        $group: {
          _id: null,
          totalMismatches: { $sum: 1 },
          overriddenCount: { $sum: { $cond: ['$wasOverridden', 1, 0] } },
          mismatchTypes: { $addToSet: '$mismatchType' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        history,
        statistics: stats[0] || { totalMismatches: 0, overriddenCount: 0, mismatchTypes: [] }
      }
    });

  } catch (error) {
    console.error('[AUDIT ANALYTICS] Error getting user mismatch history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user mismatch history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAuditSummary,
  getAuditReports,
  getMostEditedParameters,
  getAccuracyTrends,
  getMismatches,
  getMismatchStats,
  getUserMismatchHistory
};
