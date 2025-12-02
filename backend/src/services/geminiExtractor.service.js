const { GoogleGenerativeAI } = require('@google/generative-ai');
const LabConfig = require('../models/LabConfig');
const pLimit = require('p-limit');

// Helper function to normalize gender values to schema-compatible values
// Converts "M", "m", "Male", "MALE" → "male"
// Converts "F", "f", "Female", "FEMALE" → "female"
// Anything else → "other"
function normalizeGender(gender) {
  if (!gender) return null;
  const g = gender.trim().toLowerCase();
  if (g === 'm' || g === 'male') return 'male';
  if (g === 'f' || g === 'female') return 'female';
  return 'other';
}

class GeminiExtractorService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
- REF_RANGE_TEXT: the complete reference range text as shown
- REF_HIGH: the upper limit number from reference range (null if not present)
- REF_LOW: the lower limit number from reference range (null if not present)

Example format:
HEMOGLOBIN | 13.5 | g/dL | Automated Cell Counter | M: 13.0-17.0, F: 12.0-15.0 | 17.0 | 13.0
HBA1C | 5.6 | % | HPLC | Non-diabetic: <5.7, Pre-diabetic: 5.7-6.4, Diabetic: >=6.5 | 5.7 | null

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

      // Call Gemini with specified model
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig,
        safetySettings
      });
      const result = await model.generateContent(prompt);

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
- REF_HIGH: the upper limit number from reference range (null if not present)
- REF_LOW: the lower limit number from reference range (null if not present)

REFERENCE RANGE FORMATS (extract complete text for REF_RANGE_TEXT):
- Simple numeric: "5-9" or "5.0-9.0"
- Age-specific: "Adult: 13-17, Child: 11-16, Infant: 14-20"
- Gender-specific: "Male: 13-17, Female: 12-16"
- Categorical: "Negative: <1.0, Positive: ≥1.0"
- Multi-condition: "18-50 years: 0.4-4.0, >50 years: 0.5-5.0"
- Combined: "Adult Male: 13.5-17.5, Adult Female: 12.0-15.5"

