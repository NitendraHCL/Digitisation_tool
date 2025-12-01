const OpenAI = require('openai');
const LabConfig = require('../models/LabConfig');
const pLimit = require('p-limit');

class GPT4oExtractorService {
  constructor() {
    this.openai = null; // Lazy-load OpenAI client only when needed
  }

  // Lazy-load OpenAI client
  getOpenAIClient() {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for GPT-4o extraction. Please set it in your environment variables.');
      }
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    return this.openai;
  }

  async extractFromImages(images, orderId) {
    const startTime = Date.now();
    console.log('[GPT-4o VISION] 1. ========== STARTING GPT-4o VISION EXTRACTION ==========');
    console.log('[GPT-4o VISION] 2. Order ID:', orderId);
    console.log('[GPT-4o VISION] 3. Number of images:', images.length);

    try {
      // Get lab configuration for lab names
      console.log('[GPT-4o VISION] 4. Fetching lab configuration from database...');
      const config = await LabConfig.getConfig();

      const allLabNames = new Set([
        ...config.labNames,
        ...config.labs.map(lab => lab.name)
      ]);
      const labNames = Array.from(allLabNames).join(', ');

      console.log('[GPT-4o VISION] 5. Lab names:', labNames);
      console.log('[GPT-4o VISION] 6. Total unique lab names:', allLabNames.size);

      // Prepare prompt (same format as Gemini for consistency)
      const prompt = `You are a medical lab report data extraction specialist. Analyze these medical lab report images and extract patient demographics and all test parameters.

**IMPORTANT: First, identify the lab name from the report header/footer. The lab name should be one of these configured labs:**
${labNames}

**CRITICAL: If the lab name is NOT from the above list, return "Unknown Lab". Do not look for any other lab apart from the ones mentioned above.**

If you find the lab name from the configured list, add it as the FIRST line in this format:
LAB_NAME: [exact lab name from the report]

If not found in the configured list, add:
LAB_NAME: Unknown Lab

**EXTRACT PATIENT DEMOGRAPHICS from the report header:**
PATIENT_NAME: [patient name as shown in report]
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
- REF_HIGH: the upper limit number from reference range (null if not present)
- REF_LOW: the lower limit number from reference range (null if not present)

Example format:
HEMOGLOBIN | 13.5 | g/dL | Automated Cell Counter | M: 13.0-17.0, F: 12.0-15.0 | 17.0 | 13.0
HBA1C | 5.6 | % | HPLC | Non-diabetic: <5.7, Pre-diabetic: 5.7-6.4, Diabetic: >=6.5 | 5.7 | null

Important:
- Extract ALL test parameters from ALL pages/images
- Return ONLY the pipe-separated data, one test per line
- Do not include any explanatory text, headers, or markdown
- Use "null" (as text) for missing numeric values
- Process all images sequentially and extract complete data

**IMPORTANT - Sequential Pages and Interpretations:**
The pages in this lab report are provided in their original sequential order. You may encounter sections labeled 'Interpretation', 'Interpretations', 'Clinical Notes', or similar headers that appear in tables or text blocks throughout the report. These interpretation sections contain reference information, clinical guidance, or explanatory notes - they are NOT actual test parameter values or measured results. Do not extract data from interpretation sections as test parameters. Only extract actual measured test results with their corresponding values, units, and reference ranges.`;

      console.log('[GPT-4o VISION] 7. ========== PREPARING IMAGE PARTS ==========');

      // Convert base64 images to OpenAI format
      const imageMessages = images.map((base64Image, idx) => {
        console.log(`[GPT-4o VISION] 8.${idx + 1}. Processing image ${idx + 1} (size: ${(base64Image.length / 1024).toFixed(2)}KB)`);
        return {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64Image}`
          }
        };
      });

      console.log('[GPT-4o VISION] 9. Total images prepared:', imageMessages.length);
      console.log('[GPT-4o VISION] 10. ========== CALLING GPT-4o VISION API ==========');

      const apiCallStartTime = Date.now();
      console.log('[GPT-4o VISION] 11. API call started at:', new Date(apiCallStartTime).toISOString());
      console.log('[GPT-4o VISION] 11a. Model config: temperature=0 (deterministic), max_tokens=4096');

      // Call GPT-4o with vision support and deterministic configuration
      const response = await this.getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              ...imageMessages
            ]
          }
        ],
        temperature: 0,        // Deterministic (zero randomness)
        max_tokens: 4096,      // Allow complete extraction
        top_p: 1,             // Deterministic
      });

      const apiCallEndTime = Date.now();
      const apiDuration = ((apiCallEndTime - apiCallStartTime) / 1000).toFixed(2);
      console.log('[GPT-4o VISION] 12. API call completed at:', new Date(apiCallEndTime).toISOString());
      console.log('[GPT-4o VISION] 13. ========== API CALL DURATION: ' + apiDuration + ' seconds ==========');

      const responseText = response.choices[0].message.content;

      console.log('[GPT-4o VISION] 14. ========== GPT-4o RESPONSE ==========');
      console.log('[GPT-4o VISION] 15. Response length:', responseText.length, 'characters');
      console.log('[GPT-4o VISION] 16. Full response:');
      console.log(responseText);

      console.log('[GPT-4o VISION] 17. ========== PARSING RESPONSE ==========');

      // Parse the pipe-separated response (same logic as Gemini)
      let labNameFromResponse = null;
      const allLines = responseText.trim().split('\n').filter(l => l.trim().length > 0);

      // Initialize patient demographics
      let patientName = null;
      let patientGender = null;
      let dateOfTest = null;

      // Check if first line is lab name
      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('LAB_NAME:')) {
        labNameFromResponse = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GPT-4o VISION] 18a. Lab name extracted from response:', labNameFromResponse);
        allLines.shift(); // Remove the lab name line
      }

      // Check for patient name
      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_NAME:')) {
        patientName = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GPT-4o VISION] 18b. Patient name extracted:', patientName);
        allLines.shift();
      }

      // Check for patient gender
      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_GENDER:')) {
        patientGender = allLines[0].substring(allLines[0].indexOf(':') + 1).trim().toLowerCase();
        console.log('[GPT-4o VISION] 18c. Patient gender extracted:', patientGender);
        allLines.shift();
      }

      // Check for date of test
      if (allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('DATE_OF_TEST:')) {
        dateOfTest = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
        console.log('[GPT-4o VISION] 18d. Date of test extracted:', dateOfTest);
        allLines.shift();
      }

      const lines = allLines.filter(l => l.includes('|'));
      console.log('[GPT-4o VISION] 18. Extracted', lines.length, 'parameter lines');

      // Debug: Log warning if no lines found
      if (lines.length === 0) {
        console.warn('[GPT-4o VISION] WARNING: No pipe-separated lines found in response!');
        console.warn('[GPT-4o VISION] WARNING: Response may not be in expected format.');
        console.warn('[GPT-4o VISION] WARNING: First few remaining lines:', allLines.slice(0, 5));
      }

      const results = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const parts = line.split('|').map(p => p.trim());

        if (parts.length >= 7) {
          const testName = parts[0];
          const value = parts[1];
          const unit = parts[2];
          const method = parts[3];
          const refRangeText = parts[4];
          const refHigh = parts[5] === 'null' ? null : parseFloat(parts[5]);
          const refLow = parts[6] === 'null' ? null : parseFloat(parts[6]);

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

      console.log('[GPT-4o VISION] 19. ✓ Successfully parsed', results.length, 'parameters');

      // Use lab name from response, or try to identify from text (fallback)
      let labName = labNameFromResponse || 'Unknown Lab';

      if (!labNameFromResponse) {
        const labNamesArray = Array.from(allLabNames);
        // Try to find lab name in the response text
        for (const name of labNamesArray) {
          if (responseText.toLowerCase().includes(name.toLowerCase())) {
            labName = name;
            break;
          }
        }
        console.log('[GPT-4o VISION] 20. Lab identified from text search:', labName);
      } else {
        console.log('[GPT-4o VISION] 20. Lab identified from GPT-4o response:', labName);
      }

      // Log first 3 parameters as sample
      if (results.length > 0) {
        console.log('[GPT-4o VISION] 21. ========== SAMPLE EXTRACTED PARAMETERS (first 3) ==========');
        const sampleParams = results.slice(0, 3);
        sampleParams.forEach((param, idx) => {
          console.log(`[GPT-4o VISION] 22.${idx + 1}. ${param.serviceItemName}: ${param.value} ${param.unit || ''}`);
        });
      }

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('[GPT-4o VISION] 23. ========== EXTRACTION COMPLETE ==========');
      console.log('[GPT-4o VISION] 24. Total processing time:', totalDuration, 'seconds');
      console.log('[GPT-4o VISION] 25. Successfully extracted', results.length, 'parameters from', labName);

      // Get token usage from GPT-4o response
      const usage = response.usage;
      const inputTokens = usage.prompt_tokens;
      const outputTokens = usage.completion_tokens;
      const totalTokens = usage.total_tokens;

      // Calculate cost with GPT-4o pricing
      // Input: $2.50 per 1M tokens, Output: $10.00 per 1M tokens
      const inputCost = (inputTokens * 2.50) / 1000000;
      const outputCost = (outputTokens * 10.00) / 1000000;
      const actualCost = inputCost + outputCost;

      // Calculate average tokens per image
      const avgTokensPerImage = Math.round(inputTokens / images.length);

      console.log('[GPT-4o VISION] 26. ========== TOKEN USAGE & COST ==========');
      console.log('[GPT-4o VISION] 27. Input tokens:', inputTokens, '(' + images.length, 'images, avg', avgTokensPerImage, 'tokens/image)');
      console.log('[GPT-4o VISION] 28. Output tokens:', outputTokens);
      console.log('[GPT-4o VISION] 29. Total tokens:', totalTokens);
      console.log('[GPT-4o VISION] 30. Input cost: $' + inputCost.toFixed(6));
      console.log('[GPT-4o VISION] 31. Output cost: $' + outputCost.toFixed(6));
      console.log('[GPT-4o VISION] 32. Total cost: $' + actualCost.toFixed(6));
      console.log('[GPT-4o VISION] 33. Cost per image: $' + (actualCost / images.length).toFixed(6));

      // Return extracted data in same format as Gemini extractor
      return {
        labName: labName,
        patientName: patientName,
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
      console.error('[GPT-4o VISION] ERROR: ========== EXTRACTION FAILED ==========');
      console.error('[GPT-4o VISION] ERROR: Failed after', errorDuration, 'seconds');
      console.error('[GPT-4o VISION] ERROR: Error type:', error.constructor.name);
      console.error('[GPT-4o VISION] ERROR: Error message:', error.message);
      console.error('[GPT-4o VISION] ERROR: Stack trace:', error.stack);
      throw error;
    }
  }

  async extractFromImagesPageWise(images, orderId, modelName = 'gpt-4o') {
    const startTime = Date.now();
    console.log('[GPT-4o PAGEWISE] 1. ========== STARTING PAGE-BY-PAGE EXTRACTION ==========');
    console.log('[GPT-4o PAGEWISE] 2. Order ID:', orderId);
    console.log('[GPT-4o PAGEWISE] 3. Model:', modelName);
    console.log('[GPT-4o PAGEWISE] 4. Total pages to process:', images.length);

    try {
      // Get lab configuration for lab names
      console.log('[GPT-4o PAGEWISE] 5. Fetching lab configuration from database...');
      const config = await LabConfig.getConfig();
      const allLabNames = new Set([
        ...config.labNames,
        ...config.labs.map(lab => lab.name)
      ]);
      const labNames = Array.from(allLabNames).join(', ');
      console.log('[GPT-4o PAGEWISE] 6. Lab names configured:', labNames);

      // Prepare the prompt for single-page extraction
      const prompt = `You are a medical lab report data extraction specialist. Analyze this medical lab report image and extract test parameters FROM THIS PAGE ONLY.

**IMPORTANT: First, identify the lab name from the report header/footer. The lab name should be one of these configured labs:**
${labNames}

**CRITICAL: If the lab name is NOT from the above list, return "Unknown Lab". Do not look for any other lab apart from the ones mentioned above.**

For the FIRST page only: identify and return the following header information:
LAB_NAME: [exact lab name from the report, or "Unknown Lab" if not in the list above]
PATIENT_NAME: [patient's full name from the report]
PATIENT_GENDER: [male/female/other, extract from report]
DATE_OF_TEST: [date of the test in YYYY-MM-DD format if available]

Then extract all test parameters from THIS PAGE ONLY and return the data in this exact format:

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
- Extract ONLY test parameters visible on THIS PAGE
- If this page has no test parameters (e.g., header page), return no pipe-separated lines
- Return ONLY the pipe-separated data, one test per line
- Do not include any explanatory text, headers, or markdown
- Use "null" (as text) for missing numeric values

**IMPORTANT - Sequential Pages and Interpretations:**
The pages in this lab report are provided in their original sequential order. You may encounter sections labeled 'Interpretation', 'Interpretations', 'Clinical Notes', or similar headers that appear in tables or text blocks throughout the report. These interpretation sections contain reference information, clinical guidance, or explanatory notes - they are NOT actual test parameter values or measured results. Do not extract data from interpretation sections as test parameters. Only extract actual measured test results with their corresponding values, units, and reference ranges.`;

      // Process pages concurrently
      const pageWiseData = [];
      const allResults = [];
      let labNameGlobal = null;
      let patientNameGlobal = null;
      let patientGenderGlobal = null;
      let dateOfTestGlobal = null;
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      let totalCost = 0;

      console.log('[GPT-4o PAGEWISE] 7. ========== PROCESSING PAGES CONCURRENTLY ==========');
      console.log('[GPT-4o PAGEWISE] 7a. Concurrency limit: 15 pages at once');

      // Set up concurrency control - process max 15 pages at once
      const limit = pLimit(15);

      // Create array of promises for concurrent processing
      const pagePromises = images.map((imageData, pageIdx) =>
        limit(async () => {
          const pageNumber = pageIdx + 1;
          const pageStartTime = Date.now();

          console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}. ========== PAGE ${pageNumber}/${images.length} ==========`);

          // Skip if image is undefined/null (failed conversion)
          if (!imageData || imageData.length === 0) {
            console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.1. ⚠️ SKIPPING: Image data is missing (likely conversion failed)`);
            return null; // Return null for skipped pages
          }

          console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.1. Processing page ${pageNumber}...`);

          try {
            // Prepare single image
            const imageMessage = {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageData}`
              }
            };

            const pagePayloadSize = imageData.length;
            console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.2. Page ${pageNumber} payload size:`, (pagePayloadSize / 1024 / 1024).toFixed(2), 'MB');

            // Call GPT-4o for THIS page only
            console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.3. Calling GPT-4o API for page ${pageNumber}...`);
            const apiCallStartTime = Date.now();

            const response = await this.getOpenAIClient().chat.completions.create({
              model: modelName,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: prompt },
                    imageMessage
                  ]
                }
              ],
              temperature: 0,
              max_tokens: 4096,
              top_p: 1
            });

            const pageDuration = ((Date.now() - apiCallStartTime) / 1000).toFixed(2);
            console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.4. Page ${pageNumber} API call completed in ${pageDuration} seconds`);

            // Parse response for this page
            const responseText = response.choices[0].message.content;
            console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.5. Page ${pageNumber} response length:`, responseText.length, 'characters');

            // Parse the pipe-separated response
            let labNameFromResponse = null;
            let patientNameFromResponse = null;
            let patientGenderFromResponse = null;
            let dateOfTestFromResponse = null;
            const allLines = responseText.trim().split('\n').filter(l => l.trim().length > 0);

            // Check if first line is lab name (only expected on first page)
            if (pageNumber === 1 && allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('LAB_NAME:')) {
              labNameFromResponse = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
              console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.6. Lab name from page ${pageNumber}:`, labNameFromResponse);
              allLines.shift();
            }

            // Check for patient name (only expected on first page)
            if (pageNumber === 1 && allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_NAME:')) {
              patientNameFromResponse = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
              console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.6a. Patient name from page ${pageNumber}:`, patientNameFromResponse);
              allLines.shift();
            }

            // Check for patient gender (only expected on first page)
            if (pageNumber === 1 && allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('PATIENT_GENDER:')) {
              patientGenderFromResponse = allLines[0].substring(allLines[0].indexOf(':') + 1).trim().toLowerCase();
              console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.6b. Patient gender from page ${pageNumber}:`, patientGenderFromResponse);
              allLines.shift();
            }

            // Check for date of test (only expected on first page)
            if (pageNumber === 1 && allLines.length > 0 && allLines[0].trim().toUpperCase().startsWith('DATE_OF_TEST:')) {
              dateOfTestFromResponse = allLines[0].substring(allLines[0].indexOf(':') + 1).trim();
              console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.6c. Date of test from page ${pageNumber}:`, dateOfTestFromResponse);
              allLines.shift();
            }

            const lines = allLines.filter(l => l.includes('|'));
            console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.7. Extracted ${lines.length} parameter lines from page ${pageNumber}`);

            const pageResults = [];
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              const parts = line.split('|').map(p => p.trim());

              if (parts.length >= 7) {
                const testName = parts[0];
                const value = parts[1];
                const unit = parts[2];
                const method = parts[3];
                const refRangeText = parts[4];
                const refHigh = parts[5] === 'null' ? null : parseFloat(parts[5]);
                const refLow = parts[6] === 'null' ? null : parseFloat(parts[6]);

                pageResults.push({
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

            // Log sample parameters from this page
            if (pageResults.length > 0) {
              console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.8. Sample parameters from page ${pageNumber}:`);
              pageResults.slice(0, 3).forEach((param, idx) => {
                console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.8.${idx + 1}. ${param.serviceItemName}: ${param.value} ${param.unit || ''}`);
              });
            }

            // Calculate token usage and cost for this page
            const usage = response.usage;
            const inputTokens = usage.prompt_tokens;
            const outputTokens = usage.completion_tokens;

            // GPT-4o pricing: $2.50 per 1M input, $10.00 per 1M output
            const pageCost = (inputTokens / 1000000) * 2.50 + (outputTokens / 1000000) * 10.00;

            console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.9. Page ${pageNumber} token usage: ${inputTokens} input + ${outputTokens} output = ${usage.total_tokens} total`);
            console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.10. Page ${pageNumber} cost: $${pageCost.toFixed(6)}`);

            const pageEndTime = Date.now();
            const totalPageDuration = ((pageEndTime - pageStartTime) / 1000).toFixed(2);
            console.log(`[GPT-4o PAGEWISE] 8.${pageNumber}.11. ✓ Page ${pageNumber} complete in ${totalPageDuration} seconds`);

            // Return page data (will be collected by Promise.all)
            return {
              pageNumber: pageNumber,
              rawResponse: responseText,
              results: pageResults,
              labName: labNameFromResponse,
              patientName: patientNameFromResponse,
              patientGender: patientGenderFromResponse,
              dateOfTest: dateOfTestFromResponse,
              extractionMetadata: {
                responseLength: responseText.length,
                parametersExtracted: pageResults.length,
                processingTime: parseFloat(pageDuration),
                inputTokens: inputTokens,
                outputTokens: outputTokens,
                cost: parseFloat(pageCost.toFixed(6))
              },
              extractedAt: new Date()
            };
          } catch (pageError) {
            console.error(`[GPT-4o PAGEWISE] 8.${pageNumber}.x. ❌ ERROR processing page: ${pageError.message}`);
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
      console.log('[GPT-4o PAGEWISE] 9. Executing concurrent API calls...');
      const pageResultsArray = await Promise.all(pagePromises);

      // Process results and aggregate data
      console.log('[GPT-4o PAGEWISE] 10. Aggregating results from all pages...');
      for (const pageData of pageResultsArray) {
        if (!pageData) continue; // Skip null results (skipped pages)

        // Extract lab name from first page
        if (pageData.pageNumber === 1 && pageData.labName) {
          labNameGlobal = pageData.labName;
        }

        // Extract patient demographics from first page
        if (pageData.pageNumber === 1) {
          if (pageData.patientName) patientNameGlobal = pageData.patientName;
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
          totalPromptTokens += pageData.extractionMetadata.inputTokens || 0;
          totalCompletionTokens += pageData.extractionMetadata.outputTokens || 0;
          totalCost += pageData.extractionMetadata.cost || 0;
        }
      }

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      const successfulPages = pageWiseData.length;
      console.log('[GPT-4o PAGEWISE] 11. ========== PAGE-BY-PAGE EXTRACTION COMPLETE ==========');
      console.log('[GPT-4o PAGEWISE] 12. Total pages processed:', successfulPages, '/', images.length);
      console.log('[GPT-4o PAGEWISE] 13. Total parameters extracted:', allResults.length);
      console.log('[GPT-4o PAGEWISE] 14. Lab identified:', labNameGlobal || 'Unknown Lab');
      console.log('[GPT-4o PAGEWISE] 15. Total processing time:', totalDuration, 'seconds');
      console.log('[GPT-4o PAGEWISE] 16. Average time per page:', (successfulPages > 0 ? (parseFloat(totalDuration) / successfulPages).toFixed(2) : '0.00'), 'seconds');
      console.log('[GPT-4o PAGEWISE] 17. ========== TOTAL TOKEN USAGE & COST ==========');
      console.log('[GPT-4o PAGEWISE] 18. Total input tokens:', totalPromptTokens);
      console.log('[GPT-4o PAGEWISE] 19. Total output tokens:', totalCompletionTokens);
      console.log('[GPT-4o PAGEWISE] 20. Total tokens:', totalPromptTokens + totalCompletionTokens);
      console.log('[GPT-4o PAGEWISE] 21. Total cost: $' + totalCost.toFixed(6));

      // Return enhanced data structure with page-wise data
      return {
        labName: labNameGlobal || 'Unknown Lab',
        patientName: patientNameGlobal,
        patientGender: patientGenderGlobal,
        dateOfTest: dateOfTestGlobal,
        results: allResults,
        pageWiseData: pageWiseData,
        tokenUsage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
          estimatedCost: totalCost
        }
      };

    } catch (error) {
      const errorDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error('[GPT-4o PAGEWISE] ERROR: ========== PAGE-BY-PAGE EXTRACTION FAILED ==========');
      console.error('[GPT-4o PAGEWISE] ERROR: Failed after', errorDuration, 'seconds');
      console.error('[GPT-4o PAGEWISE] ERROR: Error type:', error.constructor.name);
      console.error('[GPT-4o PAGEWISE] ERROR: Error message:', error.message);
      console.error('[GPT-4o PAGEWISE] ERROR: Stack trace:', error.stack);
      throw error;
    }
  }
}

module.exports = new GPT4oExtractorService();
