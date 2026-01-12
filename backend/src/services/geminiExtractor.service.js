const { GoogleGenerativeAI } = require('@google/generative-ai');
const LabConfig = require('../models/LabConfig');
const pLimit = require('p-limit');
const audit = require('../utils/auditLogger');
const { withRetry, sleep } = require('../utils/retryHelper');
const geminiKeyManager = require('../utils/geminiKeyManager');
const { addToQueue, PRIORITY } = require('../utils/geminiQueue');

// ============ ADMIN-CONFIGURABLE DELAYS ============
// These can be adjusted via environment variables without code changes
const PAGE_CALL_DELAY_MS = Number(process.env.PAGE_CALL_DELAY_MS) || 300;
const RETRY_INITIAL_DELAY_MS = Number(process.env.RETRY_INITIAL_DELAY_MS) || 1500;
const RETRY_BETWEEN_DELAY_MS = Number(process.env.RETRY_BETWEEN_DELAY_MS) || 2000;
const MAX_RETRIES_PER_PAGE = Number(process.env.MAX_RETRIES_PER_PAGE) || 1;

// Helper function to normalize gender values to schema-compatible values
// Converts "M", "m", "Male", "MALE" → "male"
// Converts "F", "f", "Female", "FEMALE" → "female"
// Returns null for unavailable/unrecognized values (don't block processing)
function normalizeGender(gender) {
  if (!gender) return null;
  const g = gender.trim().toLowerCase();

  // Check for "not available" patterns - return null instead of blocking
  const notAvailablePatterns = ['n/a', 'na', 'not available', 'not specified', '-', '--', 'unknown', 'nil', 'none', ''];
  if (notAvailablePatterns.includes(g)) return null;

  if (g === 'm' || g === 'male') return 'male';
  if (g === 'f' || g === 'female') return 'female';

  // For any other unrecognized value, return null to avoid blocking processing
  return null;
}

class GeminiExtractorService {
  constructor() {
    // Note: We now use geminiKeyManager for key rotation
    // Each API call will get a fresh key from the manager
    // This constructor initializes with the first key for backwards compatibility
    this.genAI = new GoogleGenerativeAI(geminiKeyManager.getNextKey());
  }

  /**
   * Get a GoogleGenerativeAI instance with the next API key in rotation
   * @returns {GoogleGenerativeAI} Fresh instance with rotated key
   */
  getGenAIWithRotatedKey() {
    return new GoogleGenerativeAI(geminiKeyManager.getNextKey());
  }

  /**
   * Get a GoogleGenerativeAI instance with key info for logging
   * @returns {Object} { genAI, keyInfo: { keyIndex, keyName, totalKeys } }
   */
  getGenAIWithKeyInfo() {
    const keyData = geminiKeyManager.getNextKeyWithInfo();
    return {
      genAI: new GoogleGenerativeAI(keyData.key),
      keyInfo: {
        keyIndex: keyData.keyIndex,
        keyName: keyData.keyName,
        totalKeys: keyData.totalKeys
      }
    };
  }

  /**
   * Execute Gemini API call with automatic retry on rate limit
   * Uses key rotation with cooldown - rate-limited keys are skipped for 60s
   *
   * @param {string} prompt - The prompt to send to Gemini
   * @param {Object} imagePart - The image data { inlineData: { data, mimeType } }
   * @param {string} modelName - The Gemini model to use
   * @param {number} maxRetries - Maximum retry attempts (default 4)
   * @param {string} requestId - Request ID for audit logging
   * @returns {Object} { result, keyInfo }
   */
  async callGeminiWithRetry(prompt, imagePart, modelName, maxRetries = 4, requestId = null) {
    const safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
    ];

    let lastError = null;
    let lastKeyInfo = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Get next AVAILABLE key (skips keys on cooldown)
      const keyData = geminiKeyManager.getNextAvailableKeyWithInfo();
      lastKeyInfo = keyData;

