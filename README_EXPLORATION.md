# Lab Report Digitization System - Exploration & Documentation

This document provides a complete overview of the codebase exploration performed on the Lab Report Digitization System project. Two comprehensive documentation files have been generated to help you understand and work with this system.

## Documentation Files Generated

### 1. CODEBASE_SUMMARY.md
**Quick Reference Guide** (2-3 minute read)

Perfect for:
- Getting started quickly
- Understanding the big picture
- Finding common commands and endpoints
- Quick lookup of tech stack and features

**Covers:**
- Project overview and status
- Tech stack quick reference
- Directory structure
- Core features summary
- API endpoints (quick reference)
- Data models summary
- Processing pipeline
- Environment setup
- Security features
- Development roadmap

### 2. CODEBASE_ANALYSIS.md
**Comprehensive Technical Documentation** (30+ minute deep dive)

Perfect for:
- Deep understanding of architecture
- Detailed feature documentation
- Implementation specifics
- Contributing to the codebase
- Security and performance analysis
- Troubleshooting issues

**Covers (22 sections):**
1. Project Overview
2. Tech Stack & Architecture
3. Project Structure (full directory layout)
4. Core Features & Functionality (detailed)
5. Authentication & Authorization
6. AI/ML Integrations
7. Data Models & Schemas (complete)
8. API Endpoints (with descriptions)
9. Frontend Features & Components
10. File Processing Flow Diagram
11. Security Features
12. Testing Setup
13. Configuration & Environment
14. Key Technologies & Libraries
15. Data Flow Diagram
16. Development Phases Overview
17. Key Files Summary
18. Example.json Data Format
19. Notable Design Patterns
20. Known Issues & Technical Notes
21. Deployment Considerations
22. Quick Start Guide & Conclusion

---

## Project Summary

### What is This System?

A **web-based AI-powered medical lab report digitization system** that:

1. **Accepts**: PDF lab reports from healthcare professionals
2. **Processes**: Automatically extracts structured data using AI (GPT-4 Vision)
3. **Displays**: Shows extracted data in editable format
4. **Reviews**: Allows nurses to verify and edit values
5. **Approves**: Finalizes and exports data for downstream systems

### Key Statistics

| Metric | Value |
|--------|-------|
| Total Codebase | ~12,000 lines |
| Backend Code | ~6,500 lines (Node.js/Express) |
| Frontend Code | ~5,650 lines (React/TypeScript) |
| Backend Endpoints | 25+ API routes |
| Frontend Pages | 6 main pages |
| Database Collections | 3 main collections |
| Completion Status | Phase 3/12 (25% complete) |
| Node Modules | 500+ dependencies |

### Technology Overview

**Backend Stack**
- Express.js REST API
- MongoDB database
- JWT authentication
- OpenAI GPT-4 Vision integration
- Multer file upload
- Helmet security

**Frontend Stack**
- React 19 with TypeScript
- Material-UI components
- Recharts for analytics
- React Router for navigation
- Axios HTTP client
- React Context for state

---

## Directory Structure at a Glance

```
/digitization
├── backend/                           Node.js/Express server
│   ├── server.js                      Main entry point
│   ├── src/
│   │   ├── models/                    3 MongoDB schemas
│   │   ├── controllers/               8 business logic controllers
│   │   ├── routes/                    7 API route definitions
│   │   ├── middleware/                Auth, upload, error handling
│   │   ├── services/                  PDF, GPT, threshold services
│   │   └── utils/                     JWT, seeding utilities
│   ├── uploads/                       PDF file storage
│   └── package.json                   Dependencies (20+ packages)
│
├── frontend/                          React application
│   └── src/
│       ├── pages/                     6 main pages
│       ├── components/                20+ reusable components
│       ├── contexts/                  Global auth state
│       ├── services/                  API client
│       ├── types/                     TypeScript interfaces
│       └── theme.ts                   Material-UI theme
│
├── IMPLEMENTATION.md                  Original implementation plan
├── Example.json                       Target data format
├── CODEBASE_SUMMARY.md               Quick reference guide
└── CODEBASE_ANALYSIS.md              Detailed technical docs
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running locally
- OpenAI API key (or Gemini alternative)

### Setup & Run
```bash
# 1. Backend
cd backend
npm install
npm run seed          # Initialize database
npm run dev           # Starts on localhost:5001

