# Plan for Language: Local Model Integration for Vietnamese Document Processing

**Document Version**: 1.0
**Date**: 2025-11-08
**Scope**: Add local model choice for image-based extraction in Vietnamese experimental process
**Target URL**: http://localhost:3000/admin/experimental

---

## Executive Summary

This document outlines a complete plan to integrate **local Vision-Language Models (VLMs)** as an alternative to Google Gemini 2.0 Flash for Vietnamese medical document processing, specifically for **image-based extraction** in the experimental Vietnamese TPA insurance claims workflow (OPD/IPD documents).

### Key Benefits
- **Data Privacy**: All processing happens on-premises, no external API calls
- **Cost Reduction**: Zero API costs after initial hardware investment
- **Independence**: No dependency on external services or rate limits
- **Customization**: Can fine-tune models for Vietnamese medical terminology
- **Compliance**: Meet regulatory requirements for sensitive medical data

### Recommended Solution
**Qwen2.5-VL-7B-Instruct** deployed via **Ollama** as the primary local model, with fallback to Gemini for comparison and redundancy.

---

## 1. Architecture Overview

### Current Flow (Gemini Only)
```
PDF Upload → Image Conversion → Gemini 2.0 Flash API → Parse Response → Display Results
                                  (External API call)
```

### Proposed Hybrid Flow
```
PDF Upload → Image Conversion → [Model Selection] → Parse Response → Display Results
                                        ↓
                                 ┌──────┴────────┐
                                 ↓               ↓
                          Gemini 2.0 Flash   Local VLM
                          (External API)     (Ollama)
```

### System Components

#### Backend Services
1. **Existing**: `vietnameseExtractor.service.js` (Gemini)
2. **New**: `localModelExtractor.service.js` (Ollama + Qwen2.5-VL)
3. **Modified**: `vietnameseProcess.controller.js` (routing logic)
4. **Modified**: `vietnamesePrompt.service.js` (prompt optimization for local models)

#### Frontend Components
1. **Modified**: `VietnameseUpload.tsx` (add model selection dropdown)
2. **Modified**: `vietnameseApi.ts` (add modelType parameter)
3. **Unchanged**: `VietnameseResults.tsx` (display logic remains same)

---

## 2. Recommended Local Models

### Primary Recommendation: Qwen2.5-VL-7B-Instruct

**Why Qwen2.5-VL?**
- ✅ **Native Vietnamese Support**: Trained on multilingual data including Vietnamese
- ✅ **Vision + Language**: Can process images AND text simultaneously
- ✅ **Production-Ready**: Used by Alibaba Cloud in production
- ✅ **Excellent OCR**: Strong text recognition capabilities for scanned documents
- ✅ **Moderate Size**: 7B parameter model runs on consumer GPUs
- ✅ **Ollama Support**: Official Ollama integration for easy deployment

**Model Variants**:
| Model | Parameters | VRAM Required | Speed | Use Case |
|-------|-----------|---------------|-------|----------|
| qwen2.5-vl:3b | 3B | 4-6 GB | Fast | Development/Testing |
| qwen2.5-vl:7b | 7B | 8-12 GB | Medium | **Production (Recommended)** |
| qwen2.5-vl:32b | 32B | 24-32 GB | Slow | High Accuracy Scenarios |
| qwen2.5-vl:72b | 72B | 48-64 GB | Very Slow | Research Only |

### Alternative Models (Backup Options)

#### 1. PhoGPT-7B (Vietnamese-Specific)
- **Pros**: Trained specifically for Vietnamese language
- **Cons**: Text-only model, requires separate OCR step
- **Use Case**: Text extraction fallback

#### 2. Vistral-7B-Chat
- **Pros**: Top VMLU leaderboard scorer for Vietnamese
- **Cons**: Text-only model, no vision capabilities
- **Use Case**: Text-based extraction only

#### 3. Gemini 2.0 Flash (Existing)
- **Pros**: Proven reliability, no local infrastructure needed
- **Cons**: External API, costs per request, privacy concerns
- **Use Case**: Fallback when local models fail or for comparison

---

## 3. Technology Stack

