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
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-client-info, apikey');
}

router.use(express.json({ limit: '50mb' }));

router.options('/', (req, res) => {
  applyCors(req, res);
  res.sendStatus(200);
});

router.post('/', authenticate, async (req, res) => {
  applyCors(req, res);

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

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API key not configured' });
    }

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
    let targetModel = process.env.GROQ_MODEL_TEXT || 'openai/gpt-oss-120b';

    const fileExt = (fileName || '').toLowerCase();
    const isImage = fileExt.endsWith('.png') || fileExt.endsWith('.jpg') || fileExt.endsWith('.jpeg') || fileExt.endsWith('.webp');
    const isPdf = fileExt.endsWith('.pdf');
    const isDocx = fileExt.endsWith('.docx');

    if (fileData && isImage) {
      targetModel = process.env.GROQ_MODEL_VISION || 'qwen/qwen3.6-27b';
      const imgType = fileExt.endsWith('.png') ? 'png' : fileExt.endsWith('.webp') ? 'webp' : 'jpeg';
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze the attached job description image and extract structured information. Focus on must-have vs nice-to-have, technologies, experience level, responsibilities, and competencies.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/${imgType};base64,${fileData}`
              }
            }
          ]
        }
      ];
    } else if (fileData && (isPdf || isDocx)) {
      let extractedText = '';
      const buffer = Buffer.from(fileData, 'base64');
      if (isPdf) {
        const pdfParseModule = require('pdf-parse');
        if (typeof pdfParseModule === 'function') {
          const pdfData = await pdfParseModule(buffer);
          extractedText = pdfData.text || '';
        } else if (pdfParseModule && pdfParseModule.PDFParse) {
          const parser = new pdfParseModule.PDFParse({ data: buffer });
          const pdfData = await parser.getText();
          extractedText = pdfData.text || '';
        } else if (pdfParseModule && typeof pdfParseModule.default === 'function') {
          const pdfData = await pdfParseModule.default(buffer);
          extractedText = pdfData.text || '';
        }
      } else if (isDocx) {
        const mammoth = require('mammoth');
        const docxData = await mammoth.extractRawText({ buffer });
        extractedText = docxData.value || '';
      }

      const userPrompt = `Analyze the following job description document content and extract structured information:

${extractedText}

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

    console.log('📋 Analyzing job description with Groq:', {
      fileName,
      model: targetModel,
      hasFileData: !!fileData,
      hasText: !!jobDescription,
      extractRequirements,
      generateGapAnalysis
    });

    // Call Groq Chat Completions API
    const openaiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.2
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('Groq API error:', openaiRes.status, errText);
      return res.status(502).json({ error: 'Groq API error', details: errText });
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