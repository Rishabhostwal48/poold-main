const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const multer = require('multer');
const { randomUUID } = require('crypto');
const s3Storage = require('../storage/s3');

dotenv.config();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// CORS preflight for this route
router.options('/', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  });
  res.sendStatus(200);
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing 'file' field" });

    const type = file.mimetype || 'application/octet-stream';
    if (!type.toLowerCase().includes('pdf')) {
      return res.status(415).json({ error: `Unsupported contentType: ${type}` });
    }

    const bytes = file.buffer;
    const objectPath = `uploads/${randomUUID()}.pdf`;

    // Upload file to Amazon S3
    try {
      await s3Storage.uploadObject(objectPath, bytes, 'application/pdf');
    } catch (uploadErr) {
      console.error('S3 upload error:', uploadErr);
      return res.status(400).json({ error: `Storage upload failed: ${uploadErr.message}` });
    }

    // Generate presigned URL (10 minutes / 600 seconds)
    let signedUrl;
    try {
      signedUrl = await s3Storage.createPresignedDownloadUrl(objectPath, 600);
    } catch (signErr) {
      console.error('Presigned URL error:', signErr);
      return res.status(500).json({ error: `Signed URL failed: ${signErr.message}` });
    }

    return res.json({ ok: true, file_path: objectPath, url: signedUrl });
  } catch (e) {
    return res.status(500).json({ error: `Unhandled: ${e?.message ?? String(e)}` });
  }
});

module.exports = router;
