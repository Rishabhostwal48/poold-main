/**
 * useAudioRecorderPCM — Audio-only, PCM16 streaming hook for real-time STT
 * - Streams raw PCM16 frames (ArrayBuffer) suitable for your server's WAV wrapper
 * - Uses AudioWorklet (fallback to ScriptProcessor if needed)
 * - Provides volume metering and simple VAD
 *
 * Usage:
 *   const rec = useAudioRecorderPCM({
 *     onPcmFrame: (buf, sampleRate) => ws.send(buf),
 *     onVolumeChange: (v) => setVU(v),
 *     frameDurationMs: 20, // 10–20ms recommended
 *     vad: { enabled: true, startThreshold: 0.02, stopThreshold: 0.01, hangMs: 300 }
 *   });
 *   // On WS open, send meta once:
 *   ws.send(JSON.stringify({ type: 'meta', codec: 'pcm16', sampleRate: 16000, language: 'en' }));
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface AudioState {
  isRecording: boolean;
  isConnected: boolean;
  volume: number; // 0–100
  duration: number; // seconds
}

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: "audioinput" | "audiooutput";
}

interface VadOptions {
  enabled?: boolean;
  /** Normalized RMS to start sending (0..1). Default 0.02 (~-34 dBFS). */
  startThreshold?: number;
  /** Normalized RMS to stop sending (0..1). Default 0.01 (~-40 dBFS). */
  stopThreshold?: number;
  /** Keep sending after drop below stopThreshold (ms). Default 300. */
  hangMs?: number;
}

interface UseAudioRecorderPCMOptions {
  onPcmFrame?: (arrayBuffer: ArrayBuffer, sampleRate: number) => void;
  onVolumeChange?: (volume0to100: number) => void;
  /** Frame size for PCM pushes, ms. 10–20ms is ideal. Default 20. */
  frameDurationMs?: number;
  /** Path to the worklet module (put file in /public). Default '/pcm16-worklet.js'. */
  workletPath?: string;
  /** Initial input/output devices. */
  inputDeviceId?: string;
  outputDeviceId?: string;
  /** Simple voice activity detection. */
  vad?: VadOptions;
}

type IntervalId = ReturnType<typeof setInterval> | undefined;

