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
  console.log('[UPLOAD MIDDLEWARE] Validating file:', file.originalname);
  console.log('[UPLOAD MIDDLEWARE] Mimetype:', file.mimetype);

  if (file.mimetype === 'application/pdf') {
    console.log('[UPLOAD MIDDLEWARE] ✓ Valid PDF file');
    cb(null, true);
  } else {
    console.log('[UPLOAD MIDDLEWARE] ✗ Invalid file type:', file.mimetype);
    cb(new Error('Only PDF files are allowed'), false);
  }
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
  console.error('[UPLOAD MIDDLEWARE] Upload error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed'
    });
  }
  next();
};

module.exports = {
  uploadPDF: upload.single('pdf'),
  uploadMultiplePDFs: upload.array('pdfs', 20), // Allow up to 20 files at once
  handleUploadError
};