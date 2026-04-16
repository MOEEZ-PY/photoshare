'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const now = new Date();
    const subdir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dest = path.join(config.UPLOAD_DIR, subdir);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename(req, file, cb) {
    const ext = MIME_TO_EXT[file.mimetype] || path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Unsupported file type.'), { code: 'UNSUPPORTED_FILE_TYPE' }));
  }
}

// Separate instances with different size limits
const photoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.MAX_PHOTO_SIZE_MB * 1024 * 1024 },
});

const videoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.MAX_VIDEO_SIZE_MB * 1024 * 1024 },
});

// Combined uploader — picks limit based on mime type at runtime
const mediaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.MAX_VIDEO_SIZE_MB * 1024 * 1024 }, // use max cap; route logic can re-check
});

module.exports = { photoUpload, videoUpload, mediaUpload, ALLOWED_MIME, MIME_TO_EXT };
