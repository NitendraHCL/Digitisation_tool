const Report = require('../models/Report');
const path = require('path');
const fs = require('fs');

// Upload PDF controller
const uploadPDF = async (req, res) => {
  try {
    console.log('[REPORT CONTROLLER] PDF upload request from:', req.user.email);

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    // Get order ID from request (now optional)
    const { orderId } = req.body;

    console.log('[REPORT CONTROLLER] Processing upload for order:', orderId || 'Not provided');
    console.log('[REPORT CONTROLLER] File details:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      path: req.file.path
    });

    // Check if order ID already exists (only if provided)
    if (orderId) {
      const existingReport = await Report.findOne({ orderId });
      if (existingReport) {
        // Delete uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Report with this Order ID already exists'
        });
      }
    }

    // Create new report record
    const report = new Report({
      orderId,
      uploadedBy: req.user.userId,
      pdfPath: req.file.path,
      originalFileName: req.file.originalname,
      fileSize: req.file.size,
      status: 'uploaded'
    });

    await report.save();
    console.log('[REPORT CONTROLLER] Report saved successfully:', report._id);

    res.status(201).json({
      success: true,
      message: 'PDF uploaded successfully',
      data: {
        reportId: report._id,
        orderId: report.orderId,
        fileName: report.originalFileName,
        fileSize: report.fileSize,
        status: report.status
      }
    });
  } catch (error) {
    console.error('[REPORT CONTROLLER] Upload error:', error);

    // Clean up uploaded file if error occurred
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('[REPORT CONTROLLER] Cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Upload multiple PDFs controller
const uploadMultiplePDFs = async (req, res) => {
  try {
    console.log('[REPORT CONTROLLER] Multiple PDF upload request from:', req.user.email);

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No PDF files uploaded'
      });
    }

    console.log('[REPORT CONTROLLER] Number of files uploaded:', req.files.length);

    const uploadedReports = [];
    const errors = [];

    // Process each file
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      try {
        console.log(`[REPORT CONTROLLER] Processing file ${i + 1}/${req.files.length}:`, file.originalname);

        // Create new report record (orderId is optional now)
        // Note: Don't set orderId at all (not even to null) for sparse index to work
        const report = new Report({
          uploadedBy: req.user.userId,
          pdfPath: file.path,
          originalFileName: file.originalname,
          fileSize: file.size,
          status: 'uploaded'
        });

        await report.save();
        console.log('[REPORT CONTROLLER] Report saved successfully:', report._id);

        uploadedReports.push({
          reportId: report._id,
          fileName: report.originalFileName,
          fileSize: report.fileSize,
          status: report.status
        });
      } catch (error) {
        console.error(`[REPORT CONTROLLER] Error processing file ${file.originalname}:`, error);

        // Clean up the uploaded file
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.error('[REPORT CONTROLLER] Cleanup error:', cleanupError);
        }

        errors.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    // Return results
    if (uploadedReports.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to upload any files',
        errors
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${uploadedReports.length} of ${req.files.length} files`,
      data: {
        uploadedReports,
        totalUploaded: uploadedReports.length,
        totalFiles: req.files.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('[REPORT CONTROLLER] Multiple upload error:', error);

    // Clean up all uploaded files if error occurred
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.error('[REPORT CONTROLLER] Cleanup error:', cleanupError);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload PDFs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all reports for the logged-in user
const getReports = async (req, res) => {
  try {
    console.log('[REPORT CONTROLLER] Fetching reports for:', req.user.email);

    // Build query based on user role
    let query = {};
    if (req.user.role === 'nurse') {
      // Nurses can only see their own uploads
      query.uploadedBy = req.user.userId;
    }
    // Admins can see all reports

    const reports = await Report.find(query)
      .populate('uploadedBy', 'name email')
      .populate('approvedBy', 'name email')
      .select('-pdfPath') // Don't send file path to frontend
      .sort('-createdAt');

    console.log('[REPORT CONTROLLER] Found', reports.length, 'reports');

    res.json({
      success: true,
      message: 'Reports fetched successfully',
      data: reports
    });
  } catch (error) {
    console.error('[REPORT CONTROLLER] Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single report by ID
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[REPORT CONTROLLER] Fetching report:', id);

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

    // Check access permission
    if (req.user.role === 'nurse' && report.uploadedBy._id.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    console.log('[REPORT CONTROLLER] Report found:', report.orderId);

    res.json({
      success: true,
      message: 'Report fetched successfully',
      data: report
    });
  } catch (error) {
    console.error('[REPORT CONTROLLER] Get report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Download original PDF
const downloadPDF = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[REPORT CONTROLLER] PDF download request for:', id);

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check access permission
    if (req.user.role === 'nurse' && report.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if file exists
    if (!fs.existsSync(report.pdfPath)) {
      console.error('[REPORT CONTROLLER] PDF file not found:', report.pdfPath);
      return res.status(404).json({
        success: false,
        message: 'PDF file not found on server'
      });
    }

    console.log('[REPORT CONTROLLER] Sending PDF:', report.originalFileName);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.originalFileName}"`);

    // Stream the file
    const fileStream = fs.createReadStream(report.pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[REPORT CONTROLLER] Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update report (for processing time, etc.)
const updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { processingTime } = req.body;

    console.log('[REPORT CONTROLLER] Update request for report:', id);
    console.log('[REPORT CONTROLLER] Processing time:', processingTime);

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check access permission - nurses can only update their own reports
    if (req.user.role === 'nurse' && report.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update processing time if provided
    if (processingTime !== undefined) {
      report.processingTime = processingTime;
      console.log('[REPORT CONTROLLER] Updated processing time to:', processingTime, 'seconds');
    }

    await report.save();

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: report
    });
  } catch (error) {
    console.error('[REPORT CONTROLLER] Update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete report (admin only)
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[REPORT CONTROLLER] Delete request for report:', id, 'by:', req.user.email);

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Delete PDF file if it exists
    if (fs.existsSync(report.pdfPath)) {
      fs.unlinkSync(report.pdfPath);
      console.log('[REPORT CONTROLLER] PDF file deleted');
    }

    // Delete report from database
    await Report.findByIdAndDelete(id);
    console.log('[REPORT CONTROLLER] Report deleted successfully');

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('[REPORT CONTROLLER] Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Cleanup stuck reports in processing state
const cleanupStuckReports = async (req, res) => {
  try {
    const { timeoutMinutes = 10 } = req.query;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const cutoffTime = new Date(Date.now() - timeoutMs);

    console.log('[REPORT CONTROLLER] Cleaning up stuck reports...');
    console.log('[REPORT CONTROLLER] Timeout:', timeoutMinutes, 'minutes');
    console.log('[REPORT CONTROLLER] Cutoff time:', cutoffTime.toISOString());

    // Find reports stuck in processing state
    const stuckReports = await Report.find({
      status: 'processing',
      updatedAt: { $lt: cutoffTime }
    }).populate('uploadedBy', 'name email');

    console.log('[REPORT CONTROLLER] Found', stuckReports.length, 'stuck reports');

    if (stuckReports.length === 0) {
      return res.json({
        success: true,
        message: 'No stuck reports found',
        data: {
          cleaned: 0,
          reports: []
        }
      });
    }

    // Update all stuck reports to error status
    const cleanedReports = [];
    for (const report of stuckReports) {
      const stuckDuration = Math.floor((Date.now() - report.updatedAt.getTime()) / 1000 / 60);
      report.status = 'error';
      report.processingError = `Processing timeout - stuck for ${stuckDuration} minutes (cleaned up automatically)`;
      await report.save();

      cleanedReports.push({
        reportId: report._id,
        orderId: report.orderId,
        uploadedBy: report.uploadedBy?.name,
        stuckSince: report.updatedAt,
        stuckDurationMinutes: stuckDuration
      });

      console.log('[REPORT CONTROLLER] Cleaned report:', report._id, '- stuck for', stuckDuration, 'minutes');
    }

    res.json({
      success: true,
      message: `Cleaned up ${cleanedReports.length} stuck report(s)`,
      data: {
        cleaned: cleanedReports.length,
        reports: cleanedReports
      }
    });
  } catch (error) {
    console.error('[REPORT CONTROLLER] Cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup stuck reports',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  uploadPDF,
  uploadMultiplePDFs,
  getReports,
  getReportById,
  downloadPDF,
  updateReport,
  deleteReport,
  cleanupStuckReports
};