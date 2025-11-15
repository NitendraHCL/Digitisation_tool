# Complete Parallel Processing Implementation Plan

## Overview
Transform the PDF processing system from sequential to parallel processing at multiple levels:
1. **Phase 1**: Concurrent page processing within each file (CURRENT FOCUS)
2. **Phase 2**: Background job queue system
3. **Phase 3**: Concurrent file processing
4. **Phase 4**: Multiple API key rotation

---

## PHASE 1: Concurrent Page Processing (Within Single File)

### Goal
Process all pages of a PDF file concurrently instead of sequentially.
- **Files**: Still processed one at a time (sequential)
- **Pages within file**: All processed together (concurrent)
- **Max pages**: Support up to 30 pages per file

### Current vs. Target Behavior

**Current (Sequential):**
```
File with 30 pages:
Page 1 (2.5s) → Page 2 (2.5s) → Page 3 (2.5s) → ... → Page 30 (2.5s)
Total: ~75 seconds
```

**Target (Concurrent):**
```
File with 30 pages:
Page 1 + Page 2 + Page 3 + ... + Page 30 (all at once)
Total: ~3-4 seconds (just one API response time)
```

### Implementation

#### Step 1: Install Dependencies
```bash
cd backend
npm install p-limit
```

#### Step 2: Modify Gemini Extractor Service
**File:** `backend/src/services/geminiExtractor.service.js`

**Current Code (Lines ~697-780):**
```javascript
// Sequential loop
for (let pageIdx = 0; pageIdx < images.length; pageIdx++) {
  const pageNumber = pageIdx + 1;
  const imagePart = { inlineData: { data: images[pageIdx], mimeType: 'image/png' }};
  const result = await model.generateContent([promptTemplate, imagePart]);
  // Process result...
}
```

**New Code:**
```javascript
const pLimit = require('p-limit');
const limit = pLimit(15); // Max 15 concurrent API calls

// Create array of promises
const pagePromises = images.map((imageData, pageIdx) =>
  limit(async () => {
    const pageNumber = pageIdx + 1;
    const imagePart = { inlineData: { data: imageData, mimeType: 'image/png' }};

    try {
      const result = await model.generateContent([promptTemplate, imagePart]);
      // Process and return result
      return { pageNumber, result, ... };
    } catch (error) {
      return { pageNumber, error: error.message };
    }
  })
);

// Execute all in parallel
const pageResults = await Promise.all(pagePromises);
```

#### Step 3: Modify GPT-4o Extractor Service
**File:** `backend/src/services/gpt4oExtractor.service.js`
- Same approach as Gemini
- Apply to `extractFromImagesPageWise` function

#### Step 4: Testing
- Test with 5-page PDF
- Test with 15-page PDF
- Test with 30-page PDF
- Verify error handling
- Monitor API rate limits

### Expected Results
- **30-page PDF**: 75 seconds → 3-4 seconds (20x faster)
- **15-page PDF**: 37 seconds → 2-3 seconds (15x faster)
- **5-page PDF**: 12 seconds → 2 seconds (6x faster)

### Concurrency Limits
- **15 concurrent pages**: Safe for Gemini's 2,000 RPM limit
- **For 30 pages**: Processes in 2 batches (15 + 15)
- **API safety**: Well within rate limits

---

## PHASE 2: Background Job Queue System

### Goal
Allow users to upload and leave - processing happens in background.

### Architecture
```
User → Upload → Job Queue → Background Worker → Complete
         ↓
      Returns immediately
         ↓
   User can leave page
```

### Implementation

#### Step 1: Install Dependencies
```bash
npm install bull ioredis redis
```

#### Step 2: Install & Start Redis
```bash
# macOS
brew install redis
redis-server

# Linux
sudo apt-get install redis-server
sudo systemctl start redis
```

#### Step 3: Create Queue Infrastructure
**File:** `backend/src/queues/processingQueue.js`
```javascript
const Queue = require('bull');

const processingQueue = new Queue('pdf-processing', {
  redis: {
    host: 'localhost',
    port: 6379
  }
});

module.exports = processingQueue;
```

#### Step 4: Create Worker
**File:** `backend/src/workers/processingWorker.js`
```javascript
const processingQueue = require('../queues/processingQueue');
const geminiExtractor = require('../services/geminiExtractor.service');
const Report = require('../models/Report');

processingQueue.process(async (job) => {
  const { reportId, extractionMethod, model } = job.data;

  // Update progress
  job.progress(10);

  // Load report
  const report = await Report.findById(reportId);

  // Process with concurrent pages
  const extractedData = await geminiExtractor.extractFromImagesPageWise(...);

  // Save results
  await report.save();

  job.progress(100);
  return { success: true };
});
```

