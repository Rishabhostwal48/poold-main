import { getAccessToken } from '@/lib/backendAuth';

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

  const speakWithBrowserSpeech = (text: string, onComplete?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onComplete?.();
      return;
    }

    let cleanText = text.trim();
    try {
      const parsed = JSON.parse(cleanText);
      if (parsed && typeof parsed.text === 'string') cleanText = parsed.text;
    } catch {}
    cleanText = cleanText.replace(/[{}[\]"]/g, ' ').replace(/\s+/g, ' ').trim();

    if (!cleanText) {
      onComplete?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find((v) => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onend = () => onComplete?.();
      utterance.onerror = () => onComplete?.();

      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch {
      onComplete?.();
    }
  };

  const finishItem = (item: QueueItem) => {
    playing = false;
    item.onComplete?.();
    setTimeout(() => void playNext(), 150);
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
      const token = getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(TTS_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: next.text, voiceId, model_id }),
        signal: currentAbortController.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[AudioQueue] ElevenLabs TTS fallback to browser speech (${res.status}):`, errText);
        speakWithBrowserSpeech(next.text, () => {
          finishItem(next);
        });
        return;
      }

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
      audio.load();

      // Chrome can reject playback even after a successful TTS response. Fall
      // back to browser speech instead of silently advancing the interview.
      try {
        await audio.play();
      } catch (playError) {
        console.warn('[AudioQueue] Audio playback was blocked; using browser speech fallback:', playError);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        try { audio.pause(); } catch {}
        cleanupUrl(url);
        speakWithBrowserSpeech(next.text, () => finishItem(next));
      }
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
