# Lab Report Digitization System - Feature Documentation

## Project Overview

A full-stack web application for digitizing PDF lab reports using AI (GPT-4o/Gemini), with comprehensive review workflows, order validation, and analytics.

**Tech Stack:**
- Backend: Node.js + Express + MongoDB
- Frontend: React 18 + TypeScript + Material-UI
- AI: OpenAI GPT-4o/4.1 + Google Gemini 2.5/2.0 Flash
- Auth: JWT + bcrypt

---

## System Architecture

### Backend Structure
```
backend/src/
├── models/          # Database schemas (Mongoose)
├── controllers/     # Business logic and API endpoints
├── services/        # AI extraction and processing services
├── middleware/      # Auth, upload, security, error handling
├── routes/          # API route definitions
├── config/          # Database and server configuration
└── utils/           # Helper functions and seed data
```

### Frontend Structure
```
frontend/src/
├── pages/           # Route components (Dashboard, Upload, Review, Admin)
├── components/      # Reusable UI components
├── contexts/        # Global state management (Auth)
├── services/        # API client and interceptors
└── types/           # TypeScript type definitions
```

---

## Feature Inventory

### 1. AUTHENTICATION & AUTHORIZATION

**Feature:** User authentication with role-based access control
**Backend Files:**
- `models/User.js` - User schema with password hashing
- `controllers/auth.controller.js` - Login, verify, logout endpoints
- `middleware/auth.middleware.js` - JWT verification and role checks

**Frontend Files:**
- `contexts/AuthContext.tsx` - Global auth state management
- `pages/Login.tsx` - Login page
- `components/ProtectedRoute.tsx` - Route guards

**Roles:** super_admin, admin, nurse

---

### 2. USER MANAGEMENT

**Feature:** Admin user CRUD operations
**Backend Files:**
- `controllers/admin.controller.js` - User creation, updates, deletion, status management

**Frontend Files:**
- `pages/admin/UserManagement.tsx` - User list, create, edit, deactivate

**Capabilities:** Create users, assign roles, activate/deactivate, prevent self-deletion

---

### 3. PDF UPLOAD & STORAGE

**Feature:** Single and multiple PDF file uploads
**Backend Files:**
- `controllers/report.controller.js` - Upload, download, list, delete endpoints
- `middleware/upload.middleware.js` - Multer configuration for PDF files
- `models/Report.js` - Report schema with file paths and metadata

**Frontend Files:**
- `pages/nurse/UploadReport.tsx` - Drag-and-drop upload interface

**Storage:** Local file system (`uploads/` directory)
**Limits:** 10MB per file, PDF format only

---

### 4. AI-POWERED DATA EXTRACTION

**Feature:** Multi-modal PDF data extraction using AI
**Backend Files:**
- `controllers/process.controller.js` - Processing orchestration
- `services/geminiExtractor.service.js` - Google Gemini integration
- `services/gpt4oExtractor.service.js` - OpenAI GPT-4o integration
- `services/pdfTextExtractor.service.js` - Text extraction
- `services/pdfConverter.service.js` - PDF to image conversion

**Extraction Methods:**
- Text: Extract text from PDF, process with LLM
- Image: Convert PDF to images, use vision AI
- Hybrid: Auto-detect best method
- PDF: Direct PDF processing (model-dependent)

**AI Models Supported:**
- OpenAI: GPT-4o, GPT-4.1
- Google: Gemini 2.5 Flash, 2.5 Flash-Lite, 2.0 Flash

**Features:**
- Page-wise extraction for improved accuracy
- Lab name validation against configured list
- Patient demographics extraction
- Token usage and cost tracking

---

### 5. THRESHOLD ANALYSIS & ABNORMALITY DETECTION

**Feature:** Automated detection of abnormal lab values
**Backend Files:**
- `services/thresholdChecker.service.js` - Abnormality detection and severity classification

**Capabilities:**
- Calculate percentage deviation from reference ranges
- Severity levels: normal, mild, moderate, critical
- Generate UI indicators (color codes, badges, priority flags)
- Flag reports with high abnormality counts

---