### Ollama Framework
**What is Ollama?**
- Open-source LLM runtime (like Docker for AI models)
- One-command model downloads and serving
- REST API compatible with OpenAI format
- Supports GPU acceleration (NVIDIA CUDA, Apple Metal)

**Installation**:
```bash
# macOS
curl -fsSL https://ollama.com/install.sh | sh

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download installer from https://ollama.com/download/windows
```

**Model Download**:
```bash
# Pull Qwen2.5-VL-7B
ollama pull qwen2.5-vl:7b

# Verify installation
ollama list

# Test run
ollama run qwen2.5-vl:7b
```

### Hardware Requirements

#### Minimum (Development)
- **CPU**: 8-core modern processor (Intel i7/AMD Ryzen 7)
- **RAM**: 16 GB system memory
- **GPU**: NVIDIA RTX 3060 (12 GB VRAM) or Apple M1/M2 with 16 GB unified memory
- **Storage**: 50 GB SSD space
- **Model**: qwen2.5-vl:3b

#### Recommended (Production)
- **CPU**: 16-core processor (Intel Xeon/AMD EPYC/Apple M2 Pro)
- **RAM**: 32 GB system memory
- **GPU**: NVIDIA RTX 4090 (24 GB VRAM) or A100 (40 GB)
- **Storage**: 200 GB NVMe SSD
- **Model**: qwen2.5-vl:7b

#### Enterprise (High Volume)
- **CPU**: 32+ core server processor
- **RAM**: 64-128 GB ECC memory
- **GPU**: NVIDIA A100 (80 GB) or H100
- **Storage**: 500 GB NVMe RAID
- **Model**: qwen2.5-vl:32b or multiple 7B instances

---

## 4. Backend Implementation Plan

### Phase 1: Create Local Model Extractor Service

**File**: `/backend/src/experimental/vietnamese/services/localModelExtractor.service.js`

