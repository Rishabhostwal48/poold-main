// src/utils/tts.ts
export async function playTTS(text: string) {
  if (typeof window === "undefined") return;
// https://sxfjoqvwtjsiskqwftln.supabase.co/functions/v1/tts-elevenlabs
  try {
    // Call our Supabase Edge Function proxy (keeps API key server-side)
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tts-labs`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZmpvcXZ3dGpzaXNrcXdmdGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjIxMzcsImV4cCI6MjA3MzU5ODEzN30.-XKr81Op91guPTO604XqAMciSb6zYl30TAsujeGKqW4`,
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZmpvcXZ3dGpzaXNrcXdmdGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjIxMzcsImV4cCI6MjA3MzU5ODEzN30.-XKr81Op91guPTO604XqAMciSb6zYl30TAsujeGKqW4"
      },
      body: JSON.stringify({
        text,
        // Use a natural-sounding voice
        voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - natural and clear
        model_id: "eleven_turbo_v2",
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
      throw new Error(`TTS failed: ${response.status} ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Resume context if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);
    
    // Return a promise that resolves when audio finishes
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
    });
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
}
