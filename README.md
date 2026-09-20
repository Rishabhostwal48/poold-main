# Poold: AI-Powered Skills Interview Platform

Poold is a web application that helps companies interview candidates using skills-based questions instead of relying only on resumes.

A candidate can:

- Create an account and sign in.
- Upload a CV or resume.
- Analyze a CV with AI.
- Review job descriptions and skill requirements.
- Complete a live interview with Maya, the AI interviewer.
- Answer by speaking or typing.
- Receive transcripts, analysis, skill-gap information, and an interview summary.

A recruiter or interviewer can:

- Create and manage job postings.
- Review candidates and interviews.
- Compare skills and interview results.
- View analysis and recommendations.

This repository contains both the website and the server that powers it.

## How The Project Works

The project has three important parts:

```text
Your browser
    |
    | React website
    v
Frontend (Vite, port 8080)
    |
    | HTTP API and Socket.IO interview connection
    v
Backend (Express, port 3000)
    |
    +--> PostgreSQL database
    +--> Amazon Cognito authentication
    +--> Amazon S3 file storage
    +--> Groq/OpenAI AI services
    +--> ElevenLabs text-to-speech (optional)
```

The frontend displays the application. The backend handles authentication, permissions, AI requests, file uploads, interview audio, and database operations.

## Main Features

### Authentication

The backend uses Amazon Cognito for user registration and login. The application stores the current access token in the browser and sends it to protected backend routes.

### CV Upload And Analysis

Users can upload a PDF resume. The backend stores the file in Amazon S3, extracts text, and sends the text to an AI parser. The result is converted into a candidate profile containing experience, skills, education, and certifications.

### Job Postings

Interviewers can create, edit, list, and delete job postings. Candidates can browse active postings. Job-posting requests go through the local Express backend at `/job-postings`.

### Live Interviews

Maya can conduct interviews using two transport options:

- WebRTC with the OpenAI Realtime API.
- Socket.IO/WebSocket fallback using recorded audio, transcription, and AI-generated questions.

The fallback transport sends candidate audio to the backend in small chunks. The backend sends audio to a speech-to-text provider, generates the next question, and sends it back to the browser.

### Text-To-Speech

Browser speech is the default voice option because ElevenLabs library voices require a paid plan. ElevenLabs can be enabled explicitly if the account and selected voice support API usage.

## Requirements

Install these tools before starting:

- Node.js 18 or newer
- npm
- A PostgreSQL database, either local or hosted
- An Amazon Cognito user pool
- An Amazon S3 bucket for CV files
- A Groq API key for CV parsing, question generation, and transcription
- Optional OpenAI API key for OpenAI-powered features
- Optional ElevenLabs API key for paid text-to-speech

You do not need SQL software installed just to use a hosted PostgreSQL database. SQL migrations are run against the configured database by the migration tool or database dashboard.

## Project Structure

```text
poold-main/
├── backend/
│   ├── index.js                 Express and Socket.IO server
│   ├── service/                 API route handlers
│   ├── middleware/              Authentication and request middleware
│   ├── auth/                    Amazon Cognito integration
│   ├── db/                      PostgreSQL connection and queries
│   ├── storage/                 Amazon S3 integration
│   ├── .env.example             Backend configuration template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/               Main application screens
│   │   ├── components/          Reusable interface components
│   │   ├── contexts/             Authentication state
│   │   ├── hooks/               Reusable React hooks
│   │   ├── lib/                 API clients and helpers
│   │   └── utils/               Audio, WebSocket, and TTS utilities
│   ├── supabase/migrations/     Database migration files
│   ├── .env.example             Frontend configuration template
│   └── package.json
├── docker-compose.yml            Optional Docker setup
└── README.md
```

## Install Dependencies

Open a terminal in the project folder.

### PowerShell

```powershell
cd "D:\E\amazon hack\poold-main\backend"
npm install

cd "D:\E\amazon hack\poold-main\frontend"
npm install
```