Example format:
HEMOGLOBIN | 13.5 | g/dL | Automated Cell Counter | M: 13.0-17.0, F: 12.0-15.0 | 17.0 | 13.0
HBA1C | 5.6 | % | HPLC | Non-diabetic: <5.7, Pre-diabetic: 5.7-6.4, Diabetic: >=6.5 | 5.7 | null

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
   * @returns {Object} - { labName, results, pageWiseData, tokenUsage }
   */
  async extractFromImagesPageWise(images, orderId, modelName = 'gemini-2.5-flash') {
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

      console.log('[GEMINI PAGEWISE] 6. ========== PROCESSING PAGES CONCURRENTLY ==========');
      console.log('[GEMINI PAGEWISE] 6a. Concurrency limit: 15 pages at once');

      // Set up concurrency control - process max 15 pages at once
      const limit = pLimit(15);

      // Create array of promises for concurrent processing
      const pagePromises = images.map((imageData, pageIdx) =>
        limit(async () => {
          const pageNumber = pageIdx + 1;
          const pageStartTime = Date.now();

          console.log(`[GEMINI PAGEWISE] 7.${pageNumber}. ========== PAGE ${pageNumber}/${images.length} ==========`);

          // Skip if image is undefined/null (failed conversion)
          if (!imageData || imageData.length === 0) {
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}a. ⚠️ SKIPPING: Image data is missing (likely conversion failed)`);
            return null; // Return null for skipped pages
          }

          console.log(`[GEMINI PAGEWISE] 7.${pageNumber}a. Image size: ${(imageData.length / 1024).toFixed(2)}KB`);

          try {
            // Prepare image part
            const imagePart = {
              inlineData: {
                data: imageData,
                mimeType: 'image/png'
              }
            };

            // Generation config
            const generationConfig = {
              temperature: 0,
              topP: 1,
              topK: 1,
              maxOutputTokens: 8192  // Each page should need much less than full report
            };

            const safetySettings = [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ];

            const model = this.genAI.getGenerativeModel({
              model: modelName,
              generationConfig,
              safetySettings
            });

            // Call Gemini for this page
            const contents = [promptTemplate, imagePart];
            const result = await model.generateContent(contents);
            const response = result.response.text();

            const pageEndTime = Date.now();
            const pageDuration = ((pageEndTime - pageStartTime) / 1000).toFixed(2);

            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}b. API call duration: ${pageDuration}s`);
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}c. Response length: ${response.length} characters`);

            // DEBUG: Log full response for page
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}d. ========== FULL RESPONSE FOR PAGE ${pageNumber} ==========`);
            console.log(response);
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}e. ========== END RESPONSE ==========`);

            // Parse response
            const allLines = response.trim().split('\n').filter(l => l.trim().length > 0);
            let labNameFromPage = null;
            let patientNameFromPage = null;
            let patientAgeFromPage = null;
            let patientGenderFromPage = null;
            let dateOfTestFromPage = null;

            // Check for lab name (only expected on first page)
            if (pageNumber === 1 && allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('LAB_NAME:')) {
              labNameFromPage = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
              console.log(`[GEMINI PAGEWISE] 7.${pageNumber}d. Lab name: ${labNameFromPage}`);
              allLines.shift();
            }

            // Check for patient name (only expected on first page)
            if (pageNumber === 1 && allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_NAME:')) {
              patientNameFromPage = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
              console.log(`[GEMINI PAGEWISE] 7.${pageNumber}d1. Patient name: ${patientNameFromPage}`);
              allLines.shift();
            }

            // Check for patient age (only expected on first page)
            if (pageNumber === 1 && allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_AGE:')) {
              patientAgeFromPage = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
              console.log(`[GEMINI PAGEWISE] 7.${pageNumber}d1a. Patient age: ${patientAgeFromPage}`);
              allLines.shift();
            }

            // Check for patient gender (only expected on first page)
            if (pageNumber === 1 && allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_GENDER:')) {
              const rawGender = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
              patientGenderFromPage = normalizeGender(rawGender);
              console.log(`[GEMINI PAGEWISE] 7.${pageNumber}d2. Patient gender: ${rawGender} → normalized: ${patientGenderFromPage}`);
              allLines.shift();
            }

            // Check for date of test (only expected on first page)
            if (pageNumber === 1 && allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('DATE_OF_TEST:')) {
              dateOfTestFromPage = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
              console.log(`[GEMINI PAGEWISE] 7.${pageNumber}d3. Date of test: ${dateOfTestFromPage}`);
              allLines.shift();
            }

            const lines = allLines.filter(l => l.includes('|'));

            // DEBUG: Log line filtering results
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}f. Total lines after headers: ${allLines.length}`);
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}g. Lines with pipes: ${lines.length}`);
            if (lines.length === 0 && allLines.length > 0) {
              console.warn(`[GEMINI PAGEWISE] WARNING Page ${pageNumber}: No pipe-separated lines found!`);
              console.warn(`[GEMINI PAGEWISE] First 5 remaining lines:`, allLines.slice(0, 5));
            }

            const pageResults = [];

            // Debug: Log first few raw lines
            if (lines.length > 0 && pageNumber === 1) {
              console.log(`[GEMINI PAGEWISE] 7.${pageNumber}g1. First 3 raw lines for debugging:`);
              lines.slice(0, 3).forEach((line, idx) => {
                console.log(`  Line ${idx + 1}: "${line}"`);
              });
            }

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

                const resultObj = {
                  type: 'path',
                  serviceItemName: testName,
                  value: value,
                  unit: unit,
                  method: method,
                  referenceRange: {
                    high: Number.isNaN(refHigh) ? null : refHigh,
                    low: Number.isNaN(refLow) ? null : refLow,
                    referenceRange: refRangeText
                  }
                };

                pageResults.push(resultObj);
              } else {
                // DEBUG: Log lines that don't match expected format
                console.warn(`[GEMINI PAGEWISE] Page ${pageNumber} skipped line (parts.length=${parts.length}): ${line}`);
              }
            }

            // Get token usage for this page
            const usageMetadata = result.response.usageMetadata;
            const inputTokens = Number(usageMetadata?.promptTokenCount) || 0;
            const outputTokens = Number(usageMetadata?.candidatesTokenCount) || 0;
            // Calculate cost even if output is 0 (input-only cost)
            const pageCost = ((inputTokens * 0.30) + (outputTokens * 2.50)) / 1000000;

            // Validation: Check if all values are null
            if (pageResults.length > 0 && pageResults.every(r => !r.value || r.value === 'null')) {
              console.error(`[GEMINI PAGEWISE] ⚠️ WARNING Page ${pageNumber}: All ${pageResults.length} values are null/empty!`);
              console.error(`[GEMINI PAGEWISE] Sample raw lines for debugging:`, lines.slice(0, 3));
            }

            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}f. Parameters extracted: ${pageResults.length}`);
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}g. Tokens: ${inputTokens} input, ${outputTokens} output`);
            console.log(`[GEMINI PAGEWISE] 7.${pageNumber}h. Cost: $${pageCost.toFixed(6)}`);

            // Return page data (will be collected by Promise.all)
            return {
              pageNumber: pageNumber,
              rawResponse: response,
              results: pageResults,
              labName: labNameFromPage,
              patientName: patientNameFromPage,
              patientAge: patientAgeFromPage,
              patientGender: patientGenderFromPage,
              dateOfTest: dateOfTestFromPage,
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
            console.error(`[GEMINI PAGEWISE] 7.${pageNumber}x. ❌ ERROR processing page: ${pageError.message}`);
            // Return error info instead of failing completely
            return {
              pageNumber: pageNumber,
              error: pageError.message,
              results: []
            };
          }
        })
      );

      // Execute all page processing concurrently
      console.log('[GEMINI PAGEWISE] 7. Executing concurrent API calls...');
      const pageResultsArray = await Promise.all(pagePromises);

      // Process results and aggregate data
      console.log('[GEMINI PAGEWISE] 8. Aggregating results from all pages...');
      for (const pageData of pageResultsArray) {
        if (!pageData) continue; // Skip null results (skipped pages)

        // Extract lab name from first page
        if (pageData.pageNumber === 1 && pageData.labName) {
          labNameGlobal = pageData.labName;
        }

        // Extract patient demographics from first page
        if (pageData.pageNumber === 1) {
          if (pageData.patientName) patientNameGlobal = pageData.patientName;
          if (pageData.patientAge) patientAgeGlobal = pageData.patientAge;
          if (pageData.patientGender) patientGenderGlobal = pageData.patientGender;
          if (pageData.dateOfTest) dateOfTestGlobal = pageData.dateOfTest;
        }

        // Add to page-wise data
        pageWiseData.push({
          pageNumber: pageData.pageNumber,
          rawResponse: pageData.rawResponse,
          results: pageData.results,
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
      throw error;
    }
  }
}

module.exports = new GeminiExtractorService();
