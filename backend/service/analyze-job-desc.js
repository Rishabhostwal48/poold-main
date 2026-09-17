const express = require('express');
const router = express.Router();

router.use(express.json({ limit: '50mb' }));

router.post('/', async (req, res) => {
  try {
    // Debug log
    if (typeof req.body !== 'object' || req.body === null) {
      console.error('❌ Invalid req.body:', typeof req.body, req.body);
      return res.status(400).json({ error: 'Request body must be a valid JSON object' });
    }

    let {
      fileData,
      fileName,
      jobDescription,
      extractRequirements = true,
      generateGapAnalysis = false,
      model = 'gpt-4o-mini'
    } = req.body;

    if (!fileData && !jobDescription) {
      return res.status(400).json({ error: 'No file data or job description provided' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('📋 Analyzing job description:', {
      fileName,
      model,
      hasFileData: !!fileData,
      hasText: !!jobDescription,
      extractRequirements,
      generateGapAnalysis
    });

    const systemPrompt = `You are an expert HR analyst and technical recruiter. Analyze the job description to extract structured requirements and create a comprehensive job profile.

Return ONLY a JSON object with this structure:
{
  "title": "Job Title",
  "level": "Junior/Mid/Senior/Lead/Principal",
  "company": "Company name if mentioned",
  "location": "Location if mentioned",
  "employment_type": "Full-time/Part-time/Contract/Remote",
  "must_haves": [ "..."],
  "nice_haves": [ "..."],
  "responsibilities": [ "..."],
  "competencies": [
    { "name": "Technical Excellence", "signals": ["signal1","signal2"] }
  ],
  "salary_range": "Salary range if mentioned",
  "benefits": ["..."],
  "technologies": ["..."],
  "years_experience": "minimum years required"
}`;

    let messages;

    // PDF/DOCX -> send as data URI for vision-capable models
    if (fileData && fileName && (fileName.toLowerCase().endsWith('.pdf') || fileName.toLowerCase().endsWith('.docx'))) {
      const mime = fileName.toLowerCase().endsWith('.pdf')
        ? 'pdf'
        : 'vnd.openxmlformats-officedocument.wordprocessingml.document';

      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze the attached job description document and extract structured information. Focus on must-have vs nice-to-have, technologies, experience level, responsibilities, and competencies.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/${mime};base64,${fileData}`
              }
            }
          ]
        }
      ];
    } else if (jobDescription) {
      const userPrompt = `Analyze the following job description and extract structured information:

${jobDescription}

Focus on:
1) Must-have vs nice-to-have requirements
2) Technical skills and tools
3) Experience level indicators
4) Core competencies and soft skills
5) Key responsibilities`;

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
    } else if (fileData) {
      // base64 -> text
      const textContent = Buffer.from(fileData, 'base64').toString('utf-8');
      const userPrompt = `Analyze the following job description and extract structured information:

${textContent}

Focus on:
1) Must-have vs nice-to-have requirements
2) Technical skills and tools
3) Experience level indicators
4) Core competencies and soft skills
5) Key responsibilities`;

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
    } else {
      return res.status(400).json({ error: 'Unable to process the provided data' });
    }

    // Call OpenAI Chat Completions
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2000,
        temperature: 0.2
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI API error:', openaiRes.status, errText);
      return res.status(502).json({ error: 'OpenAI API error', details: errText });
    }

    const openaiJson = await openaiRes.json();
    const analysisText = openaiJson?.choices?.[0]?.message?.content;

    if (!analysisText) {
      console.error('No analysis content returned from OpenAI', openaiJson);
      return res.status(502).json({ error: 'No analysis returned from OpenAI' });
    }

    // Clean code fences and parse JSON
    let cleaned = analysisText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let jobProfile;
    try {
      jobProfile = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse JSON from model output:', parseErr);
      console.error('Model output was:', analysisText);
      return res.status(500).json({ error: 'Failed to parse job analysis JSON', raw: analysisText });
    }

    let gapAnalysis = null;
    if (generateGapAnalysis) {
      gapAnalysis = {
        coverage: {},
        open: jobProfile.must_haves || []
      };
    }

    return res.json({ jobProfile, gapAnalysis });
  } catch (err) {
    console.error('analyze-job-description route error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error',
      details: err.stack ? String(err.stack) : undefined
    });
  }
});

module.exports = router;