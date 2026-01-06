/**
 * Audit Logger - Extensive logging utility for Lab Digitization System
 *
 * Features:
 * - Per-upload log files for persistent debugging
 * - Daily error summary files
 * - Log rotation: Keeps last 6 reports in memory
 * - Request ID tracking for full trace correlation
 * - Timing breakdown for each processing step
 * - Memory usage monitoring
 * - Rate limit detection
 * - Comprehensive error categorization
 */

const fs = require('fs');
const path = require('path');

// Configuration
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');
const PROCESSING_LOG_DIR = path.join(LOG_DIR, 'processing');
const ERROR_LOG_DIR = path.join(LOG_DIR, 'errors');
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS) || 30;

// In-memory log storage with rotation (max 6 reports)
const MAX_REPORT_LOGS = 6;
const reportLogs = [];

// Track file streams per report
const activeFileStreams = new Map();

/**
 * Ensure log directories exist
 */
function ensureLogDirectories() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    if (!fs.existsSync(PROCESSING_LOG_DIR)) {
      fs.mkdirSync(PROCESSING_LOG_DIR, { recursive: true });
    }
    if (!fs.existsSync(ERROR_LOG_DIR)) {
      fs.mkdirSync(ERROR_LOG_DIR, { recursive: true });
    }
    return true;
  } catch (error) {
    console.error('[AUDIT] Failed to create log directories:', error.message);
    return false;
  }
}

/**
 * Write a log entry to file (JSON Lines format)
 */
function writeToFile(reportId, logEntry) {
  try {
    ensureLogDirectories();
    const logFilePath = path.join(PROCESSING_LOG_DIR, `${reportId}.log`);
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(logFilePath, logLine, 'utf8');
  } catch (error) {
    console.error('[AUDIT] Failed to write to log file:', error.message);
  }
}

/**
 * Write error to daily error summary file
 */
function writeToErrorLog(logEntry) {
  try {
    ensureLogDirectories();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const errorLogPath = path.join(ERROR_LOG_DIR, `errors-${today}.log`);
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(errorLogPath, logLine, 'utf8');
  } catch (error) {
    console.error('[AUDIT] Failed to write to error log file:', error.message);
  }
}

/**
 * Get log file path for a report
 */
function getLogFilePath(reportId) {
  return path.join(PROCESSING_LOG_DIR, `${reportId}.log`);
}

/**
 * Read log file for a report
 */
function readLogFile(reportId) {
  try {
    const logFilePath = getLogFilePath(reportId);
    if (!fs.existsSync(logFilePath)) {
      return null;
    }
    const content = fs.readFileSync(logFilePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line);
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  } catch (error) {
    console.error('[AUDIT] Failed to read log file:', error.message);
    return null;
  }
}

/**
 * Check if log file exists for a report
 */
function logFileExists(reportId) {
  const logFilePath = getLogFilePath(reportId);
  return fs.existsSync(logFilePath);
}

/**
 * Clean up old log files (older than LOG_RETENTION_DAYS)
 */