```javascript
const axios = require('axios');
const vietnamesePromptService = require('./vietnamesePrompt.service');

/**
 * Local Vision-Language Model Extraction Service
 * Uses Ollama + Qwen2.5-VL for on-premises Vietnamese document processing
 */
class LocalModelExtractorService {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen2.5-vl:7b';
    this.timeout = 120000; // 2 minute timeout
  }

  /**
   * Extract data from Vietnamese document images using local VLM
   * @param {Array} images - Array of base64 encoded PNG images
   * @param {string} orderId - Order/Reference ID
   * @param {string} documentType - Type of document (mixed, cost_sheet)
   * @returns {Object} Structured extraction result
   */
  async extractFromImages(images, orderId, documentType = 'mixed') {
    const startTime = Date.now();
    console.log('[LOCAL MODEL EXTRACTOR] ========== STARTING IMAGE EXTRACTION ==========');
    console.log('[LOCAL MODEL EXTRACTOR] Order ID:', orderId);
    console.log('[LOCAL MODEL EXTRACTOR] Number of images:', images.length);
    console.log('[LOCAL MODEL EXTRACTOR] Model:', this.model);

    try {
      // Build vision prompt based on document type
      const prompt = vietnamesePromptService.buildVisionPrompt(documentType);
      console.log('[LOCAL MODEL EXTRACTOR] Document type:', documentType);

      console.log('[LOCAL MODEL EXTRACTOR] Calling Ollama API...');
      const apiCallStartTime = Date.now();

      // Call Ollama with vision model
      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          images: images, // Array of base64 strings
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent extraction
            num_predict: 4096  // Max tokens to generate
          }
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const apiCallEndTime = Date.now();
      const apiDuration = ((apiCallEndTime - apiCallStartTime) / 1000).toFixed(2);
      console.log('[LOCAL MODEL EXTRACTOR] API call duration:', apiDuration, 'seconds');

      const responseText = response.data.response;
      console.log('[LOCAL MODEL EXTRACTOR] Response length:', responseText.length, 'characters');

      // Parse pipe-separated response (same parser as Gemini)
      const extractedData = this.parsePipeSeparatedResponse(responseText);

      // Detect document types
      const documentTypes = this.detectDocumentTypes(extractedData);

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('[LOCAL MODEL EXTRACTOR] Total extraction duration:', totalDuration, 'seconds');
      console.log('[LOCAL MODEL EXTRACTOR] Extracted', extractedData.length, 'data items');

      return {
        success: true,
        orderId,
        extractedData,
        documentTypes,
        metadata: {
          extractionMethod: 'local_model',
          model: this.model,
          duration: totalDuration,
          imageCount: images.length,
          rawResponse: responseText,
          ollamaStats: response.data.eval_count ? {
            evalCount: response.data.eval_count,
            evalDuration: response.data.eval_duration
          } : null
        }
      };
    } catch (error) {
      console.error('[LOCAL MODEL EXTRACTOR] Extraction failed:', error.message);

      // Provide helpful error messages
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Local model server not running. Please start Ollama: ollama serve');
      } else if (error.response?.status === 404) {
        throw new Error(`Model ${this.model} not found. Please pull it: ollama pull ${this.model}`);
      } else {
        throw new Error(`Local model extraction failed: ${error.message}`);
      }
    }
  }

  /**
   * Parse pipe-separated response (reuse same logic as Gemini extractor)
   */
  parsePipeSeparatedResponse(response) {
    console.log('[LOCAL MODEL EXTRACTOR] Parsing pipe-separated response...');

    try {
      const allLines = response.trim().split('\n').filter(l => l.trim().length > 0);
      console.log('[LOCAL MODEL EXTRACTOR] Total lines in response:', allLines.length);

      const dataLines = allLines.filter(l => l.includes('|'));
      console.log('[LOCAL MODEL EXTRACTOR] Data lines with pipes:', dataLines.length);

      const results = [];
      let successCount = 0;
      let skipCount = 0;

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();

        // Skip headers
        if (line.startsWith('---') || line.startsWith('===') ||
            line.toUpperCase().startsWith('DOC_TYPE') ||
            line.toUpperCase().includes('FIELD_EN')) {
          skipCount++;
          continue;
        }

        const parts = line.split('|').map(p => p.trim());

        if (parts.length >= 5) {
          const dataItem = {
            docType: parts[0],
            fieldEn: parts[1],
            fieldVi: parts[2],
            valueEn: parts[3],
            valueVi: parts[4]
          };

          results.push(dataItem);
          successCount++;
        } else {
          console.log(`[LOCAL MODEL EXTRACTOR] Skipping malformed line (${parts.length} parts): ${line.substring(0, 100)}...`);
          skipCount++;
        }
      }

      console.log('[LOCAL MODEL EXTRACTOR] Successfully parsed:', successCount, 'items');
      console.log('[LOCAL MODEL EXTRACTOR] Skipped:', skipCount, 'lines');

      return results;
    } catch (error) {
      console.error('[LOCAL MODEL EXTRACTOR] Parsing error:', error);
      return [];
    }
  }

  /**
   * Detect document types from extracted data
   */
  detectDocumentTypes(data) {
    const typeCounts = {};
    const typeLabels = {
      'CLINIC_INFO': 'Thông tin phòng khám',
      'PATIENT_INFO': 'Thông tin bệnh nhân',
      'DOCTOR_INFO': 'Thông tin bác sĩ',
      'PRESCRIPTION': 'Đơn thuốc',
      'LAB_TEST': 'Kết quả xét nghiệm',
      'PHARMACY_COST': 'Hóa đơn thuốc',
      'DIAGNOSIS': 'Chẩn đoán',
      'TREATMENT': 'Điều trị',
      'PROGNOSIS': 'Tiên lượng',
      'HOSPITAL_INFO': 'Thông tin bệnh viện',
      'COST_ITEM': 'Chi tiết chi phí',
      'INSURANCE_INFO': 'Thông tin bảo hiểm',
      'BILL_SUMMARY': 'Tổng kết thanh toán'
    };

    data.forEach(item => {
      const docType = item.docType;
      if (!typeCounts[docType]) {
        typeCounts[docType] = 0;
      }
      typeCounts[docType]++;
    });

    const types = Object.keys(typeCounts).map(type => ({
      type: type,
      type_vi: typeLabels[type] || type,
      count: typeCounts[type]
    }));

    console.log('[LOCAL MODEL EXTRACTOR] Detected document types:', types.map(t => `${t.type} (${t.count})`).join(', '));

    return types;
  }

  /**
   * Health check for Ollama service
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 });
      const models = response.data.models || [];
      const hasQwen = models.some(m => m.name.includes('qwen2.5-vl'));

      return {
        status: 'healthy',
        url: this.ollamaUrl,
        modelsAvailable: models.map(m => m.name),
        qwenInstalled: hasQwen
      };
    } catch (error) {
      return {
        status: 'unavailable',
        url: this.ollamaUrl,
        error: error.message
      };
    }
  }
}

module.exports = new LocalModelExtractorService();
```

