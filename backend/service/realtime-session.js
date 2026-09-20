/**
 * backend/service/realtime-session.js
 * DEPRECATED / REMOVED — OpenAI Realtime dependency removed in Loop 10.5.
 * Production interview pipeline uses Maya Socket.IO + Groq LLM + ElevenLabs / Whisper STT.
 */

'use strict';

const express = require('express');
const router = express.Router();

router.all('*', (req, res) => {
  return res.status(410).json({
    error: 'Gone',
    message: 'OpenAI Realtime dependency has been removed. Use Socket.IO Maya interview pipeline.'
  });
});

module.exports = router;
