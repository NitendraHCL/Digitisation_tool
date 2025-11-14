const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfConverter = require('./src/services/pdfConverter.service');
require('dotenv').config();

async function testGeminiWithSingleImage() {
  console.log('========================================');
  console.log('🧪 TESTING GEMINI WITH SINGLE IMAGE');
  console.log('========================================');

  const pdfPath = './uploads/pdfs-1762750496624-465610657.pdf';
  console.log('1. PDF Path:', pdfPath);

  try {
    // Step 1: Convert first page of PDF to image
    console.log('\n2. Converting first page to image...');
    const startConversion = Date.now();
    const allImages = await pdfConverter.convertToImages(pdfPath);
    const conversionTime = ((Date.now() - startConversion) / 1000).toFixed(2);

    // Use only the first image
    const firstImageBase64 = allImages[0];

    console.log(`✓ Conversion complete in ${conversionTime}s`);
    console.log(`  - Total pages converted: ${allImages.length}`);
    console.log(`  - Using only first page`);
    console.log(`  - First image size: ${(firstImageBase64.length / 1024).toFixed(2)} KB`);

    // Step 2: Initialize Gemini
    console.log('\n3. Initializing Gemini API...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('✓ Gemini API initialized');

    // Step 3: Prepare image for Gemini
    console.log('\n4. Preparing image for Gemini...');
    const imagePart = {
      inlineData: {
        data: firstImageBase64,
        mimeType: 'image/png'
      }
    };

    // Step 4: Create simple prompt
    const prompt = `Extract the lab name from this medical report image.
Just return the lab name, nothing else.`;

    console.log('\n5. Sending request to Gemini...');
    const startAPI = Date.now();
    const result = await model.generateContent([prompt, imagePart]);
    const apiTime = ((Date.now() - startAPI) / 1000).toFixed(2);

    console.log(`✓ API call complete in ${apiTime}s`);

    // Step 5: Get response
    const response = await result.response;
    const text = response.text();

    console.log('\n========================================');
    console.log('✅ SUCCESS - GEMINI RESPONSE:');
    console.log('========================================');
    console.log(text);
    console.log('========================================');
    console.log('\n📊 Summary:');
    console.log(`  - PDF conversion: ${conversionTime}s`);
    console.log(`  - Gemini API call: ${apiTime}s`);
    console.log(`  - Total time: ${((Date.now() - startConversion) / 1000).toFixed(2)}s`);
    console.log(`  - Response length: ${text.length} characters`);
    console.log('========================================');

    process.exit(0);

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ ERROR OCCURRED:');
    console.error('========================================');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('\nFull error:');
    console.error(error);
    console.error('========================================');
    process.exit(1);
  }
}

// Run the test
testGeminiWithSingleImage();