### Phase 2: Modify Controller to Support Model Selection

**File**: `/backend/src/experimental/vietnamese/controllers/vietnameseProcess.controller.js`

**Changes**:
```javascript
// Add at top with other imports
const localModelExtractor = require('../services/localModelExtractor.service');

// In processVietnameseDocument function, extract modelType parameter:
const {
  extractionMethod = 'hybrid',
  documentType = 'mixed',
  modelType = 'gemini'  // NEW: 'gemini' or 'local'
} = req.body;

console.log('[VIETNAMESE PROCESS] Model Type:', modelType);

// Modify extraction logic to route based on modelType:

// For image-based extraction:
if (extractionMethod === 'image' || (extractionMethod === 'hybrid' && !hasSelectableText)) {
  console.log('[VIETNAMESE PROCESS] Using image-based extraction');

  // Convert PDF pages to images
  const images = await pdfImageConverter.convertPdfToImages(pdfPath);
  console.log('[VIETNAMESE PROCESS] Converted to', images.length, 'images');

  // Route to appropriate extractor based on modelType
  if (modelType === 'local') {
    console.log('[VIETNAMESE PROCESS] Using LOCAL MODEL extractor');
    extractionResult = await localModelExtractor.extractFromImages(
      images,
      report.orderId,
      documentType
    );
  } else {
    console.log('[VIETNAMESE PROCESS] Using GEMINI extractor');
    extractionResult = await vietnameseExtractor.extractFromImages(
      images,
      report.orderId,
      documentType
    );
  }
}

// Store modelType in metadata:
report.processingMetadata = {
  ...report.processingMetadata,
  isVietnamese: true,
  vietnameseDocumentType: documentType,
  vietnameseModelType: modelType,  // NEW: Track which model was used
  // ... rest of metadata
};
```

### Phase 3: Add Health Check Endpoint

**File**: `/backend/src/experimental/vietnamese/routes/vietnamese.routes.js`

```javascript
// Add new endpoint for local model health check
router.get('/local-model/health', async (req, res) => {
  try {
    const localModelExtractor = require('../services/localModelExtractor.service');
    const health = await localModelExtractor.healthCheck();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});
```

### Phase 4: Environment Configuration

**File**: `/backend/.env`

```bash
# Existing Gemini config
GEMINI_API_KEY=your_gemini_api_key_here

# NEW: Local model configuration
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-vl:7b

# Model selection default (gemini | local)
DEFAULT_VIETNAMESE_MODEL=gemini
```

---

## 5. Frontend Implementation Plan

### Phase 1: Update API Interface

**File**: `/frontend/src/services/vietnameseApi.ts`

```typescript
export interface VietnameseProcessRequest {
  extractionMethod?: 'text' | 'image' | 'hybrid';
  documentType?: 'mixed' | 'cost_sheet';
  modelType?: 'gemini' | 'local';  // NEW
}

/**
 * Check local model health status
 */
export const checkLocalModelHealth = async () => {
  const response = await api.get('/experimental/vietnamese/local-model/health');
  return response.data;
};
```

### Phase 2: Modify Upload Form

**File**: `/frontend/src/pages/experimental/VietnameseUpload.tsx`

