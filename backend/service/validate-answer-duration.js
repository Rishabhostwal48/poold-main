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
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
}

router.use(express.json({ limit: '1mb' }));

const MIN_ANSWER_DURATION_SECONDS = 10;
const MIN_WORD_COUNT = 5;

router.options('/', (req, res) => {
  applyCors(req, res);
  res.sendStatus(200);
});

router.post('/', authenticate, async (req, res) => {
  applyCors(req, res);

  try {
    const { answerText, durationSeconds, questionIndex } = req.body || {};

    console.log('📊 Validating answer:', {
      durationSeconds,
      questionIndex,
      textLength: answerText?.length || 0,
    });

    // Validate required fields
    if (typeof durationSeconds !== 'number' || typeof answerText !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid required fields: answerText (string) and durationSeconds (number)',
        isValid: false,
      });
    }

    // Check if answer meets minimum duration
    const meetsMinimumDuration = durationSeconds >= MIN_ANSWER_DURATION_SECONDS;

    // Check if answer has meaningful content (not just 1-2 words)
    const wordCount = answerText?.trim().split(/\s+/).filter(w => w.length > 0).length || 0;
    const hasMeaningfulContent = wordCount >= MIN_WORD_COUNT;

    const isValid = meetsMinimumDuration && hasMeaningfulContent;

    const validation = {
      isValid,
      durationSeconds,
      minimumRequired: MIN_ANSWER_DURATION_SECONDS,
      meetsMinimumDuration,
      wordCount,
      minimumWordCount: MIN_WORD_COUNT,
      hasMeaningfulContent,
      feedback: !isValid
        ? `Answer too ${!meetsMinimumDuration ? 'short (< 10 seconds)' : 'brief (< 5 words)'}. Please provide a more complete response.`
        : 'Answer accepted',
    };

    console.log('✅ Validation result:', validation);

    return res.json(validation);

  } catch (error) {
    console.error('Validation error:', error);
    const message = error instanceof Error ? error.message : 'Validation failed';
    return res.status(500).json({
      error: message,
      isValid: false,
      details: error instanceof Error ? error.toString() : String(error),
    });
  }
});

module.exports = router;
