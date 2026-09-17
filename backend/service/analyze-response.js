
const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();

router.use(express.json({ limit: '500kb' }));

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
    const { question, response, context, model = 'gpt-4o' } = req.body || {};

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('🧠 Analyzing response:', {
      model,
      questionLength: question?.length || 0,
      responseLength: response?.length || 0
    });

    const systemPrompt = `You are an expert technical interviewer and AI-powered assessment specialist. Analyze the candidate's response with precision and provide comprehensive insights.

Your analysis should evaluate:
1. Technical accuracy and depth of knowledge
2. Communication clarity and articulation
3. Problem-solving methodology and approach
4. Relevance to specific job requirements
5. Soft skills demonstrated (leadership, teamwork, adaptability)
6. Evidence of experience and practical application
7. Critical thinking and analytical skills
8. Red flags or concerning patterns
9. Follow-up opportunities for deeper assessment
10. Specific recommendations for hiring decision

Return ONLY a JSON object with this structure:
{
  "score": number (1-10),
  "confidence": number (1-10),
  "technicalAccuracy": number (1-10),
  "communicationClarity": number (1-10),
  "problemSolvingApproach": number (1-10),
  "jobRelevance": number (1-10),
  "experienceEvidence": number (1-10),
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"],
  "technicalInsights": ["technical insight 1", "technical insight 2"],
  "softSkillsObserved": ["skill observed 1", "skill observed 2"],
  "redFlags": ["red flag 1", "red flag 2"] | [],
  "positiveSignals": ["positive signal 1", "positive signal 2"],
  "followUpQuestions": ["probing question 1", "clarifying question 2"],
  "evidenceQuality": "strong|moderate|weak|none",
  "improvementAreas": ["area 1", "area 2"],
  "overallAssessment": "detailed paragraph summarizing the response quality and candidate performance",
  "recommendation": "excellent|good|fair|poor",
  "nextStepSuggestion": "continue|probe_deeper|move_to_next|flag_concern"
}`;

    const userPrompt = `
Question Asked:
${question}

Candidate's Response:
${response}

Job Context:
${JSON.stringify(context, null, 2)}

Analyze this response comprehensively.`;

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
        max_completion_tokens: 3000,
        temperature: 0.3 // Lower temperature for more consistent analysis
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const result = await openaiResponse.json();
    const analysisText = result.choices[0].message.content;
    
    // Parse the JSON response
    let analysis;
    try {
      // strip markdown code fences if present
      let cleaned = analysisText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```/, '').replace(/```$/,'');
      }
      analysis = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse analysis JSON:', analysisText);
      return res.status(502).json({ error: 'Failed to parse analysis results', raw: analysisText });
    }

    console.log('✅ Response analysis completed:', {
      score: analysis.score,
      recommendation: analysis.recommendation
    });

    return res.json({ analysis });

  } catch (error) {
    console.error('Response analysis error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Response analysis failed',
      details: error instanceof Error ? error.toString() : String(error)
    });
  }
});

module.exports = router;