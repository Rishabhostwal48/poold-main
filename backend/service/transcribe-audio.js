const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-authorization, apikey, content-type',
};

// Convert base64 to Buffer
function base64ToBuffer(b64) {
  const clean = b64.trim().replace(/^data:.*;base64,/, '').replace(/\s+/g, '');
  return Buffer.from(clean, 'base64');
}

// Pick filename based on MIME type
function pickFilename(mimeType) {
  if (mimeType.includes('webm')) return 'audio.webm';
  if (mimeType.includes('mpeg')) return 'audio.mp3';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('x-m4a') || mimeType.includes('mp4')) return 'audio.m4a';
  return 'audio.bin';
}

router.options('/', (req, res) => {
  res.set(corsHeaders);
  res.sendStatus(200);
});

router.post('/', express.json({ limit: '30mb' }), async (req, res) => {
  try {
    const { audio, language = 'en', model = 'whisper-1', mimeType = 'audio/webm' } = req.body;

    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'No audio data provided (base64 string expected)' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Convert base64 to Buffer and check size
    const buffer = base64ToBuffer(audio);
    if (buffer.length === 0) return res.status(400).json({ error: 'Empty audio payload' });
    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(413).json({ error: 'Audio too large (max ~25MB)' });
    }

    const form = new FormData();
    const filename = pickFilename(mimeType);
    const file = new File([buffer], filename, { type: mimeType });
    form.append('file', file);
    form.append('model', model);
    if (language) form.append('language', language);
    form.append('response_format', 'verbose_json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('OpenAI API error:', resp.status, txt);
      return res.status(502).json({ error: 'OpenAI API error', status: resp.status, body: txt });
    }

    const result = await resp.json();

    return res.json({
      transcription: {
        text: result.text ?? '',
        language: result.language ?? language,
        duration: result.duration ?? null,
        segments: result.segments ?? [],
      },
    });
  } catch (err) {
    console.error('Transcription error:', err);
    const message = err instanceof Error ? err.message : String(err);
    const status = /AbortError/i.test(message) ? 504 : 500;
    return res.status(status).json({ error: 'Transcription failed', details: message });
  }
});

module.exports = router;

 