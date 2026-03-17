const HealthCheckTracking = require('../models/HealthCheckTracking');
const healthCheckSyncService = require('../services/healthCheckSync.service');

// GET / - Paginated list with filters
exports.getRecords = async (req, res) => {
  try {
    const {
      page = 1, limit = 25, sortBy = 'orderDate', sortOrder = 'desc',
      search, cugCode, relativeCugCode, vendorType, syncStatus, labProvider,
      status, reportStatus, smartReportStatus, dateFrom, dateTo, relationship,
      digitizationStatus, packageName, timeDiffMin, timeDiffMax
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { uhid: { $regex: search, $options: 'i' } }
      ];
    }
    if (cugCode) filter.cugCode = cugCode;
    if (relativeCugCode) filter.relativeCugCode = relativeCugCode;
    if (vendorType) filter.vendorType = vendorType;
    if (syncStatus !== undefined && syncStatus !== '') filter.syncStatus = syncStatus === 'true';
    if (labProvider) filter.labProvider = labProvider;
    if (status) filter.status = status;
    if (reportStatus) filter.reportStatus = reportStatus;
    if (smartReportStatus) filter.smartReportStatus = smartReportStatus;
    if (relationship) filter.relationship = relationship;
    if (digitizationStatus) filter.digitizationStatus = digitizationStatus;
    if (packageName) filter.packageName = packageName;
    if (dateFrom || dateTo) {
      filter.orderDate = {};
      if (dateFrom) filter.orderDate.$gte = new Date(dateFrom);
      if (dateTo) filter.orderDate.$lte = new Date(dateTo);
    }
    if (timeDiffMin || timeDiffMax) {
      filter.timeDiffMs = {};
      if (timeDiffMin) filter.timeDiffMs.$gte = parseInt(timeDiffMin) * 86400000; // days to ms
      if (timeDiffMax) filter.timeDiffMs.$lte = parseInt(timeDiffMax) * 86400000;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [records, total] = await Promise.all([
      HealthCheckTracking.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      HealthCheckTracking.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[HC TRACKING] getRecords error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch records', error: error.message });
  }
};

// GET /stats - Summary statistics
exports.getStats = async (req, res) => {
  try {
    const defaultFunnel = {
      totalBooked: 0, synced: 0, notSynced: 0,
      smartReportFromSynced: 0, digitizedFromNotSynced: 0,
      smartReportFromNotSynced: 0, totalSmartReports: 0, smartReportErrors: 0,
    };

    const [
      totalOrders,
      integratedCount,
      nonIntegratedCount,
      syncedCount,
      digitizedCount,
      statusBreakdown,
      vendorDistribution,
      cugDistribution,
      relationshipBreakdown,
      smartReportStats,
      dailyTrend,
      funnelResult,
      cugBreakdown,
      smartReportErrorsByProvider,
      labProviderCompliance
    ] = await Promise.all([
      HealthCheckTracking.countDocuments(),
      HealthCheckTracking.countDocuments({ vendorType: 'Integrated' }),
      HealthCheckTracking.countDocuments({ vendorType: 'Non-Integrated' }),
      HealthCheckTracking.countDocuments({ syncStatus: true }),
      HealthCheckTracking.countDocuments({ digitizationStatus: 'Uploaded' }),
      HealthCheckTracking.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      HealthCheckTracking.aggregate([
        { $group: { _id: '$labProvider', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]),
      HealthCheckTracking.aggregate([
        { $group: { _id: '$cugCode', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      HealthCheckTracking.aggregate([
        { $group: { _id: '$relationship', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      HealthCheckTracking.aggregate([
        {
          $group: {
            _id: null,
            withSmartReport: { $sum: { $cond: [{ $ne: ['$smartReportDate', null] }, 1, 0] } },
            withoutSmartReport: { $sum: { $cond: [{ $eq: ['$smartReportDate', null] }, 1, 0] } }
          }
        }
      ]),
      HealthCheckTracking.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 90 }
      ]),
      // Funnel stats aggregation
      HealthCheckTracking.aggregate([
        {
          $group: {
            _id: null,
            totalBooked: { $sum: 1 },
            synced: {
              $sum: { $cond: [{ $eq: ['$syncStatus', true] }, 1, 0] }
            },
            notSynced: {
              $sum: { $cond: [{ $ne: ['$syncStatus', true] }, 1, 0] }
            },
            smartReportFromSynced: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$syncStatus', true] },
                      { $eq: ['$smartReportStatus', 'Success'] }
                    ]
                  },
                  1, 0
                ]
              }
            },
            digitizedFromNotSynced: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$syncStatus', true] },
                      { $eq: ['$digitizationReportStatus', 'published'] }
                    ]
                  },
                  1, 0
                ]
              }
            },
            smartReportFromNotSynced: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$syncStatus', true] },
                      { $eq: ['$smartReportStatus', 'Success'] }
                    ]
                  },
                  1, 0
                ]
              }
            },
            totalSmartReports: {
              $sum: {
                $cond: [{ $eq: ['$smartReportStatus', 'Success'] }, 1, 0]
              }
            },
            smartReportErrors: {
              $sum: { $cond: [{ $eq: ['$smartReportStatus', 'Error'] }, 1, 0] }
            }
          }
        }
      ]),
      // CUG breakdown aggregation
      HealthCheckTracking.aggregate([
        {
          $group: {
            _id: { cugCode: '$cugCode' },
            totalOrders: { $sum: 1 },
            synced: {
              $sum: { $cond: [{ $eq: ['$syncStatus', true] }, 1, 0] }
            },
            smartReports: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$smartReportDate', null] }, { $eq: ['$smartReportStatus', 'Success'] }] },
                  1, 0
                ]
              }
            },
            digitized: {
              $sum: { $cond: [{ $eq: ['$digitizationStatus', 'Uploaded'] }, 1, 0] }
            },
            smartReportErrors: {
              $sum: { $cond: [{ $eq: ['$smartReportStatus', 'Error'] }, 1, 0] }
            }
          }
        },
        { $sort: { totalOrders: -1 } }
      ]),
      // Smart report errors by provider aggregation
      HealthCheckTracking.aggregate([
        { $match: { smartReportStatus: 'Error' } },
        {
          $group: {
            _id: '$labProvider',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      // Lab provider compliance breakdown
      HealthCheckTracking.aggregate([
        {
          $group: {
            _id: '$labProvider',
            totalOrders: { $sum: 1 },
            synced: { $sum: { $cond: [{ $eq: ['$syncStatus', true] }, 1, 0] } },
            smartReports: {
              $sum: { $cond: [{ $eq: ['$smartReportStatus', 'Success'] }, 1, 0] }
            },
          }
        },
        { $sort: { totalOrders: -1 } },
        { $limit: 15 }
      ])
    ]);

    const funnel = funnelResult[0]
      ? { ...defaultFunnel, ...funnelResult[0], _id: undefined }
      : { ...defaultFunnel };

    res.json({
      success: true,
      data: {
        totalOrders,
        integratedCount,
        nonIntegratedCount,
        syncedCount,
        digitizedCount,
        statusBreakdown: statusBreakdown.map(s => ({ name: s._id || 'Unknown', count: s.count })),
        vendorDistribution: vendorDistribution.map(v => ({ name: v._id || 'Unknown', count: v.count })),
        cugDistribution: cugDistribution.map(c => ({ name: c._id || 'Unknown', count: c.count })),
        relationshipBreakdown: relationshipBreakdown.map(r => ({ name: r._id || 'Unknown', count: r.count })),
        smartReportStats: smartReportStats[0] || { withSmartReport: 0, withoutSmartReport: 0 },
        dailyTrend: dailyTrend.map(d => ({ date: d._id, count: d.count })),
        funnel,
        cugBreakdown: cugBreakdown.map(c => ({
          cugCode: (c._id && c._id.cugCode) || 'Unknown',
          totalOrders: c.totalOrders,
          synced: c.synced,
          smartReports: c.smartReports,
          digitized: c.digitized,
          smartReportErrors: c.smartReportErrors
        })),
        smartReportErrorsByProvider: smartReportErrorsByProvider.map(e => ({
          provider: e._id || 'Unknown',
          count: e.count
        })),
        labProviderCompliance: labProviderCompliance.map(lp => ({
          labProvider: lp._id || 'Unknown',
          totalOrders: lp.totalOrders,
          synced: lp.synced,
          smartReports: lp.smartReports,
        }))
      }
    });
  } catch (error) {
    console.error('[HC TRACKING] getStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
  }
};

// POST /sync - Manual sync trigger
exports.triggerSync = async (req, res) => {
  try {
    const result = await healthCheckSyncService.sync();
    res.json({ success: true, message: 'Sync completed', data: result });
  } catch (error) {
    console.error('[HC TRACKING] sync error:', error);
    const statusCode = error.message === 'Sync already in progress' ? 409 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

// GET /sync-status
exports.getSyncStatus = async (req, res) => {
  try {
    const status = healthCheckSyncService.getSyncStatus();
    const recordCount = await HealthCheckTracking.countDocuments();
    res.json({ success: true, data: { ...status, recordCount } });
  } catch (error) {
    console.error('[HC TRACKING] getSyncStatus error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /filters - Distinct values for dropdowns
exports.getFilters = async (req, res) => {
  try {
    const [
      cugCodes, relativeCugCodes, labProviders, statuses, reportStatuses,
      smartReportStatuses, relationships, vendorTypes, digitizationStatuses, packageNames
    ] = await Promise.all([
      HealthCheckTracking.distinct('cugCode'),
      HealthCheckTracking.distinct('relativeCugCode'),
      HealthCheckTracking.distinct('labProvider'),
      HealthCheckTracking.distinct('status'),
      HealthCheckTracking.distinct('reportStatus'),
      HealthCheckTracking.distinct('smartReportStatus'),
      HealthCheckTracking.distinct('relationship'),
      HealthCheckTracking.distinct('vendorType'),
      HealthCheckTracking.distinct('digitizationStatus'),
      HealthCheckTracking.distinct('packageName'),
    ]);

    res.json({
      success: true,
      data: {
        cugCodes: cugCodes.filter(Boolean).sort(),
        relativeCugCodes: relativeCugCodes.filter(Boolean).sort(),
        labProviders: labProviders.filter(Boolean).sort(),
        statuses: statuses.filter(Boolean).sort(),
        reportStatuses: reportStatuses.filter(Boolean).sort(),
        smartReportStatuses: smartReportStatuses.filter(Boolean).sort(),
        relationships: relationships.filter(Boolean).sort(),
        vendorTypes: vendorTypes.filter(Boolean).sort(),
        digitizationStatuses: digitizationStatuses.filter(Boolean).sort(),
        packageNames: packageNames.filter(Boolean).sort(),
      }
    });
  } catch (error) {
    console.error('[HC TRACKING] getFilters error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /export - Export filtered data as JSON (frontend handles Excel conversion)
exports.exportData = async (req, res) => {
  try {
    const {
      search, cugCode, relativeCugCode, vendorType, syncStatus, labProvider,
      status, reportStatus, smartReportStatus, dateFrom, dateTo, relationship,
      digitizationStatus, packageName, timeDiffMin, timeDiffMax
    } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { uhid: { $regex: search, $options: 'i' } }
      ];
    }
    if (cugCode) filter.cugCode = cugCode;
    if (relativeCugCode) filter.relativeCugCode = relativeCugCode;
    if (vendorType) filter.vendorType = vendorType;
    if (syncStatus !== undefined && syncStatus !== '') filter.syncStatus = syncStatus === 'true';
    if (labProvider) filter.labProvider = labProvider;
    if (status) filter.status = status;
    if (reportStatus) filter.reportStatus = reportStatus;
    if (smartReportStatus) filter.smartReportStatus = smartReportStatus;
    if (relationship) filter.relationship = relationship;
    if (digitizationStatus) filter.digitizationStatus = digitizationStatus;
    if (packageName) filter.packageName = packageName;
    if (dateFrom || dateTo) {
      filter.orderDate = {};
      if (dateFrom) filter.orderDate.$gte = new Date(dateFrom);
      if (dateTo) filter.orderDate.$lte = new Date(dateTo);
    }
    if (timeDiffMin || timeDiffMax) {
      filter.timeDiffMs = {};
      if (timeDiffMin) filter.timeDiffMs.$gte = parseInt(timeDiffMin) * 86400000;
      if (timeDiffMax) filter.timeDiffMs.$lte = parseInt(timeDiffMax) * 86400000;
    }

    const records = await HealthCheckTracking.find(filter)
      .sort({ orderDate: -1 })
      .limit(10000)
      .lean();

    res.json({ success: true, data: records, total: records.length });
  } catch (error) {
    console.error('[HC TRACKING] export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
