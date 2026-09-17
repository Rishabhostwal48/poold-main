# Sonic Recruiter Pro

Concise, top-level readme for the Sonic Recruiter Pro repository. This repository contains two primary projects:

- `frontend/` — the React + Vite frontend that implements the interview UI, audio capture, and client-side logic.
- `backend/` — the Express.js backend that exposes HTTP routes and the optional realtime interviewer (Socket.IO). The backend handles secure server-side operations (OpenAI, ElevenLabs, Supabase interactions, and migrations).

Live demo: https://app.poold.co

---

## Quick Overview

This monorepo separates concerns between frontend and backend. Each part has its own README with full details and environment instructions:

- Frontend documentation: `frontend/README.md`
- Backend documentation: `backend/README.md`

Use the instructions below for a fast local dev setup (minimal commands). For full configuration and advanced options, read the per-project README files.

---

## Quick Start (Local Development)

npx nodemon index.js    # or `PORT=3001 node index.js` to run on custom port

### Option 1: Run locally with npm/bun

1. Clone the repository
  ```bash
  git clone <your-repo-url>
  cd sonic-recruiter-pro
  ```

2. Frontend: run the UI locally
  ```bash
  cd frontend
  npm install      # or `bun install`
  # create frontend/.env with the variable NAMES listed below (do NOT commit secrets)
  npm run dev      # or `bun dev` (http://localhost:5173 or configured port)
  ```

3. Backend: run the server (in another terminal)
  ```bash
  cd backend
  npm install
  # create backend/.env with the variable NAMES listed below (do NOT commit secrets)
  npx nodemon index.js    # or `PORT=3001 node index.js` to run on custom port
  ```

### Option 2: Run locally with Docker Compose

1. Build and start both frontend and backend containers:
  ```bash
  docker-compose up --build --force-recreate
  ```

2. Access the frontend at:
  ```
  http://localhost:8080
  ```

3. Stop all containers:
  ```bash
  docker-compose down
  ```

**Notes:**
- Ensure `.env` files exist in both `frontend/` and `backend/` before starting containers.
- The Docker setup uses named volumes for `node_modules` to avoid host/container conflicts.
- For advanced Docker usage, see comments in `docker-compose.yml` and each subproject's README.

---

## Environment Variables (names only — do NOT commit values)

Frontend (.env) — place in `frontend/.env`:

```
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_EDGE_URL
VITE_SUPABASE_ANON_KEY
ELEVENLABS_API_KEY
VITE_BACKEND_URL         # optional - only if using a local backend proxy
VITE_WEBSOCKET_URL       # optional - fallback transport
```

Backend (.env) — place in `backend/.env`:

```
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ELEVENLABS_API_KEY
CV_BUCKET                # optional, default: cvs
PORT                     # optional, defaults to 3000
```

---

## Useful Commands

From repo root:

```bash
# Start frontend (in one terminal)
cd frontend && bun dev

# Start backend (in another terminal)
cd backend && node index.js

# Run both with two terminals or use your preferred process manager
```

---

## Where to look next

- Frontend developer docs & details: `frontend/README.md` (WebRTC, MayaInterview, realtimeClient, tts, env examples)
- Backend API, WebSocket interview, and deployment instructions: `backend/README.md`
- CI, tests, and infra: see each project's README for recommendations

---

## Contributing

