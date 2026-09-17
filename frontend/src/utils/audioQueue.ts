// Simple audio queue for sequential playback of ElevenLabs TTS
// Uses a single HTMLAudioElement to avoid overlapping audio

export type AudioQueue = {
  enqueueText: (text: string) => Promise<void>;
  enqueueTextWithCallback: (text: string, onComplete: () => void) => Promise<void>;
  enqueueStreamingText: (text: string, onComplete?: () => void) => Promise<void>;
  stop: () => void;
  stopCurrent: () => void;
  destroy: () => void;
  isPlaying: () => boolean;
};

const TTS_URL = `${import.meta.env.VITE_BACKEND_URL}/tts-labs`;

export function createAudioQueue({
  onStart,
  onEnd,
  voiceId = "XB0fDUnXU5powFXDhCwa", // Charlotte (clear and friendly)
  model_id = "eleven_turbo_v2_5",
}: {
  onStart?: () => void;
  onEnd?: () => void;
  voiceId?: string;
  model_id?: string;
} = {}): AudioQueue {
  const audio = new Audio();
  audio.preload = "auto";
  
  type QueueItem = { text: string; onComplete?: () => void };
  let queue: QueueItem[] = [];
  let playing = false;
  let currentAbortController: AbortController | null = null;

  const cleanupUrl = (url: string) => {
    try { URL.revokeObjectURL(url); } catch {}
  };

  const playNext = async () => {
    if (playing) return;
    const next = queue.shift();
    if (!next) {
      onEnd?.();
      return;
    }
    playing = true;
    onStart?.();

    try {
      currentAbortController = new AbortController();
      const res = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: next.text, voiceId, model_id }),
        signal: currentAbortController.signal,
      });
      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const onEnded = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        cleanupUrl(url);
        playing = false;
        // Call completion callback if provided
        next.onComplete?.();
        // slight gap between utterances
        setTimeout(() => void playNext(), 150);
      };
      const onError = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        cleanupUrl(url);
        playing = false;
        next.onComplete?.();
        setTimeout(() => void playNext(), 0);
      };

      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      audio.src = url;
      // Some browsers require user gesture; Maya page has explicit Start button
      await audio.play().catch(() => {
        // If play fails (autoplay), pause and let user retry flow
        playing = false;
        cleanupUrl(url);
        next.onComplete?.();
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[AudioQueue] Playback aborted (barge-in)');
      }
      playing = false;
      next.onComplete?.();
      setTimeout(() => void playNext(), 0);
    } finally {
      currentAbortController = null;
    }
  };

  return {
    enqueueText: async (text: string) => {
      if (!text?.trim()) return;
      queue.push({ text });
      if (!playing) await playNext();
    },
    enqueueTextWithCallback: async (text: string, onComplete: () => void) => {
      if (!text?.trim()) return;
      queue.push({ text, onComplete });
      if (!playing) await playNext();
    },
    enqueueStreamingText: async (text: string, onComplete?: () => void) => {
      // For streaming fallback: similar to enqueueTextWithCallback but optimized
      // In future, this could use ElevenLabs WebSocket for true streaming
      if (!text?.trim()) return;
      queue.push({ text, onComplete });
      if (!playing) await playNext();
    },
    stop: () => {
      try { audio.pause(); } catch {}
      playing = false;
      queue = [];
      currentAbortController?.abort();
    },
    stopCurrent: () => {
      console.log('[AudioQueue] Stopping current playback for barge-in');
      try { audio.pause(); } catch {}
      playing = false;
      currentAbortController?.abort();
      // Continue with next item in queue
      setTimeout(() => void playNext(), 0);
    },
    destroy: () => {
      console.log('[AudioQueue] Destroying - full cleanup');
      try {
        audio.pause();
        audio.src = '';
        audio.load(); // Reset to stop any pending loads
      } catch (e) {
        console.error('[AudioQueue] Error stopping audio:', e);
      }
      queue = [];
      playing = false;
      currentAbortController?.abort();
      currentAbortController = null;
      console.log('[AudioQueue] Destroy complete');
    },
    isPlaying: () => playing,
  };
}
