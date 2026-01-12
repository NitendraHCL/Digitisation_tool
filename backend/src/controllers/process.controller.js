const Report = require('../models/Report');
const pdfConverter = require('../services/pdfConverter.service');
const pdfTextExtractor = require('../services/pdfTextExtractor.service');
const gptExtractor = require('../services/gptExtractor.service');
const geminiExtractor = require('../services/geminiExtractor.service');
const gpt4oExtractor = require('../services/gpt4oExtractor.service');
const thresholdChecker = require('../services/thresholdChecker.service');
const parameterValidator = require('../services/parameterValidator.service');
const LabConfig = require('../models/LabConfig');
const pLimit = require('p-limit');
const audit = require('../utils/auditLogger');
const path = require('path');
const { withRetry } = require('../utils/retryHelper');

// Base uploads directory - used for path resolution
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

/**
 * Resolve PDF path - handles both old absolute paths and new relative paths
 * @param {string} storedPath - Path stored in database (could be absolute or relative)
 * @returns {string|null} - Resolved path or null if invalid
 */
const resolvePdfPath = (storedPath) => {
  if (!storedPath) return null;

  // Check if it's already an absolute path (old format)
  if (path.isAbsolute(storedPath)) {
    return path.resolve(storedPath);
  }

  // Relative path (new format) - resolve against uploads directory
  return path.resolve(UPLOADS_DIR, storedPath);
};

/**
 * Internal function to process a single report
 * @param {string} reportId - Report ID to process
 * @param {string} extractionMethod - Extraction method ('text', 'image', 'hybrid', 'pdf') - optional, uses config default if not provided
 * @param {string} model - LLM model to use ('gemini', 'gpt-4o', etc.) - optional, uses config default if not provided
 * @returns {Promise<Object>} Processed report data
 */
