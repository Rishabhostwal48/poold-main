/**
 * Live Interview Component - Real-time conversational interview using OpenAI Realtime API
 * Features voice-to-voice conversation, live transcription, and evidence collection
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChat } from '@/utils/RealtimeAudio';
import { RealtimeClient } from '@/utils/realtimeClient';
import { useInterviewStore } from '@/store/interview';
import { playTTS } from '@/utils/tts';
import { Mic, MicOff, Volume2, VolumeX, Play, Square, AlertTriangle, Send, Type } from 'lucide-react';
import type { TranscriptItem } from '@/types';

interface LiveInterviewProps {
  onComplete: () => void;
}

const LiveInterview: React.FC<LiveInterviewProps> = ({ onComplete }) => {
  const { toast } = useToast();
  const { addTranscript } = useInterviewStore();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [speechUnavailable, setSpeechUnavailable] = useState(false);
  const [textInput, setTextInput] = useState("");
  const chatRef = useRef<RealtimeChat | null>(null); // websocket fallback
  const rtcRef = useRef<RealtimeClient | null>(null); // preferred WebRTC
  const [usingRTC, setUsingRTC] = useState(false);
const navigate = useNavigate();
  const startTimeRef = useRef<number>(0);
  const startingRef = useRef<boolean>(false); // prevent concurrent starts
  const lastAIMessageRef = useRef<{ text?: string; ts?: number }>({}); // deduplication for AI messages

  // Start interview once on mount (was running on every isConnected change)
  useEffect(() => {
    startInterview();
    return () => {
      // cleanup will be handled in separate effect/unmount logic below
    };
  }, []); // only on mount

  // Elapsed time timer: starts/stops when isConnected changes
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isConnected) {
      startTimeRef.current = Date.now();
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  const handleMessage = (message: any) => {
    console.log('📨 Interview message:', message.type, message);

    // Deduplicate repeated AI questions / responses arriving near-simultaneously
    if ((message.type === "question" || message.type === "ai_response") && message.data?.question === undefined && message.data?.text === undefined) {
      // allow other payload shapes through (defensive)
    }
    if (message.type === "question" || message.type === "ai_response") {
      const text = (message.data?.question || message.data?.text || "").trim();
      const now = Date.now();
      const last = lastAIMessageRef.current;
      const DUPLICATE_WINDOW_MS = 2000; // ignore duplicates within 2s
      
      if (text && last.text === text && last.ts && (now - last.ts) < DUPLICATE_WINDOW_MS) {
        console.debug('[LiveInterview] Ignoring duplicate AI message:', text);
        return;
      }
      if (text) {
        lastAIMessageRef.current = { text, ts: now };
      }
    }

    // push to debug messages
    setMessages(prev => [...prev, message]);
    
    if (message.type === "transcript" && message.data) {
      // Add to transcript store
      const transcriptItem: TranscriptItem = {
        id: `${message.data.speaker}_${Date.now()}`,
        ts: new Date(message.data.timestamp).toLocaleTimeString(),
        speaker: message.data.speaker,
        text: message.data.text
      };
      addTranscript(transcriptItem);
    }
    
    if (message.type === "question" && message.data?.question) {
      // AI interviewer asked a question - play with neural TTS, fallback to browser synthesis
      console.log("🤖 AI interviewer asked:", message.data.question);
      playTTS(message.data.question).catch((error) => {
        console.warn("TTS failed, falling back to browser synthesis:", error);
        // Fallback to browser SpeechSynthesis
        const utterance = new SpeechSynthesisUtterance(message.data.question);
        utterance.rate = 0.85;
        utterance.pitch = 0.95;
        speechSynthesis.speak(utterance);
      });
      
      // Add question to transcript
      const transcriptItem: TranscriptItem = {
        id: `ai_${Date.now()}`,
        ts: new Date().toLocaleTimeString(),
        speaker: 'interviewer',
        text: message.data.question
      };
      addTranscript(transcriptItem);
    }
    
    if (message.type === "ai_response" && message.data?.text) {
      // AI interviewer spoke - play with neural TTS, fallback to browser synthesis
      console.log("🤖 AI interviewer said:", message.data.text);
      playTTS(message.data.text).catch((error) => {
        console.warn("TTS failed, falling back to browser synthesis:", error);
        // Fallback to browser SpeechSynthesis
        const utterance = new SpeechSynthesisUtterance(message.data.text);
        utterance.rate = 0.85;
        utterance.pitch = 0.95;
        speechSynthesis.speak(utterance);
      });
    }
    
    if (message.type === "connected") {
      setIsConnected(true);
      setError("");
      toast({
        title: "Connected",
        description: "AI interviewer is starting...",
      });
    }
    
    if (message.type === "disconnected") {
      setIsConnected(false);
      setIsRecording(false);
    }
    
    if (message.type === "error") {
      setError(message.message || "Connection error");
      toast({
        title: "Error",
        description: message.message || "Connection error",
        variant: "destructive",
      });
    }
    
    if (message.type === "speech_recognition_unavailable") {
      setSpeechUnavailable(true);
      toast({
        title: "Speech Recognition Unavailable",
        description: message.message || "Please use text input instead",
        variant: "default",
      });
    }
  };

  const handleSpeakingChange = (speaking: boolean) => {
    setIsSpeaking(speaking);
  };

  const startInterview = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      setError("");
      // Try WebRTC first
      const rtc = new RealtimeClient({
        onMessage: (m) => handleMessage(m),
        onConnected: () => {
          setIsConnected(true);
          setUsingRTC(true);
          setError("");
          toast({
            title: "Connected (WebRTC)",
            description: "AI interviewer (WebRTC) is connected.",
          });
        },
        onDisconnected: () => {
          setIsConnected(false);
          // fall back to websocket if not already using it
        },
        onError: (err) => {
          console.warn("RealtimeClient error:", err);
        },
        onSpeakingChange: handleSpeakingChange
      });
      rtcRef.current = rtc;

      const started = await rtc.startSession();
      if (started) {
        // WebRTC active; do not start WebSocket recording
        setUsingRTC(true);
        return;
      }

      // If startSession returned false, try websocket fallback
      console.log("WebRTC startSession failed; falling back to WebSocket");
      await startWebsocketFallback();
    } catch (err) {
      console.warn("WebRTC setup failed, falling back to WebSocket:", err);
      await startWebsocketFallback();
    } finally {
      startingRef.current = false;
    }
  };

  const startWebsocketFallback = async () => {
    try {
      const chat = new RealtimeChat(handleMessage, handleSpeakingChange);
      chatRef.current = chat;
      await chat.init();
      setUsingRTC(false);
      setIsConnected(true);
      // start mic recording automatically for websocket fallback
      await chatRef.current?.startRecording();
      setIsRecording(true);
      toast({
        title: "Connected (WebSocket)",
        description: "Fell back to WebSocket realtime pipeline.",
      });
    } catch (err) {
      console.error("Failed to initialize WebSocket fallback:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      setIsConnected(false);
    }
  };

  const toggleRecording = async () => {
    // Recording makes sense for WebSocket fallback (MediaRecorder -> server)
    if (usingRTC) {
      // WebRTC already streams mic; indicate not-applicable
      toast({
        title: "Recording not required",
        description: "Microphone is streamed automatically over WebRTC.",
      });
      return;
    }

    if (!chatRef.current || !isConnected) return;

    try {
      if (isRecording) {
        chatRef.current.stopRecording();
        setIsRecording(false);
      } else {
        await chatRef.current.startRecording();
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
      toast({
        title: "Error",
        description: "Failed to toggle recording",
        variant: "destructive",
      });
    }
  };

  const nextQuestion = () => {
    if (usingRTC) {
      try {
        rtcRef.current?.sendControl("next_question");
      } catch (err) {
        console.warn("Failed to send next_question over RTC:", err);
      }
      return;
    }

    if (chatRef.current && isConnected) {
      chatRef.current.sendNextQuestion();
    }
  };

  const sendTextResponse = () => {
    if (!textInput.trim()) return;

    const text = textInput.trim();

    // Add the user's message to the live transcript immediately
    const userTranscriptItem: TranscriptItem = {
      id: `user_${Date.now()}`,
      ts: new Date().toLocaleTimeString(),
      speaker: 'candidate',
      text
    };
    addTranscript(userTranscriptItem);

    // Also surface the outgoing message in the debug messages area
    setMessages(prev => [...prev, { type: 'user_response', data: { text, timestamp: new Date().toISOString() } }]);

    if (usingRTC) {
      try {
        rtcRef.current?.sendTextMessage(text);
      } catch (err) {
        console.error("Failed to send text over RTC:", err);
        toast({
          title: "Error",
          description: "Failed to send message over WebRTC, trying WebSocket fallback",
          variant: "destructive",
        });
        // try fallback to websocket if available
        if (chatRef.current) {
          chatRef.current.sendTextResponse(text);
        }
      }
    } else {
      if (!chatRef.current || !isConnected) {
        console.error("No active connection to send text");
        return;
      }
      chatRef.current.sendTextResponse(text);
    }

    setTextInput("");
  };

  const endInterview = () => {
    if (rtcRef.current) {
      try { rtcRef.current.disconnect(); } catch {}
      rtcRef.current = null;
    }
    if (chatRef.current) {
      chatRef.current.disconnect();
      chatRef.current = null;
    }
    setIsConnected(false);
    setIsRecording(false);
    setUsingRTC(false);
    onComplete();
    
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount: ensure both transports are disconnected
  useEffect(() => {
    return () => {
      if (rtcRef.current) {
        try { rtcRef.current.disconnect(); } catch {}
        rtcRef.current = null;
      }
      if (chatRef.current) {
        try { chatRef.current.disconnect(); } catch {}
        chatRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-success animate-pulse' : 'bg-muted'
              }`} />
              Live AI Interview
            </span>
            
            <div className="flex items-center gap-3">
              {isConnected && (
                <Badge variant="secondary">
                  {formatTime(elapsedTime)}
                </Badge>
              )}
              
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        
        {error && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-4"
                  onClick={startInterview}
                >
                  Reconnect
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Interview Controls */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            Interview Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Indicators */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {isSpeaking ? (
                  <>
                    <Volume2 className="w-4 h-4 text-success animate-pulse" />
                    <span className="text-sm text-success">Maya Speaking</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Maya Listening</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {/* {isRecording ? (
                  <> */}
                    <Mic className="w-4 h-4 text-destructive animate-pulse" />
                    <span className="text-sm text-destructive">Recording</span>
                  {/* </>
                ) : (
                  <>
                    <MicOff className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Muted</span>
                  </> */}
                {/* )} */}
              </div>
            </div>
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center gap-3">
            {!isConnected ? (
              <Button
                onClick={startInterview}
                className="bg-gradient-hero flex-1"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Live Interviewee
              </Button>
            ) : (
              <>
                {/* <Button
                  onClick={toggleRecording}
                  variant={isRecording ? "destructive" : "default"}
                  className="flex-1"
                  disabled={!isConnected}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-4 h-4 mr-2" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Start Recording
                    </>
                  )}
                </Button> */}
                
                <div className="flex gap-2 flex-1">
                  <Input
                    placeholder="Type your response here..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    // onKeyPress={handleKeyPress}
                    disabled={!isConnected}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendTextResponse}
                    disabled={!isConnected || !textInput.trim()}
                    size="icon"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                
                <Button
                  onClick={nextQuestion}
                  variant="outline"
                  disabled={!isConnected}
                >
                  Next Question
                </Button>
                
                <Button
                  onClick={endInterview}
                  variant="outline"
                >
                  <Square className="w-4 h-4 mr-2" />
                  End Interview
                </Button>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Click "Start Live Interview" to connect to the AI interviewer</p>
            <p>• The AI will speak questions using high-quality neural voice synthesis</p>
            <p>• Press "Start Recording" to respond using microphone (streams to Whisper for transcription)</p>
            <p>• Type your responses in the text input field as an alternative</p>
            <p>• The AI will listen and continue the conversation naturally</p>
            <p>• Use "Next Question" to move forward if needed</p>
            <p className="text-xs opacity-75">
              Note: Mic audio is streamed to the server and transcribed by Whisper. Browser speech recognition is optional.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Debug Messages (development only) */}
      {process.env.NODE_ENV === 'development' && messages.length > 0 && (
        <Card className="bg-gradient-card shadow-soft">
          <CardHeader>
            <CardTitle>Debug Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {messages.slice(-5).map((msg, i) => (
                <div key={i} className="text-xs font-mono p-2 bg-muted rounded">
                  {JSON.stringify(msg, null, 2)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LiveInterview;