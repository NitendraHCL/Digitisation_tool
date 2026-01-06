const { fromPath } = require('pdf2pic');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const audit = require('../utils/auditLogger');
const { withRetry, sleep } = require('../utils/retryHelper');

class PDFConverterService {
  constructor() {
    // Optimized settings for medical lab reports based on research:
    // - 150 DPI for balanced speed/accuracy (reduced from 300 DPI)
    // - Max width 1280px to reduce file size without losing readability
    // - PNG for lossless compression
    // - Quality 90 for good compression
    this.options = {
      density: 150,           // OPTIMIZED: Reduced from 300 DPI for faster processing (15-20% speedup)
      saveFilename: 'page',
      savePath: path.join(__dirname, '../../temp'), // FIX: Use absolute path to avoid parallel processing issues
      format: 'png',         // Lossless format for medical documents
      width: 1280,           // OPTIMIZED: Cap width at 1280px (medical docs don't need full resolution)
      quality: 90            // OPTIMIZED: Good compression without quality loss
    };
  }

  async convertToImages(pdfPath, requestId = null) {
    const totalStartTime = Date.now();
    console.log('[PDF CONVERTER] ========================================');
    console.log('[PDF CONVERTER] STARTING PDF TO IMAGE CONVERSION');
    console.log('[PDF CONVERTER] ========================================');
    console.log('[PDF CONVERTER] 1. PDF path:', pdfPath);
    console.log('[PDF CONVERTER] 1a. Request ID:', requestId || 'N/A');

    if (requestId) {
      audit.logStep(requestId, 'PDF_CONVERTER_INIT', { message: `Path: ${pdfPath}` });
    }

    // Create a unique temp directory for this conversion to avoid race conditions
    const uniqueTempDir = path.join(
      __dirname,
      '../../temp',
      `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );

    try {
      // Ensure unique temp directory exists
      const mkdirStartTime = Date.now();
      await fs.mkdir(uniqueTempDir, { recursive: true });
      console.log('[PDF CONVERTER] 2. Unique temp directory created in', Date.now() - mkdirStartTime, 'ms');
      console.log('[PDF CONVERTER] 2a. Temp path:', uniqueTempDir);

      // Initialize converter with unique temp directory
      const initStartTime = Date.now();
      const converterOptions = {
        ...this.options,
        savePath: uniqueTempDir // Use unique directory for this conversion
      };
      const converter = fromPath(pdfPath, converterOptions);
      console.log('[PDF CONVERTER] 3. Converter initialized in', Date.now() - initStartTime, 'ms');

      // Get actual page count from PDF before conversion (PERF: avoids trying non-existent pages)
      const pdfBuffer = await fs.readFile(pdfPath);
      const pdfData = await pdfParse(pdfBuffer);
      const actualPageCount = pdfData.numpages || 1;
      const maxPagesLimit = parseInt(process.env.MAX_PDF_PAGES) || 100;
      const maxPages = Math.min(actualPageCount, maxPagesLimit);

      console.log('[PDF CONVERTER] 3a. PDF has', actualPageCount, 'pages, converting', maxPages, 'pages');
      const pageTimings = [];
      let totalConversionTime = 0;
      let totalFileReadTime = 0;
      let totalBase64Time = 0;
      let totalCleanupTime = 0;

      console.log('[PDF CONVERTER] 4. Starting PARALLEL page conversion (max', maxPages, 'pages)...');

      // Create array of page numbers to process in parallel
      const pageNumbers = Array.from({ length: maxPages }, (_, i) => i + 1);

      // Process all pages in parallel
      const pagePromises = pageNumbers.map(async (pageNum) => {
        const pageStartTime = Date.now();
        const timings = {
          conversion: 0,
          read: 0,
          base64: 0,
          cleanup: 0
        };

        try {
          // Convert page to image with retry logic
          const conversionStart = Date.now();
          const result = await withRetry(
            () => converter(pageNum),
            {
              maxRetries: 2,
              baseDelayMs: 500,
              operationName: `PDF page ${pageNum} conversion`
            }
          );
          timings.conversion = Date.now() - conversionStart;

          if (!result || !result.path) {
            // No more pages
            return { pageNum, success: false, reason: 'no_more_pages', timings };
          }

          // Verify the file actually exists
          try {
            await fs.access(result.path);
          } catch (accessError) {
            console.error(`[PDF CONVERTER] ERROR: Page ${pageNum} file not found at ${result.path}`);
            console.error('[PDF CONVERTER] This usually means GraphicsMagick failed to convert the PDF page');
            return { pageNum, success: false, reason: 'file_not_found', timings };
          }

          // Read the image file
          const readStart = Date.now();
          const imageBuffer = await fs.readFile(result.path);
          timings.read = Date.now() - readStart;

          // Convert to base64
          const base64Start = Date.now();
          const base64Image = imageBuffer.toString('base64');
          timings.base64 = Date.now() - base64Start;

          // Verify we got actual data
          if (base64Image.length === 0) {
            console.error(`[PDF CONVERTER] ERROR: Page ${pageNum} conversion produced 0 bytes`);
            await fs.unlink(result.path).catch(() => {});
            return { pageNum, success: false, reason: 'empty_data', timings };
          }

          // Clean up temp file
          const cleanupStart = Date.now();
          await fs.unlink(result.path);
          timings.cleanup = Date.now() - cleanupStart;

          const pageTotal = Date.now() - pageStartTime;

          return {
            pageNum,
            success: true,
            base64: base64Image,
            size: base64Image.length,
            timings,
            totalTime: pageTotal
          };
        } catch (error) {
          // Reached end of document or other error
          if (error.message && error.message.includes('Request page out of range')) {
            return { pageNum, success: false, reason: 'out_of_range', timings };
          }

          // Categorize file system errors
          const isPermissionError =
            error.code === 'EACCES' ||
            error.code === 'EPERM' ||
            error.message.includes('permission denied');

          const isDiskSpaceError =
            error.code === 'ENOSPC' ||
            error.message.includes('no space left');

          const isFileNotFound =
            error.code === 'ENOENT' ||
            error.message.includes('no such file');

          const isGraphicsMagickError =
            error.message.includes('GraphicsMagick') ||
            error.message.includes('gm convert') ||
            error.message.includes('Command failed');

          // Determine error category
          let errorCategory = 'PDF_PAGE_ERROR';
          if (isPermissionError) errorCategory = 'FILE_PERMISSION_ERROR';
          else if (isDiskSpaceError) errorCategory = 'DISK_SPACE_ERROR';
          else if (isFileNotFound) errorCategory = 'FILE_NOT_FOUND';
          else if (isGraphicsMagickError) errorCategory = 'GRAPHICS_MAGICK_ERROR';

          console.error(`[PDF CONVERTER] ERROR [${errorCategory}]: Page ${pageNum} conversion failed:`, error.message);

          // Log to audit if requestId available
          if (requestId) {
            audit.logError(requestId, errorCategory, error, {
              step: `PDF_PAGE_${pageNum}_CONVERT`,
              pageNumber: pageNum,
              operation: 'convertToImages',
              filePath: pdfPath,
              context: {
                errorCode: error.code,
                isPermissionError,
                isDiskSpaceError,
                isFileNotFound,
                isGraphicsMagickError,
                tempDir: uniqueTempDir,
                totalPages: maxPages
              }
            });
          }

          return { pageNum, success: false, reason: 'error', error: error.message, errorCategory, timings };
        }
      });

      // Wait for all pages to complete
      let allPageResults = await Promise.all(pagePromises);

      // Identify failed pages that are retryable (not out_of_range or no_more_pages)
      const retryableFailures = allPageResults.filter(
        result => !result.success && result.reason === 'error'
      );

      // Retry stats for audit
      const retryStats = {
        totalRetries: 0,
        pagesRetried: [],
        retriedSuccessfully: []
      };

      // Retry failed pages (one round, sequentially to avoid GraphicsMagick contention)
      if (retryableFailures.length > 0) {
        console.log(`[PDF CONVERTER] 4a. Retrying ${retryableFailures.length} failed pages...`);
        await sleep(1000); // Wait 1 second before retry

        for (const failedPage of retryableFailures) {
          const pageNum = failedPage.pageNum;
          retryStats.totalRetries++;
          retryStats.pagesRetried.push(pageNum);

          try {
            console.log(`[PDF CONVERTER] 4b. Retrying page ${pageNum}...`);
            const retryStart = Date.now();
            const result = await converter(pageNum);

            if (result && result.path) {
              await fs.access(result.path);
              const imageBuffer = await fs.readFile(result.path);
              const base64Image = imageBuffer.toString('base64');

              if (base64Image.length > 0) {
                await fs.unlink(result.path);
                const retryTime = Date.now() - retryStart;

                // Replace failed result with successful one
                const idx = allPageResults.findIndex(r => r.pageNum === pageNum);
                allPageResults[idx] = {
                  pageNum,
                  success: true,
                  base64: base64Image,
                  size: base64Image.length,
                  timings: { conversion: retryTime, read: 0, base64: 0, cleanup: 0 },
                  totalTime: retryTime,
                  wasRetried: true
                };
                retryStats.retriedSuccessfully.push(pageNum);
                console.log(`[PDF CONVERTER] 4c. Page ${pageNum} retry SUCCEEDED in ${retryTime}ms`);
              }
            }
          } catch (retryError) {
            console.error(`[PDF CONVERTER] 4d. Page ${pageNum} retry FAILED:`, retryError.message);
          }
        }

        console.log(`[PDF CONVERTER] 4e. Retry complete: ${retryStats.retriedSuccessfully.length}/${retryableFailures.length} pages recovered`);
      }

      // Filter successful pages and sort by page number
      const successfulPages = allPageResults
        .filter(result => result.success)
        .sort((a, b) => a.pageNum - b.pageNum);

      // Extract images in correct page order
      const images = successfulPages.map(page => page.base64);

      // Calculate timing totals
      successfulPages.forEach(page => {
        totalConversionTime += page.timings.conversion;
        totalFileReadTime += page.timings.read;
        totalBase64Time += page.timings.base64;
        totalCleanupTime += page.timings.cleanup;
        pageTimings.push(page.totalTime);

        console.log(`[PDF CONVERTER]    Page ${page.pageNum}: ${page.totalTime}ms (convert: ${page.timings.conversion}ms, read: ${page.timings.read}ms, base64: ${page.timings.base64}ms, cleanup: ${page.timings.cleanup}ms, size: ${(page.size / 1024).toFixed(2)}KB)`);
      });

      // Log if we found the end of document
      const failedPages = allPageResults.filter(result => !result.success);
      if (failedPages.length > 0) {
        const endOfDoc = failedPages.find(p => p.reason === 'out_of_range' || p.reason === 'no_more_pages');
        if (endOfDoc) {
          console.log(`[PDF CONVERTER] 5. Reached end of document (last successful page: ${successfulPages.length})`);
        }
      }

      const totalDuration = (Date.now() - totalStartTime) / 1000;
      const totalPayloadMB = (images.reduce((sum, img) => sum + img.length, 0)) / 1024 / 1024;

      console.log('[PDF CONVERTER] ========================================');
      console.log('[PDF CONVERTER] ✓ CONVERSION COMPLETE');
      console.log('[PDF CONVERTER] ========================================');
      console.log('[PDF CONVERTER] 6. Pages converted:', images.length);
      console.log('[PDF CONVERTER] 7. Total conversion time:', totalDuration.toFixed(2), 'seconds');
      console.log('[PDF CONVERTER] 8. ===== TIMING BREAKDOWN =====');
      console.log('[PDF CONVERTER] 9. Total PDF-to-PNG conversion:', (totalConversionTime / 1000).toFixed(2), 's');
      console.log('[PDF CONVERTER] 10. Total file reading:', (totalFileReadTime / 1000).toFixed(2), 's');
      console.log('[PDF CONVERTER] 11. Total base64 encoding:', (totalBase64Time / 1000).toFixed(2), 's');
      console.log('[PDF CONVERTER] 12. Total cleanup:', (totalCleanupTime / 1000).toFixed(2), 's');
      console.log('[PDF CONVERTER] 13. Average per page:', (totalDuration / images.length).toFixed(2), 's');
      console.log('[PDF CONVERTER] 14. Total payload size:', totalPayloadMB.toFixed(2), 'MB');

      // Build per-page timing data for audit
      const pdfPageTimings = successfulPages.map(page => ({
        pageNumber: page.pageNum,
        conversionTime: page.timings.conversion,
        readTime: page.timings.read,
        base64Time: page.timings.base64,
        cleanupTime: page.timings.cleanup,
        totalTime: page.totalTime,
        fileSize: Math.round(page.size / 1024) // KB
      }));

      if (requestId) {
        audit.logStep(requestId, 'PDF_CONVERTER_COMPLETE', {
          status: 'success',
          duration: totalDuration,
          count: images.length,
          size: `${totalPayloadMB.toFixed(2)}MB`,
          message: `Converted ${images.length} pages in ${totalDuration.toFixed(2)}s | PNG conversion: ${(totalConversionTime / 1000).toFixed(2)}s | Avg: ${(totalDuration / images.length).toFixed(2)}s/page`,
          pdfPageTimings // Include timing data for audit
        });
      }

      return {
        images,
        pdfTimings: {
          totalTime: totalConversionTime + totalFileReadTime + totalBase64Time + totalCleanupTime, // ms
          perPage: pdfPageTimings,
          retryStats: retryStats.totalRetries > 0 ? retryStats : null
        }
      };

    } catch (error) {
      console.error('[PDF CONVERTER] Conversion error:', error);

      // Categorize the error for comprehensive logging
      const isPermissionError =
        error.code === 'EACCES' ||
        error.code === 'EPERM' ||
        error.message.includes('permission denied');

      const isDiskSpaceError =
        error.code === 'ENOSPC' ||
        error.message.includes('no space left');

      const isFileNotFound =
        error.code === 'ENOENT' ||
        error.message.includes('no such file');

      const isGraphicsMagickError =
        error.message.includes('GraphicsMagick') ||
        error.message.includes('gm convert') ||
        error.message.includes('Command failed');

      const isPdfParseError =
        error.message.includes('pdf-parse') ||
        error.message.includes('Invalid PDF');

      // Determine error category
      let errorCategory = 'PDF_CONVERSION_ERROR';
      if (isPermissionError) errorCategory = 'FILE_PERMISSION_ERROR';
      else if (isDiskSpaceError) errorCategory = 'DISK_SPACE_ERROR';
      else if (isFileNotFound) errorCategory = 'FILE_NOT_FOUND';
      else if (isGraphicsMagickError) errorCategory = 'GRAPHICS_MAGICK_ERROR';
      else if (isPdfParseError) errorCategory = 'PDF_PARSE_ERROR';

      if (requestId) {
        audit.logError(requestId, errorCategory, error, {
          step: 'PDF_CONVERSION',
          operation: 'convertToImages',
          filePath: pdfPath,
          context: {
            errorCode: error.code,
            isPermissionError,
            isDiskSpaceError,
            isFileNotFound,
            isGraphicsMagickError,
            isPdfParseError,
            tempDir: uniqueTempDir
          }
        });
      }
      throw new Error(`PDF conversion failed: ${error.message}`);
    } finally {
      // Cleanup: Remove the unique temp directory
      try {
        await fs.rm(uniqueTempDir, { recursive: true, force: true });
        console.log('[PDF CONVERTER] 15. Cleaned up temp directory:', uniqueTempDir);
      } catch (cleanupError) {
        console.error('[PDF CONVERTER] Cleanup error for temp directory:', cleanupError.message);
      }
    }
  }

  async cleanup() {
    try {
      // Clean up temp directory
      const files = await fs.readdir(this.options.savePath);
      for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.jpg')) {
          await fs.unlink(path.join(this.options.savePath, file));
        }
      }
      console.log('[PDF CONVERTER] Cleanup completed');
    } catch (error) {
      console.error('[PDF CONVERTER] Cleanup error:', error);
    }
  }
}

module.exports = new PDFConverterService();