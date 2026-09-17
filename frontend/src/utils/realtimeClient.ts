import { supabase } from "@/integrations/supabase/client";

interface RealtimeMessage {
  type: string;
  [key: string]: any;
}

interface RealtimeClientOptions {
  onMessage: (message: RealtimeMessage) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}

export class RealtimeClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement;
  private options: RealtimeClientOptions;
  private isLocalSpeaking = false;
  private isAssistantSpeaking = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private ephemeralToken: string | null = null;
  private micStream: MediaStream | null = null;
  private onlineHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;


  // New timing state for improved barge-in behavior
  private assistantSpeakingSince: number | null = null;
 private lastBargeInTime = 0;
  private localSpeakStart: number | null = null;
  private BARGEIN_COOLDOWN_MS = 1500; // throttle repeated barge-ins
  private MIN_LOCAL_SPEAK_MS = 400; // require this much continuous local voice before barge-in
  private MIN_ASSISTANT_SPEAK_MS = 200; // require assistant was speaking for at least this long

  constructor(options: RealtimeClientOptions) {
    this.options = options;
    this.audioEl = document.createElement("audio");
    this.audioEl.autoplay = true;
    this.audioEl.id = "mayaRealtimeAudio";
    this.audioEl.volume = 0.7; // Reduce volume to prevent feedback echo
  }

  async startSession(): Promise<boolean> {
    try {
      console.log('[Realtime] Starting session...');
      
      // Get ephemeral token from Supabase function
      // const { data, error } = await supabase.functions.invoke("realtime-session");
      
      let data, error;
       await fetch(`${import.meta.env.VITE_BACKEND_URL}/realtime-session`,{
        method: "POST",
       })
       .then(async (response) => {
         if (!response.ok) {
           throw new Error(`HTTP error! status: ${response.status}`);
         }
         data = await response.json();
       })
       .catch((err) => {
         error = err;
       });

      if (error || !data?.client_secret?.value) {
        console.error('[Realtime] Failed to get ephemeral token:', error);
        this.options.onError?.(new Error("Failed to get ephemeral token"));
        return false;
      }

      this.ephemeralToken = data.client_secret.value;
      console.log('[Realtime] Got ephemeral token, expires:', data.expires_at);

      // Create peer connection
      this.pc = new RTCPeerConnection();

      // Set up remote audio (Maya's voice)
      this.pc.ontrack = (e) => {
        console.log('[Realtime] Remote track received');
        this.audioEl.srcObject = e.streams[0];
        this.audioEl.onplay = () => {
          this.isAssistantSpeaking = true;
          this.assistantSpeakingSince = Date.now();
          this.options.onSpeakingChange?.(true);
        };
        this.audioEl.onpause = () => {
          this.isAssistantSpeaking = false;
          this.assistantSpeakingSince = null;
          this.options.onSpeakingChange?.(false);
        };
        this.audioEl.onended = () => {
          this.isAssistantSpeaking = false;
          this.assistantSpeakingSince = null;
          this.options.onSpeakingChange?.(false);
        };
      };

      // Add local audio track (candidate's mic)
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.micStream.getTracks().forEach(track => {
        this.pc!.addTrack(track, this.micStream!);
        console.log('[Realtime] Added local track:', track.kind);
      });

      // Monitor local speech for barge-in
      this.setupBargeIn(this.micStream);

      // Set up data channel for events
      this.dc = this.pc.createDataChannel("oai-events");
      
      this.dc.onopen = () => {
        console.log('[Realtime] Data channel opened');
      };

      this.dc.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('[Realtime] Failed to parse message:', err);
        }
      };

      this.dc.onerror = (e) => {
        console.error('[Realtime] Data channel error:', e);
      };

      // Handle connection state changes
      this.pc.onconnectionstatechange = () => {
        console.log('[Realtime] Connection state:', this.pc?.connectionState);
        
        if (this.pc?.connectionState === 'connected') {
          this.reconnectAttempts = 0;
          this.options.onConnected?.();
          this.setupNetworkListeners();
        } else if (this.pc?.connectionState === 'disconnected' || this.pc?.connectionState === 'failed') {
          this.handleDisconnection();
        }
      };

      // Create and set local description
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      console.log('[Realtime] Created offer');

      // Connect to OpenAI Realtime API
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${this.ephemeralToken}`,
          "Content-Type": "application/sdp"
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerSdp,
      };
      
      await this.pc.setRemoteDescription(answer);
      console.log('[Realtime] WebRTC connection established');

      return true;
    } catch (error) {
      console.error('[Realtime] Error starting session:', error);
      this.options.onError?.(error as Error);
      return false;
    }
  }

  private setupBargeIn(stream: MediaStream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    // Use a larger fft for more resolution in time-domain
    analyzer.fftSize = 1024;
    source.connect(analyzer);

    const timeData = new Uint8Array(analyzer.fftSize);
    let hangoverFrames = 0;
    const HANGOVER_FRAMES = 8; // allow short drops inside speech
    // RMS thresholds (0-255) - tuned to be less aggressive than raw frequency average
    const SPEECH_RMS_THRESHOLD = 28; // raise to avoid faint noises
    const SILENCE_RMS_THRESHOLD = 20;

    const checkAudio = () => {
      if (!this.pc || this.pc.connectionState !== 'connected') return;

      analyzer.getByteTimeDomainData(timeData);
      // compute RMS centered at 128
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128);
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / timeData.length);

      const now = Date.now();

      if (rms > SPEECH_RMS_THRESHOLD) {
        // detected voice energy
        hangoverFrames = 0;

        if (!this.localSpeakStart) this.localSpeakStart = now;
        if (!this.isLocalSpeaking) this.isLocalSpeaking = true;

        // Only consider barge-in if assistant is speaking and has been for a little while
        const assistantSpokenLongEnough = this.assistantSpeakingSince && (now - this.assistantSpeakingSince) >= this.MIN_ASSISTANT_SPEAK_MS;
        const localSpokeLongEnough = this.localSpeakStart && (now - this.localSpeakStart) >= this.MIN_LOCAL_SPEAK_MS;
        const cooldownOk = (now - this.lastBargeInTime) >= this.BARGEIN_COOLDOWN_MS;

        if (this.isAssistantSpeaking && assistantSpokenLongEnough && localSpokeLongEnough && cooldownOk) {
          this.lastBargeInTime = now;
          this.handleBargeIn();
        }
      } else if (rms > SILENCE_RMS_THRESHOLD) {
        // within hangover - treat as speech for a few frames
        hangoverFrames = Math.max(0, hangoverFrames - 1);
      } else {
        // definite silence
        hangoverFrames++;
        if (hangoverFrames > HANGOVER_FRAMES) {
          if (this.isLocalSpeaking) {
            this.isLocalSpeaking = false;
            this.localSpeakStart = null;
          }
          hangoverFrames = 0;
        }
      }

      requestAnimationFrame(checkAudio);
    };

    checkAudio();
  }

  private setupNetworkListeners() {
    // Handle network reconnection
    this.onlineHandler = () => {
      console.log('[Realtime] Network online, checking connection...');
      if (this.pc?.connectionState !== 'connected') {
        this.pc?.restartIce();
      }
    };

    this.visibilityHandler = () => {
      if (!document.hidden && this.pc?.connectionState !== 'connected') {
        console.log('[Realtime] Tab visible, checking connection...');
        this.pc?.restartIce();
      }
    };

    window.addEventListener('online', this.onlineHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private handleBargeIn() {
    console.log('[Realtime] Barge-in detected - cancelling response');
    
    // Pause remote audio immediately
    if (this.audioEl.srcObject) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }

    // Send cancel event to OpenAI
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify({
        type: 'response.cancel'
      }));
    }

    // Notify page so UI can pause/stop local recorder if desired
    try { window.dispatchEvent(new Event('realtime:bargein')); } catch (e) { /* ignore */ }
  }

  private handleMessage(message: RealtimeMessage) {
    // Forward all messages to the parent component
    this.options.onMessage(message);

    // Log important events
    if (message.type === 'session.created') {
      console.log('[Realtime] Session created');
    } else if (message.type === 'error') {
      console.error('[Realtime] Error event:', message);
      this.options.onError?.(new Error(message.error?.message || 'Unknown error'));
    }
  }

  private async handleDisconnection() {
    console.log('[Realtime] Handling disconnection...');
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[Realtime] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      try {
        await this.pc?.restartIce();
      } catch (error) {
        console.error('[Realtime] ICE restart failed:', error);
        this.options.onError?.(new Error('Connection lost - please reconnect'));
        this.options.onDisconnected?.();
      }
    } else {
      console.error('[Realtime] Max reconnection attempts reached');
      this.options.onError?.(new Error('Connection lost - please start fresh'));
      this.options.onDisconnected?.();
    }
  }

  async sendTextMessage(text: string) {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    };

    this.dc.send(JSON.stringify(event));
    this.dc.send(JSON.stringify({ type: 'response.create' }));
  }

  // NEW: allow sending control events over the data channel (e.g., next_question)
  sendControl(type: string, payload?: Record<string, any>) {
    if (!this.dc || this.dc.readyState !== "open") {
      throw new Error("Data channel not ready");
    }
    const event = { type, ...(payload ? { payload } : {}) };
    this.dc.send(JSON.stringify(event));
  }

  disconnect() {
    console.log('[Realtime] Disconnecting...');
    
    // Stop audio element completely
    try {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
      this.audioEl.src = '';
      this.audioEl.load();
    } catch (e) {
      console.error('[Realtime] Error stopping audio element:', e);
    }

    // Stop all remote audio tracks
    if (this.audioEl.srcObject) {
      try {
        (this.audioEl.srcObject as MediaStream).getTracks().forEach(t => {
          t.stop();
          console.log('[Realtime] Stopped remote audio track:', t.kind);
        });
        this.audioEl.srcObject = null;
      } catch (e) {
        console.error('[Realtime] Error stopping remote tracks:', e);
      }
    }

    // Critical: stop local mic completely
    if (this.micStream) {
      try {
        this.micStream.getTracks().forEach(t => {
          t.stop();
          console.log('[Realtime] Stopped local mic track:', t.kind);
        });
        this.micStream = null;
      } catch (e) {
        console.error('[Realtime] Error stopping mic tracks:', e);
      }
    }

    // Remove network listeners
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    // Close peer connection with full cleanup
    if (this.pc) {
      try {
        // Stop all senders
        this.pc.getSenders().forEach(sender => {
          try {
            sender.track?.stop();
            sender.replaceTrack(null);
          } catch (e) {
            console.error('[Realtime] Error stopping sender:', e);
          }
        });

        // Stop all transceivers
        if (this.pc.getTransceivers) {
          this.pc.getTransceivers().forEach(transceiver => {
            try {
              transceiver.stop();
            } catch (e) {
              console.error('[Realtime] Error stopping transceiver:', e);
            }
          });
        }

        // Stop all receivers
        this.pc.getReceivers().forEach(receiver => {
          try {
            receiver.track?.stop();
          } catch (e) {
            console.error('[Realtime] Error stopping receiver:', e);
          }
        });

        // Clear event handlers
        this.pc.ontrack = null;
        this.pc.oniceconnectionstatechange = null;
        this.pc.onconnectionstatechange = null;

        // Close the connection
        this.pc.close();
        this.pc = null;
      } catch (e) {
        console.error('[Realtime] Error closing peer connection:', e);
      }
    }

    // Close data channel
    if (this.dc) {
      try {
        this.dc.close();
        this.dc = null;
      } catch (e) {
        console.error('[Realtime] Error closing data channel:', e);
      }
    }

    // Clear state
    this.ephemeralToken = null;
    this.isLocalSpeaking = false;
    this.isAssistantSpeaking = false;
    
    console.log('[Realtime] Full teardown completed');
  }


  isConnected(): boolean {
    return this.pc?.connectionState === 'connected' && this.dc?.readyState === 'open';
  }
}
