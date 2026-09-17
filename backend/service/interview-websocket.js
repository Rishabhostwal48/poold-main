// interview-websocket.js — Express router with socket.io for WebSocket support
// WebSocket server for Maya (audio-only)
// Streams PCM16 frames from client, wraps into WAV, sends to OpenAI Whisper STT,
// generates next Maya question via OpenAI, and persists to Supabase.
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-authorization'
};

// ---- Helpers ----
function pcm16ToWav(pcm, sr = 16000, channels = 1) {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = pcm.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  writeStr(buffer, 0, 'RIFF');
  buffer.writeUInt32LE(36 + dataSize, 4);
  writeStr(buffer, 8, 'WAVE');
  writeStr(buffer, 12, 'fmt ');
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sr, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample
  writeStr(buffer, 36, 'data');
  buffer.writeUInt32LE(dataSize, 40);
  const out = new Int16Array(buffer.buffer, buffer.byteOffset + 44, pcm.length);
  out.set(pcm);
  return buffer;
  function writeStr(buf, offset, s) {
    for(let i = 0; i < s.length; i++)buf[offset + i] = s.charCodeAt(i);
  }
}

async function logSttFailure(resp) {
  let body = '';
  try {
    body = await resp.text();
  } catch  {}
  console.error('❌ STT failed', {
    status: resp.status,
    statusText: resp.statusText,
    body: body?.slice(0, 800)
  });
}

function writeJSON(socket, obj) {
  try {
    socket.emit('message', JSON.stringify(obj));
  } catch  {
  /* ignore */ }
}

// ---- Server ----
router.get('/', (req, res) => {
  res.set(corsHeaders);
  res.json({ status: 'WebSocket endpoint ready. Connect via socket.io' });
});

router.options('/', (req, res) => {
  res.set(corsHeaders);
  res.sendStatus(200);
});

