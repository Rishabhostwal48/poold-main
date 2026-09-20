const express = require('express');
const router = express.Router();
const db = require('../db');
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
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
}

router.use(express.json({ limit: '1mb' }));

router.options('/', (req, res) => {
  applyCors(req, res);
  res.sendStatus(200);
});

router.post('/', authenticate, async (req, res) => {
  applyCors(req, res);

  try {
    const {
      session_id,
      candidate_name,
      candidate_phone,
      started_at,
      ended_at,
      duration_seconds,
      questions,
      responses,
      transcript,
    } = req.body || {};

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const authenticatedEmail = req.user.email;

    // Check if session_id already exists in database
    const { rows: existingRows } = await db.query(
      'SELECT session_id, user_email FROM maya_interviews WHERE session_id = $1',
      [session_id]
    );

    if (existingRows.length > 0) {
      const existingUserEmail = existingRows[0].user_email;
      if (existingUserEmail && existingUserEmail !== authenticatedEmail) {
        return res.status(403).json({ error: 'Forbidden: Unauthorized access to interview session' });
      }
    }

    console.log('💾 Saving interview data for:', authenticatedEmail, 'session:', session_id);

    const { rows } = await db.query(
      `INSERT INTO maya_interviews
         (session_id, user_email, candidate_name, candidate_phone,
          started_at, ended_at, duration_seconds,
          questions, responses, transcript)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (session_id) DO UPDATE SET
         user_email = EXCLUDED.user_email,
         candidate_name = COALESCE(EXCLUDED.candidate_name, maya_interviews.candidate_name),
         candidate_phone = COALESCE(EXCLUDED.candidate_phone, maya_interviews.candidate_phone),
         ended_at = EXCLUDED.ended_at,
         duration_seconds = EXCLUDED.duration_seconds,
         questions = EXCLUDED.questions,
         responses = EXCLUDED.responses,
         transcript = EXCLUDED.transcript,
         updated_at = now()
       RETURNING *`,
      [
        session_id,
        authenticatedEmail,
        candidate_name || null,
        candidate_phone || null,
        started_at || new Date(),
        ended_at,
        duration_seconds,
        JSON.stringify(questions || []),
        JSON.stringify(responses || []),
        JSON.stringify(transcript || []),
      ]
    );

    console.log('✅ Interview saved successfully');
    return res.json({ success: true, data: rows[0] || null });

  } catch (error) {
    console.error('Save interview error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      error: message,
      details: error instanceof Error ? error.toString() : String(error),
    });
  }
});

module.exports = router;
