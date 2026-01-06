/**
 * Audit Controller
 * API endpoints for accessing audit logs (admin only)
 */

const audit = require('../utils/auditLogger');
const fs = require('fs');
const path = require('path');

/**
 * Get all stored report logs (with rotation, max 6)
 */
const getReportLogs = async (req, res) => {
  try {
    const logs = audit.getReportLogs();

    res.json({
      success: true,
      message: `Retrieved ${logs.length} report logs (max ${audit.MAX_REPORT_LOGS} stored)`,
      data: {
        logs,
        count: logs.length,
        maxStored: audit.MAX_REPORT_LOGS
      }
    });
  } catch (error) {
    console.error('[AUDIT CONTROLLER] Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message
    });
  }
};

/**
 * Get detailed log for a specific request
 */
const getLogByRequestId = async (req, res) => {
  try {
    const { requestId } = req.params;
    const log = audit.getLogByRequestId(requestId);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: `No log found for request ID: ${requestId}`
      });
    }

    res.json({
      success: true,
      message: 'Log found',
      data: log
    });
  } catch (error) {
    console.error('[AUDIT CONTROLLER] Error fetching log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch log',
      error: error.message
    });
  }
};

/**
 * Get currently active sessions
 */
const getActiveSessions = async (req, res) => {
  try {
    const sessions = audit.getActiveSessions();

    res.json({
      success: true,
      message: `${sessions.length} active session(s)`,
      data: sessions
    });
  } catch (error) {
    console.error('[AUDIT CONTROLLER] Error fetching active sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active sessions',
      error: error.message
    });
  }
};

/**
 * Clear all logs (for testing)
 */
const clearLogs = async (req, res) => {
  try {
    audit.clearLogs();

    res.json({
      success: true,
      message: 'All audit logs cleared'
    });
  } catch (error) {
    console.error('[AUDIT CONTROLLER] Error clearing logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear logs',
      error: error.message
    });
  }
};

// ==========================================
// FILE-BASED LOG ENDPOINTS (Admin only)
// ==========================================

/**
 * Get log file content for a specific report as JSON array
 * GET /api/audit/logs/:reportId
 */
const getLogFileByReportId = async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!audit.logFileExists(reportId)) {
      return res.status(404).json({
        success: false,
        message: `No log file found for report ID: ${reportId}`,
        hint: 'Log files are created when processing starts. Check if the report was processed.'
      });
    }

    const logs = audit.readLogFile(reportId);

    res.json({
      success: true,
      message: `Log file found for report: ${reportId}`,
      data: {
        reportId,
        logFilePath: audit.getLogFilePath(reportId),
        entries: logs,
        count: logs.length
      }
    });
  } catch (error) {
    console.error('[AUDIT CONTROLLER] Error reading log file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to read log file',
      error: error.message
    });
  }
};

/**
 * Download raw log file for a specific report
 * GET /api/audit/logs/:reportId/download
 */
const downloadLogFile = async (req, res) => {
  try {
    const { reportId } = req.params;
    const logFilePath = audit.getLogFilePath(reportId);

    if (!audit.logFileExists(reportId)) {
      return res.status(404).json({
        success: false,
        message: `No log file found for report ID: ${reportId}`
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${reportId}.log"`);

    // Stream the file
    const fileStream = fs.createReadStream(logFilePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[AUDIT CONTROLLER] Error downloading log file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download log file',
      error: error.message
    });
  }
};

/**
 * Get today's error summary log
 * GET /api/audit/errors/today
 */
const getTodayErrorLog = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const errorLogPath = path.join(audit.ERROR_LOG_DIR, `errors-${today}.log`);

    if (!fs.existsSync(errorLogPath)) {
      return res.json({
        success: true,
        message: `No errors logged today (${today})`,
        data: {
          date: today,
          entries: [],
          count: 0
        }
      });
    }

    const content = fs.readFileSync(errorLogPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line);
    const entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });

    res.json({
      success: true,
      message: `Error log for ${today}`,
      data: {
        date: today,
        entries,
        count: entries.length,
        errorTypes: [...new Set(entries.map(e => e.category).filter(Boolean))]
      }
    });
  } catch (error) {
    console.error('[AUDIT CONTROLLER] Error reading today\'s error log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to read error log',
      error: error.message
    });
  }
};

/**
 * Get error log for a specific date
 * GET /api/audit/errors/:date
 */
const getErrorLogByDate = async (req, res) => {
  try {
    const { date } = req.params;

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const errorLogPath = path.join(audit.ERROR_LOG_DIR, `errors-${date}.log`);

    if (!fs.existsSync(errorLogPath)) {
      return res.json({
        success: true,
        message: `No errors logged on ${date}`,
        data: {
          date,
          entries: [],
          count: 0
        }
      });
    }

    const content = fs.readFileSync(errorLogPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line);
    const entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });

    res.json({
      success: true,
      message: `Error log for ${date}`,
      data: {
        date,
        entries,
        count: entries.length,
        errorTypes: [...new Set(entries.map(e => e.category).filter(Boolean))]
      }
    });
  } catch (error) {
    console.error('[AUDIT CONTROLLER] Error reading error log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to read error log',
      error: error.message
    });
  }
};

/**
 * Trigger log cleanup (delete logs older than retention period)
 * POST /api/audit/logs/cleanup
 */
const triggerLogCleanup = async (req, res) => {
  try {
    const deletedCount = audit.cleanupOldLogs();

    res.json({
      success: true,
      message: `Log cleanup completed`,
      data: {
        deletedFiles: deletedCount
      }
    });
  } catch (error) {
    console.error('[AUDIT CONTROLLER] Error during log cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup logs',
      error: error.message
    });
  }
};

module.exports = {
  getReportLogs,
  getLogByRequestId,
  getActiveSessions,
  clearLogs,
  // File-based log endpoints
  getLogFileByReportId,
  downloadLogFile,
  getTodayErrorLog,
  getErrorLogByDate,
  triggerLogCleanup
};
