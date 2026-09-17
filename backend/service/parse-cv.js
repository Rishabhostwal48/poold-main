const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();

const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const { randomUUID } = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY; // service key
const BUCKET = process.env.CV_BUCKET || 'cvs';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// CORS preflight for this route (if app-level CORS isn't configured)
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

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, bytes, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      return res.status(400).json({ error: `Storage upload failed: ${uploadErr.message}` });
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, 600);

    if (signErr) return res.status(500).json({ error: `Signed URL failed: ${signErr.message}` });

    return res.json({ ok: true, file_path: objectPath, url: signed?.signedUrl });
  } catch (e) {
    return res.status(500).json({ error: `Unhandled: ${e?.message ?? String(e)}` });
  }
});

module.exports = router;
