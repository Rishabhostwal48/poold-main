// WebSocket client with jittered backoff, keepalive, outbox queue,
// ASR-aware errors, explicit binaryType, and configurable timeouts.
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./backendAuth";

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
  private ws: Socket | null = null;
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
  private readonly authToken: string;
  private livenessAttached = false;
  private outbox: Array<ArrayBuffer | string> = [];
  private noRetryCodes: Set<number>;

  constructor(url?: string, token?: string, opts: WSClientOptions = {}) {
    const configuredUrl = url || import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:3000/interview";
    const authToken = token || "";
    this.authToken = authToken;
    const u = new URL(configuredUrl.replace(/^ws(s?):\/\//, "http$1://"));
    this.url = `${u.protocol}//${u.host}`;
    this.subprotocols = undefined;

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
      const sessionToken = this.authToken || getAccessToken() || "";
      this.ws = io(`${this.url}/interview`, {
        auth: sessionToken ? { token: sessionToken } : undefined,
        transports: ["websocket"],
        autoConnect: false,
      });
      const ws = this.ws;

      ws.on("connect", () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.clearReconnect();
        this.startKeepalive();
        this.attachLivenessListeners();
        this.handlers.onOpen?.(new Event("open"));
        this.flushOutbox();
      });

      ws.on("message", async (message: string) => {
        try {
          const text = typeof message === "string" ? message : JSON.stringify(message);
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
      });

      ws.on("connect_error", (error) => {
        this.isConnecting = false;
        this.handlers.onError?.(error);
      });

      ws.on("disconnect", (reason) => {
        this.isConnecting = false;
        this.ws = null;
        this.stopKeepalive();
        this.handlers.onClose?.(new CloseEvent("close", { reason }));
        if (
          !this.noRetryCodes.has(1006) &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          const jitter = Math.random() * 0.4 + 0.8;
          const delay = Math.min(10_000, this.baseDelayMs * 2 ** this.reconnectAttempts) * jitter;
          this.reconnectTimer = window.setTimeout(() => this.reconnect(), delay) as unknown as number;
          this.reconnectAttempts++;
        }
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          this.isConnecting = false;
          ws.disconnect();
          reject(new Error("WebSocket connection timeout"));
        }, this.connectTimeoutMs);

        ws.once("connect", () => {
          clearTimeout(timeout);
          resolve();
        });
        ws.once("connect_error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        ws.connect();
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
        this.ws.disconnect();
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
        this.ws!.emit("ping", { type: "ping", ts: Date.now() });
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
    if (typeof payload === "string") {
      const message = JSON.parse(payload);
      this.ws.emit(message.type, message);
    } else {
      this.ws.emit("audio", payload);
    }
  }

  private flushOutbox() {
    if (!this.ws) return;
    while (this.outbox.length) {
      this.safeSend(this.outbox.shift() as ArrayBuffer | string);
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
    return this.ws?.connected === true;
  }
  getReadyState(): number | null {
    return this.ws?.connected ? 1 : 0;
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
        this.ws.disconnect();
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