function cleanupOldLogs() {
  try {
    ensureLogDirectories();
    const now = Date.now();
    const maxAge = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    // Clean processing logs
    const processingFiles = fs.readdirSync(PROCESSING_LOG_DIR);
    for (const file of processingFiles) {
      const filePath = path.join(PROCESSING_LOG_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    // Clean error logs
    const errorFiles = fs.readdirSync(ERROR_LOG_DIR);
    for (const file of errorFiles) {
      const filePath = path.join(ERROR_LOG_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[AUDIT] Cleaned up ${deletedCount} old log files (older than ${LOG_RETENTION_DAYS} days)`);
    }
    return deletedCount;
  } catch (error) {
    console.error('[AUDIT] Failed to cleanup old logs:', error.message);
    return 0;
  }
}

// Current active request context
let activeRequests = new Map();

/**
 * Generate unique request ID
 */
function generateRequestId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REQ-${timestamp}-${random}`;
}

/**
 * Get current memory usage in MB
 */
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
    rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100
  };
}

/**
 * Format memory for logging
 */
function formatMemory() {
  const mem = getMemoryUsage();
  return `Heap: ${mem.heapUsed}/${mem.heapTotal}MB | RSS: ${mem.rss}MB`;
}

/**
 * Create a new audit session for a report
 */
function startAuditSession(reportId, orderId = null, additionalData = {}) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const session = {
    requestId,
    reportId,
    orderId,
    startTime,
    startMemory: getMemoryUsage(),
    steps: [],
    errors: [],
    warnings: [],
    pageMetrics: [],
    apiCalls: [],
    summary: null
  };

  activeRequests.set(requestId, session);

  // Console log
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`[${requestId}] 🚀 AUDIT SESSION STARTED`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`[${requestId}] Report ID: ${reportId}`);
  console.log(`[${requestId}] Order ID: ${orderId || 'Not provided'}`);
  console.log(`[${requestId}] Started: ${new Date().toISOString()}`);
  console.log(`[${requestId}] Memory: ${formatMemory()}`);
  console.log(`${'─'.repeat(80)}`);

  // Write to file
  writeToFile(reportId, {
    ts: new Date(startTime).toISOString(),
    level: 'INFO',
    step: 'SESSION_START',
    reportId,
    requestId,
    orderId,
    data: {
      memory: getMemoryUsage(),
      ...additionalData
    }
  });

  return requestId;
}

/**
 * Log a processing step with timing
 */
function logStep(requestId, stepName, details = {}) {
  const session = activeRequests.get(requestId);
  if (!session) {
    console.warn(`[AUDIT] No session found for ${requestId}`);
    return;
  }

  const now = Date.now();
  const elapsed = ((now - session.startTime) / 1000).toFixed(2);

  const step = {
    name: stepName,
    timestamp: now,
    elapsed: parseFloat(elapsed),
    memory: getMemoryUsage(),
    ...details
  };

  session.steps.push(step);

  const icon = details.status === 'error' ? '❌' :
               details.status === 'warning' ? '⚠️' :
               details.status === 'success' ? '✅' : '📍';

  // Console log
  console.log(`[${requestId}] ${icon} [${elapsed}s] ${stepName}`);

  if (details.duration) {
    console.log(`[${requestId}]    Duration: ${details.duration.toFixed(2)}s`);
  }
  if (details.count !== undefined) {
    console.log(`[${requestId}]    Count: ${details.count}`);
  }
  if (details.size !== undefined) {
    console.log(`[${requestId}]    Size: ${details.size}`);
  }
  if (details.message) {
    console.log(`[${requestId}]    ${details.message}`);
  }

  // Write to file
  const level = details.status === 'error' ? 'ERROR' :
                details.status === 'warning' ? 'WARN' : 'INFO';
  writeToFile(session.reportId, {
    ts: new Date(now).toISOString(),
    level,
    step: stepName,
    reportId: session.reportId,
    requestId,
    elapsed: parseFloat(elapsed),
    data: details
  });
}

/**
 * Store PDF conversion timing data
 */
function storePdfTimings(requestId, pdfTimings) {
  const session = activeRequests.get(requestId);
  if (!session) {
    console.warn(`[AUDIT] No session found for ${requestId} to store PDF timings`);
    return;
  }

  session.pdfTimings = pdfTimings;
  console.log(`[${requestId}] 📊 PDF timings stored: ${pdfTimings.perPage?.length || 0} pages, ${(pdfTimings.totalTime / 1000).toFixed(2)}s total`);
}

/**
 * Log page-wise processing metrics
 */
function logPageMetric(requestId, pageNumber, metrics) {
  const session = activeRequests.get(requestId);
  if (!session) return;

  const now = Date.now();
  const pageMetric = {
    pageNumber,
    timestamp: now,
    ...metrics
  };

  session.pageMetrics.push(pageMetric);

  const status = metrics.error ? '❌' : metrics.parametersExtracted > 0 ? '✅' : '⚠️';
  const timing = metrics.duration ? `${metrics.duration.toFixed(2)}s` : 'N/A';
  const params = metrics.parametersExtracted !== undefined ? metrics.parametersExtracted : 'N/A';

  // Console log
  console.log(`[${requestId}] [PAGE ${pageNumber}] ${status} ${timing} | Params: ${params} | Tokens: ${metrics.tokens || 'N/A'}`);

  if (metrics.error) {
    console.log(`[${requestId}] [PAGE ${pageNumber}] Error: ${metrics.error}`);
    session.errors.push({
      type: 'PAGE_ERROR',
      page: pageNumber,
      error: metrics.error,
      timestamp: now
    });
  }

  // Write to file
  const level = metrics.error ? 'ERROR' : 'INFO';
  const logEntry = {
    ts: new Date(now).toISOString(),
    level,
    step: `LLM_PAGE_${pageNumber}`,
    reportId: session.reportId,
    requestId,
    data: {
      pageNumber,
      duration: metrics.duration,
      parametersExtracted: metrics.parametersExtracted,
      tokens: metrics.tokens,
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
      cost: metrics.cost
    }
  };

  if (metrics.error) {
    logEntry.category = 'PAGE_ERROR';
    logEntry.error = {
      message: metrics.error,
      pageNumber,
      context: metrics.context || {}
    };
    // Also write to daily error log
    writeToErrorLog(logEntry);
  }

  writeToFile(session.reportId, logEntry);
}

/**
 * Log API call metrics
 */
function logApiCall(requestId, apiName, metrics) {
  const session = activeRequests.get(requestId);
  if (!session) return;

  const now = Date.now();
  const apiCall = {
    name: apiName,
    timestamp: now,
    ...metrics
  };

  session.apiCalls.push(apiCall);

  // Check for rate limit errors
  let errorCategory = 'API_ERROR';
  if (metrics.error) {
    const isRateLimit =
      metrics.error.includes('429') ||
      metrics.error.includes('Too Many Requests') ||
      metrics.error.includes('RESOURCE_EXHAUSTED') ||
      metrics.error.includes('quota');

    if (isRateLimit) {
      errorCategory = 'RATE_LIMIT';
      console.log(`[${requestId}] 🚨 RATE LIMIT DETECTED: ${apiName}`);
      session.errors.push({
        type: 'RATE_LIMIT',
        api: apiName,
        error: metrics.error,
        timestamp: now
      });
    }
  }

  // Console log
  const status = metrics.error ? '❌' : '✅';
  console.log(`[${requestId}] [API] ${status} ${apiName} - ${metrics.duration?.toFixed(2) || 'N/A'}s`);

  if (metrics.tokens) {
    console.log(`[${requestId}] [API]    Tokens: ${metrics.tokens.input} in / ${metrics.tokens.output} out`);
  }
  if (metrics.cost) {
    console.log(`[${requestId}] [API]    Cost: $${metrics.cost.toFixed(6)}`);
  }

  // Write to file
  const level = metrics.error ? 'ERROR' : 'INFO';
  const logEntry = {
    ts: new Date(now).toISOString(),
    level,
    step: `API_${apiName.replace(/\s+/g, '_').toUpperCase()}`,
    reportId: session.reportId,
    requestId,
    data: {
      apiName,
      duration: metrics.duration,
      tokens: metrics.tokens,
      cost: metrics.cost
    }
  };

  if (metrics.error) {
    logEntry.category = errorCategory;
    logEntry.error = {
      message: metrics.error,
      code: metrics.errorCode,
      retryable: errorCategory === 'RATE_LIMIT',
      context: {
        apiName,
        ...metrics.context
      }
    };
    // Also write to daily error log
    writeToErrorLog(logEntry);
  }

  writeToFile(session.reportId, logEntry);
}

/**
 * Log a warning
 */
function logWarning(requestId, message, details = {}) {
  const session = activeRequests.get(requestId);
  if (!session) {
    console.warn(`[AUDIT] Warning (no session): ${message}`);
    return;
  }

  const now = Date.now();
  session.warnings.push({
    message,
    details,
    timestamp: now
  });

  // Console log
  console.log(`[${requestId}] ⚠️ WARNING: ${message}`);
  if (Object.keys(details).length > 0) {
    console.log(`[${requestId}]    Details: ${JSON.stringify(details)}`);
  }

  // Write to file
  writeToFile(session.reportId, {
    ts: new Date(now).toISOString(),
    level: 'WARN',
    step: details.step || 'WARNING',
    reportId: session.reportId,
    requestId,
    message,
    data: details
  });
}

/**
 * Log an error with comprehensive context
 */
function logError(requestId, errorType, error, details = {}) {
  const session = activeRequests.get(requestId);
  const now = Date.now();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : null;

  if (!session) {
    console.error(`[AUDIT] Error (no session): ${errorType} - ${errorMessage}`);
    // Still write to daily error log even without session
    writeToErrorLog({
      ts: new Date(now).toISOString(),
      level: 'ERROR',
      category: errorType,
      error: {
        message: errorMessage,
        stack: errorStack,
        context: details
      }
    });
    return;
  }

  const errorEntry = {
    type: errorType,
    message: errorMessage,
    stack: errorStack,
    details,
    timestamp: now
  };

  session.errors.push(errorEntry);

  // Console log
  console.log(`[${requestId}] ❌ ERROR [${errorType}]: ${errorMessage}`);
  if (details.context) {
    console.log(`[${requestId}]    Context: ${details.context}`);
  }
  if (details.pageNumber) {
    console.log(`[${requestId}]    Page: ${details.pageNumber}`);
  }

  // Build comprehensive error log entry
  const logEntry = {
    ts: new Date(now).toISOString(),
    level: 'ERROR',
    step: details.step || errorType,
    reportId: session.reportId,
    requestId,
    category: errorType,
    error: {
      message: errorMessage,
      stack: errorStack,
      code: details.code || details.errorCode,
      retryable: details.retryable || false,
      retryCount: details.retryCount,
      context: {
        pageNumber: details.pageNumber,
        apiName: details.apiName,
        model: details.model,
        operation: details.operation,
        filePath: details.filePath,
        ...details.context
      }
    }
  };

  // Write to report log file
  writeToFile(session.reportId, logEntry);

  // Write to daily error summary
  writeToErrorLog(logEntry);
}

/**
 * End audit session and generate summary
 */
function endAuditSession(requestId, finalStatus = 'completed') {
  const session = activeRequests.get(requestId);
  if (!session) {
    console.warn(`[AUDIT] No session to end for ${requestId}`);
    return null;
  }

  const endTime = Date.now();
  const totalDuration = (endTime - session.startTime) / 1000;
  const endMemory = getMemoryUsage();

  // Calculate step breakdown
  const stepBreakdown = session.steps.map((step, idx) => {
    const nextStep = session.steps[idx + 1];
    const stepDuration = step.duration ||
      (nextStep ? (nextStep.timestamp - step.timestamp) / 1000 : 0);
    return {
      step: step.name,
      duration: stepDuration,
      percentage: ((stepDuration / totalDuration) * 100).toFixed(1) + '%'
    };
  });

  // Calculate page statistics
  const pageStats = {
    total: session.pageMetrics.length,
    successful: session.pageMetrics.filter(p => !p.error).length,
    failed: session.pageMetrics.filter(p => p.error).length,
    avgDuration: session.pageMetrics.length > 0
      ? session.pageMetrics.reduce((sum, p) => sum + (p.duration || 0), 0) / session.pageMetrics.length
      : 0,
    totalParams: session.pageMetrics.reduce((sum, p) => sum + (p.parametersExtracted || 0), 0)
  };

  // Calculate API statistics
  const apiStats = {
    total: session.apiCalls.length,
    successful: session.apiCalls.filter(a => !a.error).length,
    failed: session.apiCalls.filter(a => a.error).length,
    totalTokens: session.apiCalls.reduce((sum, a) => sum + (a.tokens?.total || 0), 0),
    totalCost: session.apiCalls.reduce((sum, a) => sum + (a.cost || 0), 0)
  };

  // Generate summary
  session.summary = {
    requestId,
    reportId: session.reportId,
    orderId: session.orderId,
    status: finalStatus,
    duration: totalDuration,
    startTime: new Date(session.startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    memoryDelta: {
      heapUsed: endMemory.heapUsed - session.startMemory.heapUsed,
      rss: endMemory.rss - session.startMemory.rss
    },
    steps: stepBreakdown,
    pages: pageStats,
    api: apiStats,
    errors: session.errors,
    warnings: session.warnings
  };

  // Print final summary
  console.log(`\n[${requestId}] ${'═'.repeat(70)}`);
  console.log(`[${requestId}] ║              AUDIT SESSION COMPLETE                              ║`);
  console.log(`[${requestId}] ${'═'.repeat(70)}`);
  console.log(`[${requestId}] Status: ${finalStatus.toUpperCase()}`);
  console.log(`[${requestId}] Duration: ${totalDuration.toFixed(2)}s`);
  console.log(`[${requestId}] ${'─'.repeat(70)}`);
  console.log(`[${requestId}] STEP BREAKDOWN:`);
  stepBreakdown.forEach((step, idx) => {
    console.log(`[${requestId}]   ${idx + 1}. ${step.step}: ${step.duration.toFixed(2)}s (${step.percentage})`);
  });
  console.log(`[${requestId}] ${'─'.repeat(70)}`);
  console.log(`[${requestId}] PAGE STATISTICS:`);
  console.log(`[${requestId}]   Total: ${pageStats.total} | Success: ${pageStats.successful} | Failed: ${pageStats.failed}`);
  console.log(`[${requestId}]   Avg Duration: ${pageStats.avgDuration.toFixed(2)}s | Total Params: ${pageStats.totalParams}`);
  console.log(`[${requestId}] ${'─'.repeat(70)}`);
  console.log(`[${requestId}] API STATISTICS:`);
  console.log(`[${requestId}]   Calls: ${apiStats.total} | Success: ${apiStats.successful} | Failed: ${apiStats.failed}`);
  console.log(`[${requestId}]   Tokens: ${apiStats.totalTokens} | Cost: $${apiStats.totalCost.toFixed(6)}`);
  console.log(`[${requestId}] ${'─'.repeat(70)}`);
  console.log(`[${requestId}] ERRORS: ${session.errors.length} | WARNINGS: ${session.warnings.length}`);

  if (session.errors.length > 0) {
    console.log(`[${requestId}] Error Types: ${[...new Set(session.errors.map(e => e.type))].join(', ')}`);
  }

  console.log(`[${requestId}] Memory Delta: Heap ${session.summary.memoryDelta.heapUsed.toFixed(2)}MB | RSS ${session.summary.memoryDelta.rss.toFixed(2)}MB`);
  console.log(`[${requestId}] ${'═'.repeat(70)}\n`);

  // Write session complete to file
  writeToFile(session.reportId, {
    ts: new Date(endTime).toISOString(),
    level: finalStatus === 'error' ? 'ERROR' : 'INFO',
    step: 'SESSION_COMPLETE',
    reportId: session.reportId,
    requestId,
    status: finalStatus,
    summary: {
      duration: totalDuration,
      pages: pageStats,
      api: apiStats,
      errors: session.errors.length,
      warnings: session.warnings.length,
      errorTypes: [...new Set(session.errors.map(e => e.type))],
      memoryDelta: session.summary.memoryDelta
    }
  });

  // Add to report logs with rotation
  reportLogs.unshift({
    ...session,
    endTime,
    totalDuration
  });

  // Rotate logs - keep only last MAX_REPORT_LOGS
  while (reportLogs.length > MAX_REPORT_LOGS) {
    const removed = reportLogs.pop();
    console.log(`[AUDIT] Log rotation: Removed session ${removed.requestId} (${reportLogs.length} logs kept)`);
  }

  // Clean up active request
  activeRequests.delete(requestId);

  return session.summary;
}

/**
 * Get all stored report logs
 */
function getReportLogs() {
  return reportLogs.map(log => ({
    requestId: log.requestId,
    reportId: log.reportId,
    orderId: log.orderId,
    status: log.summary?.status,
    duration: log.summary?.duration,
    startTime: new Date(log.startTime).toISOString(),
    pages: log.summary?.pages,
    errors: log.errors.length,
    warnings: log.warnings.length
  }));
}

/**
 * Get detailed log for a specific request
 */
function getLogByRequestId(requestId) {
  return reportLogs.find(log => log.requestId === requestId);
}

/**
 * Get active sessions
 */
function getActiveSessions() {
  return Array.from(activeRequests.entries()).map(([id, session]) => ({
    requestId: id,
    reportId: session.reportId,
    duration: ((Date.now() - session.startTime) / 1000).toFixed(2) + 's',
    steps: session.steps.length,
    errors: session.errors.length
  }));
}

/**
 * Clear all logs (for testing)
 */
function clearLogs() {
  reportLogs.length = 0;
  activeRequests.clear();
  console.log('[AUDIT] All logs cleared');
}

module.exports = {
  // Session management
  generateRequestId,
  startAuditSession,
  endAuditSession,
  getActiveSessions,

  // Logging functions
  logStep,
  storePdfTimings,
  logPageMetric,
  logApiCall,
  logWarning,
  logError,

  // In-memory log retrieval
  getReportLogs,
  getLogByRequestId,
  clearLogs,
  MAX_REPORT_LOGS,

  // File-based log utilities
  readLogFile,
  getLogFilePath,
  logFileExists,
  cleanupOldLogs,
  ensureLogDirectories,

  // Log directory paths
  LOG_DIR,
  PROCESSING_LOG_DIR,
  ERROR_LOG_DIR,

  // Utility functions
  getMemoryUsage,
  formatMemory
};
