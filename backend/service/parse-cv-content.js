const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
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
    const { cvText, model = 'gpt-4o-mini' } = req.body || {};

    if (!cvText) {
      return res.status(400).json({ error: 'No CV text provided' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('📄 Parsing CV content:', {
      textLength: cvText.length,
      model
    });

    const systemPrompt = `You are an expert HR analyst and resume parser. Parse the following CV/resume text and extract structured information.

Extract and organize the following information:
- Personal information (name, location, contact details)
- Work experience with achievements and technologies used
- Education background
- Skills organized by category
- Certifications and awards
- Key highlights and accomplishments

Return ONLY a JSON object with this structure:
{
  "personalInfo": {
    "name": "Full Name",
    "location": "City, State/Country",
    "email": "email@example.com",
    "phone": "phone number",
    "linkedin": "linkedin profile url",
    "website": "personal website url"
  },
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or present",
      "location": "City, State",
      "achievements": [
        "Quantified achievement 1",
        "Quantified achievement 2"
      ],
      "technologies": ["tech1", "tech2"],
      "domains": ["domain1", "domain2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Title",
      "institution": "University/School Name",
      "graduationDate": "YYYY",
      "location": "City, State",
      "gpa": "GPA if mentioned",
      "honors": "magna cum laude, etc."
    }
  ],
  "skills": {
    "Programming Languages": ["skill1", "skill2"],
    "Frameworks": ["framework1", "framework2"],
    "Tools": ["tool1", "tool2"],
    "Soft Skills": ["skill1", "skill2"]
  },
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "YYYY-MM",
      "expiryDate": "YYYY-MM if applicable"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["tech1", "tech2"],
      "achievements": ["achievement1", "achievement2"]
    }
  ],
  "summary": "Professional summary or objective statement",
  "yearsExperience": 5
}`;

    const userPrompt = `Parse the following CV/resume and extract structured information:\n\n${cvText}\n\nFocus on:\n1. Accurate extraction of personal information\n2. Detailed work experience with quantified achievements\n3. Technologies and tools used in each role\n4. Educational background and certifications\n5. Skills organized by relevant categories\n6. Calculate total years of professional experience`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: 3000,
        temperature: 0.1 // Very low temperature for accurate extraction
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return res.status(502).json({ error: 'OpenAI API error', status: response.status, body: errorText });
    }

    const result = await response.json();
    const parsedText = result.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response
    let parsedCV;
    try {
      let cleanText = parsedText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      parsedCV = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse CV JSON:', parsedText);
      return res.status(502).json({ error: 'Failed to parse CV results', raw: parsedText });
    }

    console.log('✅ CV parsed successfully:', {
      name: parsedCV.personalInfo?.name,
      yearsExperience: parsedCV.yearsExperience,
      experienceCount: parsedCV.experience?.length || 0,
      skillCategories: Object.keys(parsedCV.skills || {}).length
    });

    return res.json({ parsedCV });

  } catch (error) {
    console.error('CV parsing error:', error);
    const message = error instanceof Error ? error.message : 'CV parsing failed';
    return res.status(500).json({
      error: message,
      details: error instanceof Error ? error.toString() : String(error)
    });
  }
});

module.exports = router;