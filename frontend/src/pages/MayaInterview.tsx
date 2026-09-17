// ==========================
// src/pages/MayaInterview.tsx
// Fixed version: removes RealtimeChat dep, uses InterviewWebSocket client,
// robust timers, safe cleanup, MediaRecorder wiring, and UI polish.
// ==========================
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mic, MicOff, MessageSquare, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { wsClient } from "@/lib/ws";
import { createAudioQueue } from "@/utils/audioQueue";
import { RealtimeClient } from "@/utils/realtimeClient";
import { PreInterviewForm } from "@/components/PreInterviewForm";

// Types for incoming WS messages
interface QuestionMsg {
  type: "question";
  data: {
    question: string;
    isGreeting?: boolean;
    isClosing?: boolean;
    questionNumber?: number;
    totalQuestions?: number;
  };
}

interface TranscriptMsg {
  type: "transcript";
  data: {
    text: string;
    speaker: "interviewer" | "candidate";
    timestamp?: string;
  };
}

interface ErrorMsg {
  type: "error";
  message?: string;
}

interface ConnectedMsg {
  type: "connected";
}
interface DisconnectedMsg {
  type: "disconnected";
}
interface InterviewCompleteMsg {
  type: "interview_complete";
}

type Incoming = QuestionMsg | TranscriptMsg | ErrorMsg | ConnectedMsg | DisconnectedMsg | InterviewCompleteMsg;

type ChatItem =
  | {
      type: "question";
      text: string;
      timestamp: string;
      isGreeting?: boolean;
      isClosing?: boolean;
      questionNumber?: number;
      totalQuestions?: number;
    }
  | { type: "transcript"; text: string; speaker: "candidate" | "interviewer"; timestamp: string };

