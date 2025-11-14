const Report = require('../models/Report');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Export reports to CSV
const exportToCSV = async (req, res) => {
  try {
    const { startDate, endDate, status, labName } = req.query;
    console.log('[EXPORT CONTROLLER] Exporting to CSV with filters:', {
      startDate,
      endDate,
      status,
      labName
    });

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (labName) {
      query['extractedData.labName'] = labName;
    }

    // Fetch reports
    const reports = await Report.find(query)
      .populate('uploadedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    // Create CSV content
    let csv = 'Order ID,Status,Lab Name,Upload Date,Uploaded By,Approved By,Total Parameters,Abnormal Count,Flag Status\n';

    reports.forEach(report => {
      const row = [
        report.orderId,
        report.status,
        report.extractedData?.labName || 'N/A',
        report.createdAt.toISOString().split('T')[0],
        report.uploadedBy?.name || 'N/A',
        report.approvedBy?.name || 'N/A',
        report.extractedData?.results?.length || 0,
        report.flags?.abnormalCount || 0,
        report.flags?.requiresAttention ? 'Flagged' : 'Normal'
      ];

      csv += row.map(field => `"${field}"`).join(',') + '\n';
    });

    console.log('[EXPORT CONTROLLER] CSV generated for', reports.length, 'reports');

    // Send CSV file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=lab-reports-${Date.now()}.csv`);
    res.send(csv);

  } catch (error) {
    console.error('[EXPORT CONTROLLER] CSV export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export CSV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Export reports to Excel with detailed data
const exportToExcel = async (req, res) => {
  try {
    const { startDate, endDate, status, includeDetails } = req.query;
    console.log('[EXPORT CONTROLLER] Exporting to Excel');

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Fetch reports
    const reports = await Report.find(query)
      .populate('uploadedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Lab Digitization System';
    workbook.created = new Date();

    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary');

    summarySheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Lab Name', key: 'labName', width: 20 },
      { header: 'Upload Date', key: 'uploadDate', width: 12 },
      { header: 'Uploaded By', key: 'uploadedBy', width: 20 },
      { header: 'Approved By', key: 'approvedBy', width: 20 },
      { header: 'Total Parameters', key: 'totalParams', width: 15 },
      { header: 'Abnormal Count', key: 'abnormalCount', width: 15 },
      { header: 'Critical Count', key: 'criticalCount', width: 15 },
      { header: 'Flag Status', key: 'flagStatus', width: 12 }
    ];

    // Add data rows
    reports.forEach(report => {
      summarySheet.addRow({
        orderId: report.orderId,
        status: report.status,
        labName: report.extractedData?.labName || 'N/A',
        uploadDate: report.createdAt,
        uploadedBy: report.uploadedBy?.name || 'N/A',
        approvedBy: report.approvedBy?.name || 'N/A',
        totalParams: report.extractedData?.results?.length || 0,
        abnormalCount: report.flags?.abnormalCount || 0,
        criticalCount: report.flags?.criticalCount || 0,
        flagStatus: report.flags?.requiresAttention ? 'Flagged' : 'Normal'
      });
    });

    // Apply styles to header
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add detailed sheets if requested
    if (includeDetails === 'true') {
      const detailsSheet = workbook.addWorksheet('Detailed Results');

      detailsSheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 15 },
        { header: 'Parameter', key: 'parameter', width: 25 },
        { header: 'Value', key: 'value', width: 10 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Reference Range', key: 'reference', width: 20 },
        { header: 'Method', key: 'method', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Deviation', key: 'deviation', width: 12 }
      ];

      // Add all test results
      reports.forEach(report => {
        if (report.extractedData?.results) {
          report.extractedData.results.forEach(result => {
            const abnormalCheck = result.abnormalityCheck || {};

            detailsSheet.addRow({
              orderId: report.orderId,
              parameter: result.serviceItemName,
              value: result.value,
              unit: result.unit,
              reference: result.referenceRange?.referenceRange || '',
              method: result.method || '',
              status: abnormalCheck.isAbnormal ? abnormalCheck.severity : 'Normal',
              deviation: abnormalCheck.percentDeviation ? `${abnormalCheck.percentDeviation}%` : ''
            });
          });
        }
      });

      // Apply conditional formatting for abnormal values
      detailsSheet.getColumn('status').eachCell((cell, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        if (cell.value === 'critical') {
          cell.font = { color: { argb: 'FFFF0000' }, bold: true };
        } else if (cell.value === 'moderate') {
          cell.font = { color: { argb: 'FFFF8C00' } };
        } else if (cell.value === 'mild') {
          cell.font = { color: { argb: 'FFFFA500' } };
        }
      });

      detailsSheet.getRow(1).font = { bold: true };
      detailsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    console.log('[EXPORT CONTROLLER] Excel generated for', reports.length, 'reports');

    // Send Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=lab-reports-${Date.now()}.xlsx`);
    res.send(buffer);

  } catch (error) {
    console.error('[EXPORT CONTROLLER] Excel export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export Excel',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Export single report as JSON
const exportReportJSON = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[EXPORT CONTROLLER] Exporting report as JSON:', id);

    const report = await Report.findById(id)
      .populate('uploadedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('editHistory.editedBy', 'name email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Use finalData if available, otherwise use extractedData
    const exportData = report.finalData || {
      meta: {
        USER_CODE: report.orderId,
        lab_name: report.extractedData?.labName || '',
        date_of_test: report.createdAt.toISOString().split('T')[0]
      },
      results: report.extractedData?.results || []
    };

    // Add audit information
    exportData.audit = {
      uploadedBy: report.uploadedBy?.name || 'Unknown',
      uploadedAt: report.createdAt,
      status: report.status,
      approvedBy: report.approvedBy?.name || null,
      approvedAt: report.approvedAt,
      editCount: report.editHistory?.length || 0,
      flags: report.flags
    };

    console.log('[EXPORT CONTROLLER] JSON export prepared');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${report.orderId}.json`);
    res.json(exportData);

  } catch (error) {
    console.error('[EXPORT CONTROLLER] JSON export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export JSON',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Generate summary report
const generateSummaryReport = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    console.log('[EXPORT CONTROLLER] Generating summary report for', period, 'days');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Aggregate data
    const [
      totalReports,
      statusBreakdown,
      labBreakdown,
      flagStats,
      topAbnormalParameters
    ] = await Promise.all([
      // Total reports
      Report.countDocuments({ createdAt: { $gte: startDate } }),

      // Status breakdown
      Report.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      // Lab breakdown
      Report.aggregate([
        { $match: { createdAt: { $gte: startDate }, 'extractedData.labName': { $exists: true } } },
        { $group: { _id: '$extractedData.labName', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Flag statistics
      Report.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalFlagged: { $sum: { $cond: ['$flags.requiresAttention', 1, 0] } },
            totalCritical: { $sum: { $cond: ['$flags.requiresUrgentAttention', 1, 0] } },
            avgAbnormal: { $avg: '$flags.abnormalCount' }
          }
        }
      ]),

      // Top abnormal parameters
      Report.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $unwind: '$flags.abnormalParameters' },
        { $group: { _id: '$flags.abnormalParameters.parameter', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const summary = {
      period: {
        days: period,
        startDate: startDate,
        endDate: new Date()
      },
      overview: {
        totalReports,
        averagePerDay: Math.round(totalReports / parseInt(period))
      },
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      labBreakdown: labBreakdown.map(lab => ({
        name: lab._id,
        count: lab.count,
        percentage: Math.round(lab.count / totalReports * 100)
      })),
      flagStatistics: flagStats[0] || {
        totalFlagged: 0,
        totalCritical: 0,
        avgAbnormal: 0
      },
      topAbnormalParameters: topAbnormalParameters.map(param => ({
        parameter: param._id,
        occurrences: param.count
      }))
    };

    console.log('[EXPORT CONTROLLER] Summary report generated');

    res.json({
      success: true,
      message: 'Summary report generated successfully',
      data: summary
    });

  } catch (error) {
    console.error('[EXPORT CONTROLLER] Summary report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate summary report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  exportToCSV,
  exportToExcel,
  exportReportJSON,
  generateSummaryReport
};