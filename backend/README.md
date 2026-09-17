# Sonic Recruiter Pro — Backend

A lightweight Express.js backend migrated from Deno serverless functions. Provides endpoints for CV parsing, job-description analysis, audio transcription, text-to-speech (ElevenLabs), question generation, account deletion, and candidate response analysis. It also exposes a Socket.IO namespace `/interview` that runs an automated interviewer (Maya) which streams audio -> Whisper -> OpenAI and persists interviews to Supabase.

**Quick overview**
- HTTP routes: mounted under `/service/*` and available at the top-level paths (see "API routes").
- Optional realtime interviewer: Socket.IO namespace `/interview` (initialised only if `service/interview-websocket.js` exports `setupWebSocketHandlers`).

**Table of contents**
- Getting started
- Environment variables
- Install & run
- HTTP routes (examples)
- WebSocket / interview testing (headless)
- Troubleshooting
- Notes

**Getting started**
Prerequisites:
- Node.js (v18+ recommended)
- npm
- (Optional) `ffmpeg` for audio conversions when testing audio streaming

Clone and enter the project:

```
git clone <repo-url>
cd sonic-recruiter-pro-backend
```

Environment: create a `.env` file in the project root with the variables below.

Environment variables (summary)
- `OPENAI_API_KEY` — OpenAI API key (chat completions & Whisper transcription)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (used for storage and admin ops)
- `ELEVENLABS_API_KEY` — ElevenLabs key for TTS
- `CV_BUCKET` — Supabase storage bucket used by `parse-cv` (default `cvs`)
- `PORT` — optional, server port (defaults to `3000`)

Install dependencies

```bash
npm install
# (optional test client deps)
npm install socket.io-client
```

Run the server

- If you need Socket.IO (the `interview-websocket` module exports `setupWebSocketHandlers`), the server will start an HTTP server with Socket.IO automatically.

```bash
# default port from .env or 3000
node index.js

# or run on another port
PORT=3001 node index.js
```

API routes (HTTP)
- `GET /` — (when not running socket mode) simple hello route.
- `POST /parse-cv` — Upload a CV file (multipart `file`). Returns signed URL and path.
  - Example (curl + form):
    ```bash
    curl -X POST -F "file=@/path/to/cv.pdf" http://localhost:3000/parse-cv
    ```
- `POST /upload-cv` — Upload and store CV file to Supabase storage bucket. Accepts multipart `file` (PDF or DOCX). Returns file path, signed URL, and metadata.
  - Example (curl + form):
    ```bash
    curl -X POST -F "file=@/path/to/resume.pdf" http://localhost:3000/upload-cv
    ```
    Returns: `{ "ok": true, "file_path": "uploads/uuid.pdf", "url": "https://...", "file_name": "resume.pdf", "file_size": 125000, "content_type": "application/pdf" }`
- `POST /analyze-job-desc` — Analyze job description (text or base64 document). JSON body: `{ jobDescription: "..." }` or `{ fileData: "<base64>", fileName: "...pdf" }`.
- `POST /transcribe-audio` — Transcribe base64 audio. JSON body: `{ audio: "data:...;base64,<base64>", mimeType: "audio/webm" }`.
- `POST /tts-labs` — ElevenLabs TTS. JSON body: `{ text: "...", voiceId: "<id>" }`. Returns `audio/mpeg` binary response.
- `POST /generate-questions` — Generate interview questions from jobDescription/candidateProfile.
- `POST /delete-user-account` — Admin delete user via Supabase. Include `Authorization: Bearer <access_token>` header.
- `POST /analyze-response` — Analyze a candidate's response. JSON body: `{ question: "...", response: "...", context: {...} }`.
- `POST /validate-answer-duration` — Validate interview answer meets minimum duration (10s) and word count (5+ words). JSON body: `{ answerText: "...", durationSeconds: 15, questionIndex: 0 }`.
  - Example (curl):
    ```bash
    curl -X POST http://localhost:3000/validate-answer-duration \
      -H "Content-Type: application/json" \
      -d '{
        "answerText": "I have five years of experience working with React and Node.js in production environments",
        "durationSeconds": 12,
        "questionIndex": 0
      }'
    ```
    Returns: `{ "isValid": true, "durationSeconds": 12, "meetsMinimumDuration": true, "wordCount": 15, "hasMeaningfulContent": true, "feedback": "Answer accepted" }`
- `POST /generate-summary` — Generate a comprehensive final interview assessment from complete session data. JSON body: `{ interviewData: { candidate: {...}, job: {...}, transcript: [...], evidence: {...} }, model: "gpt-4o" }`. Returns detailed scoring with recommendation, technical/soft skills assessment, red flags, and next steps.
  - Example (curl):
    ```bash
    curl -X POST http://localhost:3000/generate-summary \
      -H "Content-Type: application/json" \
      -d '{
        "interviewData": {
          "candidate": { "name": "John Doe", "experience": 5 },
          "job": { "must_haves": ["React", "Node.js"], "nice_haves": ["TypeScript"] },
          "transcript": [{"speaker": "interviewer", "text": "Tell me about React"}, {"speaker": "candidate", "text": "I have 5 years with React..."}],
          "evidence": { "React": [{"quote": "5 years experience", "timestamp": "0:15"}] }
        },
        "model": "gpt-4o-mini"
      }'
    ```
    Returns: `{ summary: { overallScore: 85, recommendation: "hire", technicalSkills: {...}, softSkills: {...}, ... } }`