export default function MayaInterview() {
  const navigate = useNavigate();
  const { toast } = useToast();
 
  const [showPreForm, setShowPreForm] = useState(true);
  const [candidateInfo, setCandidateInfo] = useState<{ name: string; phone: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsPlaybackActive, setTtsPlaybackActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const lastMayaUtteranceRef = useRef<string>('');
  const ttsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [transportMode, setTransportMode] = useState<'realtime' | 'websocket'>('realtime');
  const [useRealtimePrimary, setUseRealtimePrimary] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const mountedRef = useRef<boolean>(false);
  const audioQueueRef = useRef<ReturnType<typeof createAudioQueue> | null>(null);
  const mainAskedRef = useRef<number>(0);
  const realtimeClientRef = useRef<RealtimeClient | null>(null);
  const currentTranscriptRef = useRef<string>("");
  const currentResponseRef = useRef<string>("");
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const startingRef = useRef<boolean>(false);
  const TIMER_LIMIT_SEC = 20 * 60;
// add some more time for response
const lastSpeechTimeRef = useRef<number>(0);
const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const answerStartTimeRef = useRef<number>(0);
const isAudioMutedRef = useRef<boolean>(false); // Mute flag
const SILENCE_THRESHOLD_MS = 2000; // 2 second silence before processing
const MIN_ANSWER_DURATION_MS = 10000; // Minimum 10 seconds of speaking
const allowResponseRef = useRef<boolean>(false); // Gate to control when responses are allowed

  // Timer
  useEffect(() => {
    if (!isConnected || isComplete) return;

    const timer = window.setInterval(() => {
      const t = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(t);
      
      // Log connection status every minute
      if (t % 60 === 0) {
        console.log(`[Maya] Interview running: ${Math.floor(t / 60)} minutes, connected: ${isConnected}, transport: ${transportMode}`);
        if (transportMode === 'realtime' && realtimeClientRef.current) {
          console.log('[Maya] Realtime connection state:', realtimeClientRef.current.isConnected());
        }
      }
      
      if (t >= TIMER_LIMIT_SEC) {
        console.log('[Maya] Timer limit reached, ending interview');
        setIsComplete(true);
        setIsConnected(false);
        stopRecordingInternal();
        
        // Save data when time limit reached
        saveInterviewData().catch(console.error);
        
        if (transportMode === 'realtime') {
          realtimeClientRef.current?.disconnect();
        } else {
          wsClient.disconnect();
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isConnected, isComplete, transportMode]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle WS events
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Setup TTS audio queue
  useEffect(() => {
    audioQueueRef.current = createAudioQueue({
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
    return () => {
      audioQueueRef.current?.destroy();
      audioQueueRef.current = null;
    };
  }, []);

  const pushMessage = (item: ChatItem) => {
    setMessages((prev) => [...prev, item]);
  };

  const onWSOpen = () => {
    setIsConnected(true);
    setError("");
    toast({ title: "Connected to Maya", description: "Interview is starting..." });
  };

  const onWSClose = () => {
    console.log("WebSocket closed");
    setIsConnected(false);
    stopRecordingInternal();
  };

  const onWSError = (e: Event | Error) => {
    const message = e instanceof Error ? e.message : "A connection error occurred";
    console.error("WebSocket error:", message);
    setError(message);
    setIsConnected(false);
    toast({ title: "Connection Error", description: message, variant: "destructive" });
  };

  const onWSQuestion = (q: {
    question: string;
    isGreeting?: boolean;
    isClosing?: boolean;
    questionNumber?: number;
    totalQuestions?: number;
  }) => {
    const isMain = !q.isGreeting && !q.isClosing;
    // Guard: if a closing message arrives before any main question, ignore it
    if (q.isClosing && mainAskedRef.current === 0) {
      console.warn("Ignored premature closing message before any main question.");
      return;
    }

    setCurrentQuestion(q.question || "");
    pushMessage({
      type: "question",
      text: q.question || "",
      timestamp: new Date().toISOString(),
      isGreeting: q.isGreeting,
      isClosing: q.isClosing,
      questionNumber: q.questionNumber,
      totalQuestions: q.totalQuestions,
    });

    if (isMain) mainAskedRef.current += 1;
    
    // Play question via TTS, then auto-start recording after it finishes
    if (!q.isClosing) {
      audioQueueRef.current?.enqueueTextWithCallback(q.question || "", async () => {
        // TTS finished, now start recording for user response
        if (wsClient.isConnected() && !recorderRef.current) {
          console.log("🎤 Question complete, starting recording for your response...");
          await startRecordingInternal().catch(console.error);
        }
      });
    } else {
      // Just play closing, no recording after
      audioQueueRef.current?.enqueueText(q.question || "");
    }
  };

  const onWSTranscript = (text: string, speaker: "interviewer" | "candidate") => {
    if (speaker === "candidate") {
      currentResponseRef.current = text;
      
      // Track when candidate starts speaking
      if (answerStartTimeRef.current === 0 && text.trim().length > 0) {
        answerStartTimeRef.current = Date.now();
        allowResponseRef.current = false; // Reset gate
      }
      
      lastSpeechTimeRef.current = Date.now(); // Update last speech time
      
      // Clear existing silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // Only process if we have meaningful content
      if (text.trim().length > 10) {
        // Set a new timeout to process after silence
        silenceTimeoutRef.current = setTimeout(() => {
          const answerDuration = Date.now() - answerStartTimeRef.current;
          
          // Only process if minimum duration met
          if (answerDuration >= MIN_ANSWER_DURATION_MS) {
            console.log('[Maya] Answer meets minimum duration, allowing response. Duration:', answerDuration + 'ms');
            allowResponseRef.current = true; // Allow response
            
            // Send a system context to Maya about the answer duration
            if (realtimeClientRef.current?.isConnected?.()) {
              try {
                const durationSeconds = Math.floor(answerDuration / 1000);
                console.log('[Maya] Sending duration context:', durationSeconds, 'seconds');
              } catch (e) {
                console.error('[Maya] Error sending duration context:', e);
              }
            }
          } else {
            console.log('[Maya] Answer too short (' + answerDuration + 'ms), waiting for more input');
            // Don't allow response yet, keep muted
            allowResponseRef.current = false;
          }
        }, SILENCE_THRESHOLD_MS);
      }
    }

    pushMessage({ type: "transcript", text, speaker, timestamp: new Date().toISOString() });
  };

  // MediaRecorder helpers - prioritize opus codecs for Whisper
  const pickMime = () => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus", 
      "audio/webm",
      "audio/ogg"
    ];
    for (const t of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) {
        console.log("Selected audio MIME type:", t);
        return t;
      }
    }
    console.warn("No preferred MIME type supported, falling back to audio/webm");
    return "audio/webm";
  };

  const startRecordingInternal = async () => {
    if (recorderRef.current) return;
    
    try {
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      }
      
      const mimeType = pickMime();
      const rec = new MediaRecorder(mediaStreamRef.current, { 
        mimeType,
        audioBitsPerSecond: 128000 // 128kbps for good quality opus
      });

      rec.onstart = () => {
        console.log("🎤 Recording started with:", mimeType);
        setIsRecording(true);
      };
      
      rec.onstop = () => {
        console.log("🎤 Recording stopped");
        setIsRecording(false);
      };
      
      rec.onerror = (ev: Event) => {
        const errorMsg = ev instanceof ErrorEvent ? ev.message : "Recording error";
        console.error("Recording error:", errorMsg);
        setError(errorMsg);
        toast({
          title: "Microphone Error",
          description: errorMsg,
          variant: "destructive",
        });
      };
      
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          // Check if audio should be muted (answer too short)
          const answerDuration = Date.now() - answerStartTimeRef.current;
          if (answerDuration < MIN_ANSWER_DURATION_MS && answerStartTimeRef.current > 0 && !allowResponseRef.current) {
            console.warn("🔇 Audio muted - Answer too short (" + answerDuration + "ms). Keep speaking...");
            isAudioMutedRef.current = true;
            return; // Don't send audio if answer is incomplete
          }
          
          if (isAudioMutedRef.current) {
            console.log("🔊 Audio unmuted - Answer duration OK");
            isAudioMutedRef.current = false;
          }
          
          console.log("📤 Sending audio chunk:", e.data.size, "bytes");
          wsClient.sendAudioChunk(e.data);
        }
      };

      recorderRef.current = rec;
      rec.start(250); // 250ms chunks for responsive transcription
    } catch (err) {
      console.error("Error starting recorder:", err);
      throw err;
    }
  };

  const stopRecordingInternal = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch (e) {
        console.error("Error stopping recorder:", e);
      }
    }
    recorderRef.current = null;
    
    if (wsClient.isConnected()) {
      wsClient.sendMessage({ type: "flush" });
    }
  };

  const handleSpeakingChange = (mayaSpeaking: boolean) => {
    setIsSpeaking(mayaSpeaking);
    
    // Track TTS playback state with 300ms tail after audio ends
    if (mayaSpeaking) {
      // Clear any pending timeout
      if (ttsTimeoutRef.current) {
        clearTimeout(ttsTimeoutRef.current);
        ttsTimeoutRef.current = null;
      }
      setTtsPlaybackActive(true);
    } else {
      // Wait 300ms after TTS ends before allowing Maya to speak again
      ttsTimeoutRef.current = setTimeout(() => {
        setTtsPlaybackActive(false);
        ttsTimeoutRef.current = null;
      }, 300);
    }
    
    // In WebSocket mode, handle TTS barge-in
    if (transportMode === 'websocket' && !mayaSpeaking && audioQueueRef.current?.isPlaying()) {
      console.log('[Maya] Stopping TTS playback (WebSocket barge-in)');
      audioQueueRef.current.stopCurrent();
    }
  };

  const startInterview = async () => {
    try {
      // Guard against double-starts
      if (startingRef.current || isConnected) {
        console.warn('[Maya] startInterview ignored (already starting or connected)');
        return;
      }
      startingRef.current = true;
      setIsStarting(true);

      // Ensure any previous transports are fully torn down
      try {
        realtimeClientRef.current?.disconnect();
      } catch {}
      realtimeClientRef.current = null;
      try {
        wsClient.disconnect({ manual: true });
      } catch {}

      setError("");
      setMessages([]);
      setCurrentQuestion("");
      mainAskedRef.current = 0;
      currentTranscriptRef.current = "";
      currentResponseRef.current = "";

      // Try Realtime first if enabled
      if (useRealtimePrimary) {
        console.log('[Maya] Attempting Realtime transport...');
        const realtimeClient = new RealtimeClient({
          onMessage: handleRealtimeMessage,
          onConnected: () => {
            console.log('[Maya] Realtime connected');
            setIsConnected(true);
            setTransportMode('realtime');
            startTimeRef.current = Date.now();
            setIsStarting(false);
            startingRef.current = false;
            toast({ title: "Connected", description: "Interview started with Realtime mode" });
          },
          onDisconnected: () => {
            console.error('[Maya] Realtime disconnected unexpectedly at', Math.floor((Date.now() - startTimeRef.current) / 1000), 'seconds');
            setIsConnected(false);
            setError("Connection lost - interview ended");
            toast({ 
              title: "Connection Lost", 
              description: "The interview connection was interrupted", 
              variant: "destructive" 
            });
          },
          onError: async (error) => {
            console.error('[Maya] Realtime error at', Math.floor((Date.now() - startTimeRef.current) / 1000), 'seconds:', error);
            setError(`Connection error: ${error.message}`);
            if (transportMode === 'realtime') {
              console.log('[Maya] Falling back to WebSocket transport...');
              toast({ 
                title: "Switching Transport", 
                description: "Switching to backup connection method...", 
                variant: "default" 
              });
              await startWebSocketTransport();
            }
          },
          onSpeakingChange: handleSpeakingChange
        });

        realtimeClientRef.current = realtimeClient;
        const success = await realtimeClient.startSession();
        
        if (!success) {
          console.log('[Maya] Realtime failed, falling back to WebSocket...');
          await startWebSocketTransport();
          setIsStarting(false);
          startingRef.current = false;
        }
      } else {
        await startWebSocketTransport();
        setIsStarting(false);
        startingRef.current = false;
      }
    } catch (error) {
      console.error('[Maya] Error starting interview:', error);
      setIsStarting(false);
      startingRef.current = false;
      setError(error instanceof Error ? error.message : "Failed to start interview");
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to start", variant: "destructive" });
    }
  };

  const startWebSocketTransport = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser");
      }

      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        mediaStreamRef.current = s;
      });

      console.log("Connecting via WebSocket...");
      const ok = await wsClient.connect({
        onOpen: onWSOpen,
        onClose: onWSClose,
        onError: onWSError,
        onQuestion: onWSQuestion,
        onTranscript: onWSTranscript,
      });

      if (!ok) throw new Error("Unable to establish connection to Maya");

      const mimeType = pickMime();
      console.log("Sending meta information:", { mimeType, language: "en", candidateInfo });
      wsClient.sendMessage({ 
        type: "meta", 
        mimeType, 
        language: "en",
        candidateName: candidateInfo?.name,
        candidatePhone: candidateInfo?.phone
      });

      setIsConnected(true);
      setTransportMode('websocket');
      startTimeRef.current = Date.now();
      toast({ title: "Connected", description: "Interview started with WebSocket mode" });
    } catch (error) {
      console.error('[Maya] WebSocket transport error:', error);
      throw error;
    }
  };

  // Simple similarity check for echo detection
  const calculateSimilarity = (str1: string, str2: string): number => {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  };

  const handleRealtimeMessage = (message: any) => {
    console.log('[Maya] Realtime message:', message.type);

    if (message.type === 'session.created') {
      console.log('[Maya] Session created');
    } else if (message.type === 'response.created') {
      // CRITICAL: Enforce minimum answer duration - if response tries to happen too early, reject it
      const answerDuration = Date.now() - answerStartTimeRef.current;
      const hasMinimumDuration = answerDuration >= MIN_ANSWER_DURATION_MS;
      const hasCandidateAnswer = currentTranscriptRef.current.trim().length > 0;
      
      if (!hasMinimumDuration && hasCandidateAnswer && answerStartTimeRef.current > 0) {
        console.error('🚫 [Maya] BLOCKING RESPONSE - Answer too short (' + answerDuration + 'ms < ' + MIN_ANSWER_DURATION_MS + 'ms)');
        
        // Force send a "continue" instruction to Maya
        try {
          // We need to cancel this response attempt
          // Unfortunately, Realtime API doesn't have a direct cancel, so we'll just log and let audio muting handle it
          console.warn('[Maya] Response blocked via duration gate. Audio chunks are being muted at MediaRecorder level.');
        } catch (e) {
          console.error('[Maya] Error in response gate:', e);
        }
        return; // Don't process this response
      }
      
      // Response is allowed
      console.log('[Maya] ✅ Response allowed after', answerDuration + 'ms of speaking');
      allowResponseRef.current = true;
      
      // New response starting; reset buffer to avoid concatenation
      if (currentResponseRef.current.length > 0) {
        console.warn('[Maya] New response started before previous done; resetting buffer');
      }
      currentResponseRef.current = '';
    } else if (message.type === 'conversation.item.input_audio_transcription.completed') {
      // Candidate speech - only these advance the interview
      const text = message.transcript?.trim();
      const normalizedText = text?.toLowerCase() || '';
      
      // Echo detection: check if user's text matches Maya's last utterance
      if (lastMayaUtteranceRef.current && normalizedText) {
        const similarity = calculateSimilarity(normalizedText, lastMayaUtteranceRef.current);
        if (similarity > 0.8) {
          console.log('[Maya] Echo detected, ignoring transcript:', text);
          return; // Don't add to transcript, it's likely echo
        }
      }
      
      if (text) {
        currentTranscriptRef.current += ' ' + text;
        pushMessage({ type: "transcript", text: currentTranscriptRef.current.trim(), speaker: "candidate", timestamp: new Date().toISOString() });
      }
    } else if (message.type === 'response.audio_transcript.delta') {
      // Assistant speech - DO NOT advance turn, just display
      const delta = message.delta || '';
      const wasEmpty = currentResponseRef.current.length === 0;
      currentResponseRef.current += delta;
      
      // Update current question display
      setCurrentQuestion(currentResponseRef.current);
      
      // Update messages (streaming Maya's response) - prevent duplicates
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.type === 'question') {
          // Update existing question message
          return [...prev.slice(0, -1), { ...last, text: currentResponseRef.current }];
        } else if (wasEmpty && currentResponseRef.current.length > 0) {
          // Only create new question when starting a fresh response (first delta)
          return [...prev, { type: 'question', text: currentResponseRef.current, timestamp: new Date().toISOString() }];
        }
        return prev;
      });
    } else if (message.type === 'response.audio_transcript.done') {
      // Complete question received, store for echo detection and check for END_QUESTION marker
      const text = currentResponseRef.current;
      lastMayaUtteranceRef.current = text.replace(/\[\[END_QUESTION\]\]/g, '').toLowerCase().trim();
      
      if (text.includes('[[END_QUESTION]]')) {
        mainAskedRef.current += 1;
        console.log(`[Maya] Main question ${mainAskedRef.current} completed`);
      }
      currentResponseRef.current = "";
    } else if (message.type === 'response.done') {
      // Full response complete, reset candidate transcript buffer and answer tracking
      currentTranscriptRef.current = "";
      answerStartTimeRef.current = 10; // Reset answer start time for next question
      allowResponseRef.current = false; // Reset response gate
    } else if (message.type === 'error') {
      console.error('[Maya] Realtime error event:', message);
      setError(message.error?.message || 'Unknown error');
    }
  };

  const reconnect = async () => {
    console.log("Reconnecting...");
    stopRecordingInternal();
    setError("");
    setIsConnected(false);
    
    try {
      await wsClient.forceReconnect();
      await startInterview();
    } catch (err) {
      console.error("Reconnection failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to reconnect";
      setError(msg);
      toast({ title: "Reconnection Failed", description: msg, variant: "destructive" });
    }
  };

  const toggleRecording = async () => {
    // Only allow manual recording in WebSocket mode
    if (transportMode !== 'websocket' || !wsClient.isConnected()) return;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      stopRecordingInternal();
    } else {
      await startRecordingInternal();
    }
  };

  const sendTextResponse = () => {
    const txt = textInput.trim();
    if (!txt || !isConnected) return;

    if (transportMode === 'realtime' && realtimeClientRef.current) {
      realtimeClientRef.current.sendTextMessage(txt).catch(console.error);
    } else {
      wsClient.sendMessage({ type: "manual_text", text: txt });
    }

    pushMessage({ type: "transcript", text: txt, speaker: "candidate", timestamp: new Date().toISOString() });
    setTextInput("");
  };

  const endInterview = async () => {
    console.log('[Maya] Ending interview - HARD TEARDOWN starting...');
    
    // 0) Clear TTS timeout
    if (ttsTimeoutRef.current) {
      clearTimeout(ttsTimeoutRef.current);
      ttsTimeoutRef.current = null;
    }
    
    // 0.5) Set interview_active to false
    setIsRecording(false);
    
    // 1) Send shutdown signal to backend
    try {
      if (transportMode === 'realtime' && realtimeClientRef.current) {
        await realtimeClientRef.current.sendTextMessage('interview_active=false shutdown_request=true');
      } else {
        wsClient.sendMessage({ type: "control", shutdown_request: true });
      }
    } catch (e) {
      console.error('[Maya] Error sending shutdown signal:', e);
    }

    // 2) Stop TTS immediately (prevents audio context keeping mic alive)
    try {
      audioQueueRef.current?.stopCurrent?.();
      audioQueueRef.current?.destroy?.();
    } catch (e) {
      console.error('[Maya] Error stopping audio queue:', e);
    }

    // 3) Stop recording pipeline
    try {
      stopRecordingInternal();
    } catch (e) {
      console.error('[Maya] Error stopping recording:', e);
    }

    // 4) Tear down Realtime completely (senders, transceivers, pc)
    if (transportMode === 'realtime' && realtimeClientRef.current) {
      try {
        realtimeClientRef.current.disconnect();
        realtimeClientRef.current = null;
      } catch (e) {
        console.error('[Maya] Error tearing down realtime client:', e);
      }
    }

    // 5) Stop every local track from any stream we created
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
            console.log('[Maya] Stopped media track:', t.kind);
          } catch (e) {
            console.error('[Maya] Error stopping track:', e);
          }
        });
      } catch (e) {
        console.error('[Maya] Error stopping media streams:', e);
      } finally {
        mediaStreamRef.current = null;
      }
    }

    // 6) Tell WS client to close without auto-reconnect
    try {
      wsClient.disconnect();
    } catch (e) {
      console.error('[Maya] Error disconnecting WS:', e);
    }

    // 7) Persist before navigating (best-effort)
    try {
      await saveInterviewData();
    } catch (e) {
      console.error('[Maya] Error saving interview data:', e);
    }

    console.log('[Maya] HARD TEARDOWN complete - navigating home');
    
    // 8) Navigate home
    navigate("/");
  };

  const saveInterviewData = async () => {
    try {
      const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      // Extract questions and responses from messages
      const questions = messages
        .filter(m => m.type === 'question')
        .map(m => ({
          question: m.text,
          timestamp: m.timestamp,
        }));
      
      const responses = messages
        .filter(m => m.type === 'transcript' && m.speaker === 'candidate')
        .map(m => ({
          response: m.text,
          timestamp: m.timestamp,
        }));

      const transcript = messages.map(m => ({
        speaker: m.type === 'question' ? 'maya' : 'candidate',
        text: m.text,
        timestamp: m.timestamp,
      }));

      console.log('[Maya] Saving interview data...', {
        session_id: sessionIdRef.current,
        candidate_name: candidateInfo?.name,
        candidate_phone: candidateInfo?.phone,
        duration_seconds: durationSeconds,
        questions_count: questions.length,
        responses_count: responses.length,
      });

      const { supabase } = await import("@/integrations/supabase/client");
      // const { error } = await supabase.functions.invoke("save-maya-interview", {
      //   body: {
      //     session_id: sessionIdRef.current,
      //     candidate_name: candidateInfo?.name,
      //     candidate_phone: candidateInfo?.phone,
      //     started_at: new Date(startTimeRef.current).toISOString(),
      //     ended_at: new Date().toISOString(),
      //     duration_seconds: durationSeconds,
      //     questions,
      //     responses,
      //     transcript,
      //   },
      // });

      let error;

      fetch (`${import.meta.env.VITE_BACKEND_URL}/save-maya-interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
           body: JSON.stringify({
          session_id: sessionIdRef.current,
          candidate_name: candidateInfo?.name,
          candidate_phone: candidateInfo?.phone,
          started_at: new Date(startTimeRef.current).toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          questions,
          responses,
          transcript,
        }),
      }).then (response => {
        if (!response.ok) {
          console.error('[Maya] Error saving interview data to backend:', response.statusText);
        } else {
          console.log('[Maya] Interview data saved to backend successfully');
        }
      }).catch (err => {
        error = err;
        console.error('[Maya] Fetch error saving interview data to backend:', err);
      });
      if (error) {
        console.error('[Maya] Error saving interview:', error);
        toast({
          title: "Warning",
          description: "Interview data could not be saved",
          variant: "destructive",
        });
      } else {
        console.log('[Maya] Interview data saved successfully');
      }
    } catch (error) {
      console.error('[Maya] Error saving interview:', error);
    }
  };

  const handlePreInterviewSubmit = async (data: { name: string; phone: string }) => {
    // Store in localStorage
    localStorage.setItem("maya.name", data.name);
    localStorage.setItem("maya.phone", data.phone);
    
    // Emit event
    window.dispatchEvent(new CustomEvent("preinterview:ready", { detail: data }));
    
    // Store in state
    setCandidateInfo(data);
    
    // Hide form and start interview
    setShowPreForm(false);
    
    // Start interview after a short delay to ensure state is updated
    setTimeout(() => startInterview(), 100);
  };

  // Cleanup on unmount - comprehensive teardown
  useEffect(() => {
    return () => {
      console.log('[Maya] Component unmounting - comprehensive cleanup...');
      
      // Clear silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      // Clear TTS timeout
      if (ttsTimeoutRef.current) {
        clearTimeout(ttsTimeoutRef.current);
        ttsTimeoutRef.current = null;
      }
      
      // Reset answer tracking
      answerStartTimeRef.current = 0;
      allowResponseRef.current = false;
      isAudioMutedRef.current = false;
      
      try { stopRecordingInternal(); } catch (e) {
        console.error('[Maya] Unmount: error stopping recording:', e);
      }
      
      try { audioQueueRef.current?.destroy?.(); } catch (e) {
        console.error('[Maya] Unmount: error destroying audio queue:', e);
      }
      
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((t) => {
            try {
              t.stop();
              console.log('[Maya] Unmount: stopped track:', t.kind);
            } catch (e) {
              console.error('[Maya] Unmount: error stopping track:', e);
            }
          });
        } catch (e) {
          console.error('[Maya] Unmount: error stopping tracks:', e);
        } finally {
          mediaStreamRef.current = null;
        }
      }
      
      if (realtimeClientRef.current) {
        try {
          realtimeClientRef.current.disconnect();
          realtimeClientRef.current = null;
        } catch (e) {
          console.error('[Maya] Unmount: error tearing down realtime:', e);
        }
      }
      
      try {
        wsClient.disconnect({ manual: true });
      } catch (e) {
        console.error('[Maya] Unmount: error disconnecting WS:', e);
      }
      
      console.log('[Maya] Component cleanup complete');
    };
  }, []);

  // Show pre-interview form first
  if (showPreForm) {
    return <PreInterviewForm onSubmit={handlePreInterviewSubmit} />;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>

          {isConnected && (
            <Badge variant="default" className="gap-2">
              <Clock className="w-4 h-4" />
              {formatTime(elapsedTime)} / 20:00
            </Badge>
          )}
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-1 gap-6">
          {/* Left: Interview Controls */}
          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                Speak with Maya - say hello to start
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isConnected && !isComplete && (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-hero flex items-center justify-center">
                    <Mic className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-muted-foreground">
                    Maya will ask you about your skills, experience, and career goals in a 20-minute interview. Your
                    microphone will be activated automatically.
                  </p>
                  <Button onClick={startInterview} size="lg" className="w-full bg-gradient-hero" disabled={isStarting}>
                    {isStarting ? 'Starting…' : 'Allow Microphone & Start'}
                  </Button>
                </div>
              )}

              {error && (
                <Card className="bg-destructive/10 border-destructive">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-destructive font-bold">!</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive mb-1">Connection Error</p>
                        <p className="text-sm text-destructive/80">{error}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={reconnect} variant="outline" size="sm" className="flex-1 border-destructive text-destructive hover:bg-destructive/10">
                        Reconnect
                      </Button>
                      {!isConnected && (
                        <Button onClick={startInterview} variant="outline" size="sm" className="flex-1">
                          Start Fresh
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {isConnected && (
                <>
                  {/* Current Question */}
                  {currentQuestion && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-4">
                        <p className="text-sm font-medium mb-2">Maya asks:</p>
                        <p className="text-foreground">{currentQuestion}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Status Indicators */}
                  <div className="flex gap-4 flex-wrap">
                    <Badge variant={isSpeaking ? "default" : "outline"} className="gap-2">
                      <MessageSquare className="w-4 h-4" />
                      {isSpeaking ? "Maya Speaking" : "Listening"}
                    </Badge>
                    {isRecording && (
                      <Badge variant={isAudioMutedRef.current ? "destructive" : "default"} className="gap-2 animate-pulse">
                        <Mic className="w-4 h-4" />
                        {isAudioMutedRef.current ? "Audio Muted - Keep Speaking" : "Recording"}
                      </Badge>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="space-y-4">
                    {/* Text Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Or type your response..."
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            sendTextResponse();
                          }
                        }}
                        disabled={!isConnected}
                      />
                      <Button onClick={sendTextResponse} disabled={!textInput.trim() || !isConnected}>
                        Send
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={endInterview} variant="outline" className="flex-1" disabled={!isConnected}>
                        End Interview
                      </Button>
                      {error && (
                        <Button onClick={reconnect} variant="default" className="flex-1">
                          Reconnect
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {isComplete && (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Interview Complete!</h3>
                    <p className="text-muted-foreground">
                      Thank you for speaking with Maya. Your responses have been recorded.
                    </p>
                  </div>
                  <Button onClick={() => navigate("/")} className="w-full bg-gradient-hero">
                    Return to Home
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Transcript */}
          {/* <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No messages yet. Start the interview to begin.
                  </p>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${msg.type === "question" ? "bg-primary/10 border border-primary/20" : "bg-secondary/50"}`}
                    >
                      <div className="flex items-start gap-2 group">
                        <Badge variant="outline" className="shrink-0">
                          {msg.type === "question" ? "Maya" : msg.speaker === "candidate" ? "You" : "Maya"}
                        </Badge>
                        <p className="text-sm flex-1">{msg.text}</p>
                      </div>
                      {"questionNumber" in msg && msg.questionNumber && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Question {msg.questionNumber} of {msg.totalQuestions}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card> */}
        </div>

        {/* Instructions */}
        <Card className="mt-6 bg-gradient-card border-primary/20">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3">Interview Tips:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• The interview lasts approximately 20 minutes</li>
              <li>• Maya will ask 8 questions with follow-ups</li>
              <li>• Click "Start Recording" to respond with your voice</li>
              <li>• Or type your responses in the text field</li>
              <li>• Speak naturally and take your time with answers</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
