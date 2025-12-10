// Custom error class
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error catcher wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  const errorId = Math.random().toString(36).substring(7);
  let { statusCode = 500, message, isOperational } = err;

  // Log error with extensive details
  console.error(`[ERROR ${errorId}] ========================================`);
  console.error(`[ERROR ${errorId}] ✗✗✗ ERROR OCCURRED ✗✗✗`);
  console.error(`[ERROR ${errorId}] ========================================`);
  console.error(`[ERROR ${errorId}] Timestamp:`, new Date().toISOString());
  console.error(`[ERROR ${errorId}] Error ID:`, errorId);
  console.error(`[ERROR ${errorId}] Request Info:`);
  console.error(`[ERROR ${errorId}]   - Method: ${req.method}`);
  console.error(`[ERROR ${errorId}]   - URL: ${req.url}`);
  console.error(`[ERROR ${errorId}]   - Path: ${req.path}`);
  console.error(`[ERROR ${errorId}]   - IP: ${req.ip}`);
  console.error(`[ERROR ${errorId}]   - User-Agent: ${req.get('user-agent')}`);
  if (req.user) {
    console.error(`[ERROR ${errorId}]   - User: ${req.user.email} (${req.user.role})`);
  }
  console.error(`[ERROR ${errorId}] Error Details:`);
  console.error(`[ERROR ${errorId}]   - Type: ${err.constructor.name}`);
  console.error(`[ERROR ${errorId}]   - Name: ${err.name}`);
  console.error(`[ERROR ${errorId}]   - Message: ${message}`);
  console.error(`[ERROR ${errorId}]   - Status Code: ${statusCode}`);
  console.error(`[ERROR ${errorId}]   - Is Operational: ${isOperational}`);
  if (err.code) {
    console.error(`[ERROR ${errorId}]   - Error Code: ${err.code}`);
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(`[ERROR ${errorId}] Stack Trace:`);
    console.error(err.stack);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map(e => e.message);
    message = `Validation Error: ${errors.join(', ')}`;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please login again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired. Please login again.';
  }

  // Multer errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'FILE_TOO_LARGE') {
      message = 'File too large. Maximum size is 10MB.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    } else {
      message = err.message;
    }
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError') {
    statusCode = 503;
    message = 'Database connection error';
  }

  // Default to 500 for programming errors
  if (!isOperational) {
    statusCode = 500;
    message = process.env.NODE_ENV === 'production'
      ? 'Something went wrong!'
      : message;
  }

  res.status(statusCode).json({
    success: false,
    status: statusCode < 500 ? 'fail' : 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && {
      error: err,
      stack: err.stack
    })
  });
};

// Not found handler
const notFoundHandler = (req, res, next) => {
  const message = `Cannot find ${req.originalUrl} on this server`;
  const err = new AppError(message, 404);
  next(err);
};

// Validation middleware factory
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
};

// Field sanitization
const sanitizeFields = (fields) => {
  return (req, res, next) => {
    fields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = req.body[field].trim();
      }
    });
    next();
  };
};

// Check required fields
const requireFields = (fields) => {
  return (req, res, next) => {
    const missing = [];

    fields.forEach(field => {
      if (!req.body[field]) {
        missing.push(field);
      }
    });

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missing
      });
    }

    next();
  };
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.name, err.message);
  console.error('[FATAL] Stack:', err.stack);
  console.error('[FATAL] Shutting down...');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[ERROR] Unhandled Promise Rejection:', err);
  console.error('[ERROR] Shutting down gracefully...');

  // Give time to finish ongoing requests
  if (global.server) {
    global.server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

module.exports = {
  AppError,
  catchAsync,
  errorHandler,
  notFoundHandler,
  validateRequest,
  sanitizeFields,
  requireFields
};