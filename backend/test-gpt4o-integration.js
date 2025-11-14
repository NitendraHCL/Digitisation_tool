#!/usr/bin/env node

/**
 * Test script for GPT-4o integration
 * Tests the new model selection feature in the process controller
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const API_BASE = 'http://localhost:5001/api';

// Test credentials
const TEST_USER = {
  email: 'admin@labdigital.com',
  password: 'Admin@123'
};

let authToken = null;

/**
 * Login and get auth token
 */
async function login() {
  console.log('========================================');
  console.log('1. LOGGING IN');
  console.log('========================================');

  try {
    const response = await axios.post(`${API_BASE}/auth/login`, TEST_USER);
    authToken = response.data.token;
    console.log('✓ Login successful');
    console.log('✓ Token obtained');
    return true;
  } catch (error) {
    console.error('✗ Login failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Upload a test PDF
 */
async function uploadPDF(pdfPath) {
  console.log('\n========================================');
  console.log('2. UPLOADING TEST PDF');
  console.log('========================================');
  console.log('PDF:', pdfPath);

  if (!fs.existsSync(pdfPath)) {
    console.error('✗ PDF file not found:', pdfPath);
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('pdf', fs.createReadStream(pdfPath));
    formData.append('orderId', 'GPT4O-TEST-' + Date.now());

    const response = await axios.post(`${API_BASE}/reports/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log('✓ Upload successful');
    console.log('✓ Report ID:', response.data.data.reportId);
    console.log('✓ Order ID:', response.data.data.orderId);

    return response.data.data.reportId;
  } catch (error) {
    console.error('✗ Upload failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Process report with GPT-4o
 */
async function processWithGPT4o(reportId) {
  console.log('\n========================================');
  console.log('3. PROCESSING WITH GPT-4O');
  console.log('========================================');
  console.log('Report ID:', reportId);
  console.log('Model: GPT-4O');
  console.log('Method: IMAGE (vision)');

  try {
    const startTime = Date.now();

    const response = await axios.post(
      `${API_BASE}/reports/${reportId}/process`,
      {
        extractionMethod: 'image',
        model: 'gpt-4o'
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✓ Processing successful');
    console.log('✓ Duration:', duration + 's');
    console.log('✓ Lab name:', response.data.data.labName);
    console.log('✓ Parameters extracted:', response.data.data.parametersExtracted);
    console.log('✓ Processing time:', response.data.data.processingTime);

    if (response.data.data.processingMetadata) {
      const meta = response.data.data.processingMetadata;
      console.log('\n--- Processing Metadata ---');
      console.log('Image conversion:', meta.imageConversionTime?.toFixed(2) + 's');
      console.log('GPT processing:', meta.gptProcessingTime?.toFixed(2) + 's');
      console.log('Total time:', meta.totalProcessingTime?.toFixed(2) + 's');
    }

    return response.data.data;
  } catch (error) {
    console.error('✗ Processing failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Process report with Gemini (for comparison)
 */
async function processWithGemini(reportId) {
  console.log('\n========================================');
  console.log('4. PROCESSING WITH GEMINI (COMPARISON)');
  console.log('========================================');
  console.log('Report ID:', reportId);
  console.log('Model: GEMINI 2.0 FLASH');
  console.log('Method: IMAGE (vision)');

  try {
    const startTime = Date.now();

    const response = await axios.post(
      `${API_BASE}/reports/${reportId}/process`,
      {
        extractionMethod: 'image',
        model: 'gemini'
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✓ Processing successful');
    console.log('✓ Duration:', duration + 's');
    console.log('✓ Lab name:', response.data.data.labName);
    console.log('✓ Parameters extracted:', response.data.data.parametersExtracted);
    console.log('✓ Processing time:', response.data.data.processingTime);

    if (response.data.data.processingMetadata) {
      const meta = response.data.data.processingMetadata;
      console.log('\n--- Processing Metadata ---');
      console.log('Image conversion:', meta.imageConversionTime?.toFixed(2) + 's');
      console.log('GPT processing:', meta.gptProcessingTime?.toFixed(2) + 's');
      console.log('Total time:', meta.totalProcessingTime?.toFixed(2) + 's');
    }

    return response.data.data;
  } catch (error) {
    console.error('✗ Processing failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Main test function
 */
async function runTest() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   GPT-4o INTEGRATION TEST             ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Check if PDF path is provided
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Usage: node test-gpt4o-integration.js <path-to-test-pdf>');
    console.error('Example: node test-gpt4o-integration.js report.pdf');
    process.exit(1);
  }

  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('\n✗ Test aborted: Login failed');
    process.exit(1);
  }

  // Step 2: Upload PDF for GPT-4o test
  const gpt4oReportId = await uploadPDF(pdfPath);
  if (!gpt4oReportId) {
    console.error('\n✗ Test aborted: Upload failed');
    process.exit(1);
  }

  // Step 3: Process with GPT-4o
  const gpt4oResult = await processWithGPT4o(gpt4oReportId);
  if (!gpt4oResult) {
    console.error('\n✗ Test aborted: GPT-4o processing failed');
    process.exit(1);
  }

  // Step 4: Upload same PDF for Gemini comparison
  console.log('\n--- Uploading same PDF for Gemini comparison ---');
  const geminiReportId = await uploadPDF(pdfPath);
  if (!geminiReportId) {
    console.error('\n✗ Comparison skipped: Upload failed');
  } else {
    // Step 5: Process with Gemini
    const geminiResult = await processWithGemini(geminiReportId);

    // Compare results
    if (gpt4oResult && geminiResult) {
      console.log('\n========================================');
      console.log('5. COMPARISON RESULTS');
      console.log('========================================');
      console.log('GPT-4o parameters:', gpt4oResult.parametersExtracted);
      console.log('Gemini parameters:', geminiResult.parametersExtracted);
      console.log('Difference:', Math.abs(gpt4oResult.parametersExtracted - geminiResult.parametersExtracted));
    }
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   ✓ TEST COMPLETED                    ║');
  console.log('╚════════════════════════════════════════╝\n');
}

// Run the test
runTest().catch(error => {
  console.error('\n✗ Test failed with error:', error.message);
  process.exit(1);
});
