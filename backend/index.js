const express = require('express');
const app = express();
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const port = process.env.PORT || 3000;

const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN,
  'http://localhost:8080',
  'http://127.0.0.1:8080',
].filter(Boolean));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-client-info',
    'apikey'
  ],
  credentials: true
}));

// Middleware to parse JSON bodies (increased limit for large payloads)
app.use(express.json({ limit: '50mb' }));

// Global error handler for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('❌ JSON parse error on', req.method, req.path);
    console.error('   Error:', err.message);
    return res.status(400).json({ error: 'Invalid JSON in request body', message: err.message });
  }
  next(err);
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});
app.use('/auth', require('./service/auth'));
app.use('/api/job-postings', require('./service/job-postings'));
app.use('/api', require('./service/api'));
app.use('/job-postings', require('./service/job-postings'));
app.use('/parse-cv', require('./service/parse-cv'));   //
app.use('/upload-cv', require('./service/upload-cv'));//
app.use('/analyze-job-desc', require('./service/analyze-job-desc'));//
app.use('/transcribe-audio', require('./service/transcribe-audio'));//
app.use('/tts-labs', require('./service/tts-elevenlabs'));//
app.use('/generate-questions', require('./service/generate-questions'));//
app.use('/delete-user-account', require('./service/delete-user-account'));//
app.use('/analyze-response', require('./service/analyze-response'));//
app.use('/validate-answer-duration', require('./service/validate-answer-duration'));
app.use('/generate-summary', require('./service/generate-summary'));//
app.use('/parse-cv-content', require('./service/parse-cv-content'));//
app.use('/save-maya-interview', require('./service/save-maya-interview'));//
// Require the interview module once and mount its router
let interviewModule;
try {
  interviewModule = require('./service/interview-websocket');
  // If the module exports a router (default export), mount it
  if (interviewModule && typeof interviewModule === 'function') {
    app.use('/interview-websocket', interviewModule);
  } else if (interviewModule && interviewModule.router) {
    app.use('/interview-websocket', interviewModule.router);
  }
} catch (err) {
  console.warn('Optional interview-websocket module not found or failed to load:', err && err.message);
}

// If the interview module exposes setupWebSocketHandlers, create an HTTP server and init Socket.IO.
if (interviewModule && typeof interviewModule.setupWebSocketHandlers === 'function') {
  const server = http.createServer(app);
  const io = socketIo(server, {
    cors: {
      origin: Array.from(allowedOrigins),
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  });
  // Initialize socket handlers
  interviewModule.setupWebSocketHandlers(io);

  // Start HTTP server (required for Socket.IO)
  server.listen(port, () => {
    console.log(`Server (with WebSocket) is running at http://localhost:${port}`);
    console.log(`WebSocket namespace ready at ws://localhost:${port}/interview`);
  });
} else {
  // No socket integration required; use Express directly.


  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}