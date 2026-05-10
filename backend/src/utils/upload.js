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

// ── Azure Blob Storage (initialised only when connection string is set) ────────

let blobContainerClient = null;

if (config.AZURE_STORAGE_CONNECTION_STRING) {
  const { BlobServiceClient } = require('@azure/storage-blob');
  const blobServiceClient = BlobServiceClient.fromConnectionString(config.AZURE_STORAGE_CONNECTION_STRING);
  blobContainerClient = blobServiceClient.getContainerClient(config.AZURE_STORAGE_CONTAINER_NAME);

  // Ensure the container exists with public blob-level read access
  blobContainerClient
    .createIfNotExists({ access: 'blob' })
    .then(() => console.log('[storage] Azure Blob container ready:', config.AZURE_STORAGE_CONTAINER_NAME))
    .catch(err => console.error('[storage] Warning — blob container init failed:', err.message));
}

const useAzure = !!blobContainerClient;

// ── Multer setup ──────────────────────────────────────────────────────────────

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Unsupported file type.'), { code: 'UNSUPPORTED_FILE_TYPE' }));
  }
}

const diskStorage = multer.diskStorage({
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

// Azure mode uses memory storage — multer buffers the file, we upload to blob manually
const mediaUpload = multer({
  storage: useAzure ? multer.memoryStorage() : diskStorage,
  fileFilter,
  limits: { fileSize: config.MAX_VIDEO_SIZE_MB * 1024 * 1024 },
});

// ── Storage helpers ───────────────────────────────────────────────────────────

function _blobName(mimetype, originalname) {
  const now = new Date();
  const subdir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ext = MIME_TO_EXT[mimetype] || path.extname(originalname).toLowerCase();
  return `${subdir}/${uuidv4()}${ext}`;
}

// Saves the uploaded file to blob storage (Azure) or disk (local).
// Returns the filename/blob-name to store in the database.
async function saveFile(file) {
  if (useAzure) {
    const blobName = _blobName(file.mimetype, file.originalname);
    await blobContainerClient
      .getBlockBlobClient(blobName)
      .upload(file.buffer, file.size, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
      });
    return blobName;
  }
  // Disk mode: multer already wrote the file; return relative path
  return path.relative(config.UPLOAD_DIR, file.path).replace(/\\/g, '/');
}

// Deletes a file from blob storage or disk. Errors are swallowed — best-effort.
async function deleteFile(filename) {
  if (useAzure) {
    await blobContainerClient.getBlockBlobClient(filename).deleteIfExists();
  } else {
    fs.unlink(path.join(config.UPLOAD_DIR, filename), () => {});
  }
}

// Returns the public URL for a stored filename.
// Azure → full blob URL; local → /uploads/<filename>
function mediaUrl(filename) {
  if (!filename) return '';
  if (useAzure) {
    // blobContainerClient.url = https://<account>.blob.core.windows.net/<container>
    return `${blobContainerClient.url}/${filename}`;
  }
  return `/uploads/${filename}`;
}

// Downloads a file and returns its content as a base64 string.
// Used by the AI analyze route which needs to send the image to Claude.
async function readFileAsBase64(filename) {
  if (useAzure) {
    const buffer = await blobContainerClient
      .getBlockBlobClient(filename)
      .downloadToBuffer();
    return buffer.toString('base64');
  }
  const filePath = path.join(config.UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) throw new Error('File not found on disk.');
  return fs.readFileSync(filePath).toString('base64');
}

module.exports = {
  mediaUpload,
  saveFile,
  deleteFile,
  mediaUrl,
  readFileAsBase64,
  useAzure,
  ALLOWED_MIME,
  MIME_TO_EXT,
};
