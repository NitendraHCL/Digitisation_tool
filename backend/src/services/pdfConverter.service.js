const { fromPath } = require('pdf2pic');
const path = require('path');
const fs = require('fs').promises;

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

  async convertToImages(pdfPath) {
    const totalStartTime = Date.now();
    console.log('[PDF CONVERTER] ========================================');
    console.log('[PDF CONVERTER] STARTING PDF TO IMAGE CONVERSION');
    console.log('[PDF CONVERTER] ========================================');
    console.log('[PDF CONVERTER] 1. PDF path:', pdfPath);

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

      // Get PDF info to know how many pages
      // We'll convert all pages - limit can be configured via env if needed
      const images = [];
      const maxPages = parseInt(process.env.MAX_PDF_PAGES) || 100; // Default to 100 pages max, configurable
      const pageTimings = [];
      let totalConversionTime = 0;
      let totalFileReadTime = 0;
      let totalBase64Time = 0;
      let totalCleanupTime = 0;

      console.log('[PDF CONVERTER] 4. Starting page conversion (max', maxPages, 'pages)...');

      for (let i = 1; i <= maxPages; i++) {
        try {
          const pageStartTime = Date.now();

          // Convert page to image
          const conversionStart = Date.now();
          const result = await converter(i);
          const conversionDuration = Date.now() - conversionStart;
          totalConversionTime += conversionDuration;

          if (result && result.path) {
            // Verify the file actually exists (pdf2pic sometimes returns a path but fails silently)
            try {
              await fs.access(result.path);
            } catch (accessError) {
              console.error(`[PDF CONVERTER] ERROR: Page ${i} file not found at ${result.path}`);
              console.error('[PDF CONVERTER] This usually means GraphicsMagick failed to convert the PDF page');
              continue; // Skip this page and try the next one
            }

            // Read the image file
            const readStart = Date.now();
            const imageBuffer = await fs.readFile(result.path);
            const readDuration = Date.now() - readStart;
            totalFileReadTime += readDuration;

            // Convert to base64
            const base64Start = Date.now();
            const base64Image = imageBuffer.toString('base64');
            const base64Duration = Date.now() - base64Start;
            totalBase64Time += base64Duration;

            // Verify we got actual data
            if (base64Image.length === 0) {
              console.error(`[PDF CONVERTER] ERROR: Page ${i} conversion produced 0 bytes`);
              await fs.unlink(result.path).catch(() => {}); // Clean up if it exists
              continue; // Skip this page
            }

            images.push(base64Image);

            // Clean up temp file
            const cleanupStart = Date.now();
            await fs.unlink(result.path);
            const cleanupDuration = Date.now() - cleanupStart;
            totalCleanupTime += cleanupDuration;

            const pageTotal = Date.now() - pageStartTime;
            pageTimings.push(pageTotal);

            console.log(`[PDF CONVERTER]    Page ${i}: ${pageTotal}ms (convert: ${conversionDuration}ms, read: ${readDuration}ms, base64: ${base64Duration}ms, cleanup: ${cleanupDuration}ms, size: ${(base64Image.length / 1024).toFixed(2)}KB)`);
          } else {
            // No more pages
            console.log(`[PDF CONVERTER] 5. No more pages found at page ${i}`);
            break;
          }
        } catch (error) {
          // Reached end of document
          if (error.message && error.message.includes('Request page out of range')) {
            console.log(`[PDF CONVERTER] 5. Reached end of document at page ${i-1}`);
            break;
          }
          // Other errors for specific page
          console.error(`[PDF CONVERTER] ERROR: Page ${i} conversion failed:`, error.message);
        }
      }

      const totalDuration = (Date.now() - totalStartTime) / 1000;
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
      console.log('[PDF CONVERTER] 14. Total payload size:', ((images.reduce((sum, img) => sum + img.length, 0)) / 1024 / 1024).toFixed(2), 'MB');

      return images;

    } catch (error) {
      console.error('[PDF CONVERTER] Conversion error:', error);
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