# 2. Frontend (in new terminal)
cd frontend
npm install
npm start             # Starts on localhost:3000

# 3. Access application
# URL: http://localhost:3000
# Demo Login: admin@labdigital.com / Admin@123
```

---

## Key Features Explained

### 1. Authentication System
- **JWT-based**: 7-day token expiry
- **Roles**: super_admin, admin, nurse
- **Password Security**: bcrypt hashing (10 rounds)
- **Session**: Stateless (no server-side sessions)

### 2. PDF Processing Pipeline
```
Upload → Validate → Store → Extract Text → Send to GPT-4 → Parse JSON → Check Thresholds → Flag Abnormalities → Ready for Review
```

### 3. AI Integration
- **Primary**: OpenAI GPT-4 Vision
- **Fallback**: Google Gemini
- **Methods**: Text extraction, image conversion, hybrid, PDF processing
- **Output**: Structured JSON with lab values and reference ranges

### 4. Abnormality Detection
- Compares values to reference ranges
- Calculates deviation percentages
- Severity levels: mild (>0%), moderate (>50%), critical (>200%)
- Color-coded indicators: green, yellow, orange, red

### 5. Audit Trail
- Every edit tracked with user attribution
- Timestamps for all changes
- Reason for each modification
- Complete history viewable by reviewers

### 6. Admin Configuration
- Lab names management
- Threshold percentage settings
- System configuration (timeouts, file sizes)
- User management interface

---

## Architecture Overview

### Frontend Architecture
```
React App (Port 3000)
├── AuthContext (global auth state)
├── Protected Routes (role-based)
├── Pages:
│   ├── Login (public)
│   ├── Nurse Dashboard (nurse+)
│   ├── Upload Report (nurse+)
│   ├── Review Report (nurse+)
│   ├── Reports List (nurse+)
│   └── Admin Dashboard (admin+)
└── Material-UI components
    └── Responsive & accessible
```

### Backend Architecture
```
Express Server (Port 5001)
├── Authentication Middleware
├── Route Handlers
│   ├── Auth Routes (/api/auth)
│   ├── Report Routes (/api/reports)
│   ├── Review Routes (/api/review)
│   ├── Admin Routes (/api/admin)
│   ├── Lab Config Routes (/api/lab-config)
│   ├── Dashboard Routes (/api/dashboard)
│   └── Export Routes (/api/export)
├── Controllers (business logic)
├── Services (AI, PDF, threshold)
└── MongoDB Database
    ├── Users collection
    ├── Reports collection
    └── LabConfigs collection
```

### Data Flow
```
Client → Axios (with JWT) → Express Routes → Middleware → Controllers 
→ Services/Models → MongoDB ↔ External APIs (OpenAI/Gemini)
← Response sent back to client
```

---

## Important Files & Their Purposes

### Backend Core Files
| File | Purpose | Lines |
|------|---------|-------|
| `server.js` | Server initialization & middleware | 365 |
| `src/models/User.js` | User schema with auth methods | 83 |
| `src/models/Report.js` | Report with full metadata | 256 |
| `src/models/LabConfig.js` | Configuration schema | 151 |
| `src/middleware/auth.middleware.js` | JWT validation & RBAC | 148 |
| `src/controllers/auth.controller.js` | Login/logout logic | 194 |
| `src/services/gptExtractor.service.js` | GPT-4 Vision integration | ~200 |
| `src/services/thresholdChecker.service.js` | Abnormality detection | ~200 |

### Frontend Core Files
| File | Purpose | Lines |
|------|---------|-------|
| `src/App.tsx` | Main router & layout | 165 |
| `src/contexts/AuthContext.tsx` | Global auth state | 103 |
| `src/pages/auth/Login.tsx` | Login page | 264 |
| `src/pages/nurse/ReviewReport.tsx` | Core review interface | ~500+ |
| `src/pages/admin/AdminDashboard.tsx` | Analytics dashboard | ~200+ |
| `src/services/api.ts` | Axios client setup | 62 |
| `src/types/index.ts` | TypeScript interfaces | 229 |

---

## API Endpoints Overview

### Authentication (3 endpoints)
- `POST /api/auth/login` - Login with credentials
- `GET /api/auth/verify` - Verify token validity
- `GET /api/auth/logout` - Logout (frontend only)

### Reports (7 endpoints)
- `POST /api/reports/upload` - Upload PDF
- `GET /api/reports` - List reports
- `GET /api/reports/:id` - Get details
- `GET /api/reports/:id/pdf` - Download file
- `POST /api/reports/:id/process` - Process PDF
- `GET /api/reports/:id/extracted` - Get extracted data
- `DELETE /api/reports/:id` - Delete (admin only)

### Review (4 endpoints)
- `GET /api/review/:id` - Get for review
- `PUT /api/review/:id` - Edit parameters
- `POST /api/review/:id/approve` - Approve
- `POST /api/review/:id/reject` - Reject

### Admin (6 endpoints)
- `POST /api/admin/users` - Create user
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/lab-config` - Get config
- `PUT /api/lab-config` - Update config

