const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

router.use(express.json({ limit: '1mb' }));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

router.options('/', (req, res) => {
  res.set(corsHeaders);
  res.sendStatus(200);
});

router.post('/', async (req, res) => {
  res.set(corsHeaders);

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: 'Supabase configuration missing (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required)',
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  ;
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

    const { data, error } = await supabase.from('maya_interviews').insert({
      session_id,
      candidate_name: candidate_name || null,
      candidate_phone: candidate_phone || null,
      started_at,
      ended_at,
      duration_seconds,
      questions: questions || [],
      responses: responses || [],
      transcript: transcript || [],
    });

    if (error) {
      console.error('Error saving interview:', error);
      return res.status(500).json({
        error: error.message,
        code: error.code,
      });
    }

    console.log('✅ Interview saved successfully');
    return res.json({ success: true, data });

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