async function processReportInternal(reportId, extractionMethod = null, model = null) {
  const overallStartTime = Date.now();

  // Start audit session
  const requestId = audit.startAuditSession(reportId);

  // Fetch defaults from LabConfig if not provided (with retry)
  const configStartTime = Date.now();
  if (!extractionMethod || !model) {
    audit.logStep(requestId, 'FETCH_CONFIG', { status: 'started' });
    const labConfig = await withRetry(
      () => LabConfig.getConfig(),
      {
        maxRetries: 2,
        baseDelayMs: 500,
        operationName: 'LabConfig fetch'
      }
    );
    extractionMethod = extractionMethod || labConfig.systemConfig.defaultExtractionMethod || 'image';
    model = model || labConfig.systemConfig.defaultModel || 'gemini-2.5-flash';
    audit.logStep(requestId, 'FETCH_CONFIG', {
      status: 'success',
      duration: (Date.now() - configStartTime) / 1000,
      message: `Method: ${extractionMethod}, Model: ${model}`
    });
  }

  audit.logStep(requestId, 'PIPELINE_START', {
    message: `Method: ${extractionMethod.toUpperCase()}, Model: ${model.toUpperCase()}`
  });

  console.log('[PROCESS] ========================================');
  console.log('[PROCESS] 🚀 STARTING REPORT PROCESSING PIPELINE');
  console.log('[PROCESS] ========================================');
  console.log('[PROCESS] 1. Report ID:', reportId);
  console.log('[PROCESS] 2. Extraction Method:', extractionMethod.toUpperCase());
  console.log('[PROCESS] 2a. LLM Model:', model.toUpperCase());
  console.log('[PROCESS] 3. Started at:', new Date().toISOString());
  console.log('[PROCESS] 4. Request ID:', requestId);

  // Validate extraction method
  if (!['text', 'image', 'hybrid', 'pdf'].includes(extractionMethod)) {
    audit.logError(requestId, 'VALIDATION_ERROR', 'Invalid extraction method');
    audit.endAuditSession(requestId, 'error');
    throw new Error('Invalid extraction method. Must be "text", "image", "hybrid", or "pdf"');
  }

  // Get report from database (with retry)
  const dbFetchStart = Date.now();
  audit.logStep(requestId, 'DB_FETCH_REPORT', { status: 'started' });
  console.log('[PROCESS] 4. Fetching report from database...');
  const report = await withRetry(
    () => Report.findById(reportId),
    {
      maxRetries: 2,
      baseDelayMs: 500,
      operationName: 'Report DB fetch'
    }
  );
  const dbFetchDuration = (Date.now() - dbFetchStart) / 1000;

  if (!report) {
    audit.logError(requestId, 'DB_ERROR', 'Report not found in database');
    audit.endAuditSession(requestId, 'error');
    console.error('[PROCESS] ERROR: Report not found in database');
    throw new Error('Report not found');
  }

  audit.logStep(requestId, 'DB_FETCH_REPORT', {
    status: 'success',
    duration: dbFetchDuration,
    message: `Order: ${report.orderId}, Status: ${report.status}`
  });

  console.log('[PROCESS] 5. ✓ Report found');

  // Resolve PDF path (handles both old absolute and new relative paths)
  const resolvedPdfPath = resolvePdfPath(report.pdfPath);
  if (!resolvedPdfPath) {
    audit.logError(requestId, 'PATH_ERROR', 'Invalid PDF path stored in database');
    audit.endAuditSession(requestId, 'error');
    console.error('[PROCESS] ERROR: Invalid PDF path:', report.pdfPath);
    throw new Error('Invalid PDF path');
  }

  console.log('[PROCESS] 6. Report details:');
  console.log('[PROCESS]    - Order ID:', report.orderId);
  console.log('[PROCESS]    - PDF Path (stored):', report.pdfPath);
  console.log('[PROCESS]    - PDF Path (resolved):', resolvedPdfPath);
  console.log('[PROCESS]    - Current status:', report.status);
  console.log('[PROCESS]    - Uploaded by:', report.uploadedBy);
  console.log('[PROCESS]    - Uploaded at:', report.createdAt);

  // Check if already processed
  if (report.status !== 'uploaded') {
    audit.logWarning(requestId, `Report already processed: ${report.status}`);
    audit.endAuditSession(requestId, 'skipped');
    console.warn('[PROCESS] WARNING: Report already processed, current status:', report.status);
    throw new Error(`Report is already ${report.status}`);
  }

  // Update status to processing (with retry)
  const statusUpdateStart = Date.now();
  audit.logStep(requestId, 'STATUS_UPDATE', { status: 'started', message: 'Setting to processing' });
  console.log('[PROCESS] 7. Updating status to "processing"...');
  report.status = 'processing';
  report.extractionMethod = extractionMethod;
  await withRetry(
    () => report.save(),
    {
      maxRetries: 2,
      baseDelayMs: 500,
      operationName: 'Report status update'
    }
  );
  audit.logStep(requestId, 'STATUS_UPDATE', {
    status: 'success',
    duration: (Date.now() - statusUpdateStart) / 1000
  });
  console.log('[PROCESS] 8. ✓ Status updated');

  // Initialize processing metadata
  const metadata = {
    method: extractionMethod,
    model: model,
    textExtractionTime: null,
    imageConversionTime: null,
    gptProcessingTime: null,
    totalProcessingTime: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    estimatedCost: null,
    pdfPages: null,
    imagesGenerated: null
  };

  try {
    let extractedData;
    let pdfDuration = 0;

    // ROUTE TO APPROPRIATE EXTRACTION METHOD
    if (extractionMethod === 'text') {
      // Map model names to display names
      const modelDisplayNames = {
        'gpt-4o': 'GPT-4O',
        'gpt-4.1': 'GPT-4.1',
        'gemini': 'GEMINI 2.5 FLASH',
        'gemini-2.5-flash': 'GEMINI 2.5 FLASH',
        'gemini-2.5-flash-lite': 'GEMINI 2.5 FLASH-LITE',
        'gemini-2.0-flash': 'GEMINI 2.0 FLASH'
      };
      const modelName = modelDisplayNames[model] || 'GEMINI 2.5 FLASH';
      console.log('[PROCESS] ========================================');
      console.log('[PROCESS] 📄 METHOD: TEXT-BASED EXTRACTION (' + modelName + ')');
      console.log('[PROCESS] ========================================');

      const pdfStartTime = Date.now();
      const pdfData = await pdfTextExtractor.extractText(resolvedPdfPath);
      pdfDuration = (Date.now() - pdfStartTime) / 1000;
      metadata.textExtractionTime = pdfDuration;
      metadata.pdfPages = Array.isArray(pdfData.pages) ? pdfData.pages.length : pdfData.pages;

      console.log('[PROCESS] 9. ✓ Text extraction completed in', pdfDuration.toFixed(2), 'seconds');
      console.log('[PROCESS]    - Pages:', pdfData.pages);
      console.log('[PROCESS]    - Characters:', pdfData.text.length);

      if (!pdfData || !pdfData.text || pdfData.text.length < 100) {
        throw new Error('Insufficient text extracted from PDF');
      }

      console.log('[PROCESS] 10. Calling', modelName, 'with text...');
      const gptStartTime = Date.now();

      // Route to appropriate model
      if (model === 'gpt-4o' || model === 'gpt-4.1') {
        // GPT models don't support text extraction yet, fall back to Gemini
        console.log('[PROCESS] 10a. Note: GPT text extraction not implemented, using Gemini');
        extractedData = await geminiExtractor.extractFromText(pdfData.text, report.orderId, 'gemini-2.5-flash');
      } else {
        // Pass the specific Gemini model variant
        const geminiModel = model === 'gemini' ? 'gemini-2.5-flash' : model;
        extractedData = await geminiExtractor.extractFromText(pdfData.text, report.orderId, geminiModel);
      }

      metadata.gptProcessingTime = (Date.now() - gptStartTime) / 1000;

      // Capture token usage data
      if (extractedData.tokenUsage) {
        metadata.promptTokens = extractedData.tokenUsage.promptTokens;
        metadata.completionTokens = extractedData.tokenUsage.completionTokens;
        metadata.totalTokens = extractedData.tokenUsage.totalTokens;
        metadata.estimatedCost = extractedData.tokenUsage.estimatedCost;
      }

    } else if (extractionMethod === 'image') {
      // Map model names to display names for vision
      const modelDisplayNames = {
        'gpt-4o': 'GPT-4O VISION',
        'gpt-4.1': 'GPT-4.1 VISION',
        'gemini': 'GEMINI 2.5 FLASH VISION',
        'gemini-2.5-flash': 'GEMINI 2.5 FLASH VISION',
        'gemini-2.5-flash-lite': 'GEMINI 2.5 FLASH-LITE VISION',
        'gemini-2.0-flash': 'GEMINI 2.0 FLASH VISION'
      };
      const modelName = modelDisplayNames[model] || 'GEMINI 2.5 FLASH VISION';

      audit.logStep(requestId, 'IMAGE_EXTRACTION_START', {
        message: `Model: ${modelName}`
      });

      console.log('[PROCESS] ========================================');
      console.log('[PROCESS] 🖼️  METHOD: IMAGE-BASED EXTRACTION (' + modelName + ')');
      console.log('[PROCESS] ========================================');

      // PDF to Image Conversion
      const imgStartTime = Date.now();
      audit.logStep(requestId, 'PDF_TO_IMAGE_START', { status: 'started' });

      const pdfResult = await pdfConverter.convertToImages(resolvedPdfPath, requestId);
      const images = pdfResult.images;
      const pdfTimings = pdfResult.pdfTimings;
      const imgDuration = (Date.now() - imgStartTime) / 1000;
      metadata.imageConversionTime = imgDuration;
      metadata.pdfPages = images.length;
      metadata.imagesGenerated = images.length;

      // Store PDF timings for audit
      if (pdfTimings) {
        audit.storePdfTimings(requestId, pdfTimings);
      }

      audit.logStep(requestId, 'PDF_TO_IMAGE_COMPLETE', {
        status: 'success',
        duration: imgDuration,
        count: images.length,
        size: `${(images.reduce((sum, img) => sum + img.length, 0) / 1024 / 1024).toFixed(2)}MB`
      });

      console.log('[PROCESS] 9. ✓ Image conversion completed in', imgDuration.toFixed(2), 'seconds');
      console.log('[PROCESS]    - Pages converted:', images.length);

      if (!images || images.length === 0) {
        audit.logError(requestId, 'PDF_CONVERSION_ERROR', 'Failed to convert PDF to images');
        throw new Error('Failed to convert PDF to images');
      }

      // LLM Processing
      console.log('[PROCESS] 10. Calling', modelName, 'with images (PAGE-BY-PAGE)...');
      const gptStartTime = Date.now();
      audit.logStep(requestId, 'LLM_EXTRACTION_START', {
        message: `${modelName} - ${images.length} pages - queue-controlled with retry`
      });

      // Route to appropriate model - USING PAGE-WISE EXTRACTION with rate-limit aware retry
      if (model === 'gpt-4o' || model === 'gpt-4.1') {
        const gptModel = model === 'gpt-4.1' ? 'gpt-4.1-2025-04-14' : 'gpt-4o';
        extractedData = await gpt4oExtractor.extractFromImagesPageWise(images, report.orderId, gptModel, requestId);
      } else {
        // Pass the specific Gemini model variant
        const geminiModel = model === 'gemini' ? 'gemini-2.5-flash' : model;
        extractedData = await geminiExtractor.extractFromImagesPageWise(images, report.orderId, geminiModel, requestId);
      }

      metadata.gptProcessingTime = (Date.now() - gptStartTime) / 1000;

      audit.logStep(requestId, 'LLM_EXTRACTION_COMPLETE', {
        status: 'success',
        duration: metadata.gptProcessingTime,
        count: extractedData.results?.length || 0,
        message: `Lab: ${extractedData.labName}, Params: ${extractedData.results?.length || 0}`
      });

      // Capture token usage data
      if (extractedData.tokenUsage) {
        metadata.promptTokens = extractedData.tokenUsage.promptTokens;
        metadata.completionTokens = extractedData.tokenUsage.completionTokens;
        metadata.totalTokens = extractedData.tokenUsage.totalTokens;
        metadata.estimatedCost = extractedData.tokenUsage.estimatedCost;

        audit.logApiCall(requestId, 'GEMINI_PAGEWISE', {
          duration: metadata.gptProcessingTime,
          tokens: {
            input: metadata.promptTokens,
            output: metadata.completionTokens,
            total: metadata.totalTokens
          },
          cost: metadata.estimatedCost
        });
      }

    } else if (extractionMethod === 'hybrid') {
      console.log('[PROCESS] ========================================');
      console.log('[PROCESS] 🔄 METHOD: HYBRID (AUTO-DETECT)');
      console.log('[PROCESS] ========================================');

      // Try text extraction first
      console.log('[PROCESS] 9. Attempting text extraction...');
      const textStartTime = Date.now();
      let textSuccess = false;
      let pdfData;

      try {
        pdfData = await pdfTextExtractor.extractText(resolvedPdfPath);
        const textDuration = (Date.now() - textStartTime) / 1000;
        metadata.textExtractionTime = textDuration;
        metadata.pdfPages = Array.isArray(pdfData.pages) ? pdfData.pages.length : pdfData.pages;

        console.log('[PROCESS] 10. Text extraction completed in', textDuration.toFixed(2), 'seconds');
        console.log('[PROCESS]     - Pages:', pdfData.pages);
        console.log('[PROCESS]     - Characters extracted:', pdfData.text.length);

        // Check if text extraction was successful (enough meaningful text)
        if (pdfData && pdfData.text && pdfData.text.length >= 100) {
          textSuccess = true;
          console.log('[PROCESS] 11. ✓ Text extraction successful - using TEXT method');
          metadata.method = 'text';
        } else {
          console.log('[PROCESS] 11. Text extraction insufficient - falling back to IMAGE method');
        }
      } catch (textError) {
        console.log('[PROCESS] 11. Text extraction failed:', textError.message);
        console.log('[PROCESS]     Falling back to IMAGE method...');
      }

      if (textSuccess) {
        // Use text-based extraction
        const gptStartTime = Date.now();
        extractedData = await gptExtractor.extractFromText(pdfData.text, report.orderId);
        metadata.gptProcessingTime = (Date.now() - gptStartTime) / 1000;

        // Capture token usage data
        if (extractedData.tokenUsage) {
          metadata.promptTokens = extractedData.tokenUsage.promptTokens;
          metadata.completionTokens = extractedData.tokenUsage.completionTokens;
          metadata.totalTokens = extractedData.tokenUsage.totalTokens;
          metadata.estimatedCost = extractedData.tokenUsage.estimatedCost;
        }
      } else {
        // Fall back to image-based extraction
        console.log('[PROCESS] 12. Converting PDF to images...');
        const imgStartTime = Date.now();
        const pdfResult = await pdfConverter.convertToImages(resolvedPdfPath);
        const images = pdfResult.images;
        const imgDuration = (Date.now() - imgStartTime) / 1000;
        metadata.imageConversionTime = imgDuration;
        metadata.imagesGenerated = images.length;
        metadata.pdfPages = images.length;
        metadata.method = 'image';

        console.log('[PROCESS] 13. ✓ Image conversion completed in', imgDuration.toFixed(2), 'seconds');
        console.log('[PROCESS]     - Images generated:', images.length);

        // Map model names to display names for vision (hybrid fallback)
        const modelDisplayNames = {
          'gpt-4o': 'GPT-4O VISION',
          'gpt-4.1': 'GPT-4.1 VISION',
          'gemini': 'GEMINI 2.5 FLASH VISION',
          'gemini-2.5-flash': 'GEMINI 2.5 FLASH VISION',
          'gemini-2.5-flash-lite': 'GEMINI 2.5 FLASH-LITE VISION',
          'gemini-2.0-flash': 'GEMINI 2.0 FLASH VISION'
        };
        const modelName = modelDisplayNames[model] || 'GEMINI 2.5 FLASH VISION';
        console.log('[PROCESS] 14. Calling', modelName, 'with images (PAGE-BY-PAGE)...');
        const gptStartTime = Date.now();

        // Route to appropriate model - USING PAGE-WISE EXTRACTION
        if (model === 'gpt-4o' || model === 'gpt-4.1') {
          const gptModel = model === 'gpt-4.1' ? 'gpt-4.1-2025-04-14' : 'gpt-4o';
          extractedData = await gpt4oExtractor.extractFromImagesPageWise(images, report.orderId, gptModel);
        } else {
          // Pass the specific Gemini model variant
          const geminiModel = model === 'gemini' ? 'gemini-2.5-flash' : model;
          extractedData = await geminiExtractor.extractFromImagesPageWise(images, report.orderId, geminiModel);
        }

        metadata.gptProcessingTime = (Date.now() - gptStartTime) / 1000;

        // Capture token usage data
        if (extractedData.tokenUsage) {
          metadata.promptTokens = extractedData.tokenUsage.promptTokens;
          metadata.completionTokens = extractedData.tokenUsage.completionTokens;
          metadata.totalTokens = extractedData.tokenUsage.totalTokens;
          metadata.estimatedCost = extractedData.tokenUsage.estimatedCost;
        }
      }
    } else if (extractionMethod === 'pdf') {
      console.log('[PROCESS] ========================================');
      console.log('[PROCESS] 📄 METHOD: RAW PDF (DIRECT)');
      console.log('[PROCESS] ========================================');

      const pdfStartTime = Date.now();
      extractedData = await gptExtractor.extractFromPDF(resolvedPdfPath, report.orderId);
      metadata.gptProcessingTime = (Date.now() - pdfStartTime) / 1000;
      metadata.method = 'pdf';

      console.log('[PROCESS] 9. ✓ PDF extraction completed in', metadata.gptProcessingTime.toFixed(2), 'seconds');

      // Capture page count if available
      if (extractedData.pageCount) {
        metadata.pdfPages = extractedData.pageCount;
        console.log('[PROCESS]    - PDF pages:', extractedData.pageCount);
      }

      // Capture token usage data
      if (extractedData.tokenUsage) {
        metadata.promptTokens = extractedData.tokenUsage.promptTokens;
        metadata.completionTokens = extractedData.tokenUsage.completionTokens;
        metadata.totalTokens = extractedData.tokenUsage.totalTokens;
        metadata.estimatedCost = extractedData.tokenUsage.estimatedCost;
      }
    }

    console.log('[PROCESS] ========================================');
    console.log('[PROCESS] ✅ DATA EXTRACTION COMPLETE');
    console.log('[PROCESS] ========================================');
    console.log('[PROCESS]    - Lab name:', extractedData.labName);
    console.log('[PROCESS]    - Parameters extracted:', extractedData.results.length);
    console.log('[PROCESS]    - GPT processing time:', metadata.gptProcessingTime.toFixed(2), 's');

    console.log('[PROCESS] ========================================');
    console.log('[PROCESS] 📊 PHASE: DATA FORMATTING');
    console.log('[PROCESS] ========================================');

    // Format for database storage
    const formattedData = gptExtractor.formatForDatabase(extractedData, report.orderId);
    console.log('[PROCESS] 12. ✓ Data formatted for database storage');

    // DEBUG: Log formatted data structure
    console.log('[PROCESS] 12a. DEBUG - Formatted data structure:');
    console.log('[PROCESS] 12b. - Meta keys:', Object.keys(formattedData.meta || {}));
    console.log('[PROCESS] 12c. - Results count:', formattedData.results ? formattedData.results.length : 0);
    if (formattedData.results && formattedData.results.length > 0) {
      console.log('[PROCESS] 12d. - First result sample:', JSON.stringify(formattedData.results[0], null, 2));
    }

    console.log('[PROCESS] ========================================');
    console.log('[PROCESS] 🎯 PHASE 4: THRESHOLD ANALYSIS');
    console.log('[PROCESS] ========================================');

    const thresholdStartTime = Date.now();

    // Get lab configuration for threshold settings
    const labConfig = await LabConfig.getConfig();
    console.log('[PROCESS] 13. Using threshold configuration:');
    console.log('[PROCESS]    - Critical deviation:', labConfig.thresholdPercentage + '%');
    console.log('[PROCESS]    - Flag threshold:', labConfig.flagThreshold + '%');

    // Calculate flags and check thresholds
    const flags = await thresholdChecker.calculateFlags(extractedData.results, labConfig);

    const thresholdDuration = ((Date.now() - thresholdStartTime) / 1000).toFixed(2);
    console.log('[PROCESS] 14. ✓ Threshold analysis completed in', thresholdDuration, 'seconds');

    // DEBUG: Log flags details
    console.log('[PROCESS] 14a. DEBUG - Flags calculated:');
    console.log('[PROCESS] 14b. - hasAbnormalValues:', flags.hasAbnormalValues);
    console.log('[PROCESS] 14c. - abnormalCount:', flags.abnormalCount);
    console.log('[PROCESS] 14d. - criticalCount:', flags.criticalCount);
    console.log('[PROCESS] 14e. - percentAbnormal:', flags.percentAbnormal);
    console.log('[PROCESS] 14f. - requiresAttention:', flags.requiresAttention);
    console.log('[PROCESS] 14g. - requiresUrgentAttention:', flags.requiresUrgentAttention);

    console.log('[PROCESS] ========================================');
    console.log('[PROCESS] 🎨 PHASE 5: UI INDICATORS GENERATION');
    console.log('[PROCESS] ========================================');

    // Generate UI indicators for nurse display
    const uiIndicators = thresholdChecker.generateUIIndicators(flags);
    console.log('[PROCESS] 15. ✓ UI indicators generated:');
    console.log('[PROCESS]    - Color:', uiIndicators.color);
    console.log('[PROCESS]    - Badge:', uiIndicators.badge);
    console.log('[PROCESS]    - Priority:', uiIndicators.priority);

    console.log('[PROCESS] ========================================');
    console.log('[PROCESS] ✅ PHASE 6: PARAMETER VALIDATION');
    console.log('[PROCESS] ========================================');

    const validationStartTime = Date.now();
    audit.logStep(requestId, 'PARAMETER_VALIDATION_START', { status: 'started' });

    // Validate extracted data against Parameter Master
    const validation = await parameterValidator.validateAgainstMaster(extractedData, requestId);

    const validationDuration = ((Date.now() - validationStartTime) / 1000).toFixed(2);

    audit.logStep(requestId, 'PARAMETER_VALIDATION_COMPLETE', {
      status: 'success',
      duration: parseFloat(validationDuration),
      count: validation.validationFlags.length,
      message: `Total: ${validation.summary.total}, NotFound: ${validation.summary.parameterNotFound}, UnitMismatch: ${validation.summary.unitMismatch}`
    });

    console.log('[PROCESS] 16. ✓ Parameter validation completed in', validationDuration, 'seconds');
    console.log('[PROCESS] 16a. Validation summary:');
    console.log('[PROCESS]    - Total parameters:', validation.summary.total);
    console.log('[PROCESS]    - Not found in master:', validation.summary.parameterNotFound);
    console.log('[PROCESS]    - Unit mismatches:', validation.summary.unitMismatch);
    console.log('[PROCESS]    - Value type mismatches:', validation.summary.valueTypeMismatch);
    console.log('[PROCESS]    - Total validation flags:', validation.validationFlags.length);

    console.log('[PROCESS] ========================================');
    console.log('[PROCESS] 💾 PHASE 7: SAVING TO DATABASE');
    console.log('[PROCESS] ========================================');

    const dbSaveStartTime = Date.now();
    audit.logStep(requestId, 'DB_SAVE_START', { status: 'started' });
    console.log('[PROCESS] 13a. Preparing report data for database save...');

    // Update report with extracted data
    report.extractedData = {
      gptRawResponse: extractedData,
      labName: extractedData.labName,
      patientName: extractedData.patientName,
      patientAge: extractedData.patientAge,
      patientGender: extractedData.patientGender,
      dateOfTest: extractedData.dateOfTest,
      results: extractedData.results,
      extractedAt: new Date(),
      // Store page-wise extraction data if available
      pageWiseData: extractedData.pageWiseData || []
    };

    // Log page-wise data storage
    if (extractedData.pageWiseData && extractedData.pageWiseData.length > 0) {
      console.log('[PROCESS] 13b. ✓ Page-wise extraction data included');
      console.log('[PROCESS] 13c. - Pages with data:', extractedData.pageWiseData.length);
      console.log('[PROCESS] 13d. - Total parameters across pages:', extractedData.results.length);
    }

    // Set final data in Example.json format (will be complete after approval)
    report.finalData = formattedData;

    // Store flags and indicators
    report.flags = flags;
    report.uiIndicators = uiIndicators;

    // Store validation flags from Parameter Master validation
    report.validationFlags = validation.validationFlags || [];

    // Store processing metadata
    metadata.totalProcessingTime = (Date.now() - overallStartTime) / 1000;
    report.processingMetadata = metadata;

    report.status = 'ready';
    report.processingError = null;

    // ========================================
    // INCOMPLETE PROCESSING DETECTION
    // ========================================
    const pdfPages = metadata.pdfPages || 0;
    const pageWiseData = extractedData.pageWiseData || [];

    // Find pages with API errors (have 'error' field - indicates API failure, not empty pages)
    const errorPages = pageWiseData
      .filter(p => p.error)
      .map(p => p.pageNumber);

    // Find missing pages (not in pageWiseData at all)
    const processedPageNumbers = pageWiseData.map(p => p.pageNumber);
    const allPageNumbers = Array.from({ length: pdfPages }, (_, i) => i + 1);
    const missingPages = allPageNumbers.filter(p => !processedPageNumbers.includes(p));

    // Combine as failed pages (deduplicated and sorted)
    const failedPages = [...new Set([...missingPages, ...errorPages])].sort((a, b) => a - b);
    const successfulPages = pdfPages - failedPages.length;

    if (pdfPages > 0 && failedPages.length > 0) {
      report.processingIssues = {
        hasIncompleteProcessing: true,
        totalPages: pdfPages,
        processedPages: successfulPages,
        failedPages: failedPages,
        errorPages: errorPages,
        missingPages: missingPages,
        message: `${successfulPages} of ${pdfPages} pages processed (${failedPages.length} failed)`
      };
      console.log('[PROCESS] ⚠️  INCOMPLETE PROCESSING DETECTED');
      console.log('[PROCESS]    - Total pages:', pdfPages);
      console.log('[PROCESS]    - Successfully processed pages:', successfulPages);
      console.log('[PROCESS]    - Failed pages:', failedPages.join(', '));
      if (errorPages.length > 0) {
        console.log('[PROCESS]    - Pages with API errors:', errorPages.join(', '));
      }
      if (missingPages.length > 0) {
        console.log('[PROCESS]    - Missing pages:', missingPages.join(', '));
      }
    } else {
      report.processingIssues = {
        hasIncompleteProcessing: false,
        totalPages: pdfPages,
        processedPages: pageWiseData.length,
        failedPages: [],
        errorPages: [],
        missingPages: [],
        message: null
      };
      console.log('[PROCESS] ✓ All pages processed successfully');
    }

    // DEBUG: Pre-save validation - Check for NaN and invalid data types
    console.log('[PROCESS] 15. DEBUG - Pre-save data validation:');
    console.log('[PROCESS] 15a. - Report status:', report.status);
    console.log('[PROCESS] 15b. - ExtractedData results count:', report.extractedData?.results?.length || 0);
    console.log('[PROCESS] 15c. - FinalData results count:', report.finalData?.results?.length || 0);

    // Check for NaN values in results
    let nanCount = 0;
    let invalidTypeCount = 0;
    if (report.extractedData?.results) {
      report.extractedData.results.forEach((result, index) => {
        if (result.referenceRange) {
          const high = result.referenceRange.high;
          const low = result.referenceRange.low;

          // Check for NaN
          if (Number.isNaN(high)) {
            nanCount++;
            console.log(`[PROCESS] 15d. ⚠️  WARNING - NaN detected at result[${index}].referenceRange.high`);
            console.log(`[PROCESS] 15e. - Test name: ${result.serviceItemName}`);
          }
          if (Number.isNaN(low)) {
            nanCount++;
            console.log(`[PROCESS] 15f. ⚠️  WARNING - NaN detected at result[${index}].referenceRange.low`);
            console.log(`[PROCESS] 15g. - Test name: ${result.serviceItemName}`);
          }

          // Check for invalid types (not Number, not null, not undefined)
          if (high !== null && high !== undefined && typeof high !== 'number') {
            invalidTypeCount++;
            console.log(`[PROCESS] 15h. ⚠️  WARNING - Invalid type at result[${index}].referenceRange.high: ${typeof high} = ${high}`);
          }
          if (low !== null && low !== undefined && typeof low !== 'number') {
            invalidTypeCount++;
            console.log(`[PROCESS] 15i. ⚠️  WARNING - Invalid type at result[${index}].referenceRange.low: ${typeof low} = ${low}`);
          }
        }
      });
    }
    console.log('[PROCESS] 15j. - NaN values found:', nanCount);
    console.log('[PROCESS] 15k. - Invalid type values found:', invalidTypeCount);

    console.log('[PROCESS] 16. Saving report to MongoDB...');
    const mongoSaveStartTime = Date.now();
    let mongoSaveDuration;
    let dbTotalDuration;

    try {
      await report.save();
      mongoSaveDuration = Date.now() - mongoSaveStartTime;
      dbTotalDuration = Date.now() - dbSaveStartTime;

      console.log('[PROCESS] 16a. ✓ Report saved successfully');
      console.log('[PROCESS] 16b. MongoDB save time:', mongoSaveDuration, 'ms');
      console.log('[PROCESS] 16c. Total database operation time:', dbTotalDuration, 'ms');
    } catch (mongoError) {
      mongoSaveDuration = Date.now() - mongoSaveStartTime;
      console.error('[PROCESS] 16d. ❌ MongoDB save FAILED after', mongoSaveDuration, 'ms');
      console.error('[PROCESS] 16e. - Error type:', mongoError.constructor.name);
      console.error('[PROCESS] 16f. - Error message:', mongoError.message);

      // Log validation errors if present
      if (mongoError.name === 'ValidationError' && mongoError.errors) {
        console.error('[PROCESS] 16g. - Validation errors:');
        Object.keys(mongoError.errors).forEach(field => {
          console.error(`[PROCESS] 16h.   - Field: ${field}`);
          console.error(`[PROCESS] 16i.     - Kind: ${mongoError.errors[field].kind}`);
          console.error(`[PROCESS] 16j.     - Value: ${mongoError.errors[field].value}`);
          console.error(`[PROCESS] 16k.     - Message: ${mongoError.errors[field].message}`);
        });
      }

      console.error('[PROCESS] 16l. - Full error stack:');
      console.error(mongoError.stack);

      // Re-throw to be caught by outer error handler
      throw mongoError;
    }

    const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(2);

    audit.logStep(requestId, 'DB_SAVE_COMPLETE', {
      status: 'success',
      duration: dbTotalDuration / 1000,
      message: `MongoDB save: ${mongoSaveDuration}ms`
    });

    console.log('[PROCESS] 16. ✓ Report saved to database');
    console.log('[PROCESS] ========================================');
    console.log('[PROCESS] ✅ PROCESSING COMPLETE');
    console.log('[PROCESS] ========================================');
    console.log('[PROCESS] 17. Final summary:');
    console.log('[PROCESS]    - Status: ready');
    console.log('[PROCESS]    - Extraction method:', extractionMethod);
    console.log('[PROCESS]    - Actual method used:', metadata.method);
    console.log('[PROCESS]    - Lab:', extractedData.labName);
    console.log('[PROCESS]    - Parameters:', extractedData.results.length);
    console.log('[PROCESS]    - Abnormal:', flags.abnormalCount, '(' + flags.percentAbnormal + '%)');
    console.log('[PROCESS]    - Critical:', flags.criticalCount);
    console.log('[PROCESS]    - Total time:', totalDuration + 's');
    console.log('[PROCESS] 18. ===== DETAILED TIMING BREAKDOWN =====');
    if (metadata.textExtractionTime) {
      const textPct = ((metadata.textExtractionTime / metadata.totalProcessingTime) * 100).toFixed(1);
      console.log('[PROCESS]    - Text extraction:', metadata.textExtractionTime.toFixed(2) + 's (' + textPct + '%)');
    }
    if (metadata.imageConversionTime) {
      const imgPct = ((metadata.imageConversionTime / metadata.totalProcessingTime) * 100).toFixed(1);
      console.log('[PROCESS]    - Image conversion:', metadata.imageConversionTime.toFixed(2) + 's (' + imgPct + '%)');
    }
    const gptPct = ((metadata.gptProcessingTime / metadata.totalProcessingTime) * 100).toFixed(1);
    console.log('[PROCESS]    - GPT processing:', metadata.gptProcessingTime.toFixed(2) + 's (' + gptPct + '%)');

    const thresholdPct = ((parseFloat(thresholdDuration) / metadata.totalProcessingTime) * 100).toFixed(1);
    console.log('[PROCESS]    - Threshold analysis:', thresholdDuration + 's (' + thresholdPct + '%)');

    const dbPct = ((dbTotalDuration / 1000 / metadata.totalProcessingTime) * 100).toFixed(1);
    console.log('[PROCESS]    - Database operations:', (dbTotalDuration / 1000).toFixed(2) + 's (' + dbPct + '%)');

    console.log('[PROCESS] ========================================');
    console.log('[PROCESS] 🏁 PERFORMANCE SUMMARY');
    console.log('[PROCESS] ========================================');
    console.log('[PROCESS] Slowest operation:', metadata.gptProcessingTime > (metadata.textExtractionTime || 0) && metadata.gptProcessingTime > (metadata.imageConversionTime || 0) ? 'GPT Processing (' + metadata.gptProcessingTime.toFixed(2) + 's)' : metadata.textExtractionTime ? 'Text Extraction (' + metadata.textExtractionTime.toFixed(2) + 's)' : 'Image Conversion (' + metadata.imageConversionTime.toFixed(2) + 's)');
    console.log('[PROCESS] Total pipeline time:', totalDuration + 's');
    console.log('[PROCESS] ========================================');

    // End audit session with success
    audit.endAuditSession(requestId, 'success');

    // Return processed data
    return {
      reportId: report._id,
      orderId: report.orderId,
      labName: extractedData.labName,
      parametersExtracted: extractedData.results.length,
      status: report.status,
      extractionMethod: extractionMethod,
      actualMethodUsed: metadata.method,
      processingTime: totalDuration + 's',
      processingMetadata: {
        textExtractionTime: metadata.textExtractionTime,
        imageConversionTime: metadata.imageConversionTime,
        gptProcessingTime: metadata.gptProcessingTime,
        totalProcessingTime: metadata.totalProcessingTime,
        pdfPages: metadata.pdfPages,
        imagesGenerated: metadata.imagesGenerated
      },
      flags: {
        abnormalCount: flags.abnormalCount,
        criticalCount: flags.criticalCount,
        percentAbnormal: flags.percentAbnormal
      }
    };

  } catch (processingError) {
    const errorDuration = ((Date.now() - overallStartTime) / 1000).toFixed(2);

    // Categorize the error type for comprehensive logging
    const isValidationError =
      processingError.name === 'ValidationError' ||
      processingError.message.includes('validation');

    const isDatabaseError =
      processingError.name === 'MongoError' ||
      processingError.name === 'MongoServerError' ||
      processingError.message.includes('E11000') ||
      processingError.message.includes('duplicate key');

    const isApiError =
      processingError.message.includes('429') ||
      processingError.message.includes('RESOURCE_EXHAUSTED') ||
      processingError.message.includes('rate limit');

    const isPdfError =
      processingError.message.includes('PDF') ||
      processingError.message.includes('GraphicsMagick');

    const isNetworkError =
      processingError.code === 'ECONNRESET' ||
      processingError.code === 'ETIMEDOUT' ||
      processingError.message.includes('network');

    // Determine error category
    let errorCategory = 'PROCESSING_ERROR';
    if (isValidationError) errorCategory = 'VALIDATION_ERROR';
    else if (isDatabaseError) errorCategory = 'DATABASE_ERROR';
    else if (isApiError) errorCategory = 'API_RATE_LIMIT';
    else if (isPdfError) errorCategory = 'PDF_PROCESSING_ERROR';
    else if (isNetworkError) errorCategory = 'NETWORK_ERROR';

    // Build comprehensive error context
    const errorContext = {
      step: 'MAIN_PIPELINE',
      operation: 'processReportInternal',
      duration: parseFloat(errorDuration),
      code: processingError.code,
      retryable: isApiError || isNetworkError,
      context: {
        reportId,
        extractionMethod,
        model,
        isValidationError,
        isDatabaseError,
        isApiError,
        isPdfError,
        isNetworkError
      }
    };

    // Add validation error details if applicable
    if (isValidationError && processingError.errors) {
      errorContext.validationErrors = Object.keys(processingError.errors).map(field => ({
        field,
        kind: processingError.errors[field]?.kind,
        value: processingError.errors[field]?.value,
        message: processingError.errors[field]?.message
      }));
    }

    // Log error to audit with comprehensive context
    audit.logError(requestId, errorCategory, processingError, errorContext);

    console.error('[PROCESS] ========================================');
    console.error('[PROCESS] ❌ PROCESSING FAILED');
    console.error('[PROCESS] ========================================');
    console.error('[PROCESS] ERROR: Processing error after', errorDuration, 'seconds');
    console.error('[PROCESS] ERROR: Category:', errorCategory);
    console.error('[PROCESS] ERROR: Type:', processingError.constructor.name);
    console.error('[PROCESS] ERROR: Message:', processingError.message);
    console.error('[PROCESS] ERROR: Stack:', processingError.stack);

    // Update report with error - with retry logic
    try {
      report.status = 'error';
      report.processingError = processingError.message;
      await report.save();
      console.error('[PROCESS] ERROR: Report status updated to "error"');
    } catch (saveError) {
      console.error('[PROCESS] CRITICAL: Failed to save error status to database');
      console.error('[PROCESS] CRITICAL: Save error:', saveError.message);
      // Try one more time with a fresh report fetch
      try {
        const freshReport = await Report.findById(report._id);
        if (freshReport) {
          freshReport.status = 'error';
          freshReport.processingError = processingError.message;
          await freshReport.save();
          console.error('[PROCESS] ERROR: Report status updated to "error" on retry');
        }
      } catch (retryError) {
        console.error('[PROCESS] CRITICAL: Failed to save error status even on retry');
        console.error('[PROCESS] CRITICAL: Report may be stuck in processing state');
      }
    }
    console.error('[PROCESS] ========================================');

    // End audit session with error
    audit.endAuditSession(requestId, 'error');

    throw processingError;
  }
}

