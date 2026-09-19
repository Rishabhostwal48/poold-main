const express = require('express');
const router = express.Router();
const multer = require('multer');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const s3Storage = require('../storage/s3');

dotenv.config();

// Memory storage for multipart files
const upload = multer({ storage: multer.memoryStorage() });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

router.options('/', (req, res) => {
  res.set(corsHeaders);
  res.sendStatus(200);
});

router.post('/', upload.single('file'), async (req, res) => {
  res.set(corsHeaders);

  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing 'file' field" });
    }

    const file = req.file;
    const contentType = file.mimetype || 'application/octet-stream';

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(contentType)) {
      return res.status(415).json({ error: `Unsupported file type: ${contentType}` });
    }

    // Create safe file path with UUID
    const ext = file.originalname?.split('.').pop()?.toLowerCase() || 'pdf';
    const objectPath = `uploads/${uuidv4()}.${ext}`;

    console.log(`📤 Uploading file to S3: ${file.originalname} (${file.size} bytes) to ${objectPath}`);

    // Upload to Amazon S3
    try {
      await s3Storage.uploadObject(objectPath, file.buffer, contentType);
    } catch (uploadErr) {
      console.error('S3 upload error:', uploadErr);
      return res.status(400).json({ error: 'Failed to upload file' });
    }

    // Create presigned download URL for accessing the file (1 hour expiry)
    let signedUrl;
    try {
      signedUrl = await s3Storage.createPresignedDownloadUrl(objectPath, 60 * 60);
    } catch (signErr) {
      console.error('Presigned URL error:', signErr);
      return res.status(500).json({ error: 'Failed to create signed URL' });
    }

    console.log(`✅ File uploaded successfully to S3: ${objectPath}`);

    return res.json({
      ok: true,
      file_path: objectPath,
      url: signedUrl,
      file_name: file.originalname,
      file_size: file.size,
      content_type: contentType,
    });

  } catch (error) {
    console.error('CV upload error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      error: message,
      details: error instanceof Error ? error.toString() : String(error),
    });
  }
});

module.exports = router;