### 6. ORDER MANAGEMENT

**Feature:** Patient order tracking and validation
**Backend Files:**
- `models/Order.js` - Order schema with patient demographics
- `controllers/order.controller.js` - CRUD, bulk import, search, analytics
- `services/orderValidation.service.js` - Demographics validation

**Frontend Files:**
- Admin order management pages (referenced in routes)

**Capabilities:**
- Order CRUD operations
- Bulk order import
- Order-report linking
- Patient demographics validation
- Search and filtering
- Soft delete functionality

---

### 7. REVIEW & APPROVAL WORKFLOW

**Feature:** Comprehensive report review with validation
**Backend Files:**
- `controllers/review.controller.js` - Edit, approve, reject, validation endpoints
- `models/Report.js` - Edit history, audit trail, validation warnings

**Frontend Files:**
- `pages/nurse/ReviewReport.tsx` - Side-by-side PDF viewer and data editor

**Features:**
- PDF viewer with extracted data side-by-side
- Inline parameter editing with real-time validation
- Order ID validation against database
- Demographics matching (name, age, gender, date)
- Mismatch detection and override workflow
- Approval with validation checks
- Rejection with reason tracking
- Complete edit history and audit trail
- Patient name update capability

**Validation Checks:**
- Order exists in database
- Patient name matches order
- Demographics consistency
- Required fields present
- Abnormality flags reviewed

---

### 8. AUDIT & COMPLIANCE

**Feature:** Complete audit trail and mismatch tracking
**Backend Files:**
- `models/AuditLog.js` - Audit log schema
- `controllers/auditAnalytics.controller.js` - Audit statistics and analytics

**Frontend Files:**
- `pages/admin/AuditDashboard.tsx` - Audit visualizations and reports

**Tracked Actions:**
- All parameter edits with before/after values
- Approval with mismatch overrides
- Patient name updates
- Validation warning acknowledgments

**Analytics:**
- Accuracy metrics and trends
- Most edited parameters
- User-specific audit trails
- Mismatch statistics by type
- Override frequency tracking

---

### 9. DASHBOARD & ANALYTICS

**Feature:** Real-time statistics and visualizations
**Backend Files:**
- `controllers/dashboard.controller.js` - Stats, metrics, health, activity endpoints

**Frontend Files:**
- `pages/nurse/NurseDashboard.tsx` - Nurse-specific dashboard
- `pages/admin/AdminDashboard.tsx` - System-wide analytics with trends

**Nurse Dashboard:**
- Report counts by status
- Recent uploads
- Quick actions (upload, review)
- Flagged reports

**Admin Dashboard:**
- Total reports with trend analysis
- Active users statistics
- Average processing time trends
- Approval rate metrics
- Status distribution (pie chart)
- Report activity trends (area chart)
- Lab distribution (donut chart)
- Top performing users table
- Performance metrics over time

**Time Ranges:** Today, Week, Month, Year

---

### 10. REPORT MANAGEMENT

**Feature:** Comprehensive report listing and filtering
**Backend Files:**
- `controllers/report.controller.js` - List, filter, download endpoints

**Frontend Files:**
- `pages/nurse/ReportsList.tsx` - Pending review reports
- `pages/nurse/AllReportsList.tsx` - Complete report history

**Capabilities:**
- Filter by status (uploaded, processing, ready, approved, rejected)
- Search by order ID, patient name, lab name
- Pagination support
- Download original PDF
- Delete reports (admin only)
- Role-based filtering (nurses see their uploads, admins see all)

**Report Statuses:**
- uploaded: PDF uploaded, awaiting processing
- processing: AI extraction in progress
- ready: Extracted, awaiting review
- approved: Reviewed and approved
- rejected: Rejected with reason
- error: Processing failed

---

### 11. CONFIGURATION MANAGEMENT

**Feature:** System-wide settings and thresholds
**Backend Files:**
- `models/LabConfig.js` - Configuration schema
- `controllers/labConfig.controller.js` - Config CRUD endpoints

**Frontend Files:**
- `pages/admin/ConfigurationManagement.tsx` - Configuration UI

