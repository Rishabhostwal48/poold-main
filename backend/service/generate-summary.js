// Converted Deno function -> Express router
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

router.use(express.json({ limit: '50mb' }));

router.options('/', (req, res) => {
  applyCors(req, res);
  res.sendStatus(200);
});

router.post('/', authenticate, async (req, res) => {
  applyCors(req, res);

  try {
    // Validate req.body is a proper object
    if (typeof req.body !== 'object' || req.body === null) {
      console.error('❌ Invalid req.body in generate-summary:', typeof req.body, req.body);
      return res.status(400).json({ error: 'Request body must be a valid JSON object' });
    }

    const { interviewData, model } = req.body || {};

    if (!interviewData) {
      return res.status(400).json({ error: 'Missing interviewData' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API key not configured' });
    }

    const targetModel = process.env.GROQ_MODEL_TEXT || 'openai/gpt-oss-120b';

    console.log('📊 Generating interview summary with Groq:', {
      model: targetModel,
      transcriptLength: interviewData.transcript?.length || 0,
      evidenceCount: Object.keys(interviewData.evidence || {}).length
    });

    const systemPrompt = `You are an expert technical recruiter and assessment specialist. Analyze the complete interview session to provide a comprehensive final assessment.

Your analysis should be thorough and include:
1. Overall performance evaluation with detailed scoring
2. Technical competency assessment across all discussed areas
3. Communication and soft skills evaluation
4. Cultural fit and team collaboration indicators
5. Problem-solving approach and critical thinking
6. Leadership potential and growth mindset
7. Specific strengths and areas for improvement
8. Risk assessment and red flags
9. Final hiring recommendation with reasoning
10. Suggested next steps or additional evaluations needed

Return ONLY a JSON object with this structure:
{
  "overallScore": number (1-100),
  "recommendation": "strong_hire|hire|further_interview|pass",
  "confidence": number (1-100),
  "technicalSkills": {
    "score": number (1-100),
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "evidence": ["evidence1", "evidence2"]
  },
  "softSkills": {
    "communication": number (1-100),
    "problemSolving": number (1-100),
    "leadership": number (1-100),
    "teamwork": number (1-100),
    "adaptability": number (1-100)
  },
  "culturefit": {
    "score": number (1-100),
    "indicators": ["positive indicator1", "concern1"],
    "reasoning": "detailed explanation"
  },
  "keyStrengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2"],
  "redFlags": ["flag1", "flag2"] | [],
  "detailedAssessment": "comprehensive paragraph assessment",
  "nextSteps": ["suggestion1", "suggestion2"],
  "salaryRecommendation": {
    "range": "salary range if applicable",
    "reasoning": "justification for recommendation"
  },
  "interviewHighlights": ["highlight1", "highlight2"],
  "questionsConcerns": ["question1", "concern1"] | []
}`;

    const { candidate, job, transcript, evidence } = interviewData;

    // Calculate coverage metrics
    const mustHavesCount = job?.must_haves?.length || 0;
    const niceHavesCount = job?.nice_haves?.length || 0;
    const totalRequirements = mustHavesCount + niceHavesCount;
    const coveredRequirements = Object.keys(evidence || {}).filter(
      (req) => evidence[req]?.length > 0
    ).length;
    const mustHaveCovered = job?.must_haves?.filter(
      (req) => evidence?.[req]?.length > 0
    ).length || 0;

    const userPrompt = `
Interview Session Analysis:

CANDIDATE PROFILE:
${JSON.stringify(candidate, null, 2)}

JOB REQUIREMENTS:
${JSON.stringify(job, null, 2)}

INTERVIEW TRANSCRIPT:
${transcript.map((item) => `[${item.ts || 'N/A'}] ${item.speaker || 'unknown'}: ${item.text || ''}`).join('\n')}

EVIDENCE COLLECTED:
${JSON.stringify(evidence, null, 2)}

REQUIREMENTS COVERAGE ANALYSIS:
Must-have requirements: ${mustHavesCount}
Nice-to-have requirements: ${niceHavesCount}
Requirements with evidence: ${coveredRequirements}
Must-have coverage: ${totalRequirements > 0 ? Math.round((mustHaveCovered / mustHavesCount) * 100) : 0}%
Overall coverage percentage: ${totalRequirements > 0 ? Math.round((coveredRequirements / totalRequirements) * 100) : 0}%

DETAILED EVIDENCE BREAKDOWN:
${Object.entries(evidence || {})
  .map(([req, evs]) => {
    const evidenceList = Array.isArray(evs) ? evs : [];
    return `- "${req}": ${evidenceList.length} evidence points${
      evidenceList.length > 0
        ? '\n  ' +
          evidenceList
            .map((ev) => `"${ev?.quote || 'N/A'}" (${ev?.timestamp || 'N/A'})`)
            .join('\n  ')
        : ''
    }`;
  })
  .join('\n')}

Please provide a comprehensive final assessment of this interview session.`;

    // Call Groq API
    const openaiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 3000
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('Groq API error:', errorText);
      return res.status(502).json({ error: 'Groq API error', status: openaiResponse.status, body: errorText });
    }

    const result = await openaiResponse.json();
    const summaryText = result.choices?.[0]?.message?.content || '';

    // Parse the JSON response (handle markdown wrapping)
    let summary;
    try {
      // Clean the response text by removing markdown code blocks
      let cleanText = summaryText.trim();

      // Remove markdown code block markers
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      summary = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse summary JSON:', summaryText);
      return res.status(502).json({ error: 'Failed to parse summary results', raw: summaryText });
    }

    console.log('✅ Interview summary generated:', {
      overallScore: summary.overallScore,
      recommendation: summary.recommendation,
      confidence: summary.confidence
    });

    return res.json({ summary });

  } catch (error) {
    console.error('Summary generation error:', error);
    const message = error instanceof Error ? error.message : 'Summary generation failed';
    return res.status(500).json({
      error: message,
      details: error instanceof Error ? error.toString() : String(error)
    });
  }
});

module.exports = router;
