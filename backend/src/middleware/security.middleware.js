const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');

// Configure helmet for security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'self'", 'http://localhost:3000', 'http://localhost:3001'], // Allow frontend to iframe PDFs
    },
  },
  crossOriginEmbedderPolicy: false, // Allow PDF viewing
});

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// File upload rate limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: 'Upload limit exceeded, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Processing rate limiter
const processingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 processing requests per hour
  message: 'Processing limit exceeded, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// MongoDB injection prevention - create middleware once, not per request
const mongoSanitizeConfig = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] Attempted NoSQL injection in ${key} from IP: ${req.ip}`);
  }
});

// XSS protection for specific fields
const sanitizeInput = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Don't sanitize password fields
        if (!key.toLowerCase().includes('password')) {
          req.body[key] = xss(req.body[key], {
            whiteList: {}, // No HTML tags allowed
            stripIgnoreTag: true,
            stripIgnoreTagBody: ['script']
          });
        }
      }
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key], {
          whiteList: {},
          stripIgnoreTag: true
        });
      }
    });
  }

  next();
};

// Validate ObjectId format
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (id && !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }
    next();
  };
};

// Request size limits
const requestSizeLimiter = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || '0');
  const maxSize = 50 * 1024 * 1024; // 50MB for file uploads

  if (contentLength > maxSize && !req.path.includes('upload')) {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large'
    });
  }

  next();
};

// Security headers for API responses
const apiSecurityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Allow PDFs and uploads to be framed by frontend, deny for everything else
  if (req.path.includes('/uploads/') || req.path.endsWith('.pdf')) {
    res.setHeader('X-Frame-Options', 'ALLOW-FROM http://localhost:3000');
  } else {
    res.setHeader('X-Frame-Options', 'DENY');
  }

  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
};

// IP whitelist/blacklist (optional)
const ipFilter = (whitelist = [], blacklist = []) => {
  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;

    // Check blacklist
    if (blacklist.length > 0 && blacklist.includes(clientIp)) {
      console.warn(`[SECURITY] Blocked request from blacklisted IP: ${clientIp}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check whitelist (if configured)
    if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
      console.warn(`[SECURITY] Blocked request from non-whitelisted IP: ${clientIp}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  };
};

// Log suspicious activities
const suspiciousActivityLogger = (req, res, next) => {
  // Log potential SQL injection attempts
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/i,
    /(<script|javascript:|onerror=|onclick=)/i,
    /(\.\.\/|\.\.\\)/,
    /(%00|%0d|%0a)/i
  ];

  const checkString = `${JSON.stringify(req.body)}${JSON.stringify(req.query)}${req.path}`;

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      console.warn(`[SECURITY] Suspicious activity detected from IP: ${req.ip}`);
      console.warn(`[SECURITY] Pattern: ${pattern}`);
      console.warn(`[SECURITY] Path: ${req.path}`);
      console.warn(`[SECURITY] Method: ${req.method}`);
      // Don't block, just log for monitoring
      break;
    }
  }

  next();
};

module.exports = {
  helmetConfig,
  generalLimiter,
  authLimiter,
  uploadLimiter,
  processingLimiter,
  mongoSanitizeConfig,
  sanitizeInput,
  validateObjectId,
  requestSizeLimiter,
  apiSecurityHeaders,
  ipFilter,
  suspiciousActivityLogger
};