```typescript
// Add state for model type and health status
const [modelType, setModelType] = useState<'gemini' | 'local'>('gemini');
const [localModelAvailable, setLocalModelAvailable] = useState(false);
const [checkingHealth, setCheckingHealth] = useState(false);

// Check local model health on component mount
useEffect(() => {
  checkLocalModelAvailability();
}, []);

const checkLocalModelAvailability = async () => {
  setCheckingHealth(true);
  try {
    const healthCheck = await checkLocalModelHealth();
    if (healthCheck.success && healthCheck.data.status === 'healthy') {
      setLocalModelAvailable(true);
      console.log('[VIETNAMESE UPLOAD] Local model available:', healthCheck.data);
    } else {
      setLocalModelAvailable(false);
      console.log('[VIETNAMESE UPLOAD] Local model not available');
    }
  } catch (error) {
    setLocalModelAvailable(false);
    console.error('[VIETNAMESE UPLOAD] Local model health check failed:', error);
  } finally {
    setCheckingHealth(false);
  }
};

// Add model selection UI (ONLY shown for image-based extraction)
{extractionMethod !== 'text' && (
  <FormControl fullWidth sx={{ mb: 3 }}>
    <InputLabel>AI Model</InputLabel>
    <Select
      value={modelType}
      onChange={(e) => setModelType(e.target.value as any)}
      disabled={uploading || processing}
      label="AI Model"
    >
      <MenuItem value="gemini">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudIcon fontSize="small" />
          <Box>
            <Typography variant="body2">Google Gemini 2.0 Flash</Typography>
            <Typography variant="caption" color="text.secondary">
              Cloud API • Fast • Reliable
            </Typography>
          </Box>
        </Box>
      </MenuItem>
      <MenuItem value="local" disabled={!localModelAvailable}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ComputerIcon fontSize="small" />
          <Box>
            <Typography variant="body2">Local Model (Qwen2.5-VL)</Typography>
            <Typography variant="caption" color="text.secondary">
              {localModelAvailable
                ? 'On-Premises • Private • No API costs'
                : 'Not available - Install Ollama'
              }
            </Typography>
          </Box>
        </Box>
      </MenuItem>
    </Select>
  </FormControl>
)}

{!localModelAvailable && modelType === 'local' && (
  <Alert severity="warning" sx={{ mb: 3 }}>
    <Typography variant="body2">
      <strong>Local model not available.</strong> Please install Ollama and pull the model:
      <br />
      <code>ollama pull qwen2.5-vl:7b</code>
    </Typography>
  </Alert>
)}

// Pass modelType to API
const response = await processVietnameseDocument(reportId, {
  extractionMethod,
  documentType,
  modelType,  // NEW
});
```

### Phase 3: Add Icons

**File**: `/frontend/src/pages/experimental/VietnameseUpload.tsx` (imports)

```typescript
import {
  CloudUpload as UploadIcon,
  Description as PdfIcon,
  Check as CheckIcon,
  Cloud as CloudIcon,       // NEW: For Gemini option
  Computer as ComputerIcon, // NEW: For local model option
} from '@mui/icons-material';
```

---

## 6. Deployment Guide

### Step 1: Install Ollama

**macOS**:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Linux (Ubuntu/Debian)**:
```bash
curl -fsSL https://ollama.com/install.sh | sh

# Enable GPU support (if NVIDIA GPU available)
sudo apt install nvidia-driver-535 nvidia-cuda-toolkit
```

**Windows**:
1. Download installer from https://ollama.com/download/windows
2. Run installer
3. Verify installation: `ollama --version`

### Step 2: Pull Qwen2.5-VL Model

```bash
# Pull 7B model (recommended for production)
ollama pull qwen2.5-vl:7b

# Alternative: Pull 3B model (faster, less accurate)
ollama pull qwen2.5-vl:3b

# Verify model is available
ollama list
```

### Step 3: Start Ollama Service

```bash
# Start Ollama server (default port 11434)
ollama serve

# Or run as background service
nohup ollama serve > ollama.log 2>&1 &

# Verify service is running
curl http://localhost:11434/api/tags
```

### Step 4: Configure Backend

```bash
cd /Users/anilkumar/Projects/digitization/backend

# Add to .env file
echo "OLLAMA_API_URL=http://localhost:11434" >> .env
echo "OLLAMA_MODEL=qwen2.5-vl:7b" >> .env
echo "DEFAULT_VIETNAMESE_MODEL=gemini" >> .env

# Restart backend
npm run dev
```

### Step 5: Test Local Model

```bash
# Test Ollama directly
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5-vl:7b",
  "prompt": "Extract patient name from this Vietnamese document",
  "images": ["base64_image_string_here"],
  "stream": false
}'

# Test via backend health endpoint
curl http://localhost:5001/api/experimental/vietnamese/local-model/health
```

