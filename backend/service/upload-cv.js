const express = require('express');
const router = express.Router();
const multer = require('multer');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

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
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const BUCKET = process.env.CV_BUCKET || 'cvs';

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({
        error: 'Supabase configuration missing (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required)',
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

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

    console.log(`📤 Uploading file: ${file.originalname} (${file.size} bytes) to ${objectPath}`);

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, file.buffer, {
        contentType,
        upsert: true,
      });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      return res.status(400).json({ error: 'Failed to upload file' });
    }

    // Create signed URL for accessing the file (1 hour expiry)
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, 60 * 60);

    if (signErr) {
      console.error('Signed URL error:', signErr);
      return res.status(500).json({ error: 'Failed to create signed URL' });
    }

    console.log(`✅ File uploaded successfully: ${objectPath}`);

    return res.json({
      ok: true,
      file_path: objectPath,
      url: signed.signedUrl,
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