require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// ========== EXTENSIVE DEBUGGING LOGS ==========
console.log('========================================');
console.log('[SERVER] ========== STARTING SERVER ==========');
console.log('[SERVER] Timestamp:', new Date().toISOString());
console.log('[SERVER] Node version:', process.version);
console.log('[SERVER] Platform:', process.platform);
console.log('[SERVER] Working directory:', process.cwd());
console.log('========================================');

// Environment variables check
console.log('[SERVER] ========== ENVIRONMENT VARIABLES ==========');
console.log('[SERVER] NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('[SERVER] PORT:', process.env.PORT || '5001');
console.log('[SERVER] MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
console.log('[SERVER] JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('[SERVER] OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'NOT SET');
console.log('[SERVER] GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET (length: ' + process.env.GEMINI_API_KEY.length + ')' : 'NOT SET');
console.log('[SERVER] FRONTEND_URL:', process.env.FRONTEND_URL || 'http://localhost:3000');
console.log('[SERVER] UPLOAD_DIR:', process.env.UPLOAD_DIR || './uploads');
console.log('[SERVER] MAX_FILE_SIZE:', process.env.MAX_FILE_SIZE || '10485760');
console.log('========================================');

// Initialize Express app
console.log('[SERVER] Initializing Express application...');
const app = express();
console.log('[SERVER] ✓ Express app created');

// Database connection
console.log('[SERVER] ========== DATABASE CONNECTION ==========');
const connectDB = require('./src/config/database');
console.log('[SERVER] Database module loaded');

// Middleware setup
console.log('[SERVER] ========== MIDDLEWARE SETUP ==========');

// Security middleware
console.log('[SERVER] Loading security middleware (helmet)...');
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
      // Don't upgrade to HTTPS in development since we're on HTTP
      ...(isDevelopment && { "upgrade-insecure-requests": null })
    }
  }
}));
console.log('[SERVER] ✓ Helmet security headers enabled with CSP for frame-ancestors');

// CORS configuration
console.log('[SERVER] Configuring CORS...');
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
console.log('[SERVER] ✓ CORS enabled for origin:', corsOptions.origin);

// Body parsing middleware
console.log('[SERVER] Setting up body parsers...');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
console.log('[SERVER] ✓ Body parsers configured (limit: 50mb)');

// HTTP request logging
console.log('[SERVER] Setting up Morgan HTTP request logger...');
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  console.log('[SERVER] ✓ Morgan logger enabled (dev mode)');
} else {
  app.use(morgan('combined'));
  console.log('[SERVER] ✓ Morgan logger enabled (combined mode)');
}

// Static files - uploads directory
console.log('[SERVER] Configuring static file serving...');
const uploadsDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
console.log('[SERVER] Uploads directory path:', uploadsDir);
// eslint-disable-next-line security/detect-non-literal-fs-filename
if (!fs.existsSync(uploadsDir)) {
  console.log('[SERVER] ⚠️  Uploads directory does not exist, creating...');
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('[SERVER] ✓ Uploads directory created');
} else {
  console.log('[SERVER] ✓ Uploads directory exists');
}