---

## 7. Performance & Cost Comparison

### Processing Speed (per document)

| Model | Hardware | Average Time | Peak VRAM | Notes |
|-------|----------|--------------|-----------|-------|
| **Gemini 2.0 Flash** | Cloud API | 15-25s | N/A | Network dependent |
| **Qwen2.5-VL-3B** | RTX 3060 12GB | 8-12s | 4-6 GB | Fast inference |
| **Qwen2.5-VL-7B** | RTX 4090 24GB | 12-18s | 8-12 GB | **Recommended** |
| **Qwen2.5-VL-32B** | A100 40GB | 25-40s | 24-32 GB | High accuracy |

### Cost Analysis (1000 documents/month)

**Gemini 2.0 Flash API**:
- Input tokens: ~500,000 tokens/doc (images are expensive)
- Output tokens: ~2,000 tokens/doc
- Cost per 1M input tokens: $0.10
- Cost per 1M output tokens: $0.40
- **Monthly cost**: ~$58 (500M input + 2M output tokens)

**Local Model (Qwen2.5-VL-7B)**:
- Hardware cost: ~$1,500 (RTX 4090 one-time)
- Power consumption: ~450W × 100 hours/month = 45 kWh
- Electricity cost: 45 kWh × $0.12/kWh = $5.40/month
- **Monthly cost**: $5.40 (electricity only)
- **Break-even point**: 26 months (~2.2 years)

**Conclusion**: Local model becomes cost-effective after processing ~44,000 documents.

### Accuracy Comparison (Preliminary Estimates)

| Metric | Gemini 2.0 Flash | Qwen2.5-VL-7B | Notes |
|--------|------------------|---------------|-------|
| Vietnamese OCR | 95-98% | 92-95% | Gemini slightly better for scanned docs |
| Field extraction | 93-96% | 90-93% | Similar performance |
| Multi-document detection | 97% | 94% | Gemini better at document segmentation |
| Medical terminology | 94% | 89% | Qwen needs fine-tuning |
| Cost items table | 96% | 93% | Both handle structured data well |

**Recommendation**: Run both models in parallel initially to benchmark accuracy on real documents.

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Install Ollama on server
- [ ] Pull Qwen2.5-VL-7B model
- [ ] Create `localModelExtractor.service.js`
- [ ] Add environment variables
- [ ] Test Ollama API connectivity

**Deliverable**: Working local model extractor service with basic parsing

### Phase 2: Integration (Week 2)
- [ ] Modify controller to support model routing
- [ ] Add health check endpoint
- [ ] Update frontend API interface
- [ ] Add model selection dropdown (conditional on image extraction)
- [ ] Add local model availability indicator

**Deliverable**: Full model selection UI with graceful fallback

### Phase 3: Testing & Optimization (Week 3)
- [ ] Process v1.pdf and v2.pdf with both models
- [ ] Compare accuracy and speed
- [ ] Optimize prompt for local model
- [ ] Fine-tune temperature and generation parameters
- [ ] Test edge cases (poor quality scans, mixed documents)

**Deliverable**: Performance comparison report with recommendations

### Phase 4: Production Deployment (Week 4)
- [ ] Set up Ollama as systemd service (Linux) or launchd (macOS)
- [ ] Configure automatic model loading on startup
- [ ] Add monitoring and logging
- [ ] Create user documentation
- [ ] Deploy to production environment

**Deliverable**: Production-ready local model option with documentation

---

## 9. Risk Mitigation

### Risk 1: Local Model Not Available
**Mitigation**:
- Default to Gemini if local model health check fails
- Show clear error messages with installation instructions
- Gracefully disable local option in UI

### Risk 2: Lower Accuracy on Vietnamese Medical Terms
**Mitigation**:
- Run parallel comparison for first 100 documents
- Build fine-tuning dataset from validated outputs
- Consider hybrid approach: local model + Gemini validation for critical fields

### Risk 3: Hardware Limitations
**Mitigation**:
- Support multiple model sizes (3B, 7B, 32B)
- Add GPU memory monitoring
- Implement request queuing to prevent OOM errors

