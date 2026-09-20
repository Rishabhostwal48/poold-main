/**
 * RealtimeAudio - WebSocket-based interview system with MediaRecorder + Whisper transcription
 */
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/backendAuth";

export class RealtimeChat {
  private ws: Socket | null = null;
  private isConnected = false;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext;
  private onMessage: (message: any) => void;
  private onSpeakingChange: (speaking: boolean) => void;
  private isRecording = false;
  private audioChunks: Uint8Array[] = [];
  private flushIntervalId: number | null = null;

  constructor(onMessage: (message: any) => void, onSpeakingChange: (speaking: boolean) => void) {
    this.onMessage = onMessage;
    this.onSpeakingChange = onSpeakingChange;
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async init() {
    try {
      console.log("🔗 Connecting to interview WebSocket...");
      
      // Resume audio context if needed
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Connect to WebSocket
      const PROJECT_REF = "sxfjoqvwtjsiskqwftln";
      const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZmpvcXZ3dGpzaXNrcXdmdGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjIxMzcsImV4cCI6MjA3MzU5ODEzN30.-XKr81Op91guPTO604XqAMciSb6zYl30TAsujeGKqW4";
      const configuredUrl = import.meta.env.VITE_WEBSOCKET_URL || "http://localhost:3000";
      const baseUrl = configuredUrl.replace(/^ws(s?):\/\//, "http$1://").replace(/\/+$/, "");
      const token = getAccessToken();
      this.ws = io(`${baseUrl}/interview`, {
        auth: token ? { token } : undefined,
        transports: ["websocket"],
        autoConnect: false,
      });

      return new Promise<void>((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket not initialized'));
          return;
        }

        const timeout = window.setTimeout(() => {
          this.ws?.disconnect();
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.ws.on("connect", () => {
          clearTimeout(timeout);
          console.log("✅ WebSocket connected");
          this.isConnected = true;
          // Notify the UI that we're connected
          this.onMessage({ type: "connected" });
          resolve();
        });

        this.ws.on("message", (message: string) => {
          try {
            this.onMessage(JSON.parse(message));
          } catch (error) {
            console.error("❌ Error parsing WebSocket message:", error);
          }
        });

        this.ws.on("disconnect", (reason) => {
          console.log("🔌 WebSocket closed:", reason);
          this.isConnected = false;
          this.onMessage({ type: "disconnected" });
        });

        this.ws.on("connect_error", (error) => {
          clearTimeout(timeout);
          console.error("❌ WebSocket error:", error);
          this.onMessage({ type: "error", message: error.message || "WebSocket connection error" });
          reject(error);
        });
        this.ws.connect();
      });

    } catch (error) {
      console.error("❌ Error initializing chat:", error);
      throw error;
    }
  }

  async startRecording() {
    if (this.isRecording) return;
    
    try {
      // Resume audio context on user interaction
      if (this.audioContext.state === 'suspended') {
        console.log("🔊 Resuming audio context for recording...");
        await this.audioContext.resume();
      }
      
      console.log("🎙️ Starting microphone recording...");
      
      // Get microphone stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Choose the best available MIME type
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
        MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")  ? "audio/ogg;codecs=opus"  :
        MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" :
        "audio/webm";

      console.log("🎙️ Using MIME type:", mimeType);

      this.mediaRecorder = new MediaRecorder(this.stream, { 
        mimeType,
        audioBitsPerSecond: 128000
      });

      // Tell server what MIME type we'll send
      if (this.ws?.connected) {
        this.ws.emit("meta", {
          mimeType, 
          language: "en" 
        });
      }

      // Clear previous chunks
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && this.ws?.connected) {
          // Convert to ArrayBuffer and send as binary
          event.data.arrayBuffer().then((arrayBuffer) => {
            const uint8Array = new Uint8Array(arrayBuffer);
            console.log(`🎙️ Sending audio chunk: ${uint8Array.length} bytes`);
            this.ws!.emit("audio", uint8Array);
          });
        }
      };

      this.mediaRecorder.onstart = () => {
        console.log("🎙️ MediaRecorder started");
        this.isRecording = true;
      };

      this.mediaRecorder.onstop = () => {
        console.log("🎙️ MediaRecorder stopped");
        this.isRecording = false;
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event);
        this.isRecording = false;
      };

      // Start recording with 500ms chunks for low latency
      this.mediaRecorder.start(500);
      // Periodically request server to process buffered audio while recording
      if (this.ws?.connected) {
        // Send an initial flush to kick things off
        this.ws.emit("flush");
      }
      // Start a flush ticker every 4s to trigger transcription batches
      this.flushIntervalId = window.setInterval(() => {
        if (this.ws?.connected && this.isRecording) {
          this.ws.emit("flush");
        }
      }, 4000);
      
    } catch (error) {
      console.error("❌ Error starting recording:", error);
      this.onMessage({ 
        type: "error", 
        message: "Failed to start microphone recording. Please check permissions and try again." 
      });
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      console.log("🎙️ Stopping MediaRecorder...");
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    // Stop mic tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Clear periodic flush
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }

    // Ask server to process whatever is buffered
    if (this.ws?.connected) {
      this.ws.emit("flush");
    }

    this.isRecording = false;
  }

  sendTextResponse(text: string) {
    if (!this.ws?.connected) {
      console.error("❌ WebSocket not connected");
      return;
    }

    console.log("📤 Sending text response:", text);
    this.ws.emit("manual_text", { text });
  }

  sendNextQuestion() {
    if (!this.ws?.connected) {
      console.error("❌ WebSocket not connected");
      return;
    }

    console.log("➡️ Requesting next question");
    this.ws.emit("flush");
  }

  sendMessage(text: string) {
    this.sendTextResponse(text);
  }

  disconnect() {
    // Ensure recording is stopped and resources are released
    this.stopRecording();

    // Clear any flush ticker just in case
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }

    if (this.ws) {
      this.ws.disconnect();
      this.ws = null;
    }

    this.isConnected = false;
  }

  isConnectedStatus(): boolean {
    return this.isConnected;
  }

  isRecordingStatus(): boolean {
    return this.isRecording;
  }
}