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

router.options('/', (req, res) => {
  applyCors(req, res);
  res.sendStatus(200);
});

router.post('/', authenticate, async (req, res) => {
  applyCors(req, res);

  try {
    const { cvText, model } = req.body || {};

    if (!cvText) {
      return res.status(400).json({ error: 'No CV text provided' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API key not configured' });
    }

    const targetModel = process.env.GROQ_MODEL_TEXT || 'openai/gpt-oss-120b';

    console.log('📄 Parsing CV content with Groq:', {
      textLength: cvText.length,
      model: targetModel
    });

    const systemPrompt = `You are an expert HR analyst and resume parser. Parse the following CV/resume text and extract structured information.

Extract and organize the following information:
1. Contact Details: Name, email, phone, location, LinkedIn/website
2. Summary/Objective: Professional summary or objective statement
3. Skills: Technical skills, soft skills, tools, frameworks, languages
4. Work Experience: Companies, job titles, dates, key responsibilities, achievements
5. Education: Degrees, institutions, graduation dates, field of study
6. Certifications & Projects: Relevant certifications and key projects

Return ONLY a JSON object with this structure:
{
  "full_name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number",
  "location": "City, Country",
  "summary": "Professional summary...",
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "duration": "Start Date - End Date",
      "highlights": ["Key achievement 1", "Key responsibility 2"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Name",
      "field_of_study": "Field",
      "year": "Graduation Year"
    }
  ],
  "certifications": ["Certification 1", "Certification 2"],
  "languages": ["Language 1", "Language 2"]
}`;

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
          { role: 'user', content: `Parse the following CV text:\n\n${cvText}` }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.2
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Groq API error:', errorText);
      return res.status(502).json({ error: `Groq API error: ${response.status}`, body: errorText });
    }

    const result = await response.json();
    const contentText = result.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    let parsedProfile;
    try {
      let cleaned = contentText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```/, '').replace(/```$/, '');
      }
      parsedProfile = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse CV content JSON:', contentText);
      return res.status(502).json({ error: 'Failed to parse CV content', raw: contentText });
    }

    console.log('✅ CV content parsed successfully for:', parsedProfile.full_name || 'Unknown');

    return res.json({ profile: parsedProfile });

  } catch (error) {
    console.error('CV content parsing error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'CV parsing failed',
      details: error instanceof Error ? error.toString() : String(error)
    });
  }
});

module.exports = router;