### Command Prompt

```bat
cd /d "D:\E\amazon hack\poold-main\backend"
npm install

cd /d "D:\E\amazon hack\poold-main\frontend"
npm install
```

Important: `Push-Location` and `Pop-Location` are PowerShell commands. They do not work in Command Prompt. In Command Prompt, use `cd` instead.

## Configure The Backend

Create a file named `backend/.env` by copying `backend/.env.example`.

At minimum, configure:

```env
PORT=3000
FRONTEND_ORIGIN=http://localhost:8080

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_SSL=false

# Amazon Cognito
COGNITO_USER_POOL_ID=your_user_pool_id
COGNITO_CLIENT_ID=your_cognito_client_id
COGNITO_REGION=us-east-1

# Amazon S3
S3_BUCKET_NAME=your_bucket_name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# AI services
GROQ_API_KEY=your_groq_key
GROQ_MODEL_TEXT=openai/gpt-oss-120b
GROQ_MODEL_FAST=openai/gpt-oss-20b
GROQ_MODEL_STT=whisper-large-v3-turbo

# Optional
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

Never commit a real `.env` file or secret keys to Git.

## Configure The Frontend

Create `frontend/.env` from `frontend/.env.example`.

```env
VITE_BACKEND_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:3000/api
VITE_USE_ELEVENLABS_TTS=false
```

`VITE_USE_ELEVENLABS_TTS=false` uses the browser's built-in speech. Set it to `true` only when the ElevenLabs account, API key, model, and voice are configured for API use.

Vite reads frontend environment variables when the frontend starts or builds. Restart the frontend after changing `.env`.

## Database Setup

The database migration files are in:

```text
frontend/supabase/migrations/
```

They create the tables and policies needed by the application, including job postings, interview sessions, CV analysis, and user-related data.

The project uses the Supabase CLI to apply these migrations to a hosted database. Install or run the CLI through `npx`:

```powershell
cd frontend
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migration process may ask for confirmation before changing the remote database. Review the migration list and confirm only when you are connected to the correct project.

The application must have the database tables before requests such as these can work:

```text
GET  /job-postings
POST /job-postings
PATCH /job-postings/:id
DELETE /job-postings/:id
```

If you see:

```text
Could not find the table 'public.job_postings' in the schema cache
```

apply the migrations to the configured remote database. This is a database deployment issue, not a missing SQL program on your computer.

## Run The Application Locally

Start the backend in one terminal:

### PowerShell

```powershell
cd "D:\E\amazon hack\poold-main\backend"
node index.js
```

### Command Prompt

```bat
cd /d "D:\E\amazon hack\poold-main\backend"
node index.js
```

The backend normally runs at:

```text
http://localhost:3000
```

Start the frontend in a second terminal:

### PowerShell

```powershell
cd "D:\E\amazon hack\poold-main\frontend"
npm run dev -- --host 0.0.0.0
```

### Command Prompt

```bat
cd /d "D:\E\amazon hack\poold-main\frontend"
npm run dev -- --host 0.0.0.0
```

Open the address printed by Vite, normally:

```text
http://localhost:8080
```

Use the same frontend hostname consistently. For example, do not switch randomly between `localhost:8080` and `127.0.0.1:8080` if your CORS configuration allows only one of them.

## Useful Commands

### Frontend

