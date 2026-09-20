// Converted Deno function -> Express router
const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const { authenticate } = require('../middleware/authenticate');

dotenv.config();

const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN,
  'http://localhost:8080',
  'http://127.0.0.1:8080',
].filter(Boolean));

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type, x-supabase-authorization');
}

router.use(express.json({ limit: '50mb' }));

router.options('/', (req, res) => { 
  applyCors(req, res);
  res.sendStatus(200);
});

router.post('/', authenticate, async (req, res) => {
  applyCors(req, res);

  try {
    // Validate req.body is an object
    if (typeof req.body !== 'object' || req.body === null) {
      console.error('❌ Invalid req.body in tts-elevenlabs:', typeof req.body, req.body);
      return res.status(400).json({ error: 'Request body must be a valid JSON object' });
    }

    const { text, voiceId, model_id, voice_settings } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(422).json({ error: "Missing 'text' string" });
    }

    const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVEN_KEY) {
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' });
    }

    const defaultVoice = '21m00Tcm4TlvDq8ikWAM'; // Rachel default
    const vid = (voiceId && String(voiceId)) || defaultVoice;
    const model = (model_id && String(model_id)) || 'eleven_turbo_v2_5';
    const settings = voice_settings || {
      stability: 0.4,
      similarity_boost: 0.8,
      style: 0.2,
      use_speaker_boost: true,
    };

    console.log(`🎙️ Generating TTS for text: "${text.substring(0, 50)}..." with voice: ${vid}`);

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}?optimize_streaming_latency=3`;

    const upstreamRes = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
    });

    if (!upstreamRes.ok) {
      const body = await upstreamRes.text().catch(() => '');
      console.error(`❌ ElevenLabs API error (${upstreamRes.status}):`, body);
      
      if (upstreamRes.status === 401 || upstreamRes.status === 403) {
        return res.status(403).json({
          error: 'ElevenLabs API key is missing text_to_speech permission',
          status: upstreamRes.status,
          details: body
        });
      }
      return res.status(502).json({ error: 'Upstream ElevenLabs TTS failed', status: upstreamRes.status, body });
    }

    // Read response as arrayBuffer and convert to Buffer to send via Express
    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=60',
    });
    return res.status(200).send(buffer);
  } catch (e) {
    console.error('❌ TTS route error:', e);
    return res.status(500).json({ error: 'Unhandled error', details: String(e) });
  }
});

module.exports = router;