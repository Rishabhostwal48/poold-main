const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();

router.use(express.json({ limit: '200kb' }));

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
    const { jobDescription, candidateProfile, difficulty = 'mid', model = 'gpt-4o-mini' } = req.body || {};

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('🤖 Generating interview questions:', {
      model,
      difficulty,
      jobDescriptionLength: jobDescription ? jobDescription.length : 0
    });

    // Construct the prompt for generating interview questions
    const systemPrompt = `You are an expert technical recruiter. Generate targeted interview questions based on the job description and candidate profile.\n\nInstructions:\n- Generate 5-8 questions of varying types (technical, behavioral, situational)\n- Match difficulty level: ${difficulty}\n- Focus on skills and requirements mentioned in the job description\n- Consider the candidate's background to avoid redundant questions\n- Include a mix of technical depth and soft skills assessment\n\nReturn ONLY a JSON array of questions with this structure:\n{\n  "id": "unique_id",\n  "question": "the question text",\n  "type": "technical|behavioral|situational",\n  "category": "problem-solving|technical-skills|leadership|etc",\n  "expectedDuration": seconds_for_answer,\n  "followUp": "optional follow-up question"\n}`;

    const userPrompt = `\nJob Description:\n${jobDescription || ''}\n\nCandidate Profile:\n${JSON.stringify(candidateProfile || {}, null, 2)}\n\nDifficulty Level: ${difficulty}\n\nGenerate appropriate interview questions now.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 2000,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('OpenAI API error:', errorText);
      return res.status(502).json({ error: `OpenAI API error: ${response.status}`, body: errorText });
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