// Process a PDF report (HTTP endpoint wrapper)
const processReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { extractionMethod, model } = req.body;

    // Call internal function (will fetch defaults from config if not provided)
    const result = await processReportInternal(id, extractionMethod, model);

    res.json({
      success: true,
      message: 'Report processed successfully',
      data: result
    });

  } catch (error) {
    console.error('[PROCESS] FATAL ERROR:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to process report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Processing failed'
    });
  }
};

/**
 * Process multiple PDF reports in parallel with queue management
 * Maintains constant concurrency using p-limit
 */
const processMultipleReports = async (req, res) => {
  const batchStartTime = Date.now();

  try {
    const { reportIds, extractionMethod, model } = req.body;

    console.log('[PROCESS BATCH] ========================================');
    console.log('[PROCESS BATCH] 🚀 STARTING BATCH PROCESSING');
    console.log('[PROCESS BATCH] ========================================');
    console.log('[PROCESS BATCH] Report IDs:', reportIds);
    console.log('[PROCESS BATCH] Total reports:', reportIds?.length || 0);
    console.log('[PROCESS BATCH] Extraction method:', extractionMethod);
    console.log('[PROCESS BATCH] Model:', model);
    console.log('[PROCESS BATCH] Started at:', new Date().toISOString());

    // Validate input
    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'reportIds array is required and must not be empty'
      });
    }

    // ========== VALIDATION: Check all reports exist and log mismatches ==========
    console.log('[PROCESS BATCH] Validating report IDs...');
    const Report = require('../models/report.model');

    // Fetch all reports with matching IDs
    const existingReports = await Report.find({ _id: { $in: reportIds } }).select('_id status originalFileName');
    const existingIds = new Set(existingReports.map(r => r._id.toString()));

    // Find missing IDs
    const missingIds = reportIds.filter(id => !existingIds.has(id));
    if (missingIds.length > 0) {
      console.error('[PROCESS BATCH] ⚠️ WARNING: Some report IDs not found in database:', missingIds);
    }

    // Check for reports not in 'uploaded' or 'processing' status
    const invalidStatusReports = existingReports.filter(r =>
      r.status !== 'uploaded' && r.status !== 'processing' && r.status !== 'error'
    );
    if (invalidStatusReports.length > 0) {
      console.log('[PROCESS BATCH] ℹ️ Reports with non-uploadable status (may be already processed):');
      invalidStatusReports.forEach(r => {
        console.log(`[PROCESS BATCH]   - ${r._id}: status=${r.status}, file=${r.originalFileName}`);
      });
    }

    // Log validation summary
    console.log('[PROCESS BATCH] ========================================');
    console.log('[PROCESS BATCH] VALIDATION SUMMARY:');
    console.log(`[PROCESS BATCH]   Requested: ${reportIds.length} reports`);
    console.log(`[PROCESS BATCH]   Found in DB: ${existingReports.length} reports`);
    console.log(`[PROCESS BATCH]   Missing: ${missingIds.length} reports`);
    console.log(`[PROCESS BATCH]   Already processed: ${invalidStatusReports.length} reports`);
    console.log('[PROCESS BATCH] ========================================');

    // Filter to only process valid IDs that exist
    const validReportIds = reportIds.filter(id => existingIds.has(id));
    if (validReportIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid report IDs to process',
        details: {
          requested: reportIds.length,
          missing: missingIds.length
        }
      });
    }

    if (validReportIds.length !== reportIds.length) {
      console.warn(`[PROCESS BATCH] ⚠️ Processing ${validReportIds.length} of ${reportIds.length} requested reports`);
    }
    // ========== END VALIDATION ==========

    // Get concurrency limit from environment (default: 2 for stability with global Gemini queue)
    const concurrencyLimit = parseInt(process.env.CONCURRENT_PDF_LIMIT || '2', 10);
    console.log('[PROCESS BATCH] Concurrency limit:', concurrencyLimit);
    console.log('[PROCESS BATCH] ========================================');

    // Create p-limit instance for queue management
    const limit = pLimit(concurrencyLimit);

    // Track results and errors
    const results = [];
    const errors = [];

    // Process all reports with automatic queue management
    // p-limit ensures only 'concurrencyLimit' PDFs process concurrently
    // As one finishes, the next one starts automatically
    console.log('[PROCESS BATCH] Creating processing queue...');
    const promises = validReportIds.map((reportId, index) => {
      return limit(async () => {
        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

        console.log(`[PROCESS BATCH] [${index + 1}/${validReportIds.length}] 🚀 STARTING at ${timestamp} - Report: ${reportId}`);
        const startTime = Date.now();

        try {
          const result = await processReportInternal(reportId, extractionMethod, model);
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);

          console.log(`[PROCESS BATCH] [${index + 1}/${validReportIds.length}] ✓ COMPLETED in ${duration}s - Report: ${reportId}`);

          return {
            success: true,
            reportId,
            ...result
          };
        } catch (error) {
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);

          console.error(`[PROCESS BATCH] [${index + 1}/${validReportIds.length}] ✗ FAILED after ${duration}s - Report: ${reportId}`);
          console.error(`[PROCESS BATCH] Error:`, error.message);

          return {
            success: false,
            reportId,
            error: error.message
          };
        }
      });
    });

    console.log('[PROCESS BATCH] Queue created with', concurrencyLimit, 'concurrent slots');
    console.log('[PROCESS BATCH] Waiting for Promise.all() - parallel processing will begin now...');
    console.log('[PROCESS BATCH] ========================================');

    // Wait for all reports to process
    const allResults = await Promise.all(promises);

    // Separate successful and failed results
    allResults.forEach(result => {
      if (result.success) {
        results.push(result);
      } else {
        errors.push(result);
      }
    });

    const totalDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);

    console.log('[PROCESS BATCH] ========================================');
    console.log('[PROCESS BATCH] ✅ BATCH PROCESSING COMPLETE');
    console.log('[PROCESS BATCH] ========================================');
    console.log('[PROCESS BATCH] Requested reports:', reportIds.length);
    console.log('[PROCESS BATCH] Valid reports processed:', validReportIds.length);
    console.log('[PROCESS BATCH] Successful:', results.length);
    console.log('[PROCESS BATCH] Failed:', errors.length);
    console.log('[PROCESS BATCH] Skipped (missing/invalid):', missingIds.length);
    console.log('[PROCESS BATCH] Total time:', totalDuration + 's');
    console.log('[PROCESS BATCH] Average time per report:', (parseFloat(totalDuration) / validReportIds.length).toFixed(2) + 's');
    console.log('[PROCESS BATCH] ========================================');

    // Return comprehensive results
    res.json({
      success: true,
      message: `Processed ${results.length} of ${validReportIds.length} reports successfully`,
      data: {
        requestedReports: reportIds.length,
        validReports: validReportIds.length,
        successCount: results.length,
        errorCount: errors.length,
        skippedCount: missingIds.length,
        totalProcessingTime: totalDuration + 's',
        averageTimePerReport: (parseFloat(totalDuration) / validReportIds.length).toFixed(2) + 's',
        concurrencyLimit,
        successful: results,
        failed: errors,
        skipped: missingIds.length > 0 ? missingIds : undefined
      }
    });

  } catch (error) {
    const totalDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);

    console.error('[PROCESS BATCH] FATAL ERROR after', totalDuration + 's');
    console.error('[PROCESS BATCH] Error:', error.message);
    console.error('[PROCESS BATCH] Stack:', error.stack);

    res.status(500).json({
      success: false,
      message: 'Batch processing failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Batch processing failed'
    });
  }
};

