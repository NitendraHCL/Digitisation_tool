# Lab Report Digitization API Documentation

## Base URL
```
Development: http://localhost:5001/api
Production: https://your-domain.com/api
```

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## API Endpoints

### 1. Authentication

#### Login
```http
POST /auth/login
```
**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "name": "User Name",
      "role": "nurse"
    }
  }
}
```

#### Get Profile
```http
GET /auth/profile
Headers: Authorization: Bearer <token>
```

### 2. Admin Management

#### Create User (Admin only)
```http
POST /admin/users
Headers: Authorization: Bearer <admin-token>
```
**Body:**
```json
{
  "email": "nurse@hospital.com",
  "password": "Nurse@123",
  "name": "Nurse Name",
  "role": "nurse"
}
```

#### Get All Users (Admin only)
```http
GET /admin/users
Headers: Authorization: Bearer <admin-token>
```

#### Update User (Admin only)
```http
PUT /admin/users/:id
Headers: Authorization: Bearer <admin-token>
```

#### Delete User (Admin only)
```http
DELETE /admin/users/:id
Headers: Authorization: Bearer <admin-token>
```

### 3. Report Management

#### Upload PDF
```http
POST /reports/upload
Headers:
  - Authorization: Bearer <token>
  - Content-Type: multipart/form-data
```
**Form Data:**
- `pdf`: PDF file (max 10MB)
- `orderId`: Unique order ID

**Response:**
```json
{
  "success": true,
  "message": "PDF uploaded successfully",
  "data": {
    "reportId": "report-id",
    "orderId": "ORD-001",
    "fileName": "report.pdf",
    "fileSize": 2048576,
    "status": "uploaded"
  }
}
```

#### Process Report
```http
POST /reports/:id/process
Headers: Authorization: Bearer <token>
```
**Response:**
```json
{
  "success": true,
  "message": "Report processed successfully",
  "data": {
    "reportId": "report-id",
    "orderId": "ORD-001",
    "labName": "LabCorp",
    "parametersExtracted": 18,
    "status": "ready"
  }
}
```

#### Get Reports
```http
GET /reports
Headers: Authorization: Bearer <token>
Query Parameters:
  - status: uploaded|processing|ready|approved|rejected|error
  - page: 1
  - limit: 20
```

#### Get Report by ID
```http
GET /reports/:id
Headers: Authorization: Bearer <token>
```

#### Download PDF
```http
GET /reports/:id/pdf
Headers: Authorization: Bearer <token>
```

#### Get Extracted Data
```http
GET /reports/:id/extracted
Headers: Authorization: Bearer <token>
```

### 4. Review & Approval

#### Get Report for Review
```http
GET /review/:id
Headers: Authorization: Bearer <token>
```

#### Edit Single Parameter
```http
PUT /review/:id/parameter
Headers: Authorization: Bearer <token>
```
**Body:**
```json
{
  "parameterName": "Hemoglobin",
  "field": "value",
  "newValue": "14.5",
  "reason": "Manual correction"
}
```

#### Bulk Edit Parameters
```http
PUT /review/:id/bulk-edit
Headers: Authorization: Bearer <token>
```
**Body:**
```json
{
  "edits": [
    {
      "parameterName": "Hemoglobin",
      "field": "value",
      "newValue": "14.5",
      "reason": "Correction"
    }
  ]
}
```

#### Approve Report
```http
POST /review/:id/approve
Headers: Authorization: Bearer <token>
```
**Body:**
```json
{
  "comments": "Approved after review"
}
```

#### Reject Report
```http
POST /review/:id/reject
Headers: Authorization: Bearer <token>
```
**Body:**
```json
{
  "reason": "Poor scan quality"
}
```

#### Get Edit History
```http
GET /review/:id/history
Headers: Authorization: Bearer <token>
```

### 5. Lab Configuration (Admin only)

#### Get Configuration
```http
GET /config
Headers: Authorization: Bearer <admin-token>
```

#### Update Thresholds
```http
PUT /config/thresholds
Headers: Authorization: Bearer <admin-token>
```
**Body:**
```json
{
  "thresholdPercentage": 200,
  "flagThreshold": 50
}
```

#### Update Lab Names
```http
PUT /config/lab-names
Headers: Authorization: Bearer <admin-token>
```
**Body:**
```json
{
  "labNames": ["LabCorp", "Quest", "Agilus"]
}
```

#### Add Lab Name
```http
POST /config/lab-names
Headers: Authorization: Bearer <admin-token>
```
**Body:**
```json
{
  "labName": "New Lab"
}
```

#### Remove Lab Name
```http
DELETE /config/lab-names
Headers: Authorization: Bearer <admin-token>
```
**Body:**
```json
{
  "labName": "Lab to Remove"
}
```

### 6. Dashboard (Admin only)

#### Get Dashboard Statistics
```http
GET /dashboard/stats
Headers: Authorization: Bearer <admin-token>
```

#### Get Recent Activity
```http
GET /dashboard/activity?limit=20
Headers: Authorization: Bearer <admin-token>
```

#### Get Performance Metrics
```http
GET /dashboard/metrics?days=30
Headers: Authorization: Bearer <admin-token>
```

#### Get System Health
```http
GET /dashboard/health
Headers: Authorization: Bearer <admin-token>
```

### 7. Export

#### Export to CSV
```http
GET /export/csv?startDate=2024-01-01&endDate=2024-12-31&status=approved
Headers: Authorization: Bearer <token>
```

#### Export to Excel
```http
GET /export/excel?includeDetails=true
Headers: Authorization: Bearer <token>
```

#### Export Single Report as JSON
```http
GET /export/json/:id
Headers: Authorization: Bearer <token>
```

#### Generate Summary Report
```http
GET /export/summary?period=30
Headers: Authorization: Bearer <token>
```

## Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error (development only)"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate)
- `413` - Payload Too Large
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

## Rate Limits

- General API: 100 requests per 15 minutes
- Authentication: 5 requests per 15 minutes
- File Upload: 20 uploads per hour
- Processing: 50 requests per hour

## Security Headers

All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy: default-src 'self'`

## File Limits

- Maximum file size: 10MB
- Allowed formats: PDF only
- Maximum request size: 50MB

## Report Status Flow

```
uploaded → processing → ready → approved/rejected
                           ↓
                         error
```

## Flag Indicators

Reports are automatically flagged based on:
- **Green (✓)**: All parameters normal
- **Yellow (!)**: Minor abnormalities
- **Orange (⚡)**: >50% parameters abnormal (configurable)
- **Red (⚠️)**: Critical values detected

## Thresholds

Default configurable thresholds:
- Abnormal value: 200% beyond reference range
- Report flagging: 50% abnormal parameters
- Critical value: 300% beyond range

## Testing Credentials

### Super Admin
```json
{
  "email": "admin@labdigital.com",
  "password": "Admin@123"
}
```

### Test Nurse
```json
{
  "email": "nurse1@hospital.com",
  "password": "Nurse@123"
}
```

## Environment Variables

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/lab_digitization
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
OPENAI_API_KEY=your_openai_api_key
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
FRONTEND_URL=http://localhost:3000
```

## Deployment Notes

1. Set `NODE_ENV=production` for production deployment
2. Use secure JWT secret
3. Configure MongoDB connection string
4. Set up SSL/TLS certificates
5. Configure reverse proxy (nginx/Apache)
6. Set up process manager (PM2)
7. Configure log rotation
8. Set up monitoring (health checks)
9. Configure backup strategy
10. Set up CI/CD pipeline