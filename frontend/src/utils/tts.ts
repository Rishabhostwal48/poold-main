// src/utils/tts.ts
import { getAccessToken } from '@/lib/backendAuth';

function cleanSpokenText(input: string): string {
  if (!input) return '';
  let str = input.trim();
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed.text === 'string') {
      str = parsed.text;
    }
  } catch {}
  return str.replace(/[{}[\]"]/g, ' ').replace(/\s+/g, ' ').trim();
}

function speakWithBrowserSpeech(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    const cleanText = cleanSpokenText(text);
    if (!cleanText) {
      resolve();
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

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        console.warn('[SpeechSynthesis] Error or ended:', e);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[SpeechSynthesis] Exception:', e);
      resolve();
    }
  });
}

export async function playTTS(text: string): Promise<void> {
  if (typeof window === "undefined" || !text?.trim()) return;
  const cleanText = cleanSpokenText(text);
  if (!cleanText) {
    console.warn('[playTTS] Ignoring empty question text');
    return;
  }

  // Free ElevenLabs accounts cannot use library voices. Use browser speech
  // by default and only call ElevenLabs when explicitly enabled.
  if (import.meta.env.VITE_USE_ELEVENLABS_TTS !== 'true') {
    return speakWithBrowserSpeech(cleanText);
  }

  try {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tts-labs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: cleanText,
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        model_id: "eleven_turbo_v2_5",
        voice_settings: { 
          stability: 0.4, 
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true
        }
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      console.warn(`[playTTS] ElevenLabs API unavailable (${response.status}): ${err} — using browser SpeechSynthesis fallback`);
      return speakWithBrowserSpeech(text);
    }

    const arrayBuffer = await response.arrayBuffer();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);
    
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
    });
  } catch (error) {
    console.warn("[playTTS] Falling back to browser SpeechSynthesis due to network/audio error");
    return speakWithBrowserSpeech(text);
  }
}