// Get extracted data for a report
const getExtractedData = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[PROCESS CONTROLLER] Fetching extracted data for:', id);

    const report = await Report.findById(id)
      .populate('uploadedBy', 'name email')
      .select('orderId status extractedData finalData flags');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if data has been extracted
    if (report.status === 'uploaded') {
      return res.status(400).json({
        success: false,
        message: 'Report has not been processed yet'
      });
    }

    if (report.status === 'error') {
      return res.status(400).json({
        success: false,
        message: 'Report processing failed',
        error: report.processingError
      });
    }

    console.log('[PROCESS CONTROLLER] Extracted data found');

    res.json({
      success: true,
      message: 'Extracted data fetched successfully',
      data: {
        reportId: report._id,
        orderId: report.orderId,
        status: report.status,
        extractedData: report.extractedData,
        finalData: report.finalData,
        flags: report.flags
      }
    });

  } catch (error) {
    console.error('[PROCESS CONTROLLER] Get extracted data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch extracted data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Reprocess a report (full reprocess - clear all data and process from scratch)
 * Used when processing was incomplete or failed
 *
 * Permissions:
 * - All users: can reprocess reports with status 'error' or 'uploaded'
 * - Admin/Super Admin only: can also reprocess reports with status 'ready' (pending review)
 */
const reprocessReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    console.log('[REPROCESS] Starting reprocess for report:', id, 'by:', req.user?.email, 'role:', userRole);

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    console.log('[REPROCESS] Current status:', report.status);
    console.log('[REPROCESS] Has incomplete processing:', report.processingIssues?.hasIncompleteProcessing);

    // Define allowed statuses based on role
    // All users: can reprocess 'error' or 'uploaded'
    // Admin only: can also reprocess 'ready' (pending review)
    const allUserStatuses = ['error', 'uploaded'];
    const adminOnlyStatuses = ['ready'];

    const canReprocess =
      allUserStatuses.includes(report.status) ||
      (isAdmin && adminOnlyStatuses.includes(report.status)) ||
      report.processingIssues?.hasIncompleteProcessing;

    if (!canReprocess) {
      // Provide appropriate error message based on role
      if (!isAdmin && report.status === 'ready') {
        return res.status(403).json({
          success: false,
          message: 'Only admins can reprocess reports that are pending review'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Report cannot be reprocessed in current state '${report.status}'`
      });
    }

    // Clear existing data for fresh processing
    report.status = 'uploaded';
    report.extractedData = undefined;
    report.processingMetadata = undefined;
    report.processingIssues = undefined;
    report.validationFlags = [];
    report.flags = undefined;
    report.uiIndicators = undefined;
    report.processingError = undefined;
    report.finalData = undefined;

    await report.save();
    console.log('[REPROCESS] Report data cleared, triggering fresh processing');

    // Trigger fresh processing (don't await - let it run in background)
    processReportInternal(report._id).catch(error => {
      console.error('[REPROCESS] Background processing error:', error.message);
    });

    res.json({
      success: true,
      message: 'Report reprocessing started',
      reportId: id
    });
  } catch (error) {
    console.error('[REPROCESS] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  processReport,
  processMultipleReports,
  getExtractedData,
  reprocessReport
};