export function useAudioRecorderPCM(options: UseAudioRecorderPCMOptions = {}) {
  const {
    onPcmFrame,
    onVolumeChange,
    frameDurationMs = 20,
    workletPath = "/pcm16-worklet.js",
    inputDeviceId = "default",
    outputDeviceId = "default",
    vad = { enabled: true, startThreshold: 0.02, stopThreshold: 0.01, hangMs: 300 },
  } = options;

  const [audioState, setAudioState] = useState<AudioState>({
    isRecording: false,
    isConnected: false,
    volume: 0,
    duration: 0,
  });

  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState<string>(inputDeviceId);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>(outputDeviceId);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null); // fallback
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<IntervalId>(undefined);

  // VAD state
  const sendingRef = useRef<boolean>(false);
  const lastVoiceMsRef = useRef<number>(0);

  // Enumerate devices (labels require prior mic permission in many browsers)
  const enumerateDevices = useCallback(async () => {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = mediaDevices
        .filter((d) => d.kind === "audioinput" || d.kind === "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `${d.kind} ${d.deviceId.slice(0, 6)}`,
          kind: d.kind as "audioinput" | "audiooutput",
        }));
      setDevices(audioDevices);
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }, []);

  // Get user media
  const getUserMedia = useCallback(async (deviceId: string) => {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId && deviceId !== "default" ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        // NOTE: sampleRate in constraints is generally ignored; we set the AudioContext sampleRate explicitly
      } as MediaTrackConstraints,
      video: false,
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  }, []);

  // Volume meter (RMS over Analyser time-domain data)
  const setupVolumeMeter = useCallback(
    (ac: AudioContext, source: MediaStreamAudioSourceNode) => {
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      const buf = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buf);
        // Convert to normalized float centered at 0
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length); // 0..~0.7
        const vol = Math.min(100, Math.max(0, Math.round(rms * 140))); // simple mapping
        setAudioState((s) => ({ ...s, volume: vol }));
        onVolumeChange?.(vol);
        animationFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    },
    [onVolumeChange],
  );

  // Start recording (AudioWorklet preferred)
  const startRecording = useCallback(async () => {
    if (audioState.isRecording) return;

    try {
      const stream = await getUserMedia(selectedInputDevice);
      streamRef.current = stream;

      // Create AC at 16k. (Safari may ignore; we resample server-side if needed.)
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = ac;

      const source = ac.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Volume meter
      setupVolumeMeter(ac, source);

      // Try AudioWorklet first
      try {
        await ac.audioWorklet.addModule(workletPath);
        const node = new AudioWorkletNode(ac, "pcm16-writer", {
          // You can pass options if needed
        });
        workletRef.current = node;

        node.port.onmessage = (ev: MessageEvent) => {
          // Each message is an ArrayBuffer of Int16 PCM for a single frame
          // Optional VAD gating:
          let send = true;
          const opts = vad || {};
          if (opts.enabled) {
            // Recompute RMS quickly from the buffer (cheap, subsample)
            const arr = new Int16Array(ev.data);
            let acc = 0,
              count = 0;
            for (let i = 0; i < arr.length; i += 64) {
              // subsample
              acc += Math.abs(arr[i]);
              count++;
            }
            const meanAbs = acc / Math.max(1, count); // 0..32767
            const norm = meanAbs / 32768; // 0..1
            const now = performance.now();
            const startT = opts.startThreshold ?? 0.02;
            const stopT = opts.stopThreshold ?? 0.01;
            const hang = opts.hangMs ?? 300;

            if (!sendingRef.current) {
              if (norm >= startT) {
                sendingRef.current = true;
                lastVoiceMsRef.current = now;
              } else {
                send = false;
              }
            } else {
              // already sending; update last voice time
              if (norm >= stopT) lastVoiceMsRef.current = now;
              if (now - lastVoiceMsRef.current > hang) {
                sendingRef.current = false;
                send = false;
              }
            }
          }

          if (send) onPcmFrame?.(ev.data as ArrayBuffer, ac.sampleRate);
        };

        source.connect(node);
      } catch (e) {
        console.warn("AudioWorklet not available, falling back to ScriptProcessorNode", e);
        // Fallback: ScriptProcessorNode (deprecated but widely supported)
        const frameSamples = Math.max(1, Math.round((frameDurationMs / 1000) * ac.sampleRate));
        const bufferSize = 2048; // typical
        const proc = ac.createScriptProcessor(bufferSize, 1, 1);
        scriptNodeRef.current = proc;

        proc.onaudioprocess = (evt) => {
          const input = evt.inputBuffer.getChannelData(0);
          // Slice into ~frameSamples chunks
          for (let offset = 0; offset < input.length; offset += frameSamples) {
            const n = Math.min(frameSamples, input.length - offset);
            const out = new Int16Array(n);
            for (let i = 0; i < n; i++) {
              const s = Math.max(-1, Math.min(1, input[offset + i]));
              out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            // Simple VAD (same as above)
            let send = true;
            const opts = vad || {};
            if (opts.enabled) {
              let acc = 0;
              for (let i = 0; i < n; i += 64) acc += Math.abs(out[i]);
              const meanAbs = acc / Math.max(1, Math.ceil(n / 64));
              const norm = meanAbs / 32768;
              const now = performance.now();
              const startT = opts.startThreshold ?? 0.02;
              const stopT = opts.stopThreshold ?? 0.01;
              const hang = opts.hangMs ?? 300;

              if (!sendingRef.current) {
                if (norm >= startT) {
                  sendingRef.current = true;
                  lastVoiceMsRef.current = now;
                } else {
                  send = false;
                }
              } else {
                if (norm >= stopT) lastVoiceMsRef.current = now;
                if (now - lastVoiceMsRef.current > hang) {
                  sendingRef.current = false;
                  send = false;
                }
              }
            }

            if (send) onPcmFrame?.(out.buffer, ac.sampleRate);
          }
        };

        source.connect(proc);
        proc.connect(ac.destination); // destination not strictly needed; some browsers require graph connection
      }

      // Duration ticker
      startTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setAudioState((s) => ({ ...s, duration: elapsed }));
      }, 1000);

      setAudioState((s) => ({
        ...s,
        isRecording: true,
        isConnected: true,
        duration: 0,
      }));
    } catch (err) {
      console.error("Error starting recording (PCM):", err);
      setAudioState((s) => ({ ...s, isRecording: false, isConnected: false }));
      throw err;
    }
  }, [
    audioState.isRecording,
    frameDurationMs,
    getUserMedia,
    selectedInputDevice,
    onPcmFrame,
    setupVolumeMeter,
    vad,
    workletPath,
  ]);

  const stopRecording = useCallback(() => {
    if (!audioState.isRecording) return;

    if (scriptNodeRef.current) {
      try {
        scriptNodeRef.current.disconnect();
      } catch {}
      scriptNodeRef.current = null;
    }
    if (workletRef.current) {
      try {
        workletRef.current.disconnect();
      } catch {}
      workletRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {}
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      streamRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current!);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

    setAudioState((s) => ({
      ...s,
      isRecording: false,
      isConnected: false,
      volume: 0,
    }));
    sendingRef.current = false;
    lastVoiceMsRef.current = 0;
  }, [audioState.isRecording]);

  const toggleRecording = useCallback(async () => {
    if (audioState.isRecording) stopRecording();
    else await startRecording();
  }, [audioState.isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => () => stopRecording(), [stopRecording]);

  // Load devices on mount and on devicechange
  useEffect(() => {
    enumerateDevices();
    const handleDeviceChange = () => enumerateDevices();
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
  }, [enumerateDevices]);

  // NOTE: Changing output device requires setting sinkId on an <audio> element,
  // not inside Web Audio graph. Keep selectedOutputDevice in state for your player.

  return {
    audioState,
    devices,
    selectedInputDevice,
    selectedOutputDevice,
    setSelectedInputDevice,
    setSelectedOutputDevice,
    startRecording,
    stopRecording,
    toggleRecording,
    enumerateDevices,
  };
}