#### Step 5: Modify Process Controller
**File:** `backend/src/controllers/process.controller.js`
```javascript
// Instead of processing immediately
const processReport = async (req, res) => {
  const job = await processingQueue.add({
    reportId: req.params.id,
    extractionMethod: req.body.extractionMethod,
    model: req.body.model
  });

  res.json({
    success: true,
    jobId: job.id,
    message: 'Processing started in background'
  });
};
```

#### Step 6: Create Status Endpoint
**File:** `backend/src/controllers/jobStatus.controller.js`
```javascript
const getJobStatus = async (req, res) => {
  const job = await processingQueue.getJob(req.params.jobId);
  const state = await job.getState();
  const progress = job.progress();

  res.json({ state, progress });
};
```

#### Step 7: Update Frontend
**File:** `frontend/src/pages/nurse/UploadReport.tsx`
```javascript
// After upload, start polling
const handleBatchProcess = async () => {
  const jobIds = [];

  // Submit all files to queue
  for (const report of uploadedReports) {
    const response = await api.post(`/reports/${report.reportId}/process`, {...});
    jobIds.push(response.data.jobId);
  }

  // Poll for status
  const pollInterval = setInterval(async () => {
    const statuses = await Promise.all(
      jobIds.map(id => api.get(`/jobs/${id}/status`))
    );

    // Update UI with statuses
    if (allComplete(statuses)) {
      clearInterval(pollInterval);
      showSuccessMessage();
    }
  }, 2000);
};
```

### Expected Results
- User uploads → Gets immediate response
- User can close browser
- Processing happens in background
- User checks back later for results
- Like Gmail attachments or Google Drive uploads

---

## PHASE 3: Concurrent File Processing

### Goal
Process multiple files simultaneously, not just pages.

### Implementation

#### Modify Worker for Concurrent Files
```javascript
processingQueue.process(5, async (job) => {
  // 5 = process up to 5 files concurrently
  // Each file still uses concurrent page processing from Phase 1
});
```

#### Modify Frontend
```javascript
// Submit all files at once
const jobPromises = uploadedReports.map(report =>
  api.post(`/reports/${report.reportId}/process`, {...})
);
const jobs = await Promise.all(jobPromises);
```

### Expected Results
- **10 files, 10 pages each**: ~3-4 seconds total
- All files process together
- Each file processes all pages concurrently

---

## PHASE 4: Multiple API Key Rotation

### Goal
Avoid rate limits by rotating through multiple Gemini API keys.

### Implementation

#### Step 1: Update Environment Variables
```bash
# .env
GEMINI_API_KEYS=key1,key2,key3,key4,key5
```

#### Step 2: Create API Key Manager
**File:** `backend/src/services/apiKeyManager.js`
```javascript
class APIKeyManager {
  constructor(keys) {
    this.keys = keys.split(',');
    this.currentIndex = 0;
    this.usage = new Map(); // Track usage per key
  }

  getNextKey() {
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  getLeastUsedKey() {
    // Return key with lowest usage
    let minUsage = Infinity;
    let selectedKey = this.keys[0];

    for (const key of this.keys) {
      const usage = this.usage.get(key) || 0;
      if (usage < minUsage) {
        minUsage = usage;
        selectedKey = key;
      }
    }

    return selectedKey;
  }

  trackUsage(key, tokens) {
    const current = this.usage.get(key) || 0;
    this.usage.set(key, current + tokens);
  }

  resetUsage() {
    this.usage.clear(); // Reset every minute
  }
}

module.exports = new APIKeyManager(process.env.GEMINI_API_KEYS);
```

#### Step 3: Modify Extractors
```javascript
const apiKeyManager = require('./apiKeyManager');

async function extractFromImagesPageWise(images, ...) {
  const pagePromises = images.map((imageData, pageIdx) =>
    limit(async () => {
      // Get key for this specific page
      const apiKey = apiKeyManager.getLeastUsedKey();
      const model = genAI(apiKey).getGenerativeModel(...);

      const result = await model.generateContent(...);

      // Track usage
      apiKeyManager.trackUsage(apiKey, result.tokens);

      return result;
    })
  );

  return await Promise.all(pagePromises);
}
```

### Expected Results
- 5 API keys = 5× the rate limit
- Smart rotation based on usage
- Automatic failover if one key fails
- Support for high-volume processing

---

## Testing Strategy

### Phase 1 Testing
- [ ] Single 5-page PDF
- [ ] Single 15-page PDF
- [ ] Single 30-page PDF
- [ ] Error handling (corrupt page)
- [ ] Response format validation

### Phase 2 Testing
- [ ] Job submission and queuing
- [ ] Status polling
- [ ] Browser close/reopen
- [ ] Multiple concurrent users
- [ ] Worker crash recovery

### Phase 3 Testing
- [ ] 5 files simultaneously
- [ ] 10 files simultaneously
- [ ] Mixed file sizes
- [ ] Partial failures

### Phase 4 Testing
- [ ] Key rotation logic
- [ ] Usage tracking
- [ ] Failover on key error
- [ ] Rate limit handling

---

## Performance Metrics

### Current State
- 1 file, 10 pages: ~30 seconds
- 10 files, 10 pages: ~300 seconds (5 minutes)
- User must wait on screen

### After Phase 1
- 1 file, 10 pages: ~3 seconds (10x faster)
- 10 files, 10 pages: ~30 seconds (10x faster)
- User still waits on screen

### After Phase 2
- User can leave immediately
- Background processing
- Better user experience

### After Phase 3
- 10 files, 10 pages: ~3-4 seconds (100x faster)
- All files process together

### After Phase 4
- Support for 1000+ files
- No rate limit concerns
- Enterprise-ready

---

## API Rate Limit Analysis

### Gemini Free Tier
- 2,000 requests per minute (RPM)
- 4,000,000 tokens per minute (TPM)
- 32,000 requests per day

### With Phase 1 (Concurrent Pages)
- 15 pages at once = 15 requests
- Well within 2,000 RPM
- Safe for single user

### With Phase 3 (Concurrent Files)
- 5 files × 15 pages = 75 requests at once
- Still safe (< 2,000 RPM)
- Works for small team

### With Phase 4 (Multiple Keys)
- 5 keys × 2,000 RPM = 10,000 effective RPM
- Can handle 100+ concurrent users
- Production-ready

---

## Rollout Plan

### Week 1: Phase 1
- Days 1-2: Implement concurrent pages
- Days 3-4: Testing and optimization
- Day 5: Deploy to production

### Week 2: Phase 2
- Days 1-2: Set up Redis and Bull
- Days 3-4: Implement workers and status polling
- Day 5: Frontend integration and testing

### Week 3: Phase 3
- Days 1-2: Concurrent file processing
- Days 3-4: Load testing
- Day 5: Production deployment

### Week 4: Phase 4
- Days 1-2: API key manager
- Days 3-4: Integration and testing
- Day 5: Documentation and monitoring

---

## Risk Mitigation

### Risk 1: API Rate Limits
- **Mitigation**: Phase 4 multiple keys
- **Fallback**: Reduce concurrency limits

### Risk 2: Worker Crashes
- **Mitigation**: Bull's built-in retry
- **Monitoring**: Job failure alerts

### Risk 3: Redis Downtime
- **Mitigation**: Redis persistence enabled
- **Fallback**: Graceful degradation

### Risk 4: Memory Issues
- **Mitigation**: Limit concurrent files
- **Monitoring**: Memory usage alerts

---

## Success Criteria

### Phase 1
- ✅ 10x speed improvement for multi-page PDFs
- ✅ No regression in accuracy
- ✅ Error handling works

### Phase 2
- ✅ User can leave page after upload
- ✅ Jobs complete in background
- ✅ Status updates work

### Phase 3
- ✅ 50x speed improvement for batch uploads
- ✅ Handle 10+ files simultaneously

### Phase 4
- ✅ No rate limit errors
- ✅ Support 50+ concurrent users
- ✅ Automatic key rotation

---

## Maintenance & Monitoring

### Metrics to Track
- Average processing time per page
- API rate limit usage
- Job queue length
- Worker utilization
- Error rates per API key

### Alerts
- Rate limit approaching (80%)
- Worker down
- Redis connection lost
- Job failure rate > 5%
- Queue length > 100

### Logging
- All API calls with timestamps
- Token usage per key
- Processing times per page
- Job state transitions

---

## Future Enhancements

### Beyond Phase 4
- WebSocket real-time updates (replace polling)
- Auto-scaling workers based on queue length
- ML model for predicting processing time
- Batch PDF processing (multiple PDFs → single job)
- Smart page splitting (group similar pages)
- Cost optimization (choose cheapest model per page type)

---

**Last Updated**: Current Date
**Status**: Phase 1 - In Progress
**Estimated Completion**: Phase 1 - This Week
