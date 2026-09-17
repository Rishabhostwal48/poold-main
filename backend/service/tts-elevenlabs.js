// Converted Deno function -> Express router
const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();

router.use(express.json({ limit: '50mb' }));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
};

router.options('/', (req, res) => { 
  res.set(corsHeaders);
  res.sendStatus(200);
});

router.post('/', async (req, res) => {
  // Set CORS headers on the response
  res.set(corsHeaders);

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
    const model = (model_id && String(model_id)) || 'eleven_turbo_v2';
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
      console.error(`❌ ElevenLabs API error: ${upstreamRes.status} - ${body}`);
      return res.status(502).json({ error: 'Upstream TTS failed', status: upstreamRes.status, body });
    }

    // Read response as arrayBuffer and convert to Buffer to send via Express
    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=60',
      ...corsHeaders,
    });
    return res.status(200).send(buffer);
  } catch (e) {
    console.error('❌ TTS route error:', e);
    return res.status(500).json({ error: 'Unhandled error', details: String(e) });
  }
});

module.exports = router;