**Settings:**
- Lab Names: List of valid lab names for AI validation
- Threshold Percentages:
  - Critical deviation (default: 200%)
  - Warning deviation (default: 150%)
  - Flagged parameter threshold (default: 50%)
- System Config:
  - Auto-processing enable/disable
  - Max file size
  - Retention days
  - Audit logging enable/disable

---

### 12. DATA EXPORT

**Feature:** Multiple export formats with filtering
**Backend Files:**
- `controllers/export.controller.js` - CSV, Excel, JSON export endpoints

**Export Formats:**
- **CSV:** Filtered report data with customizable columns
- **Excel:** Multi-sheet workbook with formatting
  - Reports sheet with all details
  - Statistics sheet
  - Summary sheet
- **JSON:** Individual report final data
- **Summary Reports:** Analytics and metrics export

**Filters:** Date range, status, lab name, user

---

### 13. PROCESSING METADATA & COST TRACKING

**Feature:** Detailed processing metrics and cost analysis
**Backend Files:**
- `models/Report.js` - processingMetadata field
- All extractor services track tokens and timing

**Tracked Metrics:**
- Total processing time (seconds)
- Token usage (input/output/total)
- Estimated cost (model-specific pricing)
- Extraction method used
- Model used
- Page count processed
- Timestamp of processing

---

### 14. UI INDICATORS & VISUAL FEEDBACK

**Feature:** Color-coded indicators for report status
**Backend Files:**
- `services/thresholdChecker.service.js` - Generate UI indicators

**Frontend Files:**
- All report listing pages use indicators

**Indicator Types:**
- **Color:** green (normal), yellow (warning), orange (moderate), red (critical)
- **Badge:** Normal, Flagged, Critical
- **Priority:** Low, Medium, High, Critical
- **Severity Count:** Number of parameters by severity level

---

## Database Models

### User
**File:** `backend/src/models/User.js`
**Purpose:** User authentication and authorization
**Key Fields:** email, password, name, role, status, isActive, lastLogin

### Report
**File:** `backend/src/models/Report.js`
**Purpose:** Lab report data and processing metadata
**Key Fields:** orderId, uploadedBy, pdfPath, status, extractedData, flags, uiIndicators, editHistory, finalData, auditSummary, validationWarnings, processingMetadata, approvedBy, rejectedBy

### Order
**File:** `backend/src/models/Order.js`
**Purpose:** Patient order management
**Key Fields:** order_id, patient_name, patient_age, gender, date_of_test, lab_name, location, cug_code, VISIT_CODE, status, billing

### LabConfig
**File:** `backend/src/models/LabConfig.js`
**Purpose:** System configuration
**Key Fields:** labNames, criticalDeviation, warningDeviation, flaggedParameterThreshold, enableAutoProcessing, maxFileSize, retentionDays, auditLogEnabled

### AuditLog
**File:** `backend/src/models/AuditLog.js`
**Purpose:** Audit trail for validations and overrides
**Key Fields:** action, reportId, orderId, userId, mismatchType, mismatches, overrideReason, metadata

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify token
- `POST /api/auth/logout` - Logout

### Reports
- `POST /api/reports/upload` - Upload single PDF
- `POST /api/reports/upload/multiple` - Upload multiple PDFs
- `GET /api/reports` - List reports (role-based filtering)
- `GET /api/reports/:id` - Get report details
- `GET /api/reports/:id/pdf` - Download PDF
- `DELETE /api/reports/:id` - Delete report (admin)

### Processing
- `POST /api/reports/:id/process` - Process PDF with AI

### Review
- `GET /api/reports/:id/validation` - Get validation data for review
- `PUT /api/reports/:id/edit` - Edit single parameter
- `PUT /api/reports/:id/edit/bulk` - Edit multiple parameters
- `POST /api/reports/:id/approve` - Approve report
- `POST /api/reports/:id/reject` - Reject report
- `PUT /api/reports/:id/order-id` - Update order ID