```bash
npm run dev       # Start development server
npm run build     # Create production build
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

### Backend

```bash
node index.js     # Start the backend
node --check index.js
```

If port 3000 is already in use, either stop the existing backend process or start another port:

```powershell
$env:PORT=3001
node index.js
```

Then update `VITE_BACKEND_URL` in `frontend/.env` to match.

## Important API Routes

The backend exposes these main routes:

| Route | Purpose |
|---|---|
| `POST /auth/signup` | Create an account |
| `POST /auth/login` | Log in and receive an access token |
| `POST /auth/refresh` | Refresh a login session |
| `POST /auth/logout` | Log out |
| `POST /upload-cv` | Upload a CV file |
| `POST /parse-cv-content` | Parse extracted CV text |
| `POST /analyze-job-desc` | Analyze a job description |
| `GET /job-postings` | List the current user's job postings |
| `POST /job-postings` | Create a job posting |
| `PATCH /job-postings/:id` | Update a job posting |
| `DELETE /job-postings/:id` | Delete a job posting |
| `POST /generate-questions` | Generate interview questions |
| `POST /transcribe-audio` | Transcribe audio |
| `POST /tts-labs` | Generate ElevenLabs speech when enabled |
| `POST /generate-summary` | Generate an interview summary |
| `POST /delete-user-account` | Delete the current account |
| Socket.IO `/interview` | Run the live Maya interview |

Most routes require an `Authorization` header:

```text
Authorization: Bearer YOUR_ACCESS_TOKEN
```

The frontend normally adds this header automatically.

## Typical User Journey

### Candidate

1. Open the website.
2. Create an account.
3. Log in.
4. Upload a CV.
5. Review or enter a job description.
6. Start an interview.
7. Answer by voice or text.
8. Review the transcript and summary.

### Interviewer

1. Create an interviewer account.
2. Log in.
3. Open Manage Jobs.
4. Create a job posting.
5. Browse interview data and candidate results.

## Troubleshooting

### The backend says `EADDRINUSE`

Another process is already using port 3000. Stop that process or choose another port. Do not start multiple backends on the same port.

### The browser says `Failed to fetch`

Check all of the following:

- The backend is running.
- `VITE_BACKEND_URL` points to the backend address.
- The frontend was restarted after changing `.env`.
- The backend's `FRONTEND_ORIGIN` matches the browser address.
- The browser is using `localhost` or `127.0.0.1` consistently.

### Job postings cannot be found

Apply the database migrations and make sure the backend is connected to the correct database. The frontend page does not create database tables automatically.

### CV parsing fails

Check that:

- The CV is a supported file type, usually PDF.
- S3 credentials and bucket configuration are correct.
- `GROQ_API_KEY` is configured.
- The backend is running.
- The browser Network tab shows a successful `/upload-cv` request followed by `/parse-cv-content`.

### Maya repeats a question

Check that the microphone is working and that the browser grants microphone permission. The WebSocket fallback pauses microphone recording while Maya speaks so Maya's own voice is not sent back as the candidate's response.

### Maya has no voice

The default setting uses browser speech. Check that the browser is not muted and that the page has permission to play audio. ElevenLabs free accounts may reject library voices with a payment-required response.

### The browser shows a TypeScript or build error

Run:

```bash
cd frontend
npm run build
```

Read the first error in the output. Warnings about large bundles or outdated Browserslist data do not necessarily prevent the application from running.

## Security Notes

- Do not commit `.env` files.
- Do not expose Cognito secrets, database passwords, AWS keys, Groq keys, OpenAI keys, or ElevenLabs keys.
- Rotate any secret that has been pasted into a public issue, chat, screenshot, or repository.
- Keep authentication and ownership checks in the backend and database, not only in frontend code.
- Use HTTPS and secure cookie settings in production.
- Use separate development and production credentials.

## Production Checklist

Before deploying:

- Set production frontend and backend URLs.
- Use HTTPS for both frontend and backend.
- Configure production CORS origins.
- Configure Cognito production settings.
- Configure PostgreSQL SSL as required by the provider.
- Configure S3 bucket permissions and CORS.
- Apply all database migrations.
- Confirm RLS and ownership policies.
- Set production AI provider keys as deployment secrets.
- Test signup, login, refresh, logout, CV upload, job posting creation, and one complete interview.
- Check browser Network and Application tabs for failed requests and missing session data.

## License

This project currently uses the license information defined in the package metadata. Confirm the intended license with the project owner before publishing or distributing the application.
