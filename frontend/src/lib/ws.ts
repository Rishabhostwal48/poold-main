// WebSocket client with jittered backoff, keepalive, outbox queue,
// ASR-aware errors, explicit binaryType, and configurable timeouts.

export type InterviewQuestion = {
  question: string;
  isGreeting?: boolean;
  isClosing?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
};

type WSEventHandlers = {
  onQuestion?: (q: InterviewQuestion) => void;
  onError?: (error: Event | Error) => void;
  onClose?: (event: CloseEvent) => void;
  onOpen?: (event: Event) => void;
  onTranscript?: (text: string, speaker: "interviewer" | "candidate") => void;
};

function env(key: string, fallback = ""): string {
  return (import.meta as any).env?.[key] ?? fallback;
}

export type WSClientOptions = {
  maxReconnectAttempts?: number;
  baseDelayMs?: number;
  connectTimeoutMs?: number;
  noRetryCloseCodes?: number[];
};

class InterviewWebSocket {
  private ws: WebSocket | null = null;
  private url: string = "";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseDelayMs = 800;
  private connectTimeoutMs = 10_000;
  private isConnecting = false;
  protected handlers: WSEventHandlers = {};
  private reconnectTimer: number | null = null;
  private keepaliveTimer: number | null = null;
  private readonly subprotocols: string[] | undefined;
  private livenessAttached = false;
  private outbox: Array<ArrayBuffer | string> = [];
  private noRetryCodes: Set<number>;

  constructor(url?: string, token?: string, opts: WSClientOptions = {}) {
    // Hardcode Supabase project ref and anon key for reliable client connectivity
    const PROJECT_REF = "sxfjoqvwtjsiskqwftln";
    const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZmpvcXZ3dGpzaXNrcXdmdGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjIxMzcsImV4cCI6MjA3MzU5ODEzN30.-XKr81Op91guPTO604XqAMciSb6zYl30TAsujeGKqW4";
  
    const baseUrl = url || import.meta.env.VITE_WEBSOCKET_URL;
    const anon = token || ANON_KEY;

    const u = new URL(baseUrl);
    if (!u.searchParams.has("apikey")) u.searchParams.set("apikey", anon);
    this.url = u.toString();
    this.subprotocols = ["jwt", anon];

    // Options
    this.maxReconnectAttempts = opts.maxReconnectAttempts ?? this.maxReconnectAttempts;
    this.baseDelayMs = opts.baseDelayMs ?? this.baseDelayMs;
    this.connectTimeoutMs = opts.connectTimeoutMs ?? this.connectTimeoutMs;
    this.noRetryCodes = new Set(opts.noRetryCloseCodes ?? [1008, 1011, 4003, 4403]); // policy/auth errors
  }