### Admin
- `POST /api/admin/users` - Create user
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Deactivate user

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/metrics` - Performance metrics
- `GET /api/dashboard/activity` - Recent activity
- `GET /api/dashboard/health` - System health

### Orders
- `POST /api/orders` - Create order
- `POST /api/orders/bulk` - Bulk import orders
- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order (soft delete)
- `PUT /api/orders/:id/patient-name` - Update patient name

### Configuration
- `GET /api/labConfig` - Get configuration
- `PUT /api/labConfig/labs` - Update lab names
- `PUT /api/labConfig/thresholds` - Update thresholds
- `PUT /api/labConfig/system` - Update system config

### Export
- `GET /api/export/csv` - Export CSV
- `GET /api/export/excel` - Export Excel
- `GET /api/export/json/:id` - Export JSON for single report
- `GET /api/export/summary` - Export summary report

### Audit
- `GET /api/audit/summary` - Audit summary
- `GET /api/audit/mismatches` - Mismatch records
- `GET /api/audit/accuracy` - Accuracy metrics
- `GET /api/audit/edited-parameters` - Most edited parameters
- `GET /api/audit/user/:userId/mismatches` - User-specific mismatches

---

## Frontend Pages

### Nurse Pages
- `pages/nurse/NurseDashboard.tsx` - Dashboard with statistics
- `pages/nurse/UploadReport.tsx` - PDF upload interface
- `pages/nurse/ReviewReport.tsx` - Report review and approval
- `pages/nurse/ReportsList.tsx` - Pending review reports
- `pages/nurse/AllReportsList.tsx` - Complete report history

### Admin Pages
- `pages/admin/AdminDashboard.tsx` - System analytics
- `pages/admin/UserManagement.tsx` - User administration
- `pages/admin/ConfigurationManagement.tsx` - System settings
- `pages/admin/AuditDashboard.tsx` - Audit analytics

### Auth Pages
- `pages/Login.tsx` - User login

---

## Key Components

### Common
- `components/Layout.tsx` - App shell with navigation
- `components/ProtectedRoute.tsx` - Route authentication guard
- `components/PDFViewer.tsx` - PDF display component
- `components/JsonOutputView.tsx` - JSON data viewer

### Contexts
- `contexts/AuthContext.tsx` - Global authentication state

### Services
- `services/api.ts` - Axios client with interceptors

---

## Environment Variables

### Backend (.env)
```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/lab-digitization
JWT_SECRET=your_jwt_secret_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_API_KEY=your_google_api_key
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5001/api
```

---

## Development Commands

### Backend
```bash
cd backend
npm install
npm run dev          # Start development server
node src/utils/seed.js  # Seed super admin user
```

### Frontend
```bash
cd frontend
npm install
npm start            # Start React development server
```

### Database
```bash
mongod               # Start MongoDB
```

---

## Default Credentials

**Super Admin:**
- Email: admin@labdigital.com
- Password: Admin@123

**Test Nurse:**
- Email: nurse1@hospital.com
- Password: Nurse@123

---

## Project Status

**Fully Implemented Features:**
- ✅ Authentication & Authorization
- ✅ User Management
- ✅ PDF Upload (single & multiple)
- ✅ AI Data Extraction (5 models, 4 methods)
- ✅ Threshold Analysis & Abnormality Detection
- ✅ Order Management & Validation
- ✅ Review & Approval Workflow
- ✅ Demographics Validation
- ✅ Edit History & Audit Trail
- ✅ Dashboard & Analytics (with real data)
- ✅ Report Management & Filtering
- ✅ Configuration Management
- ✅ Data Export (CSV, Excel, JSON)
- ✅ Audit Analytics
- ✅ UI Indicators & Visual Feedback
- ✅ Processing Metadata & Cost Tracking
- ✅ Mismatch Detection & Override Workflow

**Architecture Highlights:**
- Full-stack TypeScript/JavaScript
- RESTful API design
- JWT-based authentication
- Role-based access control (RBAC)
- Comprehensive error handling
- Audit logging for compliance
- Real-time statistics and trends
- Multi-modal AI extraction
- Cost-optimized model selection

---

*Last Updated: January 2025*
*Version: 2.0.0*
*Status: Production-Ready*