// Add Cross-Origin-Resource-Policy header to allow PDFs to be embedded in iframes
// This is required when the frontend uses Cross-Origin-Embedder-Policy: require-corp
// Security note: Consider adding authentication middleware here to restrict access to authorized users only
app.use('/uploads', (req, res, next) => {
  // Allow cross-origin embedding while maintaining CORS restrictions via corsOptions above
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

app.use('/uploads', express.static(uploadsDir));
console.log('[SERVER] ✓ Static file serving enabled for /uploads with CORP headers');

// Temp directory for processing
const tempDir = path.join(__dirname, 'temp');
console.log('[SERVER] Temp directory path:', tempDir);
if (!fs.existsSync(tempDir)) {
  console.log('[SERVER] ⚠️  Temp directory does not exist, creating...');
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('[SERVER] ✓ Temp directory created');
} else {
  console.log('[SERVER] ✓ Temp directory exists');
}

// Request logging middleware (custom)
console.log('[SERVER] Setting up custom request logging middleware...');
app.use((req, res, next) => {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  console.log(`[REQUEST ${requestId}] ========== INCOMING REQUEST ==========`);
  console.log(`[REQUEST ${requestId}] Time: ${timestamp}`);
  console.log(`[REQUEST ${requestId}] Method: ${req.method}`);
  console.log(`[REQUEST ${requestId}] URL: ${req.url}`);
  console.log(`[REQUEST ${requestId}] IP: ${req.ip}`);
  console.log(`[REQUEST ${requestId}] User-Agent: ${req.get('user-agent')}`);
  console.log(`[REQUEST ${requestId}] Content-Type: ${req.get('content-type')}`);
  console.log(`[REQUEST ${requestId}] Authorization: ${req.get('authorization') ? 'Bearer ***' : 'None'}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`[REQUEST ${requestId}] Body keys:`, Object.keys(req.body));
  }

  // Store request ID for response logging
  req.requestId = requestId;
  req.startTime = Date.now();

  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    console.log(`[REQUEST ${requestId}] ========== RESPONSE ==========`);
    console.log(`[REQUEST ${requestId}] Status: ${res.statusCode}`);
    console.log(`[REQUEST ${requestId}] Duration: ${duration}ms`);
    if (res.statusCode >= 400) {
      console.log(`[REQUEST ${requestId}] ⚠️  Error response:`, typeof data === 'string' ? data.substring(0, 200) : '');
    } else {
      console.log(`[REQUEST ${requestId}] ✓ Success`);
    }
    console.log(`[REQUEST ${requestId}] ==========================================`);
    return originalSend.call(this, data);
  };

  next();
});
console.log('[SERVER] ✓ Custom request logging middleware enabled');

// Health check endpoint
console.log('[SERVER] Setting up health check endpoint...');
app.get('/health', (req, res) => {
  console.log('[HEALTH] Health check requested');
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});
console.log('[SERVER] ✓ Health check endpoint registered at GET /health');

// API Routes
console.log('[SERVER] ========== LOADING API ROUTES ==========');

// Auth routes
console.log('[SERVER] Loading auth routes...');
try {
  const authRoutes = require('./src/routes/auth.routes');
  app.use('/api/auth', authRoutes);
  console.log('[SERVER] ✓ Auth routes registered at /api/auth');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading auth routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Admin routes
console.log('[SERVER] Loading admin routes...');
try {
  const adminRoutes = require('./src/routes/admin.routes');
  app.use('/api/admin', adminRoutes);
  console.log('[SERVER] ✓ Admin routes registered at /api/admin');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading admin routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Report routes
console.log('[SERVER] Loading report routes...');
try {
  const reportRoutes = require('./src/routes/report.routes');
  app.use('/api/reports', reportRoutes);
  console.log('[SERVER] ✓ Report routes registered at /api/reports');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading report routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Review routes
console.log('[SERVER] Loading review routes...');
try {
  const reviewRoutes = require('./src/routes/review.routes');
  app.use('/api/review', reviewRoutes);
  console.log('[SERVER] ✓ Review routes registered at /api/review');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading review routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Dashboard routes
console.log('[SERVER] Loading dashboard routes...');
try {
  const dashboardRoutes = require('./src/routes/dashboard.routes');
  app.use('/api/dashboard', dashboardRoutes);
  console.log('[SERVER] ✓ Dashboard routes registered at /api/dashboard');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading dashboard routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Export routes
console.log('[SERVER] Loading export routes...');
try {
  const exportRoutes = require('./src/routes/export.routes');
  app.use('/api/export', exportRoutes);
  console.log('[SERVER] ✓ Export routes registered at /api/export');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading export routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Lab config routes
console.log('[SERVER] Loading lab config routes...');
try {
  const labConfigRoutes = require('./src/routes/labConfig.routes');
  app.use('/api/lab-config', labConfigRoutes);
  console.log('[SERVER] ✓ Lab config routes registered at /api/lab-config');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading lab config routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Order routes
console.log('[SERVER] Loading order routes...');
try {
  const orderRoutes = require('./src/routes/order.routes');
  app.use('/api/orders', orderRoutes);
  console.log('[SERVER] ✓ Order routes registered at /api/orders');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading order routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Audit routes
console.log('[SERVER] Loading audit routes...');
try {
  const auditRoutes = require('./src/routes/audit.routes');
  app.use('/api/audit', auditRoutes);
  console.log('[SERVER] ✓ Audit routes registered at /api/audit');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading audit routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Parameter Master routes
console.log('[SERVER] Loading parameter master routes...');
try {
  const parameterMasterRoutes = require('./src/routes/parameterMaster.routes');
  app.use('/api/parameter-master', parameterMasterRoutes);
  console.log('[SERVER] ✓ Parameter master routes registered at /api/parameter-master');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading parameter master routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Parameter Exclusion routes
console.log('[SERVER] Loading parameter exclusion routes...');
try {
  const exclusionRoutes = require('./src/routes/exclusion.routes');
  app.use('/api/exclusions', exclusionRoutes);
  console.log('[SERVER] ✓ Parameter exclusion routes registered at /api/exclusions');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading parameter exclusion routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

// Parameter Suggestion routes
console.log('[SERVER] Loading parameter suggestion routes...');
try {
  const parameterSuggestionRoutes = require('./src/routes/parameterSuggestion.routes');
  app.use('/api/parameter-suggestions', parameterSuggestionRoutes);
  console.log('[SERVER] ✓ Parameter suggestion routes registered at /api/parameter-suggestions');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading parameter suggestion routes:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
}

console.log('[SERVER] ========== ALL ROUTES LOADED ==========');

// 404 handler
console.log('[SERVER] Setting up 404 handler...');
app.use((req, res) => {
  console.log(`[SERVER] ⚠️  404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`,
    path: req.url
  });
});
console.log('[SERVER] ✓ 404 handler registered');

// Error handling middleware
console.log('[SERVER] Loading error handling middleware...');
try {
  const { errorHandler } = require('./src/middleware/error.middleware');
  app.use(errorHandler);
  console.log('[SERVER] ✓ Error handling middleware registered');
} catch (error) {
  console.error('[SERVER] ✗ ERROR loading error middleware:', error.message);
  console.error('[SERVER] Stack trace:', error.stack);
  // Fallback error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    console.error('[SERVER] ✗✗✗ UNHANDLED ERROR ✗✗✗');
    console.error('[SERVER] Error:', err.message);
    console.error('[SERVER] Stack:', err.stack);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  });
  console.log('[SERVER] ✓ Fallback error handler registered');
}

// Start server function
const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    console.log('[SERVER] ========== STARTING SERVER INITIALIZATION ==========');

    // Connect to database
    console.log('[SERVER] Step 1: Connecting to MongoDB...');
    await connectDB();
    console.log('[SERVER] ✓ Database connection successful');

    // Start listening
    console.log(`[SERVER] Step 2: Starting HTTP server on port ${PORT}...`);
    const server = app.listen(PORT, () => {
      console.log('[SERVER] ========================================');
      console.log('[SERVER] ✓✓✓ SERVER STARTED SUCCESSFULLY ✓✓✓');
      console.log('[SERVER] ========================================');
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[SERVER] Server URL: http://localhost:${PORT}`);
      console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
      console.log(`[SERVER] API base URL: http://localhost:${PORT}/api`);
      console.log(`[SERVER] Process ID: ${process.pid}`);
      console.log(`[SERVER] Started at: ${new Date().toISOString()}`);
      console.log('[SERVER] ========================================');
      console.log('[SERVER] Ready to accept requests...');
      console.log('[SERVER] ========================================');
    });

    // Server error handling
    server.on('error', (error) => {
      console.error('[SERVER] ✗✗✗ SERVER ERROR ✗✗✗');
      console.error('[SERVER] Error code:', error.code);
      console.error('[SERVER] Error message:', error.message);
      if (error.code === 'EADDRINUSE') {
        console.error(`[SERVER] Port ${PORT} is already in use`);
        console.error('[SERVER] Please kill the process using this port or use a different port');
      }
      console.error('[SERVER] Stack trace:', error.stack);
      process.exit(1);
    });

  } catch (error) {
    console.error('[SERVER] ✗✗✗ FAILED TO START SERVER ✗✗✗');
    console.error('[SERVER] Error type:', error.constructor.name);
    console.error('[SERVER] Error message:', error.message);
    console.error('[SERVER] Stack trace:', error.stack);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] ========================================');
  console.log('[SERVER] SIGTERM signal received');
  console.log('[SERVER] Closing HTTP server gracefully...');
  console.log('[SERVER] ========================================');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SERVER] ========================================');
  console.log('[SERVER] SIGINT signal received (Ctrl+C)');
  console.log('[SERVER] Closing HTTP server gracefully...');
  console.log('[SERVER] ========================================');
  process.exit(0);
});

// Unhandled rejection handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] ✗✗✗ UNHANDLED PROMISE REJECTION ✗✗✗');
  console.error('[SERVER] Reason:', reason);
  console.error('[SERVER] Promise:', promise);
  console.error('[SERVER] ========================================');
});

// Uncaught exception handling
process.on('uncaughtException', (error) => {
  console.error('[SERVER] ✗✗✗ UNCAUGHT EXCEPTION ✗✗✗');
  console.error('[SERVER] Error:', error.message);
  console.error('[SERVER] Stack:', error.stack);
  console.error('[SERVER] ========================================');
  process.exit(1);
});

// Start the server
console.log('[SERVER] Calling startServer()...');
startServer();