### Risk 4: Slow Inference on CPU
**Mitigation**:
- Require GPU for local model option
- Add estimated processing time warnings
- Keep Gemini as default for users without GPU

---

## 10. Future Enhancements

### Phase 5: Model Fine-Tuning (Optional)
1. **Collect Training Data**:
   - Export 500+ validated extractions from production
   - Manual correction of any errors
   - Focus on Vietnamese medical terminology

2. **Fine-Tune Qwen2.5-VL**:
   - Use LoRA (Low-Rank Adaptation) for efficient training
   - Train on medical document layouts
   - Specialize in TPA insurance forms

3. **Deploy Custom Model**:
   - Create Ollama Modelfile with fine-tuned weights
   - Test on holdout validation set
   - Deploy alongside base model

### Phase 6: Multi-Model Ensemble
- Run both Gemini and local model on same document
- Compare outputs and flag discrepancies
- Use voting mechanism for high-confidence fields
- Manual review queue for low-confidence extractions

### Phase 7: Edge Deployment
- Package Ollama + model as Docker container
- Deploy to edge devices at hospital sites
- Process documents at point of capture
- Reduce network latency and improve privacy

---

## 11. Success Metrics

### Technical Metrics
- **Extraction Accuracy**: Target ≥92% field accuracy (F1 score)
- **Processing Speed**: Average <20s per document
- **Uptime**: Local model availability >99%
- **GPU Utilization**: 60-80% during processing

### Business Metrics
- **Cost Savings**: >70% reduction in API costs after 3 months
- **Privacy Compliance**: 100% on-premises processing for sensitive documents
- **User Adoption**: >50% of users choose local model option
- **Processing Volume**: Support 1000+ documents/month on single GPU

---

## 12. Testing Checklist

### Pre-Deployment Testing
- [ ] Test with v1.pdf (mixed medical document)
- [ ] Test with v2.pdf (cost sheet)
- [ ] Test with poor quality scans
- [ ] Test with multi-page documents (>10 pages)
- [ ] Test with both Vietnamese and English mixed documents
- [ ] Load test: 10 concurrent requests
- [ ] Failover test: Ollama service down → fallback to Gemini
- [ ] Memory leak test: 100 consecutive documents

### Acceptance Criteria
- ✅ Local model processes documents without errors
- ✅ Extraction accuracy within 3% of Gemini
- ✅ Processing time <25s per document
- ✅ UI correctly shows model availability
- ✅ Graceful degradation when local model unavailable
- ✅ Consistent pipe-separated output format
- ✅ All document types correctly detected

---

## 13. Documentation Requirements

### User Documentation
1. **Installation Guide**: Step-by-step Ollama setup
2. **Model Selection Guide**: When to use Gemini vs Local
3. **Troubleshooting**: Common errors and solutions
4. **Performance Expectations**: Speed and accuracy comparisons

### Developer Documentation
1. **API Reference**: New endpoints and parameters
2. **Service Architecture**: Diagram showing model routing
3. **Deployment Playbook**: Production deployment steps
4. **Monitoring & Logging**: How to track model performance

---

## Conclusion

This plan provides a complete roadmap to integrate local Vision-Language Models (specifically Qwen2.5-VL-7B via Ollama) as an alternative to Google Gemini for Vietnamese medical document processing.

### Key Takeaways
1. **Hybrid Approach**: Offer both cloud (Gemini) and local (Qwen) options
2. **Image Extraction Only**: Local model choice only shown for image-based extraction
3. **Graceful Fallback**: System defaults to Gemini if local model unavailable
4. **Production-Ready**: 4-week implementation timeline with testing
5. **Cost-Effective**: 70%+ cost reduction for high-volume processing
6. **Privacy-First**: 100% on-premises data processing option

### Next Steps
1. **Approve Plan**: Review and approve this document
2. **Provision Hardware**: Ensure GPU server available (RTX 4090 or equivalent)
3. **Begin Phase 1**: Install Ollama and create local model extractor service
4. **Parallel Testing**: Run both models on production data for validation

---

**Document Owner**: Development Team
**Review Date**: 2025-11-08
**Next Review**: After Phase 3 completion (3 weeks)