### Dashboard & Export (2 endpoints)
- `GET /api/dashboard/stats` - Get statistics
- `GET /api/export/:id` - Export report

---

## Security Implementation

### Authentication
- JWT tokens with 7-day expiry
- Secure token verification middleware
- Role-based access control (RBAC)
- Account deactivation support

### Data Protection
- bcrypt password hashing (10 rounds)
- Passwords never logged or returned
- Input validation on all endpoints
- CORS enabled for frontend only

### API Security
- Helmet security headers
- Request size limits (50MB JSON)
- File upload type validation
- Rate limiting ready (not yet enabled)

### Audit & Compliance
- Edit history tracking
- User attribution for all changes
- Timestamp recording
- Complete audit trail

---

## Database Schema

### Users Collection
```
{
  email: unique, lowercase
  password: hashed (bcrypt)
  name: required
  role: 'super_admin' | 'admin' | 'nurse'
  isActive: boolean
  createdBy: reference to User
  lastLogin: date
  timestamps: created/updated
}
```

### Reports Collection
```
{
  orderId: unique
  uploadedBy: reference to User
  pdfPath: local file path
  originalFileName: string
  fileSize: number (bytes)
  status: 'uploaded' | 'processing' | 'ready' | 'approved' | 'rejected' | 'error'
  extractionMethod: 'text' | 'image' | 'hybrid' | 'pdf'
  extractedData: { labName, results[] }
  flags: { abnormalCount, severity, requiresAttention }
  editHistory: [{ field, originalValue, newValue, editedBy, editedAt }]
  approvedBy/At, rejectionReason
  finalData: exported JSON
  timestamps: created/updated
}
```

### LabConfig Collection
```
{
  labNames: [string]  // Lab name list
  labs: [{ name, createdAt, updatedAt }]
  thresholds: {
    criticalDeviation: 200 (%)
    warningDeviation: 50 (%)
    flaggedParameterThreshold: 50 (%)
    autoApproveThreshold: 90 (%)
  }
  systemConfig: {
    enableAutoProcessing: boolean
    processingTimeout: number (seconds)
    maxFileSize: number (MB)
    retentionDays: number
    auditLogEnabled: boolean
  }
  updatedBy: reference to User
  timestamps: created/updated
}
```

---

## Development Status

### Completed (Phase 1-3)
- ✅ Backend server setup (Express + MongoDB)
- ✅ User authentication (JWT)
- ✅ Role-based authorization
- ✅ PDF upload infrastructure
- ✅ File storage and retrieval
- ✅ Database modeling
- ✅ API routing structure
- ✅ Basic frontend structure

### In Development (Phase 4+)
- AI extraction pipeline (GPT integration)
- Threshold checking and flagging
- Frontend review interface
- Admin configuration UI
- Dashboard and analytics
- Report listing and filtering
- Data export functionality
- Error handling & recovery
- Testing suite
- Performance optimization
- Security hardening
- Production deployment

