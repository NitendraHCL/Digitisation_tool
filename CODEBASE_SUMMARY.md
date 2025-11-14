# Lab Report Digitization System - Quick Reference Guide

## Project At a Glance

**Purpose**: AI-powered medical lab report digitization system with nurse review workflow

**Status**: Phase 3/12 Complete (Core Infrastructure Ready)
- Phase 1-3: ✅ COMPLETE (Backend setup, Auth, PDF Upload)
- Phase 4-12: In Development (AI Integration, Review UI, Admin Portal, etc.)

**Codebase Size**: ~12,000 lines across backend (6,500) and frontend (5,650)

---

## Tech Stack Quick Reference

### Backend
- **Runtime**: Node.js v18+
- **Framework**: Express.js 4.21.2
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT (7-day expiry)
- **File Upload**: Multer
- **Security**: Helmet, bcrypt, CORS
- **AI APIs**: OpenAI GPT-4 Vision, Google Gemini
- **PDF Processing**: pdf-parse, pdf2pic

### Frontend
- **Framework**: React 19 + TypeScript
- **Routing**: React Router DOM
- **HTTP**: Axios with interceptors
- **UI**: Material-UI v7
- **Charts**: Recharts
- **State**: React Context API + React Query
- **Notifications**: Notistack

---

## Directory Structure Overview

```
backend/
├── server.js              Main entry point
├── src/
│   ├── models/           MongoDB schemas (User, Report, LabConfig)
│   ├── controllers/      Business logic (8 controllers)
│   ├── routes/          API route definitions (7 route files)
│   ├── middleware/      Auth, upload, error handling
│   ├── services/        Core services (PDF extract, GPT, thresholds)
│   ├── utils/           JWT utilities, database seeding
│   └── config/          Database connection

frontend/src/
├── pages/               6 main pages (Login, 4 Nurse, Admin)
├── components/         Reusable UI components
├── contexts/          AuthContext for global state
├── services/          API client (Axios)
├── types/            TypeScript interfaces
└── theme.ts          Material-UI customization
```

---

## Core Features Summary

### 1. Authentication & Authorization
- JWT-based stateless auth
- Three roles: super_admin, admin, nurse
- Role-based route protection
- Default credentials for testing

### 2. PDF Upload & Management
- Drag-and-drop upload interface
- Max 10MB, PDF-only validation
- Local file storage in ./uploads
- Unique Order ID requirement

### 3. AI-Powered Extraction
- GPT-4 Vision integration (primary)
- Gemini fallback option
- Multiple extraction methods:
  - Text (fastest)
  - Image (most accurate)
  - Hybrid (balanced)
  - PDF (most robust)
- Configurable lab names list
- JSON output with all lab values

### 4. Abnormality Detection
- Threshold-based flagging
- Severity levels: mild, moderate, critical
- Default thresholds: 200% critical, 50% warning
- Color-coded indicators (green/yellow/orange/red)
- Audit trail of all changes

### 5. Report Review Workflow
- Split-screen PDF + data view
- In-line parameter editing
- Approve/Reject with comments
- Complete edit history tracking
- User attribution for all changes

### 6. Admin Features
- User management (create, edit, deactivate)
- Lab configuration management
- Threshold and system settings
- Dashboard with analytics
- Report statistics and trends

---

## API Endpoints (Quick Reference)

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Token verification

### Reports
- `POST /api/reports/upload` - Upload PDF
- `GET /api/reports` - List all reports
- `GET /api/reports/:id` - Get report details
- `GET /api/reports/:id/pdf` - Download PDF file
- `POST /api/reports/:id/process` - Start processing

### Review & Approval
- `PUT /api/review/:id` - Edit parameters
- `POST /api/review/:id/approve` - Approve report
- `POST /api/review/:id/reject` - Reject report

### Admin
- `POST /api/admin/users` - Create user
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id` - Update user
- `GET /api/lab-config` - Get config
- `PUT /api/lab-config` - Update config

### Dashboard & Export
- `GET /api/dashboard/stats` - Statistics
- `GET /api/export/:id` - Export as JSON

---

## Data Models Summary

### User
- email, password (hashed), name, role, isActive, lastLogin

### Report
- orderId, uploadedBy, pdfPath, fileSize
- status (uploaded→processing→ready→approved)
- extractedData (labName, results array)
- flags (abnormalCount, severity info)
- editHistory (audit trail)
- finalData (approved JSON output)

### LabConfig
- labNames array, lab configurations
- Thresholds (critical: 200%, warning: 50%)
- System settings (timeout, file size, etc.)

---

## Key Processing Pipeline

```
1. Nurse uploads PDF with Order ID
   ↓
