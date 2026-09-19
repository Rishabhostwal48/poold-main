const express = require('express');
const router = express.Router();
const db = require('../db');

router.use(express.json({ limit: '1mb' }));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

router.options('/', (req, res) => {
  res.set(corsHeaders);
  res.sendStatus(200);
});

// DEFERRED SECURITY REVIEW: This endpoint saves Maya interview data without
// user authentication. This matches the existing Supabase behavior.
// Evaluate whether authentication should be required in a future loop.
router.post('/', async (req, res) => {
  res.set(corsHeaders);

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

    console.log('💾 Saving interview data:', {
      session_id,
      candidate_name,
      candidate_phone,
    });

    const { rows } = await db.query(
      `INSERT INTO maya_interviews
         (session_id, candidate_name, candidate_phone,
          started_at, ended_at, duration_seconds,
          questions, responses, transcript)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        session_id,
        candidate_name || null,
        candidate_phone || null,
        started_at,
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

    // Handle unique constraint violation on session_id
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Interview with this session_id already exists',
        code: error.code,
      });
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      error: message,
      details: error instanceof Error ? error.toString() : String(error),
    });
  }
});

module.exports = router;