- `POST /parse-cv-content` — Parse CV text and extract structured information. JSON body: `{ cvText: "...", model: "gpt-4o-mini" }`. Returns parsed CV with personal info, experience, education, skills, certifications, projects.
  - Example (curl):
    ```bash
    curl -X POST http://localhost:3000/parse-cv-content \
      -H "Content-Type: application/json" \
      -d '{"cvText":"John Doe\nSenior Developer with 5 years Node.js experience...","model":"gpt-4o-mini"}'
    ```
- `POST /realtime-session` — Create an ephemeral OpenAI Realtime API session for live audio/text interviewing with Maya. Returns session token, token expiry, and connection details. JSON body: `{}` (empty).
  - Example (curl):
    ```bash
    curl -X POST http://localhost:3000/realtime-session \
      -H "Content-Type: application/json" \
      -d '{}'
    ```
    Returns: `{ "id": "sess_...", "object": "realtime.session", "model": "gpt-4o-realtime-preview-2024-12-17", "expires_at": 1234567890, "modalities": ["audio", "text"], "voice": "verse", ... }`
- `POST /save-maya-interview` — Save completed Maya interview session to Supabase `maya_interviews` table. JSON body: `{ session_id: "...", candidate_name: "...", candidate_phone: "...", started_at: "...", ended_at: "...", duration_seconds: 300, questions: [...], responses: [...], transcript: [...] }`.
  - Example (curl):
    ```bash
    curl -X POST http://localhost:3000/save-maya-interview \
      -H "Content-Type: application/json" \
      -d '{
        "session_id": "sess_abc123",
        "candidate_name": "John Doe",
        "candidate_phone": "+1-555-0123",
        "started_at": "2025-11-15T10:00:00Z",
        "ended_at": "2025-11-15T10:05:00Z",
        "duration_seconds": 300,
        "questions": ["Tell me about yourself?", "Describe a challenge you faced"],
        "responses": ["I am a software engineer with 5 years experience", "Once I had to debug..."],
        "transcript": [{"speaker": "maya", "text": "Hello..."}, {"speaker": "candidate", "text": "Hi there"}]
      }'
    ```
    Returns: `{ "success": true, "data": [...] }`

Each route sets permissive CORS headers (for local testing). See individual route files under `service/` for parameter details and limits.

WebSocket / interview (headless) testing
- Namespace: `/interview` (Socket.IO). The interview module exposes `setupWebSocketHandlers(io)` and a small router at `/interview-websocket`.
- A headless Node test client is provided at `scripts/test-interview-client.js`.

To test the interviewer without a browser:
1. Ensure the server is running (and `OPENAI_API_KEY` is set).
2. Install the test client dependency (if not already installed):

```bash
npm install socket.io-client
```

3. Run the test client (optional: pass path to a WebM/OGG/MP3 file to stream audio):

```bash
node scripts/test-interview-client.js            # manual text + fake audio chunk
node scripts/test-interview-client.js output.webm  # stream a real file
```

What the test client does:
- Connects to `http://localhost:PORT/interview` using Socket.IO
- Emits a `meta` event (codec, sample rate, candidate info)
- Emits a `manual_text` event to exercise question generation
- Optionally streams an audio file in chunks via `audio` events then emits `flush`
- Prints `message` events emitted by the server

Tips for audio testing
- Use `ffmpeg` to convert files to Opus-in-WebM if needed:

```bash
ffmpeg -i input.wav -c:a libopus -b:a 64k output.webm
```

- The server expects binary `Buffer` chunks for `audio` events.

Troubleshooting
- Port in use: if you see `EADDRINUSE`, either kill the process using the port (`lsof -i :3000`) or run with `PORT=3001 node index.js`.
- OpenAI errors: ensure `OPENAI_API_KEY` is present. The server logs upstream responses for debugging.
- Supabase issues: ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct.
- CORS: routes set permissive CORS headers but your browser environment or hosting config might require more restrictions—adjust headers in each route as needed.

Developer notes
- Route files are in the `service/` folder; each exports an Express `router`.
- `interview-websocket.js` exports both `router` and `setupWebSocketHandlers(io)`. The main `index.js` only creates Socket.IO when `setupWebSocketHandlers` exists to keep the server simple when realtime isn't needed.
- Binary audio handling uses Node `Buffer` and streams chunks to OpenAI Whisper via multipart form requests.

Testing & CI
- There are no automated tests included. To add tests, consider adding small integration tests that start the server on a random port and call each HTTP route with mocked upstream APIs.

Contributing
- Open a PR with focused changes. Keep changes small and add tests for new logic where practical.

License
- (Add license here)

---
If you'd like, I can add:
- Example Postman collection for the HTTP routes,
- A minimal `docker-compose` to run the backend with mocked upstreams, or
- Automated smoke tests that run the `scripts/test-interview-client.js` against a local server and assert expected messages.