1. Create a branch: `git checkout -b feat/your-change`
2. Make focused changes and tests (if applicable)
3. Open a PR against `sn_dev` (or your team's target branch)

---

If you'd like, I can also:

- Create a small root-level `dev` script that starts frontend and backend concurrently.
- Add a minimal `docker-compose` that spins up frontend, backend and a local mock Supabase for smoke tests.

---

Last updated: 2025-11-16
# Sonic Recruiter Pro - AI-Powered Interview Platform - Frontend 

Production-ready frontend for conducting real-time voice interviews using OpenAI's Realtime API with comprehensive interview analysis and scoring capabilities.

## Project Brief

Sonic Recruiter Pro is a two-part system: a frontend (this repository) that runs the interview UI, audio capture, and client-side logic, and a backend (a separate repository) that hosts secure server-side functions, database migrations, and API endpoints. The frontend README focuses on local development and UI integration; backend operational details (secrets, migrations, server deployment) live in the backend repository's README.

Live demo: https://app.poold.co

### Live App & Setup (short)
- Visit the live application at: https://app.poold.co
- For local frontend development: follow the `Quick Start` section in this README (clone, install, create `.env`, run `bun dev`).
- For backend setup (Supabase, Edge Functions, secrets, migrations) see the backend repository README — that repo contains all server-side setup and deployment steps.


## 🎯 Overview

Sonic Recruiter Pro is an end-to-end interview automation solution featuring:
- **Real-time voice interviews** with AI interviewer (Maya) powered by GPT-4 Realtime
- **CV parsing and analysis** with structured data extraction
- **Job description analysis** with requirement matching
- **Dual-transport architecture** (WebRTC + WebSocket) for 99.9% uptime
- **Comprehensive analytics** with response evaluation and scoring

---

## 🌟 Core Features

### 1. Interview Management
- **Live Audio Interviews**: WebRTC + OpenAI Realtime API for low-latency voice
- **Fallback Transport**: WebSocket + Whisper + ElevenLabs TTS for resilience
- **Barge-in Support**: Candidate can interrupt Maya mid-response
- **Real-time Transcription**: Server-side Whisper with client-side VAD
- **Duration Gating**: Enforces minimum 5-second answer duration before processing
- **Question Tracking**: 8 main questions + 2 follow-ups per question
- **Interview Duration**: 20-minute sessions with automatic termination

### 2. CV & Resume Processing
- **PDF/DOCX Upload**: Direct file upload to Supabase Storage
- **AI Parsing**: GPT-4o-mini extracts structured data
- **Profile Generation**: Candidate basics, experience, education, skills
- **Experience Calculation**: Automatic years-of-experience detection

### 3. Job Description Analysis
- **Text/PDF Input**: Support for both raw text and file uploads
- **Requirement Extraction**: Must-haves, nice-to-haves, technologies
- **Competency Mapping**: Technical, soft skills, and behavioral signals
- **Gap Analysis**: Real-time comparison with candidate profile

### 4. Response Analysis & Scoring
- **10-Dimension Evaluation**:
  - Technical correctness & depth
  - Communication clarity
  - Problem-solving approach
  - Job relevance
  - Experience evidence
  - Soft skills observed
  - Critical thinking
  - Red flags detection
  - Follow-up opportunities
  - Overall hiring recommendation

### 5. Interview Summary & Reports
- **Automated Reports**: Post-interview analysis and scoring
- **Recommendation Engine**: Hire/No-Hire with reasoning
- **Transcript Export**: Full audio transcripts with timestamps
- **Comparative Analytics**: Multiple candidate comparison

## 🏗️ Technology Stack

### Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 18.3+ |
| Language | TypeScript | 5.6+ |
| Build Tool | Vite | 5.0+ |
| Styling | Tailwind CSS | 3.4+ |
| UI Components | Shadcn/ui | Latest |
| Package Manager | Bun | 1.x |
| WebRTC | OpenAI Realtime API | preview-20241024 |
| Audio Codec | Opus (webm) | 128kbps |



## 📋 Project Structure

```
sonic-recruiter-pro/
├── src/
│   ├── pages/              # Route pages
│   │   ├── Landing.tsx     # Landing/home
│   │   ├── Auth.tsx        # Authentication
│   │   ├── Setup.tsx       # CV upload + job description
│   │   ├── Interview.tsx   # Live interview (WebSocket fallback)
│   │   ├── MayaInterview.tsx # Live interview (WebRTC primary)
│   │   ├── Summary.tsx     # Interview summary & analysis
│   │   ├── AdminDashboard.tsx
│   │   └── ...
│   ├── components/         # Reusable React components
│   │   ├── ui/            # Shadcn/ui components
│   │   ├── LiveInterview.tsx
│   │   ├── QuestionCard.tsx
│   │   ├── ResponseAnalysis.tsx
│   │   ├── VUMeter.tsx    # Audio levels visualization
│   │   └── ...
│   ├── lib/               # Core utilities
│   │   ├── api.ts         # Supabase API calls
│   │   ├── edge.ts        # Edge function caller
│   │   ├── gap.ts         # Gap analysis logic
│   │   ├── pdfClient.ts   # PDF handling
│   │   └── utils.ts       # General utilities
│   ├── utils/             # Audio & WebRTC utilities
│   │   ├── realtimeClient.ts     # OpenAI Realtime WebRTC
│   │   ├── RealtimeAudio.ts      # WebSocket audio handling
│   │   ├── audioQueue.ts         # TTS audio playback
│   │   ├── tts.ts               # ElevenLabs integration
│   │   └── micGate.ts           # Voice activity detection
│   ├── hooks/             # Custom React hooks
│   │   ├── useAudioRecorder.ts
│   │   ├── useUserRole.ts
│   │   └── use-toast.ts
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx
│   ├── services/          # External service integrations
│   │   └── aiServices.ts
│   ├── store/             # State management (Zustand)
│   │   └── interview.ts
├── public/
├── vite.config.ts         # Vite configuration
├── tailwind.config.ts     # Tailwind configuration
├── tsconfig.json          # TypeScript configuration
├── package.json
├── .env                   # Environment variables (local)
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ or **Bun** (recommended)
- **Supabase** account (free tier acceptable for development)
- **OpenAI** API key with Realtime API access
- **ElevenLabs** API key for neural TTS

### Installation

1. **Clone repository and install dependencies**
```bash
git clone <your-repo-url>
cd sonic-recruiter-pro
bun install  # or npm install
```

2. **Set up environment variables**

Create `.env` in project root:
```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_EDGE_URL=https://your-project.supabase.co/functions/v1

# ElevenLabs (fallback TTS)
ELEVENLABS_API_KEY=sk_...
```

3. **Start development server**
```bash
bun dev  # http://localhost:5173
```


## 🔧 Core Components

### MayaInterview.tsx (Live Interview - WebRTC Primary)
Main component managing the AI interview experience with 5-second answer gating.

**Key Features:**
- WebRTC peer connection to OpenAI Realtime API
- Minimum 5-second answer duration enforcement
- Silence detection (2-second threshold)
- Barge-in support (interrupt Maya mid-response)
- Fallback to WebSocket/Whisper if WebRTC fails
- Real-time audio level visualization

**Key Constants:**
```typescript
const MIN_ANSWER_DURATION_MS = 5000;  // Minimum 5 seconds before processing
const SILENCE_THRESHOLD_MS = 2000;    // Silence timeout
const TIMER_LIMIT_SEC = 1200;         // 20-minute interview limit
```

**Critical Refs:**
- `answerStartTimeRef`: Timestamp when candidate started speaking
- `allowResponseRef`: Boolean gate for Maya response permission
- `isAudioMutedRef`: Tracks local audio mute state

**Flow Example:**
```typescript
// 1. On transcript: Check if 5+ seconds elapsed
onWSTranscript(text, speaker) {
  if (speaker === 'user') {
    if (!answerStartTimeRef.current) {
      answerStartTimeRef.current = Date.now();
    }
    // After 5s, set allowResponseRef.current = true
  }
}

// 2. On response.created: Check gate before allowing
handleRealtimeMessage(msg) {
  if (msg.type === 'response.created' && !allowResponseRef.current) {
    return; // Block response if answer too short
  }
  realtimeClientRef.current?.unmuteLocalMic(); // Allow audio
}

// 3. On response.done: Re-mute for next question
if (msg.type === 'response.done') {
  realtimeClientRef.current?.muteLocalMic();
  // Reset refs for next answer
}
```

### RealtimeClient.ts (WebRTC Connection Manager)
Manages WebRTC peer connection with OpenAI Realtime API.

**New Mute/Unmute API:**
```typescript
// Disable all local audio tracks (prevents audio from reaching model)
muteLocalMic(): void {
  this.localSenders.forEach(sender => {
    if (sender.track) {
      sender.track.enabled = false;
    }
  });
}

// Re-enable local audio tracks
unmuteLocalMic(): void {
  this.localSenders.forEach(sender => {
    if (sender.track && !sender.track.enabled) {
      sender.track.enabled = true;
    }
  });
}
```

**Integration Pattern:**
```typescript
// Initialize with muted mic
realtimeClient.startSession();
realtimeClient.muteLocalMic(); // Start silenced

// Unmute when response is allowed (5s+ elapsed)
if (allowResponseRef.current) {
  realtimeClient.unmuteLocalMic();
}

// Re-mute after Maya finishes
on_response_done() {
  realtimeClient.muteLocalMic();
}
```

### InterviewWebSocket.ts (WebSocket Fallback)
Handles fallback via WebSocket + Whisper + ElevenLabs.

**Transport Choice Logic:**
1. Try WebRTC (OpenAI Realtime) - ~100ms latency
2. Fall back to WebSocket if connection fails - ~200ms latency

### AudioQueue.ts (TTS Playback)
Manages ElevenLabs TTS audio queue for seamless playback.

---

## 📡 Interview Flow

### Phase 1: Pre-Interview Setup (Setup.tsx)
1. User uploads CV (PDF/DOCX) → `parse-cv` edge function
2. User enters job description → `analyze-job-description`
3. System performs gap analysis → `gap.ts`
4. Display recommended questions to user

**Duration:** 2-5 minutes

### Phase 2: Live Interview (MayaInterview.tsx)
1. **Initialization**: Connect WebRTC to Realtime API, request ephemeral token
2. **Question Delivery**: Maya asks first question via TTS
3. **Answer Capture**:
   - Silence detection starts (SILENCE_THRESHOLD_MS = 2000ms)
   - Answer duration tracked (MIN_ANSWER_DURATION_MS = 5000ms)
   - Real-time transcription via Whisper (fallback) or Realtime API (primary)
4. **5-Second Gate Enforcement**:
   - If < 5 seconds: Block Maya response, display timer
   - If ≥ 5 seconds: Allow response.created event
5. **Response Generation**: Maya responds based on answer and job context
6. **Follow-ups**: 0-2 follow-ups per question based on answer quality
7. **Question Loop**: Repeat until 8 main questions answered or 20min limit reached

**Duration:** 15-20 minutes

### Phase 3: Response Analysis (Summary.tsx)
1. Retrieve all answers and Maya's assessments
2. Call `analyze-response` for each answer (10-dimension scoring)
3. Aggregate scores across all responses

**Dimensions Evaluated:**
- Technical correctness & depth
- Communication clarity
- Problem-solving approach
- Job relevance
- Experience evidence
- Soft skills observed
- Critical thinking
- Red flags detection
- Follow-up opportunities
- Overall recommendation

### Phase 4: Final Summary & Export
1. Generate interview summary via `generate-summary`
2. Compile recommendation (Hire/No-Hire with reasoning)
3. Export full transcript
4. Allow comparison with other candidates

**Duration:** 2-3 minutes

---

## 🎙️ Maya Prompt System


**1. 5-Second Answer Minimum (CRITICAL)**
```
"MUST NOT respond until candidate has spoken for AT LEAST 5 seconds.
If response < 5 seconds, wait silently for more content."
```

**Implementation:**
- Client-side: `MIN_ANSWER_DURATION_MS = 5000` in MayaInterview.tsx
- Server-side: System prompt reinforces this rule
- WebRTC-level: RTCRtpSender muting prevents audio before gate met
- Result: Maya cannot interrupt candidates mid-thought

**2. Barge-in Support**
- Maya stops immediately if candidate interrupts
- Client detects interrupt → calls `muteLocalMic()` on realtimeClient

**3. Gate Conditions**
- `preinterview_ready` ✓
- `recording_on` ✓
- `interview_active` ✓
- `tts_playback_active` = false (Maya not speaking)

**4. Question Tracking**
- Exactly 8 main questions via `[[END_QUESTION]]` marker
- 0-2 follow-ups per question
- Uses `question_asked_count` and `follow_up_count` to track

**5. Echo Detection**
- Compares answer similarity to previous answers
- Flags repeated responses for lower scoring

### Customization
All behavior parameters in MAYA_SYSTEM_PROMPT can be adjusted:
- Follow-up depth: "0-2 follow-ups" → change to "0-1"
- Response style: Add "Be concise" or "Be thorough"
- Evaluation focus: Add emphasis on specific skills

---

## 🔐 Environment Variables

### Frontend (.env)
Add the following variable names to your local `.env` file (do NOT commit secrets).

| Variable | Purpose | Notes |
|----------|---------|-------|
| `VITE_SUPABASE_PROJECT_ID` | Supabase project identifier | required for some helper scripts |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/publishable-like key | public/anon usage |
| `VITE_SUPABASE_URL` | Supabase API endpoint | required |
| `VITE_SUPABASE_EDGE_URL` | Supabase Edge Functions URL | used to call Edge functions |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous API key | required for client access |
| `ELEVENLABS_API_KEY` | ElevenLabs API key | required for TTS fallback (keep secret)
| `VITE_BACKEND_URL` | Optional local backend URL | optional — only if using a local backend service
| `VITE_WEBSOCKET_URL` | Optional WebSocket URL for fallback transport | optional — only if using external WS

> Note: keep all secret values out of source control. The backend repository contains any server-side secrets and deployment instructions.

---

## 🧪 Testing & Debugging

### Local WebRTC Testing
```bash
# 1. Start dev server
bun dev

# 2. Open http://localhost:5173
# 3. Upload sample CV
# 4. Enter job description
# 5. Start interview
# 6. Check browser console for WebRTC logs
```

### Console Logs to Monitor
```
[Realtime] Connected to OpenAI API
[Answer] Duration: 5200ms, Allowed: true
[Response] Maya responding...
[Barge-in] Candidate interrupted at 3s
```

### Common Issues

**Issue: WebRTC connection fails**

**Issue: Maya responds too quickly**

**Issue: Audio not working**

**Issue: Transcription missing**
- WebSocket fallback uses Whisper (slower)
- Check `transcribe-audio` function logs
- Verify audio chunks being sent

---

## 📈 Performance Optimization

### Audio Streaming
- **Chunk Size**: 250ms MediaRecorder intervals
- **Codec**: Opus (128kbps, webm)
- **Latency**: ~100ms WebRTC, ~200ms WebSocket

### Database
- Indexed `interview_id`, `candidate_id`, `job_id` foreign keys
- JSONB storage for flexible response dimensions
- RLS policies prevent cross-user access

### Frontend
- Lazy load interview components
- Memoize RealtimeClient instance
- Cancel audio timeouts on unmount


---

## 🔄 Deployment

### Frontend Deployment (Vercel/Netlify)
```bash
# Vercel
vercel deploy

# Netlify
netlify deploy --prod
```

**Environment Variables to Set:**
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SUPABASE_EDGE_URL=...
```


---

## 📚 Documentation Links

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Realtime API Pricing](https://openai.com/pricing/realtime-api)
- [ElevenLabs API](https://elevenlabs.io/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)

---

## 🤝 Contributing

### Development Setup
```bash
git clone <repo>
cd sonic-recruiter-pro
bun install
bun dev
```

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Configured in eslint.config.js
- **Components**: Functional with hooks
- **Naming**: camelCase for variables/functions, PascalCase for components

### Adding Features
1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes with tests
3. Submit PR with description
4. Address review feedback
5. Merge to main

### Submitting Issues
Include:
- Reproducible steps
- Expected vs actual behavior
- Browser/OS environment
- Console error logs

---

## 📄 License

MIT License - Feel free to use this project for personal and commercial purposes.

---

## 💬 Support & Feedback

For questions or feedback:
- Open an issue on GitHub
- Check existing documentation
- Review codebase comments
- Contact the development team

---

**Built with ❤️ for better hiring**

Last Updated: 2025
