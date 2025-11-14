# Lab Report Digitization System - Backend

A comprehensive Node.js/Express backend system for digitizing PDF lab reports using OpenAI's GPT API. This system enables nurses to upload PDF lab reports, automatically extract data using AI, review and edit the extracted information, and approve final reports with complete audit trails.

## 🚀 Features

### Core Functionality
- **PDF Upload & Storage**: Secure PDF upload with validation and organized storage
- **AI-Powered Data Extraction**: Uses OpenAI GPT-4o to extract lab test parameters from PDFs
- **Intelligent Threshold Checking**: Configurable abnormality detection with visual indicators
- **Nurse Review Interface**: Complete editing capabilities with audit trail
- **Admin Dashboard**: Comprehensive statistics, metrics, and system monitoring
- **Export Capabilities**: CSV, Excel, and JSON export with filtering

### Security Features
- JWT-based authentication with role-based access control
- Rate limiting on all endpoints
- XSS and NoSQL injection protection
- Security headers with Helmet.js
- Input sanitization and validation
- Suspicious activity logging

### User Roles
- **Super Admin**: Full system access
- **Admin**: User management and configuration
- **Nurse**: Upload, review, and approve reports

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- OpenAI API Key

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
# Server Configuration
PORT=5001
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/lab_digitization

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

4. Create upload directory:
```bash
mkdir uploads
```

5. Seed the database with default admin:
```bash
npm run seed
```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run prod
```

The server will start on `http://localhost:5001`

## 📚 API Documentation

Complete API documentation is available in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

#### Reports
- `POST /api/reports/upload` - Upload PDF
- `POST /api/reports/:id/process` - Process with GPT
- `GET /api/reports` - List reports
- `GET /api/reports/:id/extracted` - Get extracted data

#### Review
- `GET /api/review/:id` - Get report for review
- `PUT /api/review/:id/parameter` - Edit parameter
- `POST /api/review/:id/approve` - Approve report
- `POST /api/review/:id/reject` - Reject report

#### Configuration (Admin)
- `GET /api/config` - Get configuration
- `PUT /api/config/thresholds` - Update thresholds
- `PUT /api/config/lab-names` - Update lab names

#### Dashboard (Admin)
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/metrics` - Performance metrics
- `GET /api/dashboard/health` - System health

#### Export
- `GET /api/export/csv` - Export to CSV
- `GET /api/export/excel` - Export to Excel
- `GET /api/export/json/:id` - Export single report

## 🔄 Workflow

1. **Upload**: Nurse uploads PDF with unique order ID
2. **Process**: System extracts text and sends to GPT API
3. **Extract**: GPT returns structured lab data in JSON format
4. **Check**: System checks thresholds and flags abnormal values
5. **Review**: Nurse reviews and edits extracted data
6. **Approve**: Nurse approves or rejects the report
7. **Export**: Approved reports can be exported in various formats

## 🎯 Threshold Configuration

The system uses configurable thresholds for abnormality detection:

- **Abnormal Threshold**: Default 200% beyond reference range
- **Report Flag Threshold**: Default 50% abnormal parameters
- **Visual Indicators**:
  - 🟢 Green (✓): Normal
  - 🟡 Yellow (!): Minor abnormalities
  - 🟠 Orange (⚡): Review required
  - 🔴 Red (⚠️): Critical values

## 📊 Database Schema

### Main Collections
- **Users**: User accounts with roles
- **Reports**: PDF reports and extracted data
- **LabConfigs**: System configuration
- **Edit History**: Complete audit trail

## 🔐 Security

- **Authentication**: JWT tokens with 7-day expiry
- **Rate Limiting**:
  - General: 100 req/15min
  - Auth: 5 req/15min
  - Upload: 20/hour
- **File Security**: PDF only, 10MB max
- **Data Sanitization**: XSS and injection prevention

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/         # Database configuration
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Auth, security, error handling
│   ├── models/         # Mongoose schemas
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   └── utils/          # Helper functions
├── uploads/            # PDF storage
├── server.js           # Main application file
├── .env               # Environment variables
└── package.json       # Dependencies
```

## 🧪 Testing

### Test Credentials

**Super Admin:**
```json
{
  "email": "admin@labdigital.com",
  "password": "Admin@123"
}
```

**Test Nurse:**
```json
{
  "email": "nurse1@hospital.com",
  "password": "Nurse@123"
}
```

## 🚀 Deployment

1. Set environment variables for production
2. Use process manager (PM2):
```bash
pm2 start server.js --name lab-digitization
```

3. Configure reverse proxy (nginx)
4. Set up SSL certificates
5. Configure MongoDB replica set
6. Set up backup strategy
7. Enable monitoring and logging

## 📈 Performance

- Database indexing on critical fields
- Efficient aggregation pipelines
- Parallel processing with Promise.all
- Request/response compression ready
- Optimized for 100+ concurrent users

## 🛠️ Maintenance

### Logs
- Development: Console output with Morgan
- Production: Configure log rotation

### Database
- Regular backups recommended
- Index optimization monthly
- Clean old reports periodically

### Updates
- Keep dependencies updated
- Monitor OpenAI API changes
- Security patches as needed

## 📝 License

ISC

## 🤝 Support

For issues or questions, please check:
1. [API Documentation](./API_DOCUMENTATION.md)
2. [Implementation Plan](./IMPLEMENTATION_PLAN.md)
3. Server logs for debugging

## 🎉 Project Status

**COMPLETED** - All 12 phases implemented successfully:

✅ Project Setup & Configuration
✅ Authentication & User Management
✅ PDF Upload & Storage
✅ OpenAI GPT Integration
✅ Threshold Checking & Flags
✅ Nurse Review Interface
✅ Admin Configuration Portal
✅ Reports & Data Management
✅ Security Implementation
✅ Error Handling
✅ Performance Optimization
✅ Deployment Preparation

The backend is production-ready and fully functional!