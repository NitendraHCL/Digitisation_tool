#!/bin/bash

echo "=========================================="
echo "Testing IMAGE Method with Gemini 2.0 Flash Vision"
echo "=========================================="
echo ""

# Login to get token
echo "Step 1: Logging in as admin..."
LOGIN_RESPONSE=$(curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@labdigital.com","password":"Admin@123"}' \
  --silent)

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✓ Login successful, token obtained"
echo ""

# Upload report.pdf
echo "Step 2: Uploading report.pdf..."
UPLOAD1_RESPONSE=$(curl -X POST http://localhost:5001/api/reports/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "pdf=@../report.pdf" \
  -F "orderId=TEST-IMAGE-GEMINI-$(date +%s)" \
  --silent)

REPORT1_ID=$(echo "$UPLOAD1_RESPONSE" | grep -o '"reportId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$REPORT1_ID" ]; then
  echo "❌ Upload failed for report.pdf!"
  echo "Response: $UPLOAD1_RESPONSE"
  exit 1
fi

echo "✓ report.pdf uploaded successfully"
echo "  Report ID: $REPORT1_ID"
echo ""

# Process with IMAGE method
echo "Step 3: Processing report.pdf with IMAGE method..."
echo "=========================================="
PROCESS1_RESPONSE=$(curl -X POST "http://localhost:5001/api/reports/$REPORT1_ID/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"extractionMethod":"image"}' \
  --silent)

echo "$PROCESS1_RESPONSE" | node -e "
  const data = require('fs').readFileSync(0, 'utf-8');
  try {
    const json = JSON.parse(data);
    if (json.success) {
      console.log('✓ Processing successful!');
      console.log('  Lab Name:', json.data.labName);
      console.log('  Parameters Extracted:', json.data.parametersExtracted);
      console.log('  Processing Time:', json.data.processingTime);
      console.log('  Method Used:', json.data.actualMethodUsed || json.data.extractionMethod);
      if (json.data.processingMetadata) {
        console.log('  Image Conversion Time:', json.data.processingMetadata.imageConversionTime?.toFixed(2) || 'N/A', 's');
        console.log('  GPT/Gemini Processing Time:', json.data.processingMetadata.gptProcessingTime?.toFixed(2) || 'N/A', 's');
      }
    } else {
      console.log('❌ Processing failed:', json.message);
    }
  } catch (e) {
    console.log('❌ Failed to parse response');
    console.log(data);
  }
"
echo ""
echo "=========================================="
echo ""

# Upload report2.pdf
echo "Step 4: Uploading report2.pdf..."
UPLOAD2_RESPONSE=$(curl -X POST http://localhost:5001/api/reports/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "pdf=@../report2.pdf" \
  -F "orderId=TEST-IMAGE-GEMINI-$(date +%s)-2" \
  --silent)

REPORT2_ID=$(echo "$UPLOAD2_RESPONSE" | grep -o '"reportId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$REPORT2_ID" ]; then
  echo "❌ Upload failed for report2.pdf!"
  echo "Response: $UPLOAD2_RESPONSE"
  exit 1
fi

echo "✓ report2.pdf uploaded successfully"
echo "  Report ID: $REPORT2_ID"
echo ""

# Process with IMAGE method
echo "Step 5: Processing report2.pdf with IMAGE method..."
echo "=========================================="
PROCESS2_RESPONSE=$(curl -X POST "http://localhost:5001/api/reports/$REPORT2_ID/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"extractionMethod":"image"}' \
  --silent)

echo "$PROCESS2_RESPONSE" | node -e "
  const data = require('fs').readFileSync(0, 'utf-8');
  try {
    const json = JSON.parse(data);
    if (json.success) {
      console.log('✓ Processing successful!');
      console.log('  Lab Name:', json.data.labName);
      console.log('  Parameters Extracted:', json.data.parametersExtracted);
      console.log('  Processing Time:', json.data.processingTime);
      console.log('  Method Used:', json.data.actualMethodUsed || json.data.extractionMethod);
      if (json.data.processingMetadata) {
        console.log('  Image Conversion Time:', json.data.processingMetadata.imageConversionTime?.toFixed(2) || 'N/A', 's');
        console.log('  GPT/Gemini Processing Time:', json.data.processingMetadata.gptProcessingTime?.toFixed(2) || 'N/A', 's');
      }
    } else {
      console.log('❌ Processing failed:', json.message);
    }
  } catch (e) {
    console.log('❌ Failed to parse response');
    console.log(data);
  }
"
echo ""
echo "=========================================="
echo "✓ IMAGE Method Testing Complete!"
echo "=========================================="
