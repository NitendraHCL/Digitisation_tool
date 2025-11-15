const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('[UPLOAD MIDDLEWARE] Created uploads directory');
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('[UPLOAD MIDDLEWARE] Saving file to:', uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    console.log('[UPLOAD MIDDLEWARE] Generated filename:', filename);
    cb(null, filename);
  }
});

// File filter for PDF only
const fileFilter = (req, file, cb) => {
  console.log('[UPLOAD MIDDLEWARE] ========== FILE VALIDATION ==========');
  console.log('[UPLOAD MIDDLEWARE] Validating file:', file.originalname);
  console.log('[UPLOAD MIDDLEWARE] Mimetype:', file.mimetype);
  console.log('[UPLOAD MIDDLEWARE] File size limit:', process.env.MAX_FILE_SIZE || '10485760', 'bytes');
  console.log('[UPLOAD MIDDLEWARE] File size limit (MB):', Math.round((parseInt(process.env.MAX_FILE_SIZE) || 10485760) / (1024 * 1024)));

  if (file.mimetype === 'application/pdf') {
    console.log('[UPLOAD MIDDLEWARE] ✓ Valid PDF file');
    cb(null, true);
  } else {
    console.log('[UPLOAD MIDDLEWARE] ✗ Invalid file type:', file.mimetype);
    cb(new Error('Only PDF files are allowed'), false);
  }
  console.log('[UPLOAD MIDDLEWARE] ==========================================');
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
});

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err) {
    console.error('[UPLOAD MIDDLEWARE] ========== UPLOAD ERROR ==========');
    console.error('[UPLOAD MIDDLEWARE] Error type:', err.constructor.name);
    console.error('[UPLOAD MIDDLEWARE] Error message:', err.message);
    console.error('[UPLOAD MIDDLEWARE] Error code:', err.code);
    console.error('[UPLOAD MIDDLEWARE] Current MAX_FILE_SIZE env:', process.env.MAX_FILE_SIZE);
    console.error('[UPLOAD MIDDLEWARE] Configured limit (bytes):', parseInt(process.env.MAX_FILE_SIZE) || 10485760);
    console.error('[UPLOAD MIDDLEWARE] Configured limit (MB):', Math.round((parseInt(process.env.MAX_FILE_SIZE) || 10485760) / (1024 * 1024)));

    if (req.file) {
      console.error('[UPLOAD MIDDLEWARE] File that failed:', {
        originalname: req.file.originalname,
        size: req.file.size,
        sizeMB: (req.file.size / (1024 * 1024)).toFixed(2)
      });
    }
    console.error('[UPLOAD MIDDLEWARE] Full error:', err);
    console.error('[UPLOAD MIDDLEWARE] ==========================================');
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSizeMB = Math.round((parseInt(process.env.MAX_FILE_SIZE) || 10485760) / (1024 * 1024));
      return res.status(400).json({
        success: false,
        message: `File size too large. Maximum size is ${maxSizeMB}MB.`,
        details: {
          maxSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
          maxSizeMB: maxSizeMB
        }
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
      code: err.code
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed'
    });
  }

  // Log successful upload pass-through
  console.log('[UPLOAD MIDDLEWARE] ✓ No upload errors, passing to controller');
  next();
};

module.exports = {
  uploadPDF: upload.single('pdf'),
  uploadMultiplePDFs: upload.array('pdfs', 20), // Allow up to 20 files at once
  handleUploadError
};