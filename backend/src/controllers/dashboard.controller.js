const Report = require('../models/Report');
const User = require('../models/User');
const LabConfig = require('../models/LabConfig');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const { range = 'week' } = req.query;
    console.log('[DASHBOARD CONTROLLER] Fetching dashboard statistics for range:', range);

    // Get date ranges based on selected range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentStart, previousStart, previousEnd;

    switch (range) {
      case 'today':
        currentStart = today;
        previousStart = new Date(today);
        previousStart.setDate(previousStart.getDate() - 1);
        previousEnd = today;
        break;
      case 'week':
        currentStart = new Date();
        currentStart.setDate(currentStart.getDate() - 7);
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 7);
        previousEnd = currentStart;
        break;
      case 'month':
        currentStart = new Date();
        currentStart.setMonth(currentStart.getMonth() - 1);
        previousStart = new Date(currentStart);
        previousStart.setMonth(previousStart.getMonth() - 1);
        previousEnd = currentStart;
        break;
      case 'year':
        currentStart = new Date();
        currentStart.setFullYear(currentStart.getFullYear() - 1);
        previousStart = new Date(currentStart);
        previousStart.setFullYear(previousStart.getFullYear() - 1);
        previousEnd = currentStart;
        break;
      default:
        currentStart = new Date();
        currentStart.setDate(currentStart.getDate() - 7);
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 7);
        previousEnd = currentStart;
    }

    // Aggregate statistics for current period
    const [
      totalReports,
      currentPeriodReports,
      previousPeriodReports,
      statusCounts,
      flaggedReports,
      criticalReports,
      userStats,
      processingTimes,
      previousProcessingTimes,
      labDistribution,
      currentPeriodUsers,
      previousPeriodUsers
    ] = await Promise.all([
      // Total reports (all time)
      Report.countDocuments(),

      // Current period reports
      Report.countDocuments({ createdAt: { $gte: currentStart } }),

      // Previous period reports (for trend calculation)
      Report.countDocuments({
        createdAt: { $gte: previousStart, $lt: previousEnd }
      }),

      // Status distribution (all time)
      Report.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      // Flagged reports
      Report.countDocuments({ 'flags.requiresAttention': true }),

      // Critical reports
      Report.countDocuments({ 'flags.requiresUrgentAttention': true }),

      // User statistics
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),

      // Average processing time (current period)
      Report.aggregate([
        {
          $match: {
            status: { $in: ['ready', 'approved', 'rejected'] },
            createdAt: { $gte: currentStart }
          }
        },
        {
          $project: {
            processingTime: '$processingMetadata.totalProcessingTime'
          }
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$processingTime' },
            minTime: { $min: '$processingTime' },
            maxTime: { $max: '$processingTime' }
          }
        }
      ]),

      // Average processing time (previous period for trend)
      Report.aggregate([
        {
          $match: {
            status: { $in: ['ready', 'approved', 'rejected'] },
            createdAt: { $gte: previousStart, $lt: previousEnd }
          }
        },
        {
          $project: {
            processingTime: '$processingMetadata.totalProcessingTime'
          }
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$processingTime' }
          }
        }
      ]),

      // Lab distribution
      Report.aggregate([
        { $match: { 'extractedData.labName': { $exists: true } } },
        { $group: { _id: '$extractedData.labName', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Active users in current period
      User.countDocuments({
        createdAt: { $gte: currentStart }
      }),

      // Active users in previous period
      User.countDocuments({
        createdAt: { $gte: previousStart, $lt: previousEnd }
      })
    ]);

    // Format status counts
    const statusMap = {};
    statusCounts.forEach(item => {
      statusMap[item._id] = item.count;
    });

    // Format user stats
    const userMap = {};
    userStats.forEach(item => {
      userMap[item._id] = item.count;
    });

    // Calculate percentages
    const approvalRate = totalReports > 0
      ? Math.round((statusMap.approved || 0) / totalReports * 100)
      : 0;

    const flaggedRate = totalReports > 0
      ? Math.round(flaggedReports / totalReports * 100)
      : 0;

    // Helper function to calculate trend percentage
    const calculateTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };

    // Calculate trends
    const totalUsers = Object.values(userMap).reduce((a, b) => a + b, 0);
    const currentAvgProcessingTime = processingTimes[0]?.avgTime || 0;
    const previousAvgProcessingTime = previousProcessingTimes[0]?.avgTime || 0;

    const stats = {
      overview: {
        totalReports,
        currentPeriodReports,
        approvalRate,
        flaggedRate
      },
      status: {
        uploaded: statusMap.uploaded || 0,
        processing: statusMap.processing || 0,
        ready: statusMap.ready || 0,
        approved: statusMap.approved || 0,
        rejected: statusMap.rejected || 0,
        error: statusMap.error || 0
      },
      flags: {
        flaggedReports,
        criticalReports,
        normalReports: totalReports - flaggedReports
      },
      users: {
        total: totalUsers,
        admins: userMap.admin || 0,
        superAdmins: userMap.super_admin || 0,
        nurses: userMap.nurse || 0
      },
      processingTime: {
        avgTime: currentAvgProcessingTime,
        minTime: processingTimes[0]?.minTime || 0,
        maxTime: processingTimes[0]?.maxTime || 0
      },
      labDistribution: labDistribution.map(lab => ({
        name: lab._id,
        count: lab.count,
        percentage: Math.round(lab.count / totalReports * 100)
      })),
      trends: {
        totalReports: calculateTrend(totalReports, totalReports - currentPeriodReports + previousPeriodReports),
        activeUsers: calculateTrend(currentPeriodUsers, previousPeriodUsers),
        processingTime: calculateTrend(currentAvgProcessingTime, previousAvgProcessingTime),
        approvalRate: calculateTrend(approvalRate, approvalRate) // Will be refined with period-specific approval rates
      }
    };

    console.log('[DASHBOARD CONTROLLER] Statistics compiled successfully');

    res.json({
      success: true,
      message: 'Dashboard statistics fetched successfully',
      data: stats
    });

  } catch (error) {
    console.error('[DASHBOARD CONTROLLER] Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get recent activity
const getRecentActivity = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    console.log('[DASHBOARD CONTROLLER] Fetching recent activity');

    // Get recent reports with user details
    const recentReports = await Report.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('uploadedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .select('orderId status createdAt updatedAt uploadedBy approvedBy rejectedBy uiIndicators');

    // Format activity feed
    const activities = recentReports.map(report => {
      let action = 'uploaded';
      let actor = report.uploadedBy;
      let timestamp = report.createdAt;

      if (report.status === 'approved' && report.approvedBy) {
        action = 'approved';
        actor = report.approvedBy;
        timestamp = report.approvedAt || report.updatedAt;
      } else if (report.status === 'rejected' && report.rejectedBy) {
        action = 'rejected';
        actor = report.rejectedBy;
        timestamp = report.rejectedAt || report.updatedAt;
      } else if (report.status === 'ready') {
        action = 'processed';
        timestamp = report.updatedAt;
      }

      return {
        reportId: report._id,
        orderId: report.orderId,
        action,
        actor: actor ? {
          name: actor.name,
          email: actor.email
        } : null,
        status: report.status,
        uiIndicators: report.uiIndicators,
        timestamp
      };
    });

    console.log('[DASHBOARD CONTROLLER] Recent activity fetched:', activities.length, 'items');

    res.json({
      success: true,
      message: 'Recent activity fetched successfully',
      data: activities
    });

  } catch (error) {
    console.error('[DASHBOARD CONTROLLER] Recent activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get performance metrics
const getPerformanceMetrics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    console.log('[DASHBOARD CONTROLLER] Fetching performance metrics for', days, 'days');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Daily report counts
    const dailyReports = await Report.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          flagged: {
            $sum: { $cond: ['$flags.requiresAttention', 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // User performance
    const userPerformance = await Report.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$uploadedBy',
          totalUploads: { $sum: 1 },
          processed: {
            $sum: { $cond: [{ $ne: ['$status', 'uploaded'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          role: '$user.role',
          totalUploads: 1,
          processed: 1
        }
      },
      { $sort: { totalUploads: -1 } },
      { $limit: 10 }
    ]);

    // Processing time trends
    const processingTrends = await Report.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['ready', 'approved', 'rejected'] }
        }
      },
      {
        $project: {
          date: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          processingTime: '$processingMetadata.totalProcessingTime' // Processing time in seconds
        }
      },
      {
        $group: {
          _id: '$date',
          avgTime: { $avg: '$processingTime' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    const metrics = {
      dailyReports: dailyReports.map(day => ({
        date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
        total: day.count,
        approved: day.approved,
        rejected: day.rejected,
        flagged: day.flagged
      })),
      userPerformance,
      processingTrends: processingTrends.map(trend => ({
        date: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}-${String(trend._id.day).padStart(2, '0')}`,
        avgProcessingTime: Math.round(trend.avgTime * 10) / 10,
        reportsProcessed: trend.count
      }))
    };

    console.log('[DASHBOARD CONTROLLER] Performance metrics compiled');

    res.json({
      success: true,
      message: 'Performance metrics fetched successfully',
      data: metrics
    });

  } catch (error) {
    console.error('[DASHBOARD CONTROLLER] Performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get system health
const getSystemHealth = async (req, res) => {
  try {
    console.log('[DASHBOARD CONTROLLER] Checking system health');

    const mongoose = require('mongoose');

    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Get collection stats
    const [reportCount, userCount] = await Promise.all([
      Report.estimatedDocumentCount(),
      User.estimatedDocumentCount()
    ]);

    // Check for stuck processing
    const stuckProcessing = await Report.countDocuments({
      status: 'processing',
      updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } // Stuck for > 30 minutes
    });

    // Check for errors in last hour
    const recentErrors = await Report.countDocuments({
      status: 'error',
      updatedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });

    // Get configuration
    const config = await LabConfig.getConfig();

    const health = {
      status: 'healthy',
      database: {
        status: dbStatus,
        reports: reportCount,
        users: userCount
      },
      processing: {
        stuck: stuckProcessing,
        recentErrors
      },
      configuration: {
        labNames: config.labNames.length,
        thresholdPercentage: config.thresholdPercentage,
        flagThreshold: config.flagThreshold
      },
      timestamp: new Date().toISOString()
    };

    // Determine overall health status
    if (dbStatus !== 'connected') {
      health.status = 'critical';
    } else if (stuckProcessing > 5 || recentErrors > 10) {
      health.status = 'warning';
    }

    console.log('[DASHBOARD CONTROLLER] System health:', health.status);

    res.json({
      success: true,
      message: 'System health checked',
      data: health
    });

  } catch (error) {
    console.error('[DASHBOARD CONTROLLER] System health error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check system health',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivity,
  getPerformanceMetrics,
  getSystemHealth
};