      try {
        const genAI = new GoogleGenerativeAI(keyData.key);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0, topP: 1, topK: 1, maxOutputTokens: 8192 },
          safetySettings
        });

        const result = await model.generateContent([prompt, imagePart]);
        return { result, keyInfo: keyData };

      } catch (error) {
        lastError = error;
        const isRateLimit = error.message.includes('429') ||
                           error.message.includes('quota') ||
                           error.message.includes('RESOURCE_EXHAUSTED') ||
                           error.message.includes('Too Many Requests');

        if (isRateLimit) {
          // Mark this key as rate-limited (cooldown for 60s)
          geminiKeyManager.markRateLimited(keyData.key);

          if (attempt < maxRetries) {
            console.warn(`[GEMINI RETRY] Rate limit on ${keyData.keyName}, attempt ${attempt}/${maxRetries}, trying next key...`);
            await sleep(500); // Brief pause before retry
            continue;
          }
        }

        // Non-rate-limit error or max retries exceeded
        console.error(`[GEMINI RETRY] Error on attempt ${attempt}/${maxRetries} with ${keyData.keyName}: ${error.message}`);
        if (attempt >= maxRetries) {
          throw error;
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Parse header-only response from Gemini
   * Used by two-pass Page 1 extraction
   * @param {string} response - Raw response from Gemini
   * @returns {Object} Parsed header info
   */
  parseHeaderResponse(response) {
    const headers = {
      labName: 'Unknown Lab',
      patientName: null,
      patientAge: null,
      patientGender: null,
      dateOfTest: null
    };

    const lines = response.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.toUpperCase().startsWith('LAB_NAME:')) {
        const value = trimmedLine.substring(trimmedLine.indexOf(':') + 1).trim();
        headers.labName = value || 'Unknown Lab';
      } else if (trimmedLine.toUpperCase().startsWith('PATIENT_NAME:')) {
        const value = trimmedLine.substring(trimmedLine.indexOf(':') + 1).trim();
        headers.patientName = (value && value !== 'Not Found') ? value : null;
      } else if (trimmedLine.toUpperCase().startsWith('PATIENT_AGE:')) {
        const value = trimmedLine.substring(trimmedLine.indexOf(':') + 1).trim();
        headers.patientAge = (value && value !== 'Not Found') ? value : null;
      } else if (trimmedLine.toUpperCase().startsWith('PATIENT_GENDER:')) {
        const value = trimmedLine.substring(trimmedLine.indexOf(':') + 1).trim();
        headers.patientGender = normalizeGender(value);
      } else if (trimmedLine.toUpperCase().startsWith('DATE_OF_TEST:')) {
        const value = trimmedLine.substring(trimmedLine.indexOf(':') + 1).trim();
        headers.dateOfTest = (value && value !== 'Not Found') ? value : null;
      }
    }

    return headers;
  }

  /**
   * Parse parameter response from Gemini
   * Used by two-pass Page 1 extraction and quality-based retry
   * @param {string} response - Raw response from Gemini
   * @returns {Array} Array of parsed parameters
   */
  parseParameterResponse(response) {
    const parameters = [];

    // Check for NO_TEST_DATA response
    if (response.trim().toUpperCase() === 'NO_TEST_DATA') {
      return parameters;
    }

    const lines = response.trim().split('\n').filter(line => line.includes('|'));

    for (const line of lines) {
      const parts = line.split('|').map(part => part.trim());

      if (parts.length >= 7) {
        const refHigh = parts[5] === 'null' || parts[5] === '' ? null : parseFloat(parts[5]);
        const refLow = parts[6] === 'null' || parts[6] === '' ? null : parseFloat(parts[6]);

        parameters.push({
          type: 'path',
          serviceItemName: parts[0],
          value: (parts[1] === 'null' || parts[1] === '') ? null : parts[1],
          unit: (parts[2] === 'null' || parts[2] === '') ? null : parts[2],
          method: (parts[3] === 'null' || parts[3] === '' || parts[3] === 'N/A') ? null : parts[3],
          referenceRange: {
            high: Number.isNaN(refHigh) ? null : refHigh,
            low: Number.isNaN(refLow) ? null : refLow,
            referenceRange: parts[4]
          }
        });
      }
    }

    return parameters;
  }

  /**
   * Two-Pass Extraction for Page 1
   *
   * WHY THIS EXISTS:
   * Page 1 previously had ONE prompt doing THREE tasks:
   *   1. Match lab name from 40+ options
   *   2. Extract patient header info
   *   3. Extract all test parameters
   *
   * PROBLEM: Gemini gets "attention exhaustion" - it completes the header
   * extraction but skips the parameters. This caused ~40% of Page 1
   * extractions to have 0 CBC parameters.
   *
   * SOLUTION: Split into TWO focused API calls:
   *   Pass 1: Headers only (5 fields) - through queue
   *   Pass 2: Parameters only (using improved prompt) - through queue
   *
   * @param {string} pageImage - Base64 encoded image of Page 1
   * @param {string} labNames - Comma-separated list of valid lab names
   * @param {string} modelName - Gemini model to use
   * @param {string} requestId - Request ID for audit logging
   * @returns {Object} { headerInfo, results, rawResponse, extractionMetadata }
   */
  async extractPage1TwoPass(pageImage, labNames, modelName, requestId) {
    console.log('[PAGE 1 TWO-PASS] ========== Starting two-pass extraction ==========');

    const totalStartTime = Date.now();
    let headerDuration = 0;
    let paramDuration = 0;
    let headerTokens = { promptTokenCount: 0, candidatesTokenCount: 0 };
    let paramTokens = { promptTokenCount: 0, candidatesTokenCount: 0 };

    // ==================== PASS 1: HEADERS ONLY ====================
    console.log('[PAGE 1 TWO-PASS] Pass 1: Extracting headers...');

    const headerPrompt = `You are a medical lab report header extractor.

Extract ONLY the following header information from this lab report page:

LAB_NAME: [exact lab name from the report, or "Unknown Lab" if not in list: ${labNames}]
PATIENT_NAME: [patient's full name]
PATIENT_AGE: [age as shown, e.g., "35 Y" or "35 Years"]
PATIENT_GENDER: [male/female/other]
DATE_OF_TEST: [YYYY-MM-DD format]

RULES:
- Return ONLY these 5 fields
- Do NOT extract any test parameters
- If a field is not found, return "Not Found"

FORMAT:
LAB_NAME: <value>
PATIENT_NAME: <value>
PATIENT_AGE: <value>
PATIENT_GENDER: <value>
DATE_OF_TEST: <value>`;

    const imagePart = {
      inlineData: {
        data: pageImage,
        mimeType: 'image/png'
      }
    };

    const safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
    ];

    let headerResponse = '';
    let headerInfo = { labName: 'Unknown Lab', patientName: null, patientAge: null, patientGender: null, dateOfTest: null };

    let headerKeyInfo = null;
    try {
      const headerStartTime = Date.now();

      // Execute header extraction with rate-limit aware retry
      // This will automatically retry with next available key if rate-limited
      console.log('[QUEUE] Page=1 (header), Priority=HIGH');
      const { result: headerResult, keyInfo } = await addToQueue(async () => {
        return await this.callGeminiWithRetry(headerPrompt, imagePart, modelName, 4, requestId);
      }, { priority: PRIORITY.HIGH });
      headerKeyInfo = keyInfo;

      headerResponse = headerResult.response.text();
      headerDuration = ((Date.now() - headerStartTime) / 1000).toFixed(2);
      headerTokens = headerResult.response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };

      console.log(`[PAGE 1 TWO-PASS] Pass 1 complete: ${headerDuration}s, Key: ${headerKeyInfo?.keyName || 'N/A'}, ${headerTokens.candidatesTokenCount} output tokens`);

      // Parse header response
      headerInfo = this.parseHeaderResponse(headerResponse);
      console.log(`[PAGE 1 TWO-PASS] Headers extracted:`, JSON.stringify(headerInfo));

      if (requestId) {
        audit.logApiCall(requestId, 'PAGE1_HEADER_EXTRACTION', {
          duration: parseFloat(headerDuration),
          tokens: headerTokens.promptTokenCount + headerTokens.candidatesTokenCount,
          apiKey: headerKeyInfo ? `Key ${headerKeyInfo.keyIndex}/${headerKeyInfo.totalKeys} (${headerKeyInfo.keyName})` : 'N/A'
        });
      }
    } catch (headerError) {
      console.error(`[PAGE 1 TWO-PASS] Pass 1 FAILED: ${headerError.message}`);
      if (requestId) {
        audit.logError(requestId, 'PAGE1_HEADER_FAILED', { error: headerError.message, apiKey: headerKeyInfo?.keyName });
      }
    }

    // Small delay between calls to avoid rate limiting
    await sleep(PAGE_CALL_DELAY_MS);

    // ==================== PASS 2: PARAMETERS ONLY ====================
    console.log('[PAGE 1 TWO-PASS] Pass 2: Extracting parameters...');

    const paramPrompt = `You are a medical lab report parameter extractor.

Extract ALL test parameters from this page in this EXACT format:
TEST_NAME | VALUE | UNIT | METHOD | REF_RANGE_TEXT | REF_HIGH | REF_LOW

CRITICAL RULES:

1. MULTI-LINE REFERENCE RANGES:
   Some parameters have reference ranges spanning MULTIPLE LINES.
   - Concatenate all lines into ONE REF_RANGE_TEXT, separated by ", "
   - If MULTIPLE ranges exist (age-specific, gender-specific), set REF_HIGH and REF_LOW to "null"
   - Only populate REF_HIGH/REF_LOW if a SINGLE unambiguous numeric range applies

   Example (multiple ranges - use null):
   Total Protein | 7.02 | gm/dL | N/A | 0-7 Day: 4.6-7.0, 7Day to 1year: 4.4-7.5, 3year-Adults: 6.0-8.3 | null | null

   Example (single range - extract values):
   Glucose | 95 | mg/dL | N/A | 70-110 | 110 | 70

2. PHYSICAL EXAMINATION DATA:
   Physical exam findings ARE valid. Include Blood Pressure, Pulse, etc.
   Use "null" for REF_HIGH/REF_LOW when no numeric reference exists.

   Example:
   Blood Pressure | 110/70 | mmHg | N/A | null | null | null

3. REF_HIGH/REF_LOW AMBIGUITY:
   If the reference range is ambiguous or you're unsure which value is high vs low, use "null" for BOTH.
   It's better to leave them blank than to extract incorrect values.

4. NEVER SKIP a row with a test name and value.

5. NON-TEST PAGES:
   If this page contains ONLY terms & conditions, disclaimers, or interpretation summaries
   (no actual lab test results with values), return: NO_TEST_DATA

6. DO NOT OVER-EXTRACT FROM DESCRIPTIVE TEXT:
   For RADIOLOGY/IMAGING reports (Ultrasound, CT, MRI, X-Ray, ECG findings):
   - Each organ/finding should be ONE entry, not multiple
   - Keep the FULL descriptive text as the VALUE
   - Do NOT split descriptive findings into separate rows

   WRONG (over-extraction):
   LIVER SIZE | 12.2 | cms | N/A | null | null | null
   LIVER ECHOTEXTURE | Normal | N/A | N/A | null | null | null

   CORRECT (single entry):
   LIVER | Normal in size (12.2 cms) and echotexture with smooth contours. No focal lesions. | N/A | N/A | null | null | null

   For LABORATORY reports (CBC, LFT, KFT, etc.) each discrete test value IS a separate entry.

OUTPUT: Only pipe-separated data, one test per line. No markdown, no headers, no explanations.`;

    let paramResponse = '';
    let parameters = [];
    let paramKeyInfo = null;

    try {
      const paramStartTime = Date.now();

      // Execute parameter extraction with rate-limit aware retry
      // This will automatically retry with next available key if rate-limited
      console.log('[QUEUE] Page=1 (params), Priority=HIGH');
      const { result: paramResult, keyInfo } = await addToQueue(async () => {
        return await this.callGeminiWithRetry(paramPrompt, imagePart, modelName, 4, requestId);
      }, { priority: PRIORITY.HIGH });
      paramKeyInfo = keyInfo;

      paramResponse = paramResult.response.text();
      paramDuration = ((Date.now() - paramStartTime) / 1000).toFixed(2);
      paramTokens = paramResult.response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };

      console.log(`[PAGE 1 TWO-PASS] Pass 2 complete: ${paramDuration}s, Key: ${paramKeyInfo?.keyName || 'N/A'}, ${paramTokens.candidatesTokenCount} output tokens`);

      // Parse parameter response
      parameters = this.parseParameterResponse(paramResponse);
      console.log(`[PAGE 1 TWO-PASS] Parameters extracted: ${parameters.length}`);

      if (requestId) {
        audit.logApiCall(requestId, 'PAGE1_PARAM_EXTRACTION', {
          duration: parseFloat(paramDuration),
          tokens: paramTokens.promptTokenCount + paramTokens.candidatesTokenCount,
          parametersExtracted: parameters.length,
          apiKey: paramKeyInfo ? `Key ${paramKeyInfo.keyIndex}/${paramKeyInfo.totalKeys} (${paramKeyInfo.keyName})` : 'N/A'
        });
      }
    } catch (paramError) {
      console.error(`[PAGE 1 TWO-PASS] Pass 2 FAILED: ${paramError.message}`);
      if (requestId) {
        audit.logError(requestId, 'PAGE1_PARAM_FAILED', { error: paramError.message, apiKey: paramKeyInfo?.keyName });
      }
    }

    const totalDuration = ((Date.now() - totalStartTime) / 1000).toFixed(2);
    console.log(`[PAGE 1 TWO-PASS] ========== Complete: ${parameters.length} params in ${totalDuration}s ==========`);

    // ==================== RETURN COMBINED RESULT ====================
    return {
      headerInfo,
      results: parameters,
      rawResponse: `=== HEADERS ===\n${headerResponse}\n\n=== PARAMETERS ===\n${paramResponse}`,
      extractionMetadata: {
        method: 'two_pass',
        page: 1,
        headerDuration: parseFloat(headerDuration),
        paramDuration: parseFloat(paramDuration),
        totalDuration: parseFloat(totalDuration),
        inputTokens: (headerTokens.promptTokenCount || 0) + (paramTokens.promptTokenCount || 0),
        outputTokens: (headerTokens.candidatesTokenCount || 0) + (paramTokens.candidatesTokenCount || 0)
      }
    };
  }

  async extractFromText(text, orderId, modelName = 'gemini-2.5-flash') {
    const startTime = Date.now();
    console.log('[GEMINI] 1. ========== STARTING GEMINI EXTRACTION ==========');
    console.log('[GEMINI] 2. Order ID:', orderId);
    console.log('[GEMINI] 2a. Model:', modelName);
    console.log('[GEMINI] 3. Input text length:', text.length, 'characters');

    try {
      // Get lab configuration for lab names
      console.log('[GEMINI] 4. Fetching lab configuration from database...');
      const config = await LabConfig.getConfig();

      // Combine lab names from both labNames array and labs array
      const allLabNames = new Set([
        ...config.labNames,
        ...config.labs.map(lab => lab.name)
      ]);
      const labNames = Array.from(allLabNames).join(', ');

      console.log('[GEMINI] 5. Dynamically fetched lab names from database:', labNames);
      console.log('[GEMINI] 5a. Total unique lab names:', allLabNames.size);

      // Prepare simplified prompt for Gemini
      console.log('[GEMINI] 6. Constructing simplified prompt for Gemini 2.5 Flash...');

      const prompt = `You are a medical lab report data extraction specialist. Extract patient demographics and test results.

**IMPORTANT: First, identify the lab name from the report header/footer. The lab name should be one of these configured labs:**
${labNames}

**CRITICAL: If the lab name is NOT from the above list, return "Unknown Lab". Do not look for any other lab apart from the ones mentioned above.**

If you find the lab name from the configured list, add it as the FIRST line in this format:
LAB_NAME: [exact lab name from the report]

If not found in the configured list, add:
LAB_NAME: Unknown Lab

**EXTRACT PATIENT DEMOGRAPHICS from the report header:**
PATIENT_NAME: [patient name as shown in report]
PATIENT_AGE: [patient age as shown in report, e.g., "35 Y" or "35 Years" or "35"]
PATIENT_GENDER: [male/female/other]
DATE_OF_TEST: [date in YYYY-MM-DD format if possible]

Then extract all test parameters from this lab report and return the data in this exact format:

TEST_NAME | VALUE | UNIT | METHOD | REF_RANGE_TEXT | REF_HIGH | REF_LOW

Where:
- TEST_NAME: exact name of the test from the report
- VALUE: the test result value
- UNIT: unit of measurement (e.g., g/dL, mg/dL, %)
- METHOD: testing method used (if not present, use "N/A")
- REF_RANGE_TEXT: the complete reference range text as shown (always preserve ALL ranges)
- REF_HIGH: the upper limit number (null if multiple ranges exist OR not present)
- REF_LOW: the lower limit number (null if multiple ranges exist OR not present)

REFERENCE RANGE RULES:
- Only populate REF_HIGH/REF_LOW if a SINGLE unambiguous numeric range exists
- If MULTIPLE ranges exist (age/gender-specific), set REF_HIGH and REF_LOW to "null"

Example format:
HEMOGLOBIN | 13.5 | g/dL | Automated Cell Counter | M: 13.0-17.0, F: 12.0-15.0 | null | null
HBA1C | 5.6 | % | HPLC | Non-diabetic: <5.7, Pre-diabetic: 5.7-6.4, Diabetic: >=6.5 | null | null
GLUCOSE FASTING | 95 | mg/dL | Enzymatic | 70-110 | 110 | 70

Important:
- Extract ALL test parameters from the report
- Return ONLY the pipe-separated data, one test per line
- Do not include any explanatory text, headers, or markdown
- Use "null" (as text) for missing numeric values

Lab Report Text:
${text}`;

      console.log('[GEMINI] 7. ========== PROMPT ==========');
      console.log('[GEMINI] 8. Prompt length:', prompt.length, 'characters');
      console.log('[GEMINI] 9. First 500 chars:', prompt.substring(0, 500) + '...');

      console.log('[GEMINI] 10. ========== CALLING GEMINI API ==========');
      const apiCallStartTime = Date.now();
      console.log('[GEMINI] 11. API call started at:', new Date(apiCallStartTime).toISOString());

      // Deterministic generation config for consistent medical data extraction
      const generationConfig = {
        temperature: 0,        // ZERO randomness - fully deterministic (critical for medical accuracy)
        topP: 1,              // Consider full probability mass (but temp=0 makes this deterministic)
        topK: 1,              // Only select most likely token (ensures consistency)
        maxOutputTokens: 32768 // Increased from 8192 to support large reports (10-20 pages)
      };

      // Safety settings - allow medical terminology
      const safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ];

      console.log('[GEMINI] 11a. Generation config: temperature=0 (deterministic), topK=1, maxTokens=32768');

      // Call Gemini with specified model (with retry logic)
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig,
        safetySettings
      });

      const result = await withRetry(
        () => model.generateContent(prompt),
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          operationName: 'Gemini extractFromText API call'
        }
      );

      const apiCallEndTime = Date.now();
      const apiDuration = ((apiCallEndTime - apiCallStartTime) / 1000).toFixed(2);
      console.log('[GEMINI] 12. API call completed at:', new Date(apiCallEndTime).toISOString());
      console.log('[GEMINI] 13. ========== API CALL DURATION: ' + apiDuration + ' seconds ==========');

      const response = result.response.text();

      console.log('[GEMINI] 14. ========== GEMINI RESPONSE ==========');
      console.log('[GEMINI] 15. Response length:', response.length, 'characters');
      console.log('[GEMINI] 16. Full response:');
      console.log(response);

      console.log('[GEMINI] 17. ========== PARSING RESPONSE ==========');

      // Parse the pipe-separated response
      let labNameFromResponse = null;
      const allLines = response.trim().split('\n').filter(l => l.trim().length > 0);

      // Initialize patient demographics
      let patientName = null;
      let patientAge = null;
      let patientGender = null;
      let dateOfTest = null;

      // Check if first line is lab name
      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('LAB_NAME:')) {
        labNameFromResponse = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GEMINI] 18a. Lab name extracted from response:', labNameFromResponse);
        allLines.shift(); // Remove the lab name line
      }

      // Extract patient demographics
      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_NAME:')) {
        patientName = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GEMINI] 18b. Patient name extracted:', patientName);
        allLines.shift();
      }

      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_AGE:')) {
        patientAge = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GEMINI] 18b1. Patient age extracted:', patientAge);
        allLines.shift();
      }

      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_GENDER:')) {
        const rawGender = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        patientGender = normalizeGender(rawGender);
        console.log('[GEMINI] 18c. Patient gender extracted:', rawGender, '→ normalized:', patientGender);
        allLines.shift();
      }

      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('DATE_OF_TEST:')) {
        dateOfTest = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GEMINI] 18d. Date of test extracted:', dateOfTest);
        allLines.shift();
      }

      const lines = allLines.filter(l => l.includes('|'));
      console.log('[GEMINI] 18. Extracted', lines.length, 'parameter lines');

      // Convert pipe-separated format to JSON structure
      const results = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const parts = line.split('|').map(p => p.trim());

        if (parts.length >= 7) {
          const testName = parts[0];
          // Handle "null" string and empty values properly
          const value = parts[1] === 'null' || parts[1] === '' ? null : parts[1];
          const unit = parts[2] === 'null' || parts[2] === '' ? null : parts[2];
          const method = parts[3] === 'null' || parts[3] === '' ? null : parts[3];
          const refRangeText = parts[4];
          const refHigh = parts[5] === 'null' ? null : parseFloat(parts[5]);
          const refLow = parts[6] === 'null' ? null : parseFloat(parts[6]);

          // DEBUG: Check for NaN values after parseFloat
          if (Number.isNaN(refHigh)) {
            console.warn(`[GEMINI] DEBUG - NaN detected for refHigh in test: "${testName}"`);
            console.warn(`[GEMINI] DEBUG - Original value from parts[5]: "${parts[5]}"`);
            console.warn(`[GEMINI] DEBUG - Full line: ${line}`);
          }
          if (Number.isNaN(refLow)) {
            console.warn(`[GEMINI] DEBUG - NaN detected for refLow in test: "${testName}"`);
            console.warn(`[GEMINI] DEBUG - Original value from parts[6]: "${parts[6]}"`);
            console.warn(`[GEMINI] DEBUG - Full line: ${line}`);
          }

          results.push({
            type: 'path',
            serviceItemName: testName,
            value: value,
            unit: unit,
            method: method,
            referenceRange: {
              high: refHigh,
              low: refLow,
              referenceRange: refRangeText
            }
          });
        }
      }

      console.log('[GEMINI] 19. ✓ Successfully parsed', results.length, 'parameters');

      // Use lab name from response, or try to identify from text (fallback)
      let labName = labNameFromResponse || 'Unknown Lab';

      if (!labNameFromResponse) {
        const labNamesArray = Array.from(allLabNames);
        for (const name of labNamesArray) {
          if (text.toLowerCase().includes(name.toLowerCase())) {
            labName = name;
            break;
          }
        }
        console.log('[GEMINI] 20. Lab identified from text search:', labName);
      } else {
        console.log('[GEMINI] 20. Lab identified from Gemini response:', labName);
      }

      // Log first 3 parameters as sample
      if (results.length > 0) {
        console.log('[GEMINI] 21. ========== SAMPLE EXTRACTED PARAMETERS (first 3) ==========');
        const sampleParams = results.slice(0, 3);
        sampleParams.forEach((param, idx) => {
          console.log(`[GEMINI] 22.${idx + 1}. ${param.serviceItemName}: ${param.value} ${param.unit || ''}`);
        });
      }

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('[GEMINI] 23. ========== EXTRACTION COMPLETE ==========');
      console.log('[GEMINI] 24. Total processing time:', totalDuration, 'seconds');
      console.log('[GEMINI] 25. Successfully extracted', results.length, 'parameters from', labName);

      // Get ACTUAL token usage from Gemini API response
      const usageMetadata = result.response.usageMetadata;
      const inputTokens = usageMetadata.promptTokenCount;
      const outputTokens = usageMetadata.candidatesTokenCount;
      const totalTokens = usageMetadata.totalTokenCount;

      // Calculate actual cost with Gemini 2.5 Flash pricing
      // Input: $0.30 per 1M tokens, Output: $2.50 per 1M tokens
      const inputCost = (inputTokens * 0.30) / 1000000;
      const outputCost = (outputTokens * 2.50) / 1000000;
      const actualCost = inputCost + outputCost;

      console.log('[GEMINI] 26. ========== ACTUAL TOKEN USAGE & COST ==========');
      console.log('[GEMINI] 27. Input tokens (actual):', inputTokens);
      console.log('[GEMINI] 28. Output tokens (actual):', outputTokens);
      console.log('[GEMINI] 29. Total tokens:', totalTokens);
      console.log('[GEMINI] 30. Input cost: $' + inputCost.toFixed(6));
      console.log('[GEMINI] 31. Output cost: $' + outputCost.toFixed(6));
      console.log('[GEMINI] 32. Total cost: $' + actualCost.toFixed(6));

      // Return extracted data in same format as GPT extractor
      return {
        labName: labName,
        patientName: patientName,
        patientAge: patientAge,
        patientGender: patientGender,
        dateOfTest: dateOfTest,
        results: results,
        tokenUsage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: totalTokens,
          estimatedCost: actualCost
        }
      };

    } catch (error) {
      const errorDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error('[GEMINI] ERROR: ========== EXTRACTION FAILED ==========');
      console.error('[GEMINI] ERROR: Failed after', errorDuration, 'seconds');
      console.error('[GEMINI] ERROR: Error type:', error.constructor.name);
      console.error('[GEMINI] ERROR: Error message:', error.message);
      console.error('[GEMINI] ERROR: Stack trace:', error.stack);
      throw error;
    }
  }

  // New method for vision-based extraction using Gemini Vision
  async extractFromImages(images, orderId, modelName = 'gemini-2.5-flash') {
    const startTime = Date.now();
    console.log('[GEMINI VISION] 1. ========== STARTING GEMINI VISION EXTRACTION ==========');
    console.log('[GEMINI VISION] 2. Order ID:', orderId);
    console.log('[GEMINI VISION] 2a. Model:', modelName);
    console.log('[GEMINI VISION] 3. Number of images:', images.length);

    try {
      // Get lab configuration for lab names
      console.log('[GEMINI VISION] 4. Fetching lab configuration from database...');
      const config = await LabConfig.getConfig();

      const allLabNames = new Set([
        ...config.labNames,
        ...config.labs.map(lab => lab.name)
      ]);
      const labNames = Array.from(allLabNames).join(', ');

      console.log('[GEMINI VISION] 5. Lab names:', labNames);
      console.log('[GEMINI VISION] 6. Total unique lab names:', allLabNames.size);

      // Prepare optimized prompt for vision model
      const prompt = `You are a medical lab report data extraction specialist. Analyze these medical lab report images and extract all test parameters.

**IMPORTANT: First, identify the lab name from the report header/footer. The lab name should be one of these configured labs:**
${labNames}

**CRITICAL: If the lab name is NOT from the above list, return "Unknown Lab". Do not look for any other lab apart from the ones mentioned above.**

If you find the lab name from the configured list, add it as the FIRST line in this format:
LAB_NAME: [exact lab name from the report]

If not found in the configured list, add:
LAB_NAME: Unknown Lab

**EXTRACT PATIENT DEMOGRAPHICS from the report header:**
PATIENT_NAME: [patient name as shown in report]
PATIENT_AGE: [patient age as shown in report, e.g., "35 Y" or "35 Years" or "35"]
PATIENT_GENDER: [male/female/other]
DATE_OF_TEST: [date in YYYY-MM-DD format if possible]

Then extract all test parameters from the images and return the data in this exact format:

TEST_NAME | VALUE | UNIT | METHOD | REF_RANGE_TEXT | REF_HIGH | REF_LOW

Where:
- TEST_NAME: exact name of the test from the report
- VALUE: the test result value
- UNIT: unit of measurement (e.g., g/dL, mg/dL, %)
- METHOD: testing method used (if not present, use "N/A")
- REF_RANGE_TEXT: the complete reference range text as shown
  ⚠️ CRITICAL: Reference ranges can be LONG (up to 200 characters). Extract the COMPLETE text including ALL parts separated by commas. Do NOT truncate.
- REF_HIGH: the upper limit number (null if multiple ranges exist OR not present)
- REF_LOW: the lower limit number (null if multiple ranges exist OR not present)

REFERENCE RANGE RULES:
- ALWAYS preserve the COMPLETE REF_RANGE_TEXT
- Only populate REF_HIGH/REF_LOW if a SINGLE unambiguous numeric range applies
- If MULTIPLE ranges exist (age/gender/condition-specific), set REF_HIGH and REF_LOW to "null"

REFERENCE RANGE FORMATS (extract complete text for REF_RANGE_TEXT):
- Simple numeric: "5-9" or "5.0-9.0" → CAN extract REF_HIGH/REF_LOW
- Age-specific: "Adult: 13-17, Child: 11-16, Infant: 14-20" → use null for REF_HIGH/REF_LOW
- Gender-specific: "Male: 13-17, Female: 12-16" → use null for REF_HIGH/REF_LOW
- Categorical: "Negative: <1.0, Positive: ≥1.0" → use null for REF_HIGH/REF_LOW
- Multi-condition: "18-50 years: 0.4-4.0, >50 years: 0.5-5.0" → use null for REF_HIGH/REF_LOW
- Combined: "Adult Male: 13.5-17.5, Adult Female: 12.0-15.5" → use null for REF_HIGH/REF_LOW

Example format:
HEMOGLOBIN | 13.5 | g/dL | Automated Cell Counter | M: 13.0-17.0, F: 12.0-15.0 | null | null
HBA1C | 5.6 | % | HPLC | Non-diabetic: <5.7, Pre-diabetic: 5.7-6.4, Diabetic: >=6.5 | null | null
GLUCOSE FASTING | 95 | mg/dL | Enzymatic | 70-110 | 110 | 70

Important:
- Extract ALL test parameters from ALL pages/images
- Lab reports are in table/column format (may not have visible vertical lines between columns)
- Return ONLY the pipe-separated data, one test per line
- Do not include any explanatory text, headers, or markdown
- Use "null" (as text) for missing numeric values
- Process all images sequentially and extract complete data

**IMPORTANT - Sequential Pages and Interpretations:**
The pages in this lab report are provided in their original sequential order. You may encounter sections labeled 'Interpretation', 'Interpretations', 'Clinical Notes', or similar headers that appear in tables or text blocks throughout the report. These interpretation sections contain reference information, clinical guidance, or explanatory notes - they are NOT actual test parameter values or measured results. Do not extract data from interpretation sections as test parameters. Only extract actual measured test results with their corresponding values, units, and reference ranges.`;

      console.log('[GEMINI VISION] 7. ========== PREPARING IMAGE PARTS ==========');

      // Convert base64 images to Gemini format
      const imageParts = images.map((base64Image, idx) => {
        console.log(`[GEMINI VISION] 8.${idx + 1}. Processing image ${idx + 1} (size: ${(base64Image.length / 1024).toFixed(2)}KB)`);
        return {
          inlineData: {
            data: base64Image,
            mimeType: 'image/png'
          }
        };
      });

      console.log('[GEMINI VISION] 9. Total images prepared:', imageParts.length);
      console.log('[GEMINI VISION] 10. ========== CALLING GEMINI 2.5 FLASH VISION API ==========');

      const apiCallStartTime = Date.now();
      console.log('[GEMINI VISION] 11. API call started at:', new Date(apiCallStartTime).toISOString());

      // Deterministic generation config for consistent medical data extraction
      const generationConfig = {
        temperature: 0,        // ZERO randomness - fully deterministic (critical for medical accuracy)
        topP: 1,              // Consider full probability mass (but temp=0 makes this deterministic)
        topK: 1,              // Only select most likely token (ensures consistency)
        maxOutputTokens: 32768 // Increased from 8192 to support large reports (10-20 pages)
      };

      // Safety settings - allow medical terminology
      const safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ];

      console.log('[GEMINI VISION] 11a. Generation config: temperature=0 (deterministic), topK=1, maxTokens=32768');

      // Call Gemini with vision support and deterministic configuration
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig,
        safetySettings
      });

      // Combine prompt with all images
      const contents = [
        prompt,
        ...imageParts
      ];

      const result = await model.generateContent(contents);

      const apiCallEndTime = Date.now();
      const apiDuration = ((apiCallEndTime - apiCallStartTime) / 1000).toFixed(2);
      console.log('[GEMINI VISION] 12. API call completed at:', new Date(apiCallEndTime).toISOString());
      console.log('[GEMINI VISION] 13. ========== API CALL DURATION: ' + apiDuration + ' seconds ==========');

      const response = result.response.text();

      console.log('[GEMINI VISION] 14. ========== GEMINI RESPONSE ==========');
      console.log('[GEMINI VISION] 15. Response length:', response.length, 'characters');
      console.log('[GEMINI VISION] 16. Full response:');
      console.log(response);

      console.log('[GEMINI VISION] 17. ========== PARSING RESPONSE ==========');

      // Parse the pipe-separated response (same logic as text extraction)
      let labNameFromResponse = null;
      const allLines = response.trim().split('\n').filter(l => l.trim().length > 0);

      // Initialize patient demographics
      let patientName = null;
      let patientAge = null;
      let patientGender = null;
      let dateOfTest = null;

      // Check if first line is lab name
      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('LAB_NAME:')) {
        labNameFromResponse = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GEMINI VISION] 18a. Lab name extracted from response:', labNameFromResponse);
        allLines.shift(); // Remove the lab name line
      }

      // Extract patient demographics
      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_NAME:')) {
        patientName = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GEMINI VISION] 18b. Patient name extracted:', patientName);
        allLines.shift();
      }

      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_AGE:')) {
        patientAge = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GEMINI VISION] 18b1. Patient age extracted:', patientAge);
        allLines.shift();
      }

      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_GENDER:')) {
        const rawGender = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        patientGender = normalizeGender(rawGender);
        console.log('[GEMINI VISION] 18c. Patient gender extracted:', rawGender, '→ normalized:', patientGender);
        allLines.shift();
      }

      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('DATE_OF_TEST:')) {
        dateOfTest = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GEMINI VISION] 18d. Date of test extracted:', dateOfTest);
        allLines.shift();
      }

      const lines = allLines.filter(l => l.includes('|'));
      console.log('[GEMINI VISION] 18. Extracted', lines.length, 'parameter lines');

      // Debug: Log warning if no lines found
      if (lines.length === 0) {
        console.warn('[GEMINI VISION] WARNING: No pipe-separated lines found in response!');
        console.warn('[GEMINI VISION] WARNING: Response may not be in expected format.');
        console.warn('[GEMINI VISION] WARNING: First few remaining lines:', allLines.slice(0, 5));
      }

      const results = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const parts = line.split('|').map(p => p.trim());

        if (parts.length >= 7) {
          const testName = parts[0];
          // Handle "null" string and empty values properly
          const value = parts[1] === 'null' || parts[1] === '' ? null : parts[1];
          const unit = parts[2] === 'null' || parts[2] === '' ? null : parts[2];
          const method = parts[3] === 'null' || parts[3] === '' ? null : parts[3];
          const refRangeText = parts[4];
          const refHigh = parts[5] === 'null' ? null : parseFloat(parts[5]);
          const refLow = parts[6] === 'null' ? null : parseFloat(parts[6]);

          // DEBUG: Check for NaN values after parseFloat
          if (Number.isNaN(refHigh)) {
            console.warn(`[GEMINI] DEBUG - NaN detected for refHigh in test: "${testName}"`);
            console.warn(`[GEMINI] DEBUG - Original value from parts[5]: "${parts[5]}"`);
            console.warn(`[GEMINI] DEBUG - Full line: ${line}`);
          }
          if (Number.isNaN(refLow)) {
            console.warn(`[GEMINI] DEBUG - NaN detected for refLow in test: "${testName}"`);
            console.warn(`[GEMINI] DEBUG - Original value from parts[6]: "${parts[6]}"`);
            console.warn(`[GEMINI] DEBUG - Full line: ${line}`);
          }

          results.push({
            type: 'path',
            serviceItemName: testName,
            value: value,
            unit: unit,
            method: method,
            referenceRange: {
              high: refHigh,
              low: refLow,
              referenceRange: refRangeText
            }
          });
        }
      }

      console.log('[GEMINI VISION] 19. ✓ Successfully parsed', results.length, 'parameters');

      // Use lab name from response, or try to identify from text (fallback)
      let labName = labNameFromResponse || 'Unknown Lab';

      if (!labNameFromResponse) {
        const labNamesArray = Array.from(allLabNames);
        // Try to find lab name in the response text
        for (const name of labNamesArray) {
          if (response.toLowerCase().includes(name.toLowerCase())) {
            labName = name;
            break;
          }
        }
        console.log('[GEMINI VISION] 20. Lab identified from text search:', labName);
      } else {
        console.log('[GEMINI VISION] 20. Lab identified from Gemini response:', labName);
      }

      // Log first 3 parameters as sample
      if (results.length > 0) {
        console.log('[GEMINI VISION] 21. ========== SAMPLE EXTRACTED PARAMETERS (first 3) ==========');
        const sampleParams = results.slice(0, 3);
        sampleParams.forEach((param, idx) => {
          console.log(`[GEMINI VISION] 22.${idx + 1}. ${param.serviceItemName}: ${param.value} ${param.unit || ''}`);
        });
      }

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('[GEMINI VISION] 23. ========== EXTRACTION COMPLETE ==========');
      console.log('[GEMINI VISION] 24. Total processing time:', totalDuration, 'seconds');
      console.log('[GEMINI VISION] 25. Successfully extracted', results.length, 'parameters from', labName);

      // Get ACTUAL token usage from Gemini API response
      const usageMetadata = result.response.usageMetadata;
      const inputTokens = usageMetadata.promptTokenCount;
      const outputTokens = usageMetadata.candidatesTokenCount;
      const totalTokens = usageMetadata.totalTokenCount;

      // Calculate actual cost with Gemini 2.5 Flash Vision pricing
      // Input: $0.30 per 1M tokens (text+image+video), Output: $2.50 per 1M tokens
      const inputCost = (inputTokens * 0.30) / 1000000;
      const outputCost = (outputTokens * 2.50) / 1000000;
      const actualCost = inputCost + outputCost;

      // Calculate average tokens per image for informational purposes
      const avgTokensPerImage = Math.round(inputTokens / images.length);

      console.log('[GEMINI VISION] 26. ========== ACTUAL TOKEN USAGE & COST ==========');
      console.log('[GEMINI VISION] 27. Input tokens (actual):', inputTokens, '(' + images.length, 'images, avg', avgTokensPerImage, 'tokens/image)');
      console.log('[GEMINI VISION] 28. Output tokens (actual):', outputTokens);
      console.log('[GEMINI VISION] 29. Total tokens:', totalTokens);
      console.log('[GEMINI VISION] 30. Input cost: $' + inputCost.toFixed(6));
      console.log('[GEMINI VISION] 31. Output cost: $' + outputCost.toFixed(6));
      console.log('[GEMINI VISION] 32. Total cost: $' + actualCost.toFixed(6));
      console.log('[GEMINI VISION] 33. Cost per image: $' + (actualCost / images.length).toFixed(6));

      // Return extracted data in same format as text extractor
      return {
        labName: labName,
        patientName: patientName,
        patientAge: patientAge,
        patientGender: patientGender,
        dateOfTest: dateOfTest,
        results: results,
        tokenUsage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: totalTokens,
          estimatedCost: actualCost
        }
      };

    } catch (error) {
      const errorDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error('[GEMINI VISION] ERROR: ========== EXTRACTION FAILED ==========');
      console.error('[GEMINI VISION] ERROR: Failed after', errorDuration, 'seconds');
      console.error('[GEMINI VISION] ERROR: Error type:', error.constructor.name);
      console.error('[GEMINI VISION] ERROR: Error message:', error.message);
      console.error('[GEMINI VISION] ERROR: Stack trace:', error.stack);
      throw error;
    }
  }

  /**
   * Extract lab report data from images - PAGE BY PAGE processing
   * Each page is sent to Gemini individually for better verification
   * @param {Array<string>} images - Array of base64-encoded PNG images (one per page)
   * @param {string} orderId - Order ID for logging
   * @param {string} modelName - Gemini model to use
   * @param {string} requestId - Request ID for audit logging
   * @returns {Object} - { labName, results, pageWiseData, tokenUsage }
   */
  async extractFromImagesPageWise(images, orderId, modelName = 'gemini-2.5-flash', requestId = null) {
    const startTime = Date.now();
    console.log('[GEMINI PAGEWISE] 1. ========== STARTING PAGE-BY-PAGE EXTRACTION ==========');
    console.log('[GEMINI PAGEWISE] 2. Order ID:', orderId);
    console.log('[GEMINI PAGEWISE] 2a. Model:', modelName);
    console.log('[GEMINI PAGEWISE] 3. Total pages:', images.length);

    try {
      // Get lab configuration for lab names
      console.log('[GEMINI PAGEWISE] 4. Fetching lab configuration from database...');
      const config = await LabConfig.getConfig();

      const allLabNames = new Set([
        ...config.labNames,
        ...config.labs.map(lab => lab.name)
      ]);
      const labNames = Array.from(allLabNames).join(', ');
      console.log('[GEMINI PAGEWISE] 5. Lab names:', labNames);
      console.log('[GEMINI PAGEWISE] 5a. Total unique lab names:', allLabNames.size);

      // Build the prompt template (will be used for each page)
      const promptTemplate = `You are a medical lab report digitization system. Extract data from this lab report PAGE.

**CRITICAL LAB NAME MATCHING RULES:**
Your database contains these EXACT lab names (case-insensitive matching allowed):
${labNames}

**CRITICAL: If the lab name is NOT from the above list, return "Unknown Lab". Do not look for any other lab apart from the ones mentioned above.**

For the FIRST page only: identify and return the following header information:
LAB_NAME: [exact lab name from the report, or "Unknown Lab" if not in the list above]
PATIENT_NAME: [patient's full name from the report]
PATIENT_AGE: [patient age as shown in report, e.g., "35 Y" or "35 Years" or "35"]
PATIENT_GENDER: [male/female/other, extract from report]
DATE_OF_TEST: [date of the test in YYYY-MM-DD format if available]

Then extract all test parameters from THIS PAGE ONLY and return in this format:

TEST_NAME | VALUE | UNIT | METHOD | REF_RANGE_TEXT | REF_HIGH | REF_LOW

Important:
- Extract ONLY data visible on THIS specific page
- Return ONLY pipe-separated data, one test per line
- Do not include explanatory text or markdown
- For VALUE field: Extract the actual test result. Leave empty if no value found
- For REF_HIGH/REF_LOW only: Use "null" if no reference values exist
- For subsequent pages (not page 1), do NOT include header lines (LAB_NAME, PATIENT_NAME, etc.)

**IMPORTANT - Sequential Pages and Interpretations:**
The pages in this lab report are provided in their original sequential order. You may encounter sections labeled 'Interpretation', 'Interpretations', 'Clinical Notes', or similar headers that appear in tables or text blocks throughout the report. These interpretation sections contain reference information, clinical guidance, or explanatory notes - they are NOT actual test parameter values or measured results. Do not extract data from interpretation sections as test parameters. Only extract actual measured test results with their corresponding values, units, and reference ranges.`;

      // Process each page individually
      const pageWiseData = [];
      const allResults = [];
      let labNameGlobal = null;
      let patientNameGlobal = null;
      let patientAgeGlobal = null;
      let patientGenderGlobal = null;
      let dateOfTestGlobal = null;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCost = 0;

      console.log('[GEMINI PAGEWISE] 6. ========== PROCESSING PAGES WITH DUAL QUEUE SYSTEM ==========');
      console.log('[GEMINI PAGEWISE] 6a. PAGE1_QUEUE (concurrency 2): Page 1 header + param extraction');
      console.log('[GEMINI PAGEWISE] 6b. BULK_QUEUE (concurrency 6): Pages 2+ extraction');
      console.log('[GEMINI PAGEWISE] 6c. Page 1 uses two-pass extraction, Pages 2+ use parameter-only prompt');

      // Updated parameter prompt for Pages 2+ with multi-line ref and physical exam rules
      const parameterPromptTemplate = `You are a medical lab report parameter extractor.

Extract ALL test parameters from this page in this EXACT format:
TEST_NAME | VALUE | UNIT | METHOD | REF_RANGE_TEXT | REF_HIGH | REF_LOW

CRITICAL RULES:

1. MULTI-LINE REFERENCE RANGES:
   Some parameters have reference ranges spanning MULTIPLE LINES.
   - Concatenate all lines into ONE REF_RANGE_TEXT, separated by ", "
   - If MULTIPLE ranges exist (age-specific, gender-specific), set REF_HIGH and REF_LOW to "null"
   - Only populate REF_HIGH/REF_LOW if a SINGLE unambiguous numeric range applies

   Example (multiple ranges - use null):
   Total Protein | 7.02 | gm/dL | N/A | 0-7 Day: 4.6-7.0, 7Day to 1year: 4.4-7.5, 3year-Adults: 6.0-8.3 | null | null

   Example (single range - extract values):
   Glucose | 95 | mg/dL | N/A | 70-110 | 110 | 70

2. PHYSICAL EXAMINATION DATA:
   Physical exam findings ARE valid. Include Blood Pressure, Pulse, etc.
   Use "null" for REF_HIGH/REF_LOW when no numeric reference exists.

   Example:
   Blood Pressure | 110/70 | mmHg | N/A | null | null | null

3. REF_HIGH/REF_LOW AMBIGUITY:
   If the reference range is ambiguous or you're unsure which value is high vs low, use "null" for BOTH.
   It's better to leave them blank than to extract incorrect values.

4. NEVER SKIP a row with a test name and value.

5. NON-TEST PAGES:
   If this page contains ONLY terms & conditions, disclaimers, or interpretation summaries
   (no actual lab test results with values), return: NO_TEST_DATA

6. DO NOT OVER-EXTRACT FROM DESCRIPTIVE TEXT:
   For RADIOLOGY/IMAGING reports (Ultrasound, CT, MRI, X-Ray, ECG findings):
   - Each organ/finding should be ONE entry, not multiple
   - Keep the FULL descriptive text as the VALUE
   - Do NOT split descriptive findings into separate rows

   WRONG (over-extraction):
   LIVER SIZE | 12.2 | cms | N/A | null | null | null
   LIVER ECHOTEXTURE | Normal | N/A | N/A | null | null | null
   LIVER FOCAL LESIONS | No | N/A | N/A | null | null | null

   CORRECT (single entry):
   LIVER | Normal in size (12.2 cms) and echotexture with smooth contours. No focal lesions. | N/A | N/A | null | null | null

   For LABORATORY reports (CBC, LFT, KFT, etc.) each discrete test value IS a separate entry.

**IMPORTANT - Interpretations:**
Do not extract data from interpretation sections as test parameters.
Only extract actual measured test results with values, units, and reference ranges.

OUTPUT: Only pipe-separated data, one test per line. No markdown, no headers, no explanations.`;

      // Create array of promises for processing (controlled by global queue)
      const pagePromises = images.map((imageData, pageIdx) =>
        (async () => {
          const pageNumber = pageIdx + 1;
          const pageStartTime = Date.now();

          console.log(`[GEMINI PAGEWISE] 7.${pageNumber}. ========== PAGE ${pageNumber}/${images.length} ==========`);

          // Skip if image is undefined/null (failed conversion)
          if (!imageData || imageData.length === 0) {
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}a. ⚠️ SKIPPING: Image data is missing`);
            return null;
          }

          console.log(`[GEMINI PAGEWISE] 7.${pageNumber}a. Image size: ${(imageData.length / 1024).toFixed(2)}KB`);

          try {
            // ========== PAGE 1: USE TWO-PASS EXTRACTION ==========
            if (pageNumber === 1) {
              console.log(`[GEMINI PAGEWISE] 7.${pageNumber}b. Using TWO-PASS extraction for Page 1`);

              const page1Result = await this.extractPage1TwoPass(imageData, labNames, modelName, requestId);

              const pageDuration = ((Date.now() - pageStartTime) / 1000).toFixed(2);
              console.log(`[GEMINI PAGEWISE] 7.${pageNumber}c. Page 1 complete: ${page1Result.results.length} params in ${pageDuration}s`);

              return {
                pageNumber: 1,
                rawResponse: page1Result.rawResponse,
                results: page1Result.results,
                labName: page1Result.headerInfo.labName,
                patientName: page1Result.headerInfo.patientName,
                patientAge: page1Result.headerInfo.patientAge,
                patientGender: page1Result.headerInfo.patientGender,
                dateOfTest: page1Result.headerInfo.dateOfTest,
                extractionMetadata: {
                  ...page1Result.extractionMetadata,
                  parametersExtracted: page1Result.results.length,
                  processingTime: parseFloat(pageDuration),
                  cost: ((page1Result.extractionMetadata.inputTokens * 0.30) +
                         (page1Result.extractionMetadata.outputTokens * 2.50)) / 1000000
                },
                extractedAt: new Date()
              };
            }

            // ========== PAGES 2+: USE PARAMETER-ONLY PROMPT THROUGH QUEUE ==========
            const imagePart = {
              inlineData: {
                data: imageData,
                mimeType: 'image/png'
              }
            };

            const safetySettings = [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ];

            // Execute through priority queue with rate-limit aware retry
            // Pages 2+ use NORMAL priority, Page 1 uses HIGH priority
            console.log(`[QUEUE] Page=${pageNumber}, Priority=NORMAL`);
            let pageKeyInfo = null;
            const { result, keyInfo: pageKeyInfoResult } = await addToQueue(async () => {
              return await this.callGeminiWithRetry(parameterPromptTemplate, imagePart, modelName, 4, requestId);
            }, { priority: PRIORITY.NORMAL });
            pageKeyInfo = pageKeyInfoResult;

            const response = result.response.text();
            const pageDuration = ((Date.now() - pageStartTime) / 1000).toFixed(2);

            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}b. API call duration: ${pageDuration}s, Key: ${pageKeyInfo?.keyName || 'N/A'}`);
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}c. Response length: ${response.length} characters`);

            // Log to audit
            if (requestId) {
              audit.logApiCall(requestId, `GEMINI_PAGE_${pageNumber}`, {
                duration: parseFloat(pageDuration),
                responseLength: response.length,
                apiKey: pageKeyInfo ? `Key ${pageKeyInfo.keyIndex}/${pageKeyInfo.totalKeys} (${pageKeyInfo.keyName})` : 'N/A'
              });
            }

            // DEBUG: Log response for debugging
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}d. ========== RESPONSE FOR PAGE ${pageNumber} ==========`);
            console.log(response.substring(0, 500) + (response.length > 500 ? '...' : ''));
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}e. ========== END RESPONSE ==========`);

            // Parse parameter response using helper method
            const pageResults = this.parseParameterResponse(response);

            // Check if page explicitly returned NO_TEST_DATA (should not be retried)
            const wasNoTestData = response.trim().toUpperCase() === 'NO_TEST_DATA';

            // Get token usage
            const usageMetadata = result.response.usageMetadata;
            const inputTokens = Number(usageMetadata?.promptTokenCount) || 0;
            const outputTokens = Number(usageMetadata?.candidatesTokenCount) || 0;
            const pageCost = ((inputTokens * 0.30) + (outputTokens * 2.50)) / 1000000;

            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}f. Parameters extracted: ${pageResults.length}`);
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}g. Tokens: ${inputTokens} input, ${outputTokens} output`);

            // Log page metric to audit
            if (requestId) {
              audit.logPageMetric(requestId, pageNumber, {
                duration: parseFloat(pageDuration),
                parametersExtracted: pageResults.length,
                tokens: inputTokens + outputTokens,
                cost: pageCost
              });
            }

            // Add delay between pages for stability
            await sleep(PAGE_CALL_DELAY_MS);

            return {
              pageNumber: pageNumber,
              rawResponse: response,
              results: pageResults,
              wasNoTestData: wasNoTestData, // Track if page explicitly had no test data
              labName: null, // Only Page 1 extracts headers
              patientName: null,
              patientAge: null,
              patientGender: null,
              dateOfTest: null,
              extractionMetadata: {
                responseLength: response.length,
                parametersExtracted: pageResults.length,
                processingTime: parseFloat(pageDuration),
                inputTokens: inputTokens,
                outputTokens: outputTokens,
                cost: pageCost
              },
              extractedAt: new Date()
            };

          } catch (pageError) {
            const pageErrorDuration = ((Date.now() - pageStartTime) / 1000).toFixed(2);
            console.error(`[GEMINI PAGEWISE] 7.${pageNumber}x. ❌ ERROR processing page: ${pageError.message}`);

            // Categorize error type
            const isRateLimit =
              pageError.message.includes('429') ||
              pageError.message.includes('Too Many Requests') ||
              pageError.message.includes('RESOURCE_EXHAUSTED') ||
              pageError.message.includes('quota');

            const isNetworkError =
              pageError.message.includes('ECONNRESET') ||
              pageError.message.includes('ETIMEDOUT') ||
              pageError.message.includes('network') ||
              pageError.message.includes('socket') ||
              pageError.message.includes('fetch failed');

            const isAuthError =
              pageError.message.includes('401') ||
              pageError.message.includes('403') ||
              pageError.message.includes('API key');

            // Determine error category
            let errorCategory = 'API_ERROR';
            if (isRateLimit) {
              errorCategory = 'RATE_LIMIT';
              console.error(`[GEMINI PAGEWISE] 🚨 RATE LIMIT on page ${pageNumber}`);
            } else if (isNetworkError) {
              errorCategory = 'NETWORK_ERROR';
            } else if (isAuthError) {
              errorCategory = 'AUTH_ERROR';
            }

            // ========== SINGLE RETRY FOR NETWORK ERRORS (non-Page-1 only) ==========
            // Page 1 has its own retry logic, so we only retry pages 2+
            if (isNetworkError && pageNumber > 1) {
              console.log(`[GEMINI PAGEWISE] 7.${pageNumber}y. 🔄 Network error detected, attempting single retry after 2s...`);

              try {
                // Wait 2 seconds before retry
                await sleep(2000);

                // Retry with same prompt, callGeminiWithRetry will use next available key
                console.log(`[QUEUE] Page=${pageNumber} (network-retry), Priority=NORMAL`);
                const { result: retryResult, keyInfo: retryKeyInfo } = await addToQueue(async () => {
                  return await this.callGeminiWithRetry(parameterPromptTemplate, imagePart, modelName, 4, requestId);
                }, { priority: PRIORITY.NORMAL });

                const retryResponse = retryResult.response.text();
                const retryDuration = ((Date.now() - pageStartTime) / 1000).toFixed(2);

                console.log(`[GEMINI PAGEWISE] 7.${pageNumber}y. ✅ Network retry SUCCESS, Key: ${retryKeyInfo?.keyName || 'N/A'}`);

                // Parse the retry response
                const retryResults = this.parseParameterResponse(retryResponse);
                const wasNoTestData = retryResponse.trim().toUpperCase() === 'NO_TEST_DATA';

                // Get token usage
                const usageMetadata = retryResult.response.usageMetadata;
                const inputTokens = Number(usageMetadata?.promptTokenCount) || 0;
                const outputTokens = Number(usageMetadata?.candidatesTokenCount) || 0;
                const pageCost = ((inputTokens * 0.30) + (outputTokens * 2.50)) / 1000000;

                console.log(`[GEMINI PAGEWISE] 7.${pageNumber}y. Parameters extracted on retry: ${retryResults.length}`);

                // Log successful retry to audit
                if (requestId) {
                  audit.logInfo(requestId, 'PAGE_NETWORK_RETRY_SUCCESS', {
                    pageNumber,
                    parametersRecovered: retryResults.length,
                    apiKey: retryKeyInfo ? `Key ${retryKeyInfo.keyIndex}/${retryKeyInfo.totalKeys} (${retryKeyInfo.keyName})` : 'N/A',
                    duration: parseFloat(retryDuration)
                  });
                }

                // Return successful retry result
                return {
                  pageNumber: pageNumber,
                  rawResponse: retryResponse,
                  results: retryResults,
                  wasNoTestData: wasNoTestData,
                  labName: null,
                  patientName: null,
                  patientAge: null,
                  patientGender: null,
                  dateOfTest: null,
                  extractionMetadata: {
                    responseLength: retryResponse.length,
                    parametersExtracted: retryResults.length,
                    processingTime: parseFloat(retryDuration),
                    inputTokens: inputTokens,
                    outputTokens: outputTokens,
                    cost: pageCost,
                    wasNetworkRetry: true
                  },
                  extractedAt: new Date()
                };

              } catch (retryError) {
                console.error(`[GEMINI PAGEWISE] 7.${pageNumber}y. ❌ Network retry FAILED: ${retryError.message}`);

                // Log failed retry to audit
                if (requestId) {
                  audit.logError(requestId, 'PAGE_NETWORK_RETRY_FAILED', {
                    pageNumber,
                    originalError: pageError.message,
                    retryError: retryError.message
                  });
                }
                // Fall through to return error info below
              }
            }
            // ========== END NETWORK ERROR RETRY ==========

            // Log page error to audit
            if (requestId) {
              audit.logPageMetric(requestId, pageNumber, {
                duration: parseFloat(pageErrorDuration),
                error: pageError.message,
                context: {
                  errorCategory,
                  isRateLimit,
                  isNetworkError,
                  isAuthError,
                  model: modelName,
                  imageSize: imageData ? (imageData.length / 1024).toFixed(2) + 'KB' : 'N/A',
                  retryable: isRateLimit || isNetworkError
                }
              });
            }

            // Return error info instead of failing completely
            return {
              pageNumber: pageNumber,
              error: pageError.message,
              errorCategory,
              results: []
            };
          }
        })()
      );

      // Execute all page processing concurrently (controlled by global queue)
      console.log('[GEMINI PAGEWISE] 7. Executing page extraction via global queue...');
      let pageResultsArray = await Promise.all(pagePromises);

      // ============ QUALITY-BASED RETRY LOGIC ============
      // Check for pages with 0 parameters (Gemini API variance issue)
      // IMPORTANT: Skip pages that explicitly returned NO_TEST_DATA - they genuinely have no test data
      const totalExtractedParams = pageResultsArray.reduce((sum, r) => sum + (r?.results?.length || 0), 0);
      const pagesWithZeroParams = pageResultsArray.filter(r =>
        r && !r.error && (r.results?.length || 0) === 0 && !r.wasNoTestData
      );
      const pagesWithNoTestData = pageResultsArray.filter(r => r && r.wasNoTestData);
      const pagesWithParams = pageResultsArray.filter(r => r && (r.results?.length || 0) > 0);

      if (pagesWithNoTestData.length > 0) {
        console.log(`[GEMINI PAGEWISE] 7g. ℹ️ ${pagesWithNoTestData.length} pages returned NO_TEST_DATA (will not retry): ${pagesWithNoTestData.map(p => p.pageNumber).join(', ')}`);
      }

      // Only retry if: (1) some pages have 0 params (and didn't return NO_TEST_DATA), (2) other pages have params
      if (pagesWithZeroParams.length > 0 && pagesWithParams.length > 0 && pageResultsArray.length > 1) {
        console.log(`[GEMINI PAGEWISE] 7h. ⚠️ ${pagesWithZeroParams.length} pages extracted 0 params (excluding NO_TEST_DATA). Attempting quality-based retry...`);

        // Simplified retry prompt focused ONLY on parameter extraction
        const retryPrompt = `You are a medical lab report digitization system.

Extract ALL test parameters from this lab report page and return in this format:
TEST_NAME | VALUE | UNIT | METHOD | REF_RANGE_TEXT | REF_HIGH | REF_LOW

CRITICAL INSTRUCTIONS:
- Extract ALL test results with values visible on this page
- Include physical examination findings (Blood Pressure, Pulse Rate, etc.) with null for REF_HIGH/REF_LOW
- Include qualitative results like "Normal", "Positive", "Negative" as the VALUE
- REF_RANGE_TEXT: Always extract the COMPLETE reference range text
- REF_HIGH/REF_LOW: Only populate if a SINGLE unambiguous numeric range exists
- If MULTIPLE ranges exist (age-specific, gender-specific), set REF_HIGH and REF_LOW to "null"
- If reference range is ambiguous or you're unsure, use null for BOTH REF_HIGH and REF_LOW
- Return ONLY pipe-separated data, one test per line
- Do NOT include any explanatory text or markdown
- Do NOT return header information (LAB_NAME, PATIENT_NAME, etc.)
- NON-TEST PAGES: If this page contains ONLY terms & conditions, disclaimers, or interpretation summaries (no actual lab test results), return: NO_TEST_DATA

DO NOT OVER-EXTRACT FROM DESCRIPTIVE TEXT:
For RADIOLOGY/IMAGING reports (Ultrasound, CT, MRI, X-Ray, ECG findings):
- Each organ/finding should be ONE entry, not multiple
- Keep the FULL descriptive text as the VALUE (e.g., "Normal in size (12.2 cms) and echotexture...")
- Do NOT split into separate rows like "LIVER SIZE", "LIVER ECHOTEXTURE", etc.
For LABORATORY reports (CBC, LFT, KFT, etc.) each discrete test value IS a separate entry.