// Socket.io handler - to be initialized in main index.js
function setupWebSocketHandlers(io) {
  const nsp = io.of('/interview');

  nsp.on('connection', async (socket) => {
    // ---- State ----
    const sessionId = require('crypto').randomUUID();
    const startTime = Date.now();
    const INTERVIEW_DURATION = 20 * 60 * 1000; // 20 minutes
    const interviewTranscript = [];
    const conversationHistory = [];
    let mainQuestionCount = 0;
    let currentFollowUpCount = 0;
    const MAX_MAIN_QUESTIONS = 14;
    const MAX_FOLLOW_UPS_PER_QUESTION = 2;
    let isFirstMessage = true;
    let lastQuestionText = '';
    // Candidate information
    let candidateName = '';
    let candidatePhone = '';
    // Audio buffering
    let audioCodec = 'webm-opus';
    let sampleRate = 48000;
    let language = 'en';
    let accumulatedChunks = [];
    let accumulatedBytes = 0;
    let processing = false;
    const MIN_BYTES_OPUS = 50_000;
    const MAX_BYTES_OPUS = 200_000;
    const MIN_WINDOW_MS = 2500;
    const MAX_WINDOW_MS = 4000;
    const MAX_ACCUM_BYTES_HARD = 16 * 1024 * 1024;

    function bufferedMs() {
      if (audioCodec !== 'pcm16') return 0;
      const samples = accumulatedBytes / 2;
      return Math.floor(samples / sampleRate * 1000);
    }

    // ---- Supabase ----
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ---- Maya System Prompt ----
    function getMayaSystemPrompt() {
      return `You are poold, a calm UK-English interviewer. You ask one concise question at a time and then listen.
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

# Output format (WebSocket JSON mode)
Return one compact JSON object per turn. The "text" field contains only spoken text (no control tokens). Metadata in separate fields.

Format:
{"kind":"greeting|ask|followup|silence_reask|closing|control","text":"<what to speak>","question_index":0,"total_questions":8,"followups_remaining":2}

For shutdown (when interview_active becomes false or shutdown_request==true) emit exactly once:
{"kind":"control","text":"[[TEARDOWN_AUDIO]]"}
Then remain silent forever.

Examples:
Greeting: Hi ${candidateName || 'there'}—I'm Maya. I'll ask one question at a time and listen carefully.
Ask Start question: Tell me more about yourself?

Main question types:
- Which recent project best shows your impact?
- Can you tell me more about your technical skills?
- What is your dream role? 
- What are your salary expectations?

Follow-ups to ask where relevant:
What measurable result did you achieve?
Can you give me an example where you demonstrated these skills?
Why is it your dream job?

Privacy
Use the candidate's name once in the greeting. Never speak their phone number.

Current Progress:
You have asked ${mainQuestionCount} of ${MAX_MAIN_QUESTIONS} main questions.
${currentFollowUpCount < MAX_FOLLOW_UPS_PER_QUESTION ? `You can ask ${MAX_FOLLOW_UPS_PER_QUESTION - currentFollowUpCount} more follow-up(s) for the current question.` : 'Move to the next main question.'}

✅ Pre-speak checklist
[ ] All four gates true
[ ] Not reacting to your own playback
[ ] One question only (≤ 18 words)
[ ] No control tokens in speech
[ ] No re-ask of same question_index

— Be kind, be concise, and never talk over the candidate—or over yourself. 💛`;
    }

    // ---- OpenAI (question generation) ----
    async function generateMayaResponse(userMessage) {
      try {
        const openAIApiKey = process.env.OPENAI_API_KEY;
        if (!openAIApiKey) {
          console.error('❌ OPENAI_API_KEY not configured');
          return null;
        }

        if (userMessage && userMessage.trim()) {
          conversationHistory.push({
            role: 'user',
            content: userMessage
          });
        }

        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: getMayaSystemPrompt()
              },
              ...conversationHistory
            ],
            max_tokens: 150,
            temperature: 0.8
          })
        });

        if (!resp.ok) {
          console.error('❌ OpenAI error:', resp.status, await resp.text());
          return null;
        }

        const data = await resp.json();
        console.log('🧠 Maya response generated:', data);
        const mayaResponse = data?.choices?.[0]?.message?.content ?? '';
        const match = mayaResponse.match(/(.*?)\[\[END_QUESTION\]\]/s);
        const questionText = (match ? match[1] : mayaResponse).trim();

        conversationHistory.push({
          role: 'assistant',
          content: mayaResponse
        });

        const isClarification = /I might have missed|could you say it once more|didn't catch that|can you repeat/i.test(questionText);
        let isFollowUp = false;

        if (isClarification) {
          console.log('🔄 Clarification question - not counting toward total');
        } else {
          lastQuestionText = questionText;
          const wc = questionText.split(/\s+/).filter(Boolean).length;
          isFollowUp = wc <= 12 && !isFirstMessage;

          if (isFirstMessage) {
            isFirstMessage = false;
            mainQuestionCount = 1;
            currentFollowUpCount = 0;
          } else if (isFollowUp && currentFollowUpCount < MAX_FOLLOW_UPS_PER_QUESTION) {
            currentFollowUpCount++;
          } else {
            mainQuestionCount++;
            currentFollowUpCount = 0;
          }
        }

        const isClosing = mainQuestionCount > MAX_MAIN_QUESTIONS;
        console.log(`✅ Maya ${isFollowUp ? 'follow-up' : 'main'} (${mainQuestionCount}/${MAX_MAIN_QUESTIONS}): ${questionText.slice(0, 80)}${questionText.length > 80 ? '…' : ''}`);

        return {
          question: questionText,
          isFollowUp,
          isClosing,
          questionNumber: Math.min(mainQuestionCount, MAX_MAIN_QUESTIONS),
          totalQuestions: MAX_MAIN_QUESTIONS
        };
      } catch (err) {
        console.error('❌ generateMayaResponse error:', err);
        return null;
      }
    }

    // ---- STT processing using OpenAI Whisper ----
    async function processAccumulated(force = false) {
      if (processing || accumulatedChunks.length === 0) return;
      const currentCodec = audioCodec;

      if (!force) {
        if (currentCodec === 'pcm16') {
          const ms = bufferedMs();
          if (ms < MIN_WINDOW_MS) return;
        } else {
          if (accumulatedBytes < MIN_BYTES_OPUS) return;
        }
      }

      processing = true;

      try {
        const openAIApiKey = process.env.OPENAI_API_KEY;
        if (!openAIApiKey) {
          console.error('❌ OPENAI_API_KEY not configured');
          processing = false;
          return;
        }

        const merged = Buffer.concat(accumulatedChunks);
        accumulatedChunks = [];
        accumulatedBytes = 0;

        let file;
        if (currentCodec === 'pcm16') {
          const pcm = new Int16Array(merged.buffer, merged.byteOffset, merged.byteLength / 2);
          if (pcm.length === 0) {
            processing = false;
            return;
          }
          const wavBytes = pcm16ToWav(pcm, sampleRate, 1);
          file = { data: wavBytes, name: 'audio.wav', type: 'audio/wav' };
        } else {
          const type = currentCodec === 'webm-opus' ? 'audio/webm' : 'audio/ogg';
          const name = currentCodec === 'webm-opus' ? 'audio.webm' : 'audio.ogg';
          file = { data: merged, name, type };
        }

        const form = new FormData();
        const blob = new Blob([file.data], { type: file.type });
        form.append('file', blob, file.name);
        form.append('model', 'whisper-1');
        if (language) form.append('language', language);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60_000);

        const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openAIApiKey}`
          },
          body: form,
          signal: controller.signal
        }).finally(() => clearTimeout(timeout));

        if (!resp.ok) {
          await logSttFailure(resp);
          writeJSON(socket, {
            type: 'error',
            message: 'Transcription failed'
          });
          processing = false;
          return;
        }

        const result = await resp.json();
        const text = (result?.text || '').trim();

        if (text) {
          const ts = new Date().toISOString();
          console.log('✅ Transcribed:', text.slice(0, 120) + (text.length > 120 ? '…' : ''));

          interviewTranscript.push({
            speaker: 'candidate',
            text,
            timestamp: ts
          });

          writeJSON(socket, {
            type: 'transcript',
            data: {
              text,
              speaker: 'candidate',
              timestamp: ts
            }
          });

          const elapsed = Date.now() - startTime;
          if (elapsed >= INTERVIEW_DURATION || mainQuestionCount > MAX_MAIN_QUESTIONS) {
            await saveInterviewData();
            const closing = await generateMayaResponse(text);
            const closingText = closing?.question || 'Thank you for sharing all of that—it was a pleasure hearing your stories. Wishing you the very best.';
            writeJSON(socket, {
              type: 'question',
              data: {
                question: closingText,
                isClosing: true
              }
            });
            setTimeout(() => writeJSON(socket, { type: 'interview_complete' }), 3000);
            processing = false;
            return;
          }

          setTimeout(async () => {
            const next = await generateMayaResponse(text);
            if (next) {
              const ts2 = new Date().toISOString();
              interviewTranscript.push({
                speaker: 'maya',
                text: next.question,
                timestamp: ts2
              });
              writeJSON(socket, {
                type: 'question',
                data: next
              });
            }
          }, 800);
        }
      } catch (err) {
        console.error('❌ Error processing audio:', err);
        writeJSON(socket, {
          type: 'error',
          message: 'Transcription error'
        });
      } finally {
        processing = false;
      }
    }

    async function saveInterviewData() {
      try {
        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        await supabase.from('maya_interviews').insert({
          session_id: sessionId,
          candidate_name: candidateName || null,
          candidate_phone: candidatePhone || null,
          started_at: new Date(startTime).toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          questions: conversationHistory
            .filter((m) => m.role === 'assistant')
            .map((m) => ({
              question: m.content.replace(/\[\[END_QUESTION\]\]/g, '').trim(),
              timestamp: new Date().toISOString()
            })),
          responses: conversationHistory
            .filter((m) => m.role === 'user')
            .map((m) => ({
              response: m.content,
              timestamp: new Date().toISOString()
            })),
          transcript: interviewTranscript
        });
        console.log('✅ Interview data saved', {
          sessionId,
          candidateName,
          candidatePhone
        });
      } catch (err) {
        console.error('❌ Error saving interview data:', err);
      }
    }

    // ---- Heartbeat ----
    const heartbeat = setInterval(() => {
      try {
        writeJSON(socket, {
          type: 'ping',
          ts: Date.now()
        });
      } catch  {}
    }, 30_000);

    // ---- Socket.io Events ----
    socket.on('connect', async () => {
      console.log('📞 Socket.io connected', { sessionId });

      const first = await generateMayaResponse();
      if (first) {
        interviewTranscript.push({
          speaker: 'maya',
          text: first.question,
          timestamp: new Date().toISOString()
        });
        writeJSON(socket, {
          type: 'question',
          data: { ...first, isGreeting: true }
        });
      } else {
        const fallback = "Hi there - I'm Maya. I'll ask one question at a time and listen carefully. To start, what's something you've worked on recently that you're proud of?";
        writeJSON(socket, {
          type: 'question',
          data: { question: fallback, isGreeting: true }
        });
      }
    });

    socket.on('audio', async (data) => {
      try {
        if (Buffer.isBuffer(data)) {
          accumulatedChunks.push(data);
          accumulatedBytes += data.byteLength;

          if (audioCodec === 'pcm16') {
            const ms = bufferedMs();
            if (ms >= MIN_WINDOW_MS) await processAccumulated();
            if (accumulatedBytes > MAX_ACCUM_BYTES_HARD) await processAccumulated(true);
          } else {
            if (accumulatedBytes >= MAX_BYTES_OPUS) await processAccumulated();
            if (accumulatedBytes > MAX_ACCUM_BYTES_HARD) await processAccumulated(true);
          }
        }
      } catch (err) {
        console.error('❌ Error processing audio:', err);
      }
    });

    socket.on('meta', (msg) => {
      try {
        if (typeof msg.codec === 'string') {
          if (['pcm16', 'webm-opus', 'ogg-opus'].includes(msg.codec)) {
            audioCodec = msg.codec;
          }
        }
        if (typeof msg.mimeType === 'string') {
          const mt = msg.mimeType.toLowerCase();
          if (mt.includes('webm')) audioCodec = 'webm-opus';
          else if (mt.includes('ogg')) audioCodec = 'ogg-opus';
          else if (mt.includes('wav') || mt.includes('pcm')) audioCodec = 'pcm16';
        }
        if (typeof msg.sampleRate === 'number' && isFinite(msg.sampleRate)) {
          sampleRate = Math.max(8000, Math.min(48000, Math.floor(msg.sampleRate)));
        }
        if (typeof msg.language === 'string') language = msg.language;
        if (typeof msg.candidateName === 'string') candidateName = msg.candidateName;
        if (typeof msg.candidatePhone === 'string') candidatePhone = msg.candidatePhone;

        console.log('📝 Candidate info received:', {
          candidateName,
          candidatePhone
        });
      } catch (err) {
        console.error('❌ Error processing meta:', err);
      }
    });

    socket.on('flush', async () => {
      try {
        await processAccumulated(true);
      } catch (err) {
        console.error('❌ Error flushing:', err);
      }
    });

    socket.on('manual_text', async (msg) => {
      try {
        const textMsg = String(msg.text || '').trim();
        if (textMsg) {
          interviewTranscript.push({
            speaker: 'candidate',
            text: textMsg,
            timestamp: new Date().toISOString()
          });
          const next = await generateMayaResponse(textMsg);
          if (next) {
            interviewTranscript.push({
              speaker: 'maya',
              text: next.question,
              timestamp: new Date().toISOString()
            });
            writeJSON(socket, {
              type: 'question',
              data: next
            });
          }
        }
      } catch (err) {
        console.error('❌ Error processing manual_text:', err);
      }
    });

    socket.on('disconnect', async (reason) => {
      clearInterval(heartbeat);
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      if (durationSeconds > 30) await saveInterviewData();
      console.log('🔌 Socket.io disconnected:', reason);
    });

    socket.on('error', (err) => {
      console.error('❌ Socket.io error:', err);
    });
  });
}

module.exports = router;
module.exports.setupWebSocketHandlers = setupWebSocketHandlers;