### Estimated: 9 more phases (~3-6 months at current pace)

---

## Known Issues & Limitations

### Current Limitations
- Local file storage only (not production-ready)
- No message queue for async processing
- Single MongoDB instance (no replication)
- Limited error recovery mechanisms
- No automatic data cleanup
- API keys in .env (should use secrets management)

### Areas for Improvement
- Implement S3/cloud storage
- Add Redis for caching
- Implement message queue (Bull/RabbitMQ)
- Add comprehensive testing
- Structured logging (Winston)
- Performance monitoring
- CI/CD pipeline
- Docker containerization

---

## How to Use the Documentation

### For Quick Understanding (5-10 minutes)
1. Read **CODEBASE_SUMMARY.md** - Quick Reference section
2. Check **Project Summary** in this document
3. Review **Tech Stack** section

### For Development Work (30 minutes)
1. Read **CODEBASE_SUMMARY.md** completely
2. Review **API Endpoints** and **Key Features**
3. Check **Directory Structure** and **Important Files**
4. Look up specific features in **CODEBASE_ANALYSIS.md**

### For Deep Technical Understanding (1-2 hours)
1. Read **CODEBASE_ANALYSIS.md** completely
2. Review **Data Models & Schemas** section
3. Understand **Authentication & Authorization**
4. Study **File Processing Flow Diagram**
5. Review **Design Patterns** and **Architecture**

### For Contributing/Extending (varies)
1. Find your feature in **CODEBASE_ANALYSIS.md**
2. Locate relevant files in **Key Files Summary**
3. Understand the data flow for your feature
4. Review **Security Features** before implementation
5. Check **Common Tasks** for examples

---

## Contact Points in the Codebase

### For Authentication Issues
- File: `backend/src/middleware/auth.middleware.js`
- File: `backend/src/controllers/auth.controller.js`
- File: `frontend/src/contexts/AuthContext.tsx`

### For PDF Processing Issues
- File: `backend/src/services/pdfTextExtractor.service.js`
- File: `backend/src/services/pdfConverter.service.js`
- File: `backend/src/controllers/process.controller.js`

### For AI Integration Issues
- File: `backend/src/services/gptExtractor.service.js`
- File: `backend/src/services/geminiExtractor.service.js`
- File: `.env` (API key configuration)

### For Database Issues
- File: `backend/src/config/database.js`
- File: `backend/src/models/*.js`
- File: `backend/src/utils/seed.js`

### For Frontend/UI Issues
- File: `frontend/src/pages/*/`
- File: `frontend/src/components/*/`
- File: `frontend/src/theme.ts`

### For API Issues
- File: `backend/src/routes/*.js`
- File: `frontend/src/services/api.ts`

---

## Environment Variables Reference

```
# Server Configuration
PORT=5001                              # API server port
NODE_ENV=development                   # Environment

# Database
MONGODB_URI=mongodb://localhost:27017/lab_digitization  # MongoDB connection

# Authentication
JWT_SECRET=your-secret-key            # JWT signing key
JWT_EXPIRE=7d                         # Token expiry

# AI APIs
OPENAI_API_KEY=sk-...                # OpenAI API key
GEMINI_API_KEY=AIzaSy...             # Google Gemini API key

# File Upload
MAX_FILE_SIZE=10485760                # Max file size (bytes)
UPLOAD_DIR=./uploads                  # Upload directory

# CORS
FRONTEND_URL=http://localhost:3000    # Frontend URL for CORS
```

---

## Next Steps

1. **Review Documentation**: Start with CODEBASE_SUMMARY.md
2. **Setup Environment**: Follow Quick Start in this document
3. **Explore Code**: Use directory structure to navigate
4. **Review Specific Features**: Find in CODEBASE_ANALYSIS.md
5. **Understand Data Flow**: Review diagrams in analysis
6. **Start Contributing**: Follow Common Tasks examples

---

**Documentation Generated**: November 7, 2025
**Codebase Size**: ~12,000 lines
**Total Documentation**: ~3,500+ lines across 3 files
**Coverage**: Comprehensive (22 sections + summary + quick ref)