  async connect(handlers: WSEventHandlers): Promise<boolean> {
    if (typeof WebSocket === "undefined") {
      handlers.onError?.(new Error("WebSocket not supported in this environment"));
      return false;
    }
    
    // Guard: only allow one transport at a time
    if (this.isConnecting || this.isConnected()) {
      console.log('[WS] Already connecting or connected');
      return this.isConnected();
    }

    this.handlers = handlers;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url, this.subprotocols);
      const ws = this.ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = (event) => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.clearReconnect();
        this.startKeepalive();
        this.attachLivenessListeners();
        this.handlers.onOpen?.(event);
        this.flushOutbox();
      };

      ws.onmessage = async (event) => {
        try {
          let text: string;
          if (typeof event.data === "string") {
            text = event.data;
          } else if (event.data instanceof Blob) {
            text = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            text = new TextDecoder().decode(event.data);
          } else {
            return;
          }
          let data: any;
          try {
            data = JSON.parse(text);
          } catch {
            return;
          }

          switch (data.type) {
            case "question":
              this.handlers.onQuestion?.(data.data);
              break;
            case "transcript":
              this.handlers.onTranscript?.(data.data.text, data.data.speaker);
              break;
            case "error": {
              const msg = data.message ?? "WS error";
              this.handlers.onError?.(new Error(msg));
              if (/transcription|asr/i.test(msg)) {
                try {
                  (window as any).dispatchEvent(new CustomEvent("maya-asr-failed"));
                } catch {}
              }
              break;
            }
            case "asr_error":
            case "transcription_failed": {
              const msg = data.message ?? data.reason ?? "Transcription failed";
              this.handlers.onError?.(new Error(msg));
              try {
                (window as any).dispatchEvent(new CustomEvent("maya-asr-failed"));
              } catch {}
              break;
            }
            default:
              break;
          }
        } catch (err) {
          this.handlers.onError?.(err as Error);
        }
      };

      ws.onerror = (event) => {
        this.isConnecting = false;
        this.handlers.onError?.(event as Event);
      };

      ws.onclose = (event) => {
        this.isConnecting = false;
        this.ws = null;
        this.stopKeepalive();
        this.handlers.onClose?.(event);
        if (
          !this.noRetryCodes.has(event.code) &&
          event.code !== 1000 &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          const jitter = Math.random() * 0.4 + 0.8;
          const delay = Math.min(10_000, this.baseDelayMs * 2 ** this.reconnectAttempts) * jitter;
          this.reconnectTimer = window.setTimeout(() => this.reconnect(), delay) as unknown as number;
          this.reconnectAttempts++;
        }
      };

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          this.isConnecting = false;
          try {
            ws.close();
          } catch {}
          reject(new Error("WebSocket connection timeout"));
        }, this.connectTimeoutMs);

        const prevOpen = ws.onopen;
        const prevErr = ws.onerror;

        ws.onopen = (e) => {
          prevOpen?.call(ws, e as any);
          clearTimeout(timeout);
          resolve();
        };
        ws.onerror = (e) => {
          prevErr?.call(ws, e as any);
          clearTimeout(timeout);
          reject(new Error("WebSocket connection failed"));
        };
      });

      return true;
    } catch (error) {
      this.isConnecting = false;
      this.handlers.onError?.(error as Error);
      return false;
    }
  }

  private async reconnect() {
    await this.connect(this.handlers);
  }

  public async forceReconnect(): Promise<boolean> {
    this.clearReconnect();
    this.stopKeepalive();
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    if (this.ws) {
      try {
        this.ws.close(4001, "Force reconnect");
      } catch {}
      this.ws = null;
    }
    return this.connect(this.handlers);
  }

  private attachLivenessListeners() {
    if (this.livenessAttached) return;
    this.livenessAttached = true;
    window.addEventListener("online", () => {
      if (!this.isConnected()) this.forceReconnect();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !this.isConnected()) this.forceReconnect();
    });
  }

  private clearReconnect() {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startKeepalive() {
    this.stopKeepalive();
    this.keepaliveTimer = window.setInterval(() => {
      if (this.isConnected()) {
        try {
          this.ws!.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        } catch {}
      }
    }, 25_000) as unknown as number;
  }

  private stopKeepalive() {
    if (this.keepaliveTimer != null) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private safeSend(payload: ArrayBuffer | string) {
    if (!this.ws) return;
    if (this.ws.bufferedAmount > 1_000_000) return; // basic backpressure
    this.ws.send(payload as any);
  }

  private flushOutbox() {
    if (!this.ws) return;
    while (this.outbox.length && this.ws.bufferedAmount < 1_000_000) {
      this.ws.send(this.outbox.shift() as any);
    }
  }

  sendAudioChunk(blob: Blob) {
    blob.arrayBuffer().then((ab) => {
      if (!this.isConnected() || !this.ws) {
        this.outbox.push(ab);
        return;
      }
      try {
        this.safeSend(ab);
      } catch (e) {
        this.handlers.onError?.(e as Error);
      }
    });
  }

  sendMessage(message: unknown) {
    const text = JSON.stringify(message);
    if (!this.isConnected() || !this.ws) {
      this.outbox.push(text);
      return;
    }
    try {
      this.safeSend(text);
    } catch (e) {
      this.handlers.onError?.(e as Error);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  getReadyState(): number | null {
    return this.ws?.readyState ?? null;
  }
  isConnectingNow() {
    return this.isConnecting;
  }
  urlForDebug() {
    return this.url;
  }

  disconnect(opts?: { manual?: boolean }) {
    console.log('[WS] Disconnect called', opts?.manual ? '(manual - no reconnect)' : '');
    
    // Prevent auto-reconnect on manual close
    if (opts?.manual) {
      this.reconnectAttempts = this.maxReconnectAttempts;
    }
    
    this.clearReconnect();
    this.stopKeepalive();
    if (this.ws) {
      try {
        this.ws.close(1000, opts?.manual ? "Manual close" : "Client disconnect");
      } finally {
        this.ws = null;
      }
    }
    // Prevent reconnection on manual disconnect
    if (opts?.manual) {
      this.reconnectAttempts = this.maxReconnectAttempts;
    } else {
      this.reconnectAttempts = this.maxReconnectAttempts;
    }
  }
}

export const wsClient = new InterviewWebSocket();