Example output:
Haemoglobin | 14.5 | gm/dL | N/A | 13-17 | 17 | 13
Blood Pressure | 110/70 | Mm/Hg | N/A | null | null | null
LIVER | Normal in size (12.2 cms) and echotexture with smooth contours. No focal lesions. | N/A | N/A | null | null | null`;

        // Process retries sequentially to avoid rate limiting
        for (const pageResult of pagesWithZeroParams) {
          const pageNumber = pageResult.pageNumber;
          const pageImage = images[pageNumber - 1]; // 0-indexed

          if (!pageImage) continue;

          console.log(`[GEMINI PAGEWISE] 7h. Retrying Page ${pageNumber} with simplified prompt...`);

          // Wait before retry
          await sleep(RETRY_INITIAL_DELAY_MS);

          try {
            const imagePart = {
              inlineData: {
                data: pageImage,
                mimeType: 'image/png'
              }
            };

            // Execute retry through priority queue based on page number
            // Page 1 uses HIGH priority, Pages 2+ use NORMAL priority
            const retryPriority = pageNumber === 1 ? PRIORITY.HIGH : PRIORITY.NORMAL;
            console.log(`[QUEUE] Page=${pageNumber} (retry), Priority=${pageNumber === 1 ? 'HIGH' : 'NORMAL'}`);
            let retryKeyInfo = null;
            const { result, keyInfo: retryKeyInfoResult } = await addToQueue(async () => {
              return await this.callGeminiWithRetry(retryPrompt, imagePart, modelName, 4, requestId);
            }, { priority: retryPriority });
            retryKeyInfo = retryKeyInfoResult;

            const response = result.response.text();

            // Parse retry response using helper
            const retryResults = this.parseParameterResponse(response);

            console.log(`[GEMINI PAGEWISE] 7i. Page ${pageNumber} retry: ${retryResults.length} params recovered, Key: ${retryKeyInfo?.keyName || 'N/A'}`);

            if (retryResults.length > 0) {
              // Update the page result with recovered data
              pageResult.results = retryResults;
              pageResult.extractionMetadata = pageResult.extractionMetadata || {};
              pageResult.extractionMetadata.parametersExtracted = retryResults.length;
              pageResult.extractionMetadata.wasRetried = true;
              pageResult.extractionMetadata.retryKey = retryKeyInfo?.keyName;

              console.log(`[GEMINI PAGEWISE] 7j. ✓ Page ${pageNumber} retry SUCCESS: ${retryResults.length} params recovered`);

              if (requestId) {
                audit.logInfo(requestId, 'PAGE_RETRY_SUCCESS', {
                  pageNumber,
                  parametersRecovered: retryResults.length,
                  apiKey: retryKeyInfo ? `Key ${retryKeyInfo.keyIndex}/${retryKeyInfo.totalKeys} (${retryKeyInfo.keyName})` : 'N/A'
                });
              }
            }

            // Wait between retries
            await sleep(RETRY_BETWEEN_DELAY_MS);

          } catch (retryError) {
            console.error(`[GEMINI PAGEWISE] 7k. Page ${pageNumber} retry FAILED: ${retryError.message}`);
            if (requestId) {
              audit.logError(requestId, 'PAGE_RETRY_FAILED', { pageNumber, error: retryError.message });
            }
          }
        }
      }
      // ============ END QUALITY-BASED RETRY LOGIC ============

      // Process results and aggregate data
      console.log('[GEMINI PAGEWISE] 8. Aggregating results from all pages...');
      for (const pageData of pageResultsArray) {
        if (!pageData) continue; // Skip null results (skipped pages)

        // Collect lab name from each page for smart fallback (will process after loop)

        // Extract patient demographics from first page
        if (pageData.pageNumber === 1) {
          if (pageData.patientName) patientNameGlobal = pageData.patientName;
          if (pageData.patientAge) patientAgeGlobal = pageData.patientAge;
          if (pageData.patientGender) patientGenderGlobal = pageData.patientGender;
          if (pageData.dateOfTest) dateOfTestGlobal = pageData.dateOfTest;
        }

        // Add to page-wise data (include labName for smart fallback)
        pageWiseData.push({
          pageNumber: pageData.pageNumber,
          rawResponse: pageData.rawResponse,
          results: pageData.results,
          labName: pageData.labName,
          extractionMetadata: pageData.extractionMetadata,
          extractedAt: pageData.extractedAt
        });

        // Add results to global array
        allResults.push(...pageData.results);

        // Aggregate token usage
        if (pageData.extractionMetadata) {
          totalInputTokens += pageData.extractionMetadata.inputTokens || 0;
          totalOutputTokens += pageData.extractionMetadata.outputTokens || 0;
          totalCost += pageData.extractionMetadata.cost || 0;
        }
      }

      // Smart Fallback: Determine lab name from all pages
      // Priority: page 1 (if valid) > first page with valid lab name > "Unknown Lab"
      const page1Data = pageWiseData.find(p => p.pageNumber === 1);
      if (page1Data?.labName && page1Data.labName !== 'Unknown Lab') {
        labNameGlobal = page1Data.labName;
        console.log('[GEMINI PAGEWISE] Lab name from page 1:', labNameGlobal);
      } else {
        // Fallback: Find first valid lab name from other pages
        for (const pageData of pageWiseData) {
          if (pageData.labName && pageData.labName !== 'Unknown Lab') {
            labNameGlobal = pageData.labName;
            console.log(`[GEMINI PAGEWISE] Lab name fallback from page ${pageData.pageNumber}:`, labNameGlobal);
            break;
          }
        }
      }

      // Final fallback if still unknown
      if (!labNameGlobal) {
        labNameGlobal = 'Unknown Lab';
        console.log('[GEMINI PAGEWISE] WARNING: No valid lab name found on any page');
      }

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      const successfulPages = pageWiseData.length;
      console.log('[GEMINI PAGEWISE] 9. ========== EXTRACTION COMPLETE ==========');
      console.log('[GEMINI PAGEWISE] 9. Total pages processed:', successfulPages, '/', images.length);
      console.log('[GEMINI PAGEWISE] 10. Total parameters extracted:', allResults.length);

      // CRITICAL WARNING if no parameters extracted
      if (allResults.length === 0) {
        console.error('[GEMINI PAGEWISE] ❌❌❌ CRITICAL ERROR: ZERO PARAMETERS EXTRACTED ❌❌❌');
        console.error('[GEMINI PAGEWISE] Despite processing', successfulPages, 'pages successfully!');
        console.error('[GEMINI PAGEWISE] Check the response format from Gemini Flash 2.5');
        console.error('[GEMINI PAGEWISE] First page raw response sample:', pageWiseData[0]?.rawResponse?.substring(0, 500));
      }

      console.log('[GEMINI PAGEWISE] 11. Total processing time:', totalDuration, 'seconds');
      console.log('[GEMINI PAGEWISE] 12. Total input tokens:', totalInputTokens);
      console.log('[GEMINI PAGEWISE] 13. Total output tokens:', totalOutputTokens);
      console.log('[GEMINI PAGEWISE] 14. Total cost: $' + totalCost.toFixed(6));
      console.log('[GEMINI PAGEWISE] 15. Avg cost per page: $' + (successfulPages > 0 ? (totalCost / successfulPages).toFixed(6) : '0.000000'));

      // Return data in enhanced format
      return {
        labName: labNameGlobal || 'Unknown Lab',
        patientName: patientNameGlobal,
        patientAge: patientAgeGlobal,
        patientGender: patientGenderGlobal,
        dateOfTest: dateOfTestGlobal,
        results: allResults,
        pageWiseData: pageWiseData,
        tokenUsage: {
          promptTokens: totalInputTokens,
          completionTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          estimatedCost: totalCost
        }
      };

    } catch (error) {
      const errorDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error('[GEMINI PAGEWISE] ERROR: Extraction failed after', errorDuration, 'seconds');
      console.error('[GEMINI PAGEWISE] ERROR:', error.message);
      console.error('[GEMINI PAGEWISE] ERROR: Stack:', error.stack);

      // Log comprehensive error to audit
      if (requestId) {
        // Categorize the error
        const isRateLimit =
          error.message.includes('429') ||
          error.message.includes('Too Many Requests') ||
          error.message.includes('RESOURCE_EXHAUSTED');

        const isConfigError =
          error.message.includes('API key') ||
          error.message.includes('configuration');

        const errorCategory = isRateLimit ? 'RATE_LIMIT' : isConfigError ? 'CONFIG_ERROR' : 'EXTRACTION_ERROR';

        audit.logError(requestId, errorCategory, error, {
          step: 'GEMINI_PAGEWISE_EXTRACTION',
          model: modelName,
          operation: 'extractFromImagesPageWise',
          code: isRateLimit ? '429' : undefined,
          retryable: isRateLimit,
          context: {
            orderId,
            totalPages: images.length,
            processingDuration: parseFloat(errorDuration)
          }
        });
      }

      throw error;
    }
  }
}

module.exports = new GeminiExtractorService();