2. Multer validates and saves file
   ↓
3. Admin/Nurse initiates processing
   ↓
4. Backend processes:
   - Extract text from PDF
   - Convert to images (if hybrid/image method)
   - Send to GPT-4 Vision API
   - Parse JSON response
   ↓
5. Threshold checking:
   - Compare values to reference ranges
   - Calculate deviation percentages
   - Mark abnormal values
   ↓
6. Generate flags and UI indicators
   ↓
7. Status set to 'ready' for review
   ↓
8. Nurse reviews and can edit values
   ↓
9. Approve (status: approved) or Reject
   ↓
10. Approved data exported as JSON
```

---

## Environment Configuration

### Required .env Variables
```
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/lab_digitization
JWT_SECRET=change-in-production
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIzaSy...
FRONTEND_URL=http://localhost:3000
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

### Running Locally
```bash
# Terminal 1: MongoDB
mongod

# Terminal 2: Backend
cd backend
npm install
npm run seed  # Initialize database
npm run dev   # Starts on localhost:5001

# Terminal 3: Frontend
cd frontend
npm install
npm start     # Starts on localhost:3000

# Access: http://localhost:3000
# Demo: admin@labdigital.com / Admin@123
```

---

## Security Features

- JWT authentication with 7-day expiry
- bcrypt password hashing (10 rounds)
- Role-based access control
- CORS enabled for frontend only
- Helmet security headers
- File upload validation (type, size)
- Input validation on all endpoints
- Audit trail for all modifications
- Passwords never logged or returned

---

## Development Roadmap

### Completed (Phase 1-3)
- Backend server with Express + MongoDB
- User authentication and JWT
- File upload infrastructure
- Database models and relationships

### In Progress (Phase 4+)
- AI extraction and processing
- Threshold checking and flagging
- Frontend review interface
- Admin configuration portal
- Dashboard and analytics
- Error handling and testing
- Performance optimization
- Security hardening
- Testing suite
- Production deployment

---

## Common Tasks

### Add New User
```bash
# Via API
POST /api/admin/users
{
  "email": "user@hospital.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "role": "nurse"
}
```

### Upload and Process Report
1. POST /api/reports/upload (with PDF + orderId)
2. POST /api/reports/:id/process (with extraction method)
3. Wait for processing (30-60 seconds typical)
4. GET /api/reports/:id to retrieve results

### Configure Lab Names
```bash
PUT /api/lab-config
{
  "labNames": ["Quest Diagnostics", "LabCorp", "Apollo"]
}
```

### Export Processed Report
```bash
GET /api/export/:reportId
# Returns JSON in Example.json format
```

---

## Important Notes

### Security Warnings
- API keys are in .env (MUST use secrets management in production)
- Default demo credentials should be changed
- JWT_SECRET must be strong and kept secure
- MongoDB should be protected with authentication

### Performance Considerations
- Large PDFs (>10MB) will be rejected
- GPT processing takes 20-60 seconds
- Image extraction is slower than text extraction
- Database queries are indexed for performance

### Known Limitations
- Local file storage only (use S3 in production)
- No message queue for async processing
- Single MongoDB instance (no replication)
- Limited error recovery
- No automatic data cleanup

---

## Key Files to Know

**Backend Entry Points**
- `server.js` - Server initialization
- `src/config/database.js` - Database connection
- `src/services/gptExtractor.service.js` - AI processing
- `src/controllers/process.controller.js` - Processing pipeline

**Frontend Entry Points**
- `src/App.tsx` - Main router
- `src/contexts/AuthContext.tsx` - Global state
- `src/pages/nurse/ReviewReport.tsx` - Core review interface
- `src/services/api.ts` - API client setup

---

## For More Information

See `CODEBASE_ANALYSIS.md` for detailed documentation covering:
- Complete architecture overview
- All API endpoints with examples
- Database schema details
- Feature descriptions
- Security implementation details
- Development guidelines
- Deployment considerations

