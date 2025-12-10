const OpenAI = require('openai');
const LabConfig = require('../models/LabConfig');

class GPTExtractorService {
  constructor() {
    this.openai = null; // Lazy-load OpenAI client only when needed
  }

  // Lazy-load OpenAI client
  getOpenAIClient() {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for GPT extraction. Please set it in your environment variables.');
      }
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 300000, // 300 seconds (5 minutes) timeout for gpt-5-nano
        maxRetries: 2, // Retry failed requests twice
      });
    }
    return this.openai;
  }

  async extractFromText(text, orderId) {
    const startTime = Date.now();
    console.log('[GPT] 1. ========== STARTING GPT EXTRACTION ==========');
    console.log('[GPT] 2. Order ID:', orderId);
    console.log('[GPT] 3. Input text length:', text.length, 'characters');

    try {
      // Get lab configuration for lab names
      console.log('[GPT] 4. Fetching lab configuration from database...');
      const config = await LabConfig.getConfig();

      // Combine lab names from both labNames array and labs array
      const allLabNames = new Set([
        ...config.labNames,
        ...config.labs.map(lab => lab.name)
      ]);
      const labNames = Array.from(allLabNames).join(', ');

      console.log('[GPT] 5. Dynamically fetched lab names from database:', labNames);
      console.log('[GPT] 5a. Total unique lab names:', allLabNames.size);

      // Prepare the prompt
      console.log('[GPT] 6. Constructing prompts for GPT-4...');
      const systemPrompt = `You are a medical lab report data extractor. Extract patient demographics and all test results from the lab report text and return them in STRICTLY VALID JSON format.

CRITICAL JSON RULES:
1. ALL strings MUST be properly escaped (use \\" for quotes, \\n for newlines)
2. Use null (not "null" or undefined) for missing numeric values
3. Numbers must be actual numbers (123.5) not strings
4. Ensure all brackets, braces, and commas are balanced
5. NO trailing commas after last array/object element
6. Validate JSON structure before returning

Important extraction rules:
1. Extract patient demographics (name, age, gender, test date) from the report header
2. Extract EXACTLY as shown in the report - do not standardize parameter names
3. Include all test parameters, values, units, methods, and reference ranges
4. Select the lab name from this list: ${labNames}
5. For reference ranges, extract both the numeric values (high/low as numbers or null) and the full text description
6. If response approaches token limit, prioritize actual test values over long comments`;

      const userPrompt = `Extract patient demographics and all lab test data from this medical report and return VALID JSON in this exact format:

{
  "labName": "Apollo Clinic",
  "patientName": "John Doe",
  "patientAge": "35 Y,2 M,5 D",
  "patientGender": "male",
  "dateOfTest": "2025-03-15",
  "results": [
    {
      "type": "path",
      "serviceItemName": "Hemoglobin",
      "value": "12.9",
      "unit": "g/dL",
      "method": "Colorimetric",
      "referenceRange": {
        "high": 15.0,
        "low": 11.0,
        "referenceRange": "11-15"
      }
    },
    {
      "type": "path",
      "serviceItemName": "Glucose (Fasting)",
      "value": "95",
      "unit": "mg/dL",
      "method": "Enzymatic",
      "referenceRange": {
        "high": 100.0,
        "low": 70.0,
        "referenceRange": "70-100"
      }
    },
    {
      "type": "path",
      "serviceItemName": "Blood Group",
      "value": "B Positive",
      "unit": "",
      "method": "Forward Grouping",
      "referenceRange": {
        "high": null,
        "low": null,
        "referenceRange": "N/A"
      }
    }
  ]
}

IMPORTANT:
- Extract patient name, age, gender, and test date from the report header
- Select labName from: ${labNames}
- Use null for missing high/low values (NOT the word "null")
- Format age as "XX Y,XX M,XX D" if available, otherwise use the format found in report
- Format gender as lowercase: "male", "female", or "other"
- Format date as "YYYY-MM-DD" if possible
- Escape special characters: Use \\" for quotes, avoid unescaped newlines
- Include ALL test parameters from the report
- Ensure JSON is VALID - check for balanced brackets and no syntax errors
- If text contains quotes or special chars, properly escape them

Lab Report Text:
${text}

Extract ALL test parameters. Return ONLY valid JSON, no additional text.`;

      console.log('[GPT] 7. ========== SYSTEM PROMPT ==========');
      console.log(systemPrompt);
      console.log('[GPT] 8. ========== USER PROMPT (first 1000 chars) ==========');
      console.log(userPrompt.substring(0, 1000) + '...');
      console.log('[GPT] 9. Total prompt length:', userPrompt.length, 'characters');

      const apiConfig = {
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_completion_tokens: 12000,
        // Note: gpt-5-nano only supports default temperature (1), cannot be customized
        response_format: { type: 'json_object' }
      };

      console.log('[GPT] 10. ========== API CONFIGURATION ==========');
      console.log('[GPT] 11. Model:', apiConfig.model);
      console.log('[GPT] 12. Max completion tokens:', apiConfig.max_completion_tokens);
      console.log('[GPT] 13. Temperature:', apiConfig.temperature);
      console.log('[GPT] 14. Response format:', apiConfig.response_format.type);
      console.log('[GPT] 15. Message count:', apiConfig.messages.length);

      console.log('[GPT] 16. ========== CALLING OPENAI API ==========');
      const apiCallStartTime = Date.now();
      console.log('[GPT] 17. API call started at:', new Date(apiCallStartTime).toISOString());

      // Call GPT-4
      const completion = await this.getOpenAIClient().chat.completions.create(apiConfig);

      const apiCallEndTime = Date.now();
      const apiDuration = ((apiCallEndTime - apiCallStartTime) / 1000).toFixed(2);
      console.log('[GPT] 18. API call completed at:', new Date(apiCallEndTime).toISOString());
      console.log('[GPT] 19. ========== API CALL DURATION: ' + apiDuration + ' seconds ==========');

      console.log('[GPT] 20. ========== OPENAI RESPONSE METADATA ==========');
      console.log('[GPT] 21. Response ID:', completion.id);
      console.log('[GPT] 22. Model used:', completion.model);
      console.log('[GPT] 23. Created at:', new Date(completion.created * 1000).toISOString());

      if (completion.usage) {
        console.log('[GPT] 24. ========== TOKEN USAGE ==========');
        console.log('[GPT] 25. Prompt tokens:', completion.usage.prompt_tokens);
        console.log('[GPT] 26. Completion tokens:', completion.usage.completion_tokens);
        console.log('[GPT] 27. Total tokens:', completion.usage.total_tokens);
        console.log('[GPT] 28. Estimated cost: $' + ((completion.usage.total_tokens / 1000) * 0.01).toFixed(4));
      }

      console.log('[GPT] 29. ========== RAW GPT RESPONSE ==========');
      const rawResponse = completion.choices[0].message.content;
      console.log('[GPT] 30. Response length:', rawResponse.length, 'characters');
      console.log('[GPT] 31. Full response:');
      console.log(rawResponse);

      console.log('[GPT] 32. ========== PARSING JSON RESPONSE ==========');

      let extractedData;
      try {
        extractedData = JSON.parse(rawResponse);
        console.log('[GPT] 33. ✓ JSON parsing successful');
      } catch (parseError) {
        console.error('[GPT] ERROR: ========== JSON PARSING FAILED ==========');
        console.error('[GPT] ERROR: Parse error:', parseError.message);
        console.error('[GPT] ERROR: Error at position:', parseError.message.match(/position (\d+)/)?.[1] || 'unknown');
        console.error('[GPT] ERROR: ========== RAW RESPONSE CAUSING ERROR ==========');
        console.error(rawResponse);
        console.error('[GPT] ERROR: ========== RESPONSE EXCERPT AROUND ERROR ==========');

        // Try to show context around the error position
        const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0');
        if (errorPos > 0) {
          const start = Math.max(0, errorPos - 200);
          const end = Math.min(rawResponse.length, errorPos + 200);
          console.error('[GPT] ERROR: Characters', start, 'to', end, ':');
          console.error(rawResponse.substring(start, end));
          console.error('[GPT] ERROR: Error position marker: ' + ' '.repeat(Math.min(200, errorPos - start)) + '^');
        }

        throw new Error(`Failed to parse GPT response as JSON: ${parseError.message}`);
      }
      console.log('[GPT] 34. Lab identified:', extractedData.labName);
      console.log('[GPT] 35. Parameters extracted:', extractedData.results?.length || 0);

      // Log first 3 parameters as sample
      if (extractedData.results && extractedData.results.length > 0) {
        console.log('[GPT] 36. ========== SAMPLE EXTRACTED PARAMETERS (first 3) ==========');
        const sampleParams = extractedData.results.slice(0, 3);
        sampleParams.forEach((param, idx) => {
          console.log(`[GPT] 37.${idx + 1}. ${param.serviceItemName}: ${param.value} ${param.unit || ''}`);
        });
      }

      // Validate the response structure
      console.log('[GPT] 38. Validating response structure...');
      if (!extractedData.labName || !Array.isArray(extractedData.results)) {
        console.error('[GPT] ERROR: Invalid response format - missing labName or results array');
        throw new Error('Invalid response format from GPT');
      }

      console.log('[GPT] 39. ✓ Response structure validation passed');

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('[GPT] 40. ========== EXTRACTION COMPLETE ==========');
      console.log('[GPT] 41. Total processing time:', totalDuration, 'seconds');
      console.log('[GPT] 42. Successfully extracted', extractedData.results.length, 'parameters from', extractedData.labName);

      // Return extracted data along with token usage information
      return {
        ...extractedData,
        tokenUsage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
          estimatedCost: (completion.usage.total_tokens / 1000) * 0.01
        } : null
      };

    } catch (error) {
      const errorDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error('[GPT] ERROR: ========== EXTRACTION FAILED ==========');
      console.error('[GPT] ERROR: Failed after', errorDuration, 'seconds');
      console.error('[GPT] ERROR: Error type:', error.constructor.name);
      console.error('[GPT] ERROR: Error message:', error.message);

      // Check if it's an OpenAI API error
      if (error.response) {
        console.error('[GPT] ERROR: ========== OPENAI API ERROR ==========');
        console.error('[GPT] ERROR: Status:', error.response.status);
        console.error('[GPT] ERROR: Response data:', JSON.stringify(error.response.data, null, 2));
        throw new Error(`OpenAI API Error: ${error.response.data.error?.message || 'Unknown error'}`);
      }

      console.error('[GPT] ERROR: Stack trace:', error.stack);
      throw error;
    }
  }

  async extractFromImages(images, orderId, modelName = 'gpt-4o') {
    console.log('[GPT EXTRACTOR] Starting extraction for order:', orderId);
    console.log('[GPT EXTRACTOR] Model:', modelName);
    console.log('[GPT EXTRACTOR] Processing', images.length, 'pages');

    try {
      // Get lab configuration for lab names
      console.log('[GPT VISION] Fetching lab configuration from database...');
      const config = await LabConfig.getConfig();

      // Combine lab names from both labNames array and labs array
      const allLabNames = new Set([
        ...config.labNames,
        ...config.labs.map(lab => lab.name)
      ]);
      const labNames = Array.from(allLabNames).join(', ');

      console.log('[GPT VISION] Dynamically fetched lab names:', labNames);
      console.log('[GPT VISION] Total unique lab names:', allLabNames.size);

      // Prepare the prompt
      const systemPrompt = `You are a medical lab report data extractor. Extract all test results from the lab report images and return them in STRICTLY VALID JSON format.

CRITICAL JSON RULES:
1. ALL strings MUST be properly escaped (use \\" for quotes, \\n for newlines)
2. Use null (not "null" or undefined) for missing numeric values
3. Numbers must be actual numbers (123.5) not strings
4. Ensure all brackets, braces, and commas are balanced
5. NO trailing commas after last array/object element
6. Validate JSON structure before returning

Important extraction rules:
1. Extract EXACTLY as shown in the report - do not standardize parameter names
2. Include all test parameters, values, units, methods, and reference ranges
3. Select the lab name from this list: ${labNames}
4. For reference ranges, extract both the numeric values (high/low as numbers or null) and the full text description
5. If response approaches token limit, prioritize actual test values over long comments`;

      const userPrompt = `Extract all lab test data from these medical report images and return VALID JSON in this exact format:

{
  "labName": "Apollo Clinic",
  "results": [
    {
      "type": "path",
      "serviceItemName": "Hemoglobin",
      "value": "12.9",
      "unit": "g/dL",
      "method": "Colorimetric",
      "referenceRange": {
        "high": 15.0,
        "low": 11.0,
        "referenceRange": "11-15"
      }
    },
    {
      "type": "path",
      "serviceItemName": "Blood Group",
      "value": "B Positive",
      "unit": "",
      "method": "Forward Grouping",
      "referenceRange": {
        "high": null,
        "low": null,
        "referenceRange": "N/A"
      }
    }
  ]
}

IMPORTANT:
- Select labName from: ${labNames}
- Use null for missing high/low values (NOT the word "null")
- Escape special characters: Use \\" for quotes, avoid unescaped newlines
- Include ALL test parameters from all pages
- Ensure JSON is VALID - check for balanced brackets and no syntax errors

**IMPORTANT - Sequential Pages and Interpretations:**
The pages in this lab report are provided in their original sequential order. You may encounter sections labeled 'Interpretation', 'Interpretations', 'Clinical Notes', or similar headers that appear in tables or text blocks throughout the report. These interpretation sections contain reference information, clinical guidance, or explanatory notes - they are NOT actual test parameter values or measured results. Do not extract data from interpretation sections as test parameters. Only extract actual measured test results with their corresponding values, units, and reference ranges.

Extract ALL test parameters. Return ONLY valid JSON, no additional text.`;

      // Prepare images for GPT-4 Vision
      const imageContents = images.map(base64Image => ({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${base64Image}`,
          detail: 'high'
        }
      }));

      // Calculate total payload size before API call
      const payloadSize = JSON.stringify(imageContents).length;
      console.log('[GPT VISION] Total payload size:', (payloadSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('[GPT VISION] Calling OpenAI Vision API with model:', modelName);
      const apiCallStartTime = Date.now();

      // Call GPT Vision with specified model
      const completion = await this.getOpenAIClient().chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              ...imageContents
            ]
          }
        ],
        max_completion_tokens: 16384,
        response_format: { type: 'json_object' }
      });

      const apiDuration = ((Date.now() - apiCallStartTime) / 1000).toFixed(2);
      console.log('[GPT VISION] API call duration:', apiDuration, 'seconds');

      const rawResponse = completion.choices[0].message.content;
      console.log('[GPT VISION] Response length:', rawResponse.length, 'characters');
      console.log('[GPT VISION] Parsing JSON response...');

      let extractedData;
      try {
        extractedData = JSON.parse(rawResponse);
        console.log('[GPT VISION] ✓ JSON parsing successful');
      } catch (parseError) {
        console.error('[GPT VISION] ERROR: JSON PARSING FAILED');
        console.error('[GPT VISION] ERROR: Parse error:', parseError.message);
        console.error('[GPT VISION] ERROR: RAW RESPONSE:');
        console.error(rawResponse);

        const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0');
        if (errorPos > 0) {
          const start = Math.max(0, errorPos - 200);
          const end = Math.min(rawResponse.length, errorPos + 200);
          console.error('[GPT VISION] ERROR: Context around error (chars', start, 'to', end, '):');
          console.error(rawResponse.substring(start, end));
        }

        throw new Error(`Failed to parse GPT Vision response as JSON: ${parseError.message}`);
      }

      console.log('[GPT EXTRACTOR] Successfully extracted data');
      console.log('[GPT EXTRACTOR] Lab identified:', extractedData.labName);
      console.log('[GPT EXTRACTOR] Parameters extracted:', extractedData.results?.length || 0);

      // Validate the response structure
      if (!extractedData.labName || !Array.isArray(extractedData.results)) {
        throw new Error('Invalid response format from GPT');
      }

      // Return extracted data along with token usage information
      return {
        ...extractedData,
        tokenUsage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
          estimatedCost: (completion.usage.total_tokens / 1000) * 0.01
        } : null
      };

    } catch (error) {
      console.error('[GPT EXTRACTOR] Extraction error:', error);

      // Check if it's an OpenAI API error
      if (error.response) {
        console.error('[GPT EXTRACTOR] OpenAI API Error:', error.response.data);
        throw new Error(`OpenAI API Error: ${error.response.data.error?.message || 'Unknown error'}`);
      }

      throw error;
    }
  }

  async extractFromPDF(pdfPath, orderId) {
    const startTime = Date.now();
    const fs = require('fs');
    // execSync removed - using pdf-parse instead to prevent command injection

    console.log('[GPT PDF] 1. ========== STARTING PDF EXTRACTION ==========');
    console.log('[GPT PDF] 2. Order ID:', orderId);
    console.log('[GPT PDF] 3. PDF Path:', pdfPath);

    try {
      // Check if file exists
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found at path: ${pdfPath}`);
      }

      // Get file stats
      const stats = fs.statSync(pdfPath);
      const fileSizeInBytes = stats.size;
      const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

      console.log('[GPT PDF] 4. PDF file size:', fileSizeInMB, 'MB');

      // Validate file size (OpenAI limit is 32MB)
      const MAX_FILE_SIZE_MB = 32;
      if (fileSizeInBytes > MAX_FILE_SIZE_MB * 1024 * 1024) {
        throw new Error(`PDF file size (${fileSizeInMB}MB) exceeds OpenAI limit of ${MAX_FILE_SIZE_MB}MB. Please use a smaller PDF or try the 'hybrid' extraction method.`);
      }

      // Get page count using pdf-parse (safer than execSync)
      console.log('[GPT PDF] 5. Checking PDF page count...');
      let pageCount;
      try {
        // Use pdf-parse library instead of execSync to avoid command injection
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(pdfPath);
        const pdfData = await pdfParse(dataBuffer);
        pageCount = pdfData.numpages;
        console.log('[GPT PDF] 6. PDF has', pageCount, 'pages');
      } catch (error) {
        console.warn('[GPT PDF] 6. Warning: Could not determine page count, proceeding anyway');
        pageCount = null;
      }

      // Validate page count (OpenAI limit is 100 pages)
      const MAX_PAGES = 100;
      if (pageCount && pageCount > MAX_PAGES) {
        throw new Error(`PDF has ${pageCount} pages, exceeding OpenAI limit of ${MAX_PAGES} pages. Please split the PDF or try the 'hybrid' extraction method.`);
      }

      // Get lab configuration for lab names
      console.log('[GPT PDF] 7. Fetching lab configuration from database...');
      const config = await LabConfig.getConfig();
      const allLabNames = new Set([
        ...config.labNames,
        ...config.labs.map(lab => lab.name)
      ]);
      const labNames = Array.from(allLabNames).join(', ');
      console.log('[GPT PDF] 8. Lab names:', labNames);

      // Read PDF file
      console.log('[GPT PDF] 9. Reading PDF file...');
      const pdfBuffer = fs.readFileSync(pdfPath);

      // Upload PDF to OpenAI Files API
      console.log('[GPT PDF] 10. ========== UPLOADING PDF TO OPENAI ==========');
      const uploadStartTime = Date.now();

      const file = await this.getOpenAIClient().files.create({
        file: fs.createReadStream(pdfPath),
        purpose: 'assistants'
      });

      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      console.log('[GPT PDF] 11. ✓ PDF uploaded successfully');
      console.log('[GPT PDF] 12. File ID:', file.id);
      console.log('[GPT PDF] 13. Upload duration:', uploadDuration, 'seconds');

      // Prepare prompts (same as extractFromText)
      console.log('[GPT PDF] 14. Constructing prompts for GPT-4...');
      const systemPrompt = `You are a medical lab report data extractor. Extract all test results from the lab report PDF and return them in STRICTLY VALID JSON format.

CRITICAL JSON RULES:
1. ALL strings MUST be properly escaped (use \\" for quotes, \\n for newlines)
2. Use null (not "null" or undefined) for missing numeric values
3. Numbers must be actual numbers (123.5) not strings
4. Ensure all brackets, braces, and commas are balanced
5. NO trailing commas after last array/object element
6. Validate JSON structure before returning

Important extraction rules:
1. Extract EXACTLY as shown in the report - do not standardize parameter names
2. Include all test parameters, values, units, methods, and reference ranges
3. Select the lab name from this list: ${labNames}
4. For reference ranges, extract both the numeric values (high/low as numbers or null) and the full text description
5. If response approaches token limit, prioritize actual test values over long comments`;

      const userPrompt = `Extract all lab test data from this medical report PDF and return VALID JSON in this exact format:

{
  "labName": "Apollo Clinic",
  "results": [
    {
      "type": "path",
      "serviceItemName": "Hemoglobin",
      "value": "12.9",
      "unit": "g/dL",
      "method": "Colorimetric",
      "referenceRange": {
        "high": 15.0,
        "low": 11.0,
        "referenceRange": "11-15"
      }
    }
  ]
}

IMPORTANT:
- Select labName from: ${labNames}
- Use null for missing high/low values (NOT the word "null")
- Escape special characters: Use \\" for quotes, avoid unescaped newlines
- Include ALL test parameters from the report
- Ensure JSON is VALID - check for balanced brackets and no syntax errors

Extract ALL test parameters. Return ONLY valid JSON, no additional text.`;

      // Call GPT-5 Nano with PDF file
      console.log('[GPT PDF] 15. ========== CALLING OPENAI API WITH PDF ==========');
      const apiCallStartTime = Date.now();

      const completion = await this.getOpenAIClient().chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt
              },
              {
                type: 'file',
                file: {
                  file_id: file.id
                }
              }
            ]
          }
        ],
        max_completion_tokens: 12000,
        // Note: gpt-5-nano only supports default temperature (1), cannot be customized
        response_format: { type: 'json_object' }
      });

      const apiDuration = ((Date.now() - apiCallStartTime) / 1000).toFixed(2);
      console.log('[GPT PDF] 16. ✓ API call completed in', apiDuration, 'seconds');
      console.log('[GPT PDF] 17. API response time breakdown: Total call time includes network + processing');

      // Clean up: Delete the uploaded file from OpenAI
      console.log('[GPT PDF] 17. Cleaning up uploaded file...');
      try {
        await this.getOpenAIClient().files.del(file.id);
        console.log('[GPT PDF] 18. ✓ File deleted from OpenAI');
      } catch (cleanupError) {
        console.warn('[GPT PDF] 18. Warning: Failed to delete file from OpenAI:', cleanupError.message);
      }

      // Log token usage
      if (completion.usage) {
        console.log('[GPT PDF] 19. ========== TOKEN USAGE ==========');
        console.log('[GPT PDF] 20. Prompt tokens:', completion.usage.prompt_tokens);
        console.log('[GPT PDF] 21. Completion tokens:', completion.usage.completion_tokens);
        console.log('[GPT PDF] 22. Total tokens:', completion.usage.total_tokens);

        const estimatedCost = (completion.usage.total_tokens / 1000) * 0.01;
        console.log('[GPT PDF] 23. Estimated cost: $' + estimatedCost.toFixed(4));
      }

      // Parse response
      const responseText = completion.choices[0].message.content;
      console.log('[GPT PDF] 24. ========== GPT RESPONSE ==========');
      console.log('[GPT PDF] 25. Response length:', responseText.length, 'characters');
      console.log('[GPT PDF] 26. First 500 chars:', responseText.substring(0, 500));

      let extractedData;
      try {
        extractedData = JSON.parse(responseText);
        console.log('[GPT PDF] 27. ✓ JSON parsing successful');
      } catch (parseError) {
        console.error('[GPT PDF] 27. ✗ JSON parsing failed:', parseError.message);
        console.error('[GPT PDF] 28. Raw response:', responseText);
        throw new Error(`Failed to parse GPT response as JSON: ${parseError.message}`);
      }

      // Validate response structure
      if (!extractedData.labName || !Array.isArray(extractedData.results)) {
        throw new Error('Invalid response format from GPT - missing labName or results array');
      }

      console.log('[GPT PDF] 29. ✓ Response validation successful');
      console.log('[GPT PDF] 30. Lab identified:', extractedData.labName);
      console.log('[GPT PDF] 31. Parameters extracted:', extractedData.results.length);

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('[GPT PDF] 32. ========== EXTRACTION COMPLETE ==========');
      console.log('[GPT PDF] 33. Total processing time:', totalDuration, 'seconds');

      // Return extracted data along with token usage information and page count
      return {
        ...extractedData,
        pageCount: pageCount,
        tokenUsage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
          estimatedCost: (completion.usage.total_tokens / 1000) * 0.01
        } : null
      };

    } catch (error) {
      console.error('[GPT PDF] ========================================');
      console.error('[GPT PDF] ❌ PDF EXTRACTION FAILED');
      console.error('[GPT PDF] ========================================');
      console.error('[GPT PDF] Error type:', error.constructor.name);
      console.error('[GPT PDF] Error message:', error.message);
      console.error('[GPT PDF] Error stack:', error.stack);
      throw error;
    }
  }

  async extractFromImagesPageWise(images, orderId, modelName = 'gpt-4o') {
    const startTime = Date.now();
    console.log('[GPT PAGEWISE] 1. ========== STARTING PAGE-BY-PAGE EXTRACTION ==========');
    console.log('[GPT PAGEWISE] 2. Order ID:', orderId);
    console.log('[GPT PAGEWISE] 3. Model:', modelName);
    console.log('[GPT PAGEWISE] 4. Total pages to process:', images.length);

    try {
      // Get lab configuration for lab names
      console.log('[GPT PAGEWISE] 5. Fetching lab configuration from database...');
      const config = await LabConfig.getConfig();
      const allLabNames = new Set([
        ...config.labNames,
        ...config.labs.map(lab => lab.name)
      ]);
      const labNames = Array.from(allLabNames).join(', ');
      console.log('[GPT PAGEWISE] 6. Lab names configured:', labNames);

      // Prepare the prompts for single-page extraction
      const systemPrompt = `You are a medical lab report data extractor. Extract all test results from the lab report image and return them in STRICTLY VALID JSON format.

CRITICAL JSON RULES:
1. ALL strings MUST be properly escaped (use \\" for quotes, \\n for newlines)
2. Use null (not "null" or undefined) for missing numeric values
3. Numbers must be actual numbers (123.5) not strings
4. Ensure all brackets, braces, and commas are balanced
5. NO trailing commas after last array/object element
6. Validate JSON structure before returning

Important extraction rules:
1. Extract EXACTLY as shown in the report - do not standardize parameter names
2. Include all test parameters, values, units, methods, and reference ranges FROM THIS PAGE ONLY
3. Select the lab name from this list: ${labNames}
4. For reference ranges, extract both the numeric values (high/low as numbers or null) and the full text description
5. If the page has no test parameters (e.g., header page), return empty results array`;

      const userPrompt = `Extract all lab test data from this medical report image and return VALID JSON in this exact format:

{
  "labName": "Apollo Clinic",
  "results": [
    {
      "type": "path",
      "serviceItemName": "Hemoglobin",
      "value": "12.9",
      "unit": "g/dL",
      "method": "Colorimetric",
      "referenceRange": {
        "high": 15.0,
        "low": 11.0,
        "referenceRange": "11-15"
      }
    }
  ]
}

IMPORTANT:
- Select labName from: ${labNames}
- Use null for missing high/low values (NOT the word "null")
- Extract ONLY the parameters visible on THIS page
- If this page has no test parameters, return empty array: {"labName": "Lab Name", "results": []}
- Ensure JSON is VALID - check for balanced brackets and no syntax errors

**IMPORTANT - Sequential Pages and Interpretations:**
The pages in this lab report are provided in their original sequential order. You may encounter sections labeled 'Interpretation', 'Interpretations', 'Clinical Notes', or similar headers that appear in tables or text blocks throughout the report. These interpretation sections contain reference information, clinical guidance, or explanatory notes - they are NOT actual test parameter values or measured results. Do not extract data from interpretation sections as test parameters. Only extract actual measured test results with their corresponding values, units, and reference ranges.

Extract ALL test parameters from THIS PAGE. Return ONLY valid JSON, no additional text.`;

      // Process each page individually
      const pageWiseData = [];
      const allResults = [];
      let labNameGlobal = null;
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      let totalCost = 0;

      for (let pageIdx = 0; pageIdx < images.length; pageIdx++) {
        const pageNumber = pageIdx + 1;
        const pageStartTime = Date.now();

        console.log(`[GPT PAGEWISE] 7.${pageNumber}. ========== PAGE ${pageNumber}/${images.length} ==========`);

        // Skip if image is undefined/null (failed conversion)
        if (!images[pageIdx] || images[pageIdx].length === 0) {
          console.log(`[GPT PAGEWISE] 7.${pageNumber}.1. ⚠️ SKIPPING: Image data is missing (likely conversion failed)`);
          continue;
        }

        console.log(`[GPT PAGEWISE] 7.${pageNumber}.1. Processing page ${pageNumber}...`);

        try {
          // Prepare single image
          const imageContent = {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${images[pageIdx]}`,
              detail: 'high'
            }
          };

          // Calculate page payload size
          const pagePayloadSize = images[pageIdx].length;
          console.log(`[GPT PAGEWISE] 7.${pageNumber}.2. Page ${pageNumber} payload size:`, (pagePayloadSize / 1024 / 1024).toFixed(2), 'MB');

          // Call GPT Vision for THIS page only
          console.log(`[GPT PAGEWISE] 7.${pageNumber}.3. Calling OpenAI API for page ${pageNumber}...`);
          const apiCallStartTime = Date.now();

          const completion = await this.getOpenAIClient().chat.completions.create({
          model: modelName,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                imageContent
              ]
            }
          ],
          max_completion_tokens: 8192, // Sufficient for single page
          response_format: { type: 'json_object' }
        });

        const pageDuration = ((Date.now() - apiCallStartTime) / 1000).toFixed(2);
        console.log(`[GPT PAGEWISE] 7.${pageNumber}.4. Page ${pageNumber} API call completed in ${pageDuration} seconds`);

        // Parse response for this page
        const rawResponse = completion.choices[0].message.content;
        console.log(`[GPT PAGEWISE] 7.${pageNumber}.5. Page ${pageNumber} response length:`, rawResponse.length, 'characters');

        let pageData;
        try {
          pageData = JSON.parse(rawResponse);
          console.log(`[GPT PAGEWISE] 7.${pageNumber}.6. ✓ Page ${pageNumber} JSON parsing successful`);
        } catch (parseError) {
          console.error(`[GPT PAGEWISE] 7.${pageNumber}.6. ✗ Page ${pageNumber} JSON parsing failed:`, parseError.message);
          console.error(`[GPT PAGEWISE] 7.${pageNumber}.7. Raw response:`, rawResponse.substring(0, 500));

          // Store error info for this page
          pageWiseData.push({
            pageNumber: pageNumber,
            rawResponse: rawResponse,
            results: [],
            extractionMetadata: {
              responseLength: rawResponse.length,
              parametersExtracted: 0,
              processingTime: parseFloat(pageDuration),
              inputTokens: completion.usage?.prompt_tokens || 0,
              outputTokens: completion.usage?.completion_tokens || 0,
              cost: 0,
              error: `JSON parsing failed: ${parseError.message}`
            },
            extractedAt: new Date()
          });
          continue;
        }

        // Validate page data structure
        if (!pageData.labName || !Array.isArray(pageData.results)) {
          console.error(`[GPT PAGEWISE] 7.${pageNumber}.7. ✗ Invalid response format for page ${pageNumber}`);
          pageWiseData.push({
            pageNumber: pageNumber,
            rawResponse: rawResponse,
            results: [],
            extractionMetadata: {
              responseLength: rawResponse.length,
              parametersExtracted: 0,
              processingTime: parseFloat(pageDuration),
              inputTokens: completion.usage?.prompt_tokens || 0,
              outputTokens: completion.usage?.completion_tokens || 0,
              cost: 0,
              error: 'Invalid response format - missing labName or results array'
            },
            extractedAt: new Date()
          });
          continue;
        }

        // Store lab name from first page
        if (!labNameGlobal && pageData.labName) {
          labNameGlobal = pageData.labName;
          console.log(`[GPT PAGEWISE] 7.${pageNumber}.7. Lab identified:`, labNameGlobal);
        }

        const pageResults = pageData.results || [];
        console.log(`[GPT PAGEWISE] 7.${pageNumber}.8. Parameters extracted from page ${pageNumber}:`, pageResults.length);

        // Log sample parameters from this page
        if (pageResults.length > 0) {
          console.log(`[GPT PAGEWISE] 7.${pageNumber}.9. Sample parameters from page ${pageNumber}:`);
          pageResults.slice(0, 3).forEach((param, idx) => {
            console.log(`[GPT PAGEWISE] 7.${pageNumber}.9.${idx + 1}. ${param.serviceItemName}: ${param.value} ${param.unit || ''}`);
          });
        }

        // Calculate token usage and cost for this page
        const inputTokens = completion.usage?.prompt_tokens || 0;
        const outputTokens = completion.usage?.completion_tokens || 0;

        // GPT-4o pricing: $2.50 per 1M input tokens, $10 per 1M output tokens
        const pageCost = (inputTokens / 1000000) * 2.50 + (outputTokens / 1000000) * 10;

        totalPromptTokens += inputTokens;
        totalCompletionTokens += outputTokens;
        totalCost += pageCost;

        console.log(`[GPT PAGEWISE] 7.${pageNumber}.10. Page ${pageNumber} token usage: ${inputTokens} input + ${outputTokens} output = ${inputTokens + outputTokens} total`);
        console.log(`[GPT PAGEWISE] 7.${pageNumber}.11. Page ${pageNumber} cost: $${pageCost.toFixed(4)}`);

        // Store page-wise data
        pageWiseData.push({
          pageNumber: pageNumber,
          rawResponse: rawResponse,
          results: pageResults,
          extractionMetadata: {
            responseLength: rawResponse.length,
            parametersExtracted: pageResults.length,
            processingTime: parseFloat(pageDuration),
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            cost: parseFloat(pageCost.toFixed(6))
          },
          extractedAt: new Date()
        });

          // Add results to global results array
          allResults.push(...pageResults);

          const pageEndTime = Date.now();
          const totalPageDuration = ((pageEndTime - pageStartTime) / 1000).toFixed(2);
          console.log(`[GPT PAGEWISE] 7.${pageNumber}.12. ✓ Page ${pageNumber} complete in ${totalPageDuration} seconds (total with overhead)`);
          console.log(`[GPT PAGEWISE] 7.${pageNumber}.13. Running total: ${allResults.length} parameters extracted so far`);
        } catch (pageError) {
          console.error(`[GPT PAGEWISE] 7.${pageNumber}.x. ❌ ERROR processing page: ${pageError.message}`);
          // Continue with next page instead of failing completely
          continue;
        }
      }

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      const successfulPages = pageWiseData.length;
      console.log('[GPT PAGEWISE] 8. ========== PAGE-BY-PAGE EXTRACTION COMPLETE ==========');
      console.log('[GPT PAGEWISE] 9. Total pages processed:', successfulPages, '/', images.length);
      console.log('[GPT PAGEWISE] 10. Total parameters extracted:', allResults.length);
      console.log('[GPT PAGEWISE] 11. Lab identified:', labNameGlobal || 'Unknown Lab');
      console.log('[GPT PAGEWISE] 12. Total processing time:', totalDuration, 'seconds');
      console.log('[GPT PAGEWISE] 13. Average time per page:', (successfulPages > 0 ? (parseFloat(totalDuration) / successfulPages).toFixed(2) : '0.00'), 'seconds');
      console.log('[GPT PAGEWISE] 14. ========== TOTAL TOKEN USAGE ==========');
      console.log('[GPT PAGEWISE] 15. Total input tokens:', totalPromptTokens);
      console.log('[GPT PAGEWISE] 16. Total output tokens:', totalCompletionTokens);
      console.log('[GPT PAGEWISE] 17. Total tokens:', totalPromptTokens + totalCompletionTokens);
      console.log('[GPT PAGEWISE] 18. Total estimated cost: $' + totalCost.toFixed(4));

      // Return enhanced data structure with page-wise data
      return {
        labName: labNameGlobal || 'Unknown Lab',
        results: allResults,
        pageWiseData: pageWiseData, // NEW: Array of per-page extraction data
        tokenUsage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
          estimatedCost: totalCost
        }
      };

    } catch (error) {
      const errorDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error('[GPT PAGEWISE] ERROR: ========== PAGE-BY-PAGE EXTRACTION FAILED ==========');
      console.error('[GPT PAGEWISE] ERROR: Failed after', errorDuration, 'seconds');
      console.error('[GPT PAGEWISE] ERROR: Error type:', error.constructor.name);
      console.error('[GPT PAGEWISE] ERROR: Error message:', error.message);

      if (error.response) {
        console.error('[GPT PAGEWISE] ERROR: OpenAI API Error:', error.response.data);
        throw new Error(`OpenAI API Error: ${error.response.data.error?.message || 'Unknown error'}`);
      }

      console.error('[GPT PAGEWISE] ERROR: Stack trace:', error.stack);
      throw error;
    }
  }

  // Format extracted data to match Example.json structure
  formatForDatabase(extractedData, orderId, metadata = {}) {
    console.log('[GPT] 43. ========== FORMATTING FOR DATABASE ==========');
    console.log('[GPT] 44. Order ID:', orderId);
    console.log('[GPT] 45. Lab name:', extractedData.labName);
    console.log('[GPT] 46. Number of results to format:', extractedData.results.length);

    const formattedData = {
      meta: {
        USER_CODE: orderId,
        cug_code: '',
        VISIT_CODE: '',
        patient_age: metadata.patientAge || '',
        gender: metadata.gender || '',
        date_of_test: new Date().toISOString().split('T')[0],
        lab_name: extractedData.labName,
        location: metadata.location || ''
      },
      results: extractedData.results.map(result => ({
        type: result.type || 'path',
        serviceItemName: result.serviceItemName,
        value: String(result.value),
        method: result.method || '',
        unit: result.unit || '',
        referenceRange: {
          high: result.referenceRange?.high || null,
          low: result.referenceRange?.low || null,
          referenceRange: result.referenceRange?.referenceRange || ''
        }
      }))
    };

    console.log('[GPT] 47. ✓ Formatting complete');
    console.log('[GPT] 48. Formatted', formattedData.results.length, 'results for database storage');
    return formattedData;
  }
}

module.exports = new GPTExtractorService();