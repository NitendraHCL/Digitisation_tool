const fs = require('fs');
const pdfParse = require('pdf-parse');

class PDFTextExtractorService {
  async extractText(pdfPath) {
    const startTime = Date.now();
    console.log('[PDF-TEXT] 1. Starting text extraction from PDF file');
    console.log('[PDF-TEXT] 2. File path:', pdfPath);

    try {
      // Check if file exists
      if (!fs.existsSync(pdfPath)) {
        throw new Error('PDF file not found at path: ' + pdfPath);
      }

      // Get file stats
      const stats = fs.statSync(pdfPath);
      console.log('[PDF-TEXT] 3. PDF file size:', (stats.size / 1024).toFixed(2), 'KB');

      // Read the PDF file
      console.log('[PDF-TEXT] 4. Reading PDF file into buffer...');
      const readStartTime = Date.now();
      const dataBuffer = fs.readFileSync(pdfPath);
      const readDuration = Date.now() - readStartTime;
      console.log('[PDF-TEXT] 5. Buffer size:', dataBuffer.length, 'bytes');
      console.log('[PDF-TEXT] 5a. File read time:', readDuration, 'ms');

      // Parse PDF (pdf-parse is a function, not a constructor)
      console.log('[PDF-TEXT] 6. Parsing PDF with pdf-parse...');
      const parseStartTime = Date.now();
      const data = await pdfParse(dataBuffer);
      const parseDuration = Date.now() - parseStartTime;

      const totalTime = Date.now() - startTime;
      console.log('[PDF-TEXT] 7. PDF parsing completed');
      console.log('[PDF-TEXT] 8. ===== TIMING BREAKDOWN =====');
      console.log('[PDF-TEXT]   - File read time:', readDuration, 'ms');
      console.log('[PDF-TEXT]   - PDF parsing time:', parseDuration, 'ms');
      console.log('[PDF-TEXT]   - Total time:', totalTime, 'ms (' + (totalTime / 1000).toFixed(2) + 's)');

      // Extract text from result (pdf-parse returns {text, numpages, info, metadata, version})
      let extractedText = '';
      let numPages = 1;

      // pdf-parse v1.1.4 returns: {numpages, numrender, info, metadata, text, version}
      console.log('[PDF-TEXT] 9. Extracting text from parsed data...');
      extractedText = data.text || '';
      numPages = data.numpages || 1;

      console.log('[PDF-TEXT] 10. PDF has', numPages, 'page(s)');
      console.log('[PDF-TEXT] 11. Extracted text length:', extractedText.length, 'characters');

      // Log first 500 characters as a sample
      const sampleText = extractedText.substring(0, 500).replace(/\n/g, ' ').trim();
      console.log('[PDF-TEXT] 12. Text sample (first 500 chars):', sampleText);

      if (!extractedText || extractedText.trim().length === 0) {
        console.error('[PDF-TEXT] ERROR: No text could be extracted from PDF');
        throw new Error('No text could be extracted from PDF');
      }

      console.log('[PDF-TEXT] 13. ✓ Text extraction successful');
      console.log('[PDF-TEXT] 14. Total extraction time:', totalTime, 'ms (' + (totalTime / 1000).toFixed(2) + 's)');

      // Return the extracted text
      return {
        text: extractedText,
        pages: numPages,
        info: data.metadata || {}
      };

    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error('[PDF-TEXT] ERROR: Text extraction failed after', errorTime, 'ms');
      console.error('[PDF-TEXT] ERROR: Error details:', error.message);
      console.error('[PDF-TEXT] ERROR: Stack trace:', error.stack);
      throw new Error(`PDF text extraction failed: ${error.message}`);
    }
  }
}

module.exports = new PDFTextExtractorService();