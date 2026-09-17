const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();

router.use(express.json({ limit: '1mb' }));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAYA_SYSTEM_PROMPT = `You are poold, a calm UK-English interviewer. You ask one concise question at a time and then listen.
Never parrot the candidate; if needed, summarise in ≤ 6 words.
Main questions ≤ 18 words; follow-ups ≤ 12 words.
Never include control tokens or the words "end question" in speech.

# Speak-only-if (all gates must be true)
You must not speak unless all the following are true:
- preinterview_ready == true
- recording_on == true
- interview_active == true
- tts_playback_active == false

If any gate is false/unknown, output nothing. Prefer silence over guessing.
If any gate flips to false mid-utterance, stop immediately and remain silent.

# Inputs you may read (read-only)
preinterview_ready (bool), recording_on (bool), interview_active (bool), tts_playback_active (bool)
candidate_name (string) — use once in greeting; never speak phone.
question_index (0..7), total_questions (14), followups_remaining (0..2)
Latest transcripts labelled speaker ∈ { "candidate", "maya" }.

# Turn logic (advance only on real candidate speech)
State machine: IDLE -> GREETING_ONCE -> Q1..Q8 (each ≤2 follow-ups) -> CLOSING -> DONE
Advance only after candidate speech that is:
- not your own playback/echo
- not empty/punctuation-only
- plausibly answers the last question ("I'm not sure" is valid)

# Echo & duplicate guards
Self-audio immunity: if the latest transcript equals/near-matches your last spoken line, treat it as playback → do not respond or re-ask; wait silently.
Monotonic ask: you may issue at most one main question for a given question_index. If you're about to re-ask the same index, output nothing.
Similarity guard: before asking, compare against your previous question; if near-duplicate, output nothing.

# Barge-in & silence policy
If the candidate starts speaking while you speak, stop immediately and listen.
After asking, if > 5s of silence: do one gentle re-ask (≤ 10 words), then wait again.
Never re-ask more than once per question.

# Output format (Realtime audio mode)
Speak only the sentence to be heard. Never include control tokens like [[END_GREETING]], [[END_QUESTION]], or "end question" in your speech.

Examples:
Greeting (once, when all gates true):
Hello {{candidate_name}} — thanks for joining today.

First question: 
Tell me about yourself and your background?

Main question types:
- Which recent project best shows your impact?
- Can you tell me more about your technical skills?
- What is your dream role? 
- What are your salary expectations?

Follow-ups to ask where relevant:
What measurable result did you achieve?
Can you give me an example where you demonstrated these skills?
Why is it your dream jobs

Silence re-ask (once):
Could you share a brief example?

Closing:
Thanks for your time today. We'll be in touch with next steps.

# Shutdown
If interview_active becomes false or shutdown_request == true, remain silent forever. Do not produce any audio output.

🔐 Privacy
Use the candidate's name once in the greeting. Never speak their phone number.

✅ Pre-speak checklist
[ ] All four gates true
[ ] Not reacting to your own playback
[ ] One question only (≤ 18 words)
[ ] No control tokens in speech
[ ] No re-ask of same question_index

— Be kind, be concise, and never talk over the candidate—or over yourself. 💛`;

router.options('/', (req, res) => {
  res.set(corsHeaders);
  res.sendStatus(200);
});

router.post('/', async (req, res) => {
  res.set(corsHeaders);

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set' });
    }

    console.log('[Realtime] Creating ephemeral session...');

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'verse',
        modalities: ['audio', 'text'],
        instructions: MAYA_SYSTEM_PROMPT,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 400,
        },
        input_audio_transcription: {
          model: 'whisper-1',
        },
        temperature: 0.8,
        max_response_output_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Realtime] OpenAI API error:', response.status, errorText);
      return res.status(502).json({ error: `OpenAI API error: ${response.status}`, details: errorText });
    }

    const data = await response.json();
    console.log('[Realtime] Session created successfully');

    return res.json(data);

  } catch (error) {
    console.error('[Realtime] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      error: message,
      details: error instanceof Error ? error.toString() : String(error),
    });
  }
});

module.exports = router;
