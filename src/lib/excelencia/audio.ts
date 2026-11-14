/**
 * Captação de som para a conversa com o Alex.
 *
 * Em vez do MediaRecorder (que corta sílabas e produz pedaços sem cabeçalho),
 * gravamos PCM com a Web Audio API e enviamos sempre um WAV completo de
 * 16 kHz mono — o formato que o Whisper da Groq percebe melhor.
 */

const TARGET_RATE = 16000;
const FRAME = 2048;

export interface Mic {
  /** Nível de energia (RMS) do último frame captado. */
  rms(): number;
  /** Grava uma fala com deteção automática de início/fim. */
  capture(opts?: CaptureOptions): Promise<CaptureResult>;
  /** Cancela a gravação em curso. */
  abort(): void;
  /** Ruído de fundo estimado do sítio onde o aluno está. */
  floor(): number;
  /** Limpa o pré-buffer (usar depois de o Alex falar, para não gravar a voz dele). */
  flush(): void;
  close(): void;
}

export interface CaptureOptions {
  /** Silêncio (ms) depois de fala para dar o turno por terminado. */
  hangoverMs?: number;
  /** Tempo máximo (ms) à espera que o aluno comece a falar. */
  waitMs?: number;
  /** Duração máxima (ms) de uma fala. */
  maxMs?: number;
  /** Fala mínima (ms) para valer como turno (corta tosses e cliques). */
  minSpeechMs?: number;
  /** Termina a gravação por ordem externa. */
  signal?: { aborted: boolean };
}

export interface CaptureResult {
  blob: Blob | null;
  /** Duração de fala real, em ms. */
  speechMs: number;
  reason: "speech" | "timeout" | "aborted";
}

const rmsOf = (frame: Float32Array) => {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i]! * frame[i]!;
  return Math.sqrt(sum / frame.length);
};

/** Remove offset DC e normaliza o volume — voz baixa passa a ser percebida. */
function conditionPcm(pcm: Float32Array) {
  let mean = 0;
  for (let i = 0; i < pcm.length; i++) mean += pcm[i]!;
  mean /= pcm.length || 1;
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    pcm[i] = pcm[i]! - mean;
    const a = Math.abs(pcm[i]!);
    if (a > peak) peak = a;
  }
  if (peak > 0.0005 && peak < 0.85) {
    const gain = Math.min(8, 0.85 / peak);
    for (let i = 0; i < pcm.length; i++) pcm[i] = pcm[i]! * gain;
  }
  return pcm;
}

function downsample(pcm: Float32Array, from: number, to: number) {
  if (from <= to) return pcm;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(pcm.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(pcm.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += pcm[j]!;
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export function encodeWav(pcm: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Junta frames, condiciona e devolve um WAV 16 kHz mono. */
export function framesToWav(frames: Float32Array[], sampleRate: number): Blob | null {
  const total = frames.reduce((n, f) => n + f.length, 0);
  if (!total) return null;
  const pcm = new Float32Array(total);
  let at = 0;
  for (const f of frames) {
    pcm.set(f, at);
    at += f.length;
  }
  return encodeWav(conditionPcm(downsample(pcm, sampleRate, TARGET_RATE)), TARGET_RATE);
}

export async function openMic(): Promise<{ mic: Mic; stream: MediaStream }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });
  const ctx = new AudioContext();
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 85; // corta ventoinhas, mexidas na mesa, trânsito
  const processor = ctx.createScriptProcessor(FRAME, 1, 1);
  const sink = ctx.createGain();
  sink.gain.value = 0; // não devolve o som aos altifalantes
  source.connect(highpass);
  highpass.connect(processor);
  processor.connect(sink);
  sink.connect(ctx.destination);

  const frameMs = (FRAME / ctx.sampleRate) * 1000;
  const preRollFrames = Math.ceil(400 / frameMs);

  let lastRms = 0;
  let noiseFloor = 0.01;
  let listener: ((frame: Float32Array, rms: number) => void) | null = null;
  const preRoll: Float32Array[] = [];

  processor.onaudioprocess = (e) => {
    const frame = new Float32Array(e.inputBuffer.getChannelData(0));
    const r = rmsOf(frame);
    lastRms = r;
    preRoll.push(frame);
    if (preRoll.length > preRollFrames) preRoll.shift();
    listener?.(frame, r);
  };

  let aborter: (() => void) | null = null;

  const mic: Mic = {
    rms: () => lastRms,
    floor: () => noiseFloor,
    flush: () => {
      preRoll.length = 0;
    },
    abort: () => aborter?.(),
    close: () => {
      listener = null;
      processor.onaudioprocess = null;
      try {
        processor.disconnect();
        highpass.disconnect();
        source.disconnect();
        sink.disconnect();
      } catch {
        /* já desligado */
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
    },
    capture: (opts = {}) =>
      new Promise<CaptureResult>((resolve) => {
        const hangover = opts.hangoverMs ?? 700;
        const wait = opts.waitMs ?? 15000;
        const maxMs = opts.maxMs ?? 25000;
        const minSpeech = opts.minSpeechMs ?? 280;

        // arranca com o pré-buffer para não perder a primeira sílaba
        const frames: Float32Array[] = [...preRoll];
        let speechMs = 0;
        let quietMs = 0;
        let elapsed = 0;
        let spoke = false;
        let done = false;

        const finish = (reason: CaptureResult["reason"]) => {
          if (done) return;
          done = true;
          listener = null;
          aborter = null;
          const enough = speechMs >= minSpeech;
          resolve({
            blob: enough ? framesToWav(frames, ctx.sampleRate) : null,
            speechMs,
            reason,
          });
        };

        aborter = () => finish("aborted");

        listener = (frame, r) => {
          if (opts.signal?.aborted) return finish("aborted");
          elapsed += frameMs;
          frames.push(frame);

          // limiares com histerese, colados ao ruído do sítio
          const speakAt = Math.max(0.016, noiseFloor * 2.6);
          const quietAt = Math.max(0.009, noiseFloor * 1.5);

          if (r > speakAt) {
            spoke = true;
            speechMs += frameMs;
            quietMs = 0;
          } else if (spoke && r > quietAt) {
            speechMs += frameMs * 0.5;
            quietMs = 0;
          } else {
            if (!spoke) noiseFloor = noiseFloor * 0.94 + r * 0.06;
            quietMs += frameMs;
          }

          if (spoke && quietMs >= hangover) return finish("speech");
          if (!spoke && elapsed >= wait) return finish("timeout");
          if (elapsed >= maxMs) return finish(spoke ? "speech" : "timeout");
        };
      }),
  };

  // calibração rápida do ruído de fundo
  const samples: number[] = [];
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 25));
    samples.push(lastRms);
  }
  samples.sort((a, b) => a - b);
  noiseFloor = Math.max(0.004, Math.min(0.08, samples[Math.floor(samples.length / 2)] ?? 0.01));

  return { mic, stream };
}
