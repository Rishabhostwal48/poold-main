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

router.use(express.json({ limit: '200kb' }));

router.options('/', (req, res) => {
  applyCors(req, res);
  res.sendStatus(200);
});

router.post('/', authenticate, async (req, res) => {
  applyCors(req, res);

  try {
    const { jobDescription, candidateProfile, difficulty = 'mid', model } = req.body || {};

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API key not configured' });
    }

    const targetModel = process.env.GROQ_MODEL_TEXT || 'openai/gpt-oss-120b';

    console.log('🤖 Generating interview questions with Groq:', {
      model: targetModel,
      difficulty,
      jobDescriptionLength: jobDescription ? jobDescription.length : 0
    });

    // Construct the prompt for generating interview questions
    const systemPrompt = `You are an expert technical recruiter. Generate targeted interview questions based on the job description and candidate profile.\n\nInstructions:\n- Generate 5-8 questions of varying types (technical, behavioral, situational)\n- Match difficulty level: ${difficulty}\n- Focus on skills and requirements mentioned in the job description\n- Consider the candidate's background to avoid redundant questions\n- Include a mix of technical depth and soft skills assessment\n\nReturn ONLY a JSON array of questions with this structure:\n{\n  "id": "unique_id",\n  "question": "the question text",\n  "type": "technical|behavioral|situational",\n  "category": "problem-solving|technical-skills|leadership|etc",\n  "expectedDuration": seconds_for_answer,\n  "followUp": "optional follow-up question"\n}`;

    const userPrompt = `\nJob Description:\n${jobDescription || ''}\n\nCandidate Profile:\n${JSON.stringify(candidateProfile || {}, null, 2)}\n\nDifficulty Level: ${difficulty}\n\nGenerate appropriate interview questions now.`;

    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Groq API error:', errorText);
      return res.status(502).json({ error: `Groq API error: ${response.status}`, body: errorText });
    }

    const result = await response.json();
    const questionsText = result.choices?.[0]?.message?.content || result.choices?.[0]?.text || '';
    
    // Parse the JSON response
    let questions;
    try {
      // strip markdown code fences if present
      let cleaned = questionsText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```/, '').replace(/```$/,'');
      }
      questions = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse questions JSON:', questionsText);
      return res.status(502).json({ error: 'Failed to parse generated questions', raw: questionsText });
    }

    console.log('✅ Questions generated successfully:', { count: Array.isArray(questions) ? questions.length : 0 });

    return res.json({ questions });

  } catch (error) {
    console.error('Question generation error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Question generation failed',
      details: error instanceof Error ? error.toString() : String(error)
    });
  }
});

module.exports = router;