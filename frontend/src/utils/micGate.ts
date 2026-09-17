// Lightweight gate/ducking around the microphone stream with simple RMS-based VAD
export async function createDuckedMicStream(opts?: {
  onSpeech?: (speaking: boolean) => void;
  sampleRate?: number;
}) {
  const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: opts?.sampleRate ?? 48000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const src = ac.createMediaStreamSource(mic);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  const data = new Uint8Array(analyser.frequencyBinCount);

  const gateGain = ac.createGain();
  gateGain.gain.value = 1;

  src.connect(analyser);
  src.connect(gateGain);

  const dest = ac.createMediaStreamDestination();
  gateGain.connect(dest);

  let speaking = false, lastAbove = 0;
  const THRESH = 0.04;
  const HANG_MS = 250;

  function loop() {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    const now = performance.now();
    if (rms > THRESH) {
      lastAbove = now;
      if (!speaking) { speaking = true; opts?.onSpeech?.(true); }
    } else if (speaking && now - lastAbove > HANG_MS) {
      speaking = false; opts?.onSpeech?.(false);
    }
    requestAnimationFrame(loop);
  }
  loop();

  return {
    stream: dest.stream,
    setDucking(on: boolean) { gateGain.gain.value = on ? 0.02 : 1; }, // ~ -34 dB
    close() { ac.close(); mic.getTracks().forEach(t => t.stop()); },
  };
}
