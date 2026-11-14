import { useEffect, useRef, useState } from "react";
import { X, Loader2, Mic, Square, Volume2, RotateCcw, Play, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  generateSpeakingDrill,
  scoreSpeaking,
  speakWithGroq,
  transcribeAudio,
  type SpeakingDrill as Drill,
} from "@/lib/excelencia/groq.functions";
import { openMic, type Mic as MicHandle } from "@/lib/excelencia/audio";
import { browserSpeak } from "@/lib/excelencia/speech-fallback";

import type { Accent, Level } from "@/lib/excelencia/state";

interface Attempt {
  said: string;
  score: number;
  feedback: string;
  better: string;
  audioUrl: string;
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não consegui ler o áudio."));
    reader.onload = () => {
      const r = String(reader.result);
      resolve(r.slice(r.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });

export function SpeakingDrill({
  level,
  name,
  accent = "angolano",
  onClose,
  onFinish,
}: {
  level: Level;
  name: string;
  accent?: Accent;
  onClose: () => void;
  onFinish: (avgScore: number, tasks: number) => void;
}) {
  const build = useServerFn(generateSpeakingDrill);
  const speak = useServerFn(speakWithGroq);
  const transcribe = useServerFn(transcribeAudio);
  const score = useServerFn(scoreSpeaking);

  const [drill, setDrill] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [idx, setIdx] = useState(0);
  const [attempts, setAttempts] = useState<Record<number, Attempt>>({});
  const [phase, setPhase] = useState<"idle" | "recording" | "checking">("idle");
  const [playing, setPlaying] = useState<"model" | "me" | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [finished, setFinished] = useState(false);

  const micRef = useRef<MicHandle | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCache = useRef<Record<string, string>>({});
  const urlsRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setDrill(null);
    setAttempts({});
    setIdx(0);
    setFinished(false);
    build({ data: { level, name } })
      .then((d) => !cancelled && setDrill(d))
      .catch(
        (e: unknown) =>
          !cancelled && setError(e instanceof Error ? e.message : "Erro ao preparar o treino."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [build, level, name, reload]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      micRef.current?.close();
      Object.values(ttsCache.current).forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const play = async (url: string, who: "model" | "me") => {
    audioRef.current?.pause();
    const el = new Audio(url);
    audioRef.current = el;
    setPlaying(who);
    el.onended = () => setPlaying(null);
    el.onerror = () => setPlaying(null);
    await el.play().catch(() => setPlaying(null));
  };

  const playModel = async (text: string) => {
    try {
      let url = ttsCache.current[text];
      if (!url) {
        setPlaying("model");
        const { audio, mimeType, error: voiceError } = await speak({ data: { text, accent } });
        if (!audio) {
          if (voiceError) setError(voiceError);
          await browserSpeak(text, "en");
          setPlaying(null);
          return;
        }
        const bin = atob(audio);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        ttsCache.current[text] = url;
      }

      await play(url, "model");
    } catch {
      setPlaying(null);
      setError("Não consegui tocar a voz do Alex agora.");
    }
  };

  const startRecording = async () => {
    setError("");
    audioRef.current?.pause();
    try {
      const { mic } = await openMic();
      micRef.current = mic;
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      // pára sozinho quando o aluno acaba a frase (ou com o botão)
      const { blob, speechMs } = await mic.capture({
        hangoverMs: 900,
        waitMs: 12000,
        maxMs: 20000,
        minSpeechMs: 250,
      });
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      mic.close();
      micRef.current = null;
      setPhase("checking");
      if (!blob || speechMs < 250) {
        setError("Quase não te ouvi. Chega o telemóvel mais perto e fala em voz alta.");
        setPhase("idle");
        return;
      }
      await evaluate(blob);
    } catch (e) {
      setPhase("idle");
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Preciso da permissão do microfone para te ouvir."
          : "Não consegui ligar o microfone.",
      );
    }
  };

  const stopRecording = () => {
    micRef.current?.abort();
  };

  const evaluate = async (blob: Blob) => {
    const task = drill?.tasks[idx];
    if (!task) return;
    try {
      const audio = await blobToBase64(blob);
      const { text: said } = await transcribe({
        data: { audio, mimeType: blob.type || "audio/wav" },
      });
      if (!said || said.trim().length < 2)
        throw new Error("Não apanhei o que disseste. Tenta outra vez, com calma.");
      const res = await score({
        data: { target: task.target, cue: task.cue, said, type: task.type, level },
      });
      const url = URL.createObjectURL(blob);
      urlsRef.current.push(url);
      setAttempts((a) => ({ ...a, [idx]: { said, ...res, audioUrl: url } }));
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falhou a avaliação da tua fala.");
      setPhase("idle");
    }
  };

  const tasks = drill?.tasks ?? [];
  const task = tasks[idx];
  const attempt = attempts[idx];
  const scores = Object.values(attempts).map((a) => a.score);
  const avg = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  const next = () => {
    if (idx + 1 < tasks.length) {
      setIdx(idx + 1);
      setError("");
      return;
    }
    setFinished(true);
    onFinish(avg, tasks.length);
  };

  const tone = (s: number) => (s >= 80 ? "text-green" : s >= 55 ? "text-gold" : "text-coral");

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-navy-deep/85 backdrop-blur-sm">
      <div className="mx-auto max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="min-w-0 truncate font-display text-lg font-bold">
            {drill?.title ?? "Speaking"}
          </h3>
          <button onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> O Alex está a preparar o teu treino de
            fala...
          </div>
        )}

        {error && !loading && <p className="mb-3 text-sm text-coral">{error}</p>}

        {!loading && !drill && (
          <button
            onClick={() => setReload((r) => r + 1)}
            className="flex items-center gap-2 rounded-2xl bg-green px-4 py-2.5 text-sm font-bold text-navy-deep"
          >
            <RotateCcw className="h-4 w-4" /> Tentar outra vez
          </button>
        )}

        {drill && !finished && task && (
          <div className="flex flex-col gap-4 pb-4">
            <div className="flex items-center gap-1.5">
              {tasks.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    attempts[i] ? "bg-green" : i === idx ? "bg-gold" : "bg-secondary"
                  }`}
                />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{drill.intro}</p>

            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-blue">
                {task.type === "answer" ? "Responde em inglês" : "Repete em voz alta"}
              </p>
              {task.type === "answer" && task.cue && (
                <p className="mt-2 font-display text-base font-bold">{task.cue}</p>
              )}
              <p className="mt-2 font-display text-lg font-extrabold leading-snug">
                {task.type === "answer" ? `Ex.: ${task.target}` : task.target}
              </p>
              {task.translation && (
                <p className="mt-1 text-xs text-muted-foreground">{task.translation}</p>
              )}
              {task.tip && <p className="mt-2 text-xs text-gold">Dica: {task.tip}</p>}
              <button
                onClick={() => void playModel(task.type === "answer" ? task.cue || task.target : task.target)}
                className="mt-3 flex items-center gap-2 rounded-2xl bg-blue/15 px-4 py-2.5 text-sm font-bold text-blue"
              >
                {playing === "model" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                Ouvir o Alex
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
              <button
                onClick={() => (phase === "recording" ? stopRecording() : void startRecording())}
                disabled={phase === "checking"}
                aria-label={phase === "recording" ? "Parar de gravar" : "Gravar a tua voz"}
                className={`grid h-24 w-24 place-items-center rounded-full border-2 transition-all disabled:opacity-60 ${
                  phase === "recording" ? "border-coral bg-coral/20" : "border-green bg-green/15"
                }`}
                style={
                  phase === "recording"
                    ? { animation: "orb-fast 1s ease-in-out infinite" }
                    : undefined
                }
              >
                {phase === "checking" ? (
                  <Loader2 className="h-8 w-8 animate-spin text-gold" />
                ) : phase === "recording" ? (
                  <Square className="h-7 w-7 text-coral" />
                ) : (
                  <Mic className="h-8 w-8 text-green" />
                )}
              </button>
              <p className="text-xs text-muted-foreground">
                {phase === "recording"
                  ? `A gravar... ${seconds}s — toca para parar`
                  : phase === "checking"
                    ? "O Alex está a ouvir-te..."
                    : attempt
                      ? "Podes tentar outra vez para melhorar"
                      : "Toca no microfone e diz em voz alta"}
              </p>
            </div>

            {attempt && (
              <div className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Nota da tua fala</p>
                  <p className={`font-display text-2xl font-extrabold ${tone(attempt.score)}`}>
                    {attempt.score}%
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-navy-deep/50">
                  <div
                    className="h-full rounded-full bg-goldgrad transition-all"
                    style={{ width: `${attempt.score}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Ouvi: “{attempt.said}”</p>
                <p className="text-sm leading-relaxed">{attempt.feedback}</p>
                {attempt.better && (
                  <p className="text-sm font-semibold text-green">Melhor assim: {attempt.better}</p>
                )}
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    onClick={() => void play(attempt.audioUrl, "me")}
                    className="flex items-center gap-1.5 rounded-2xl border border-border px-3 py-2 text-xs font-bold"
                  >
                    <Play className="h-3.5 w-3.5" /> {playing === "me" ? "A tocar..." : "Ouvir-me"}
                  </button>
                  <button
                    onClick={() => void playModel(attempt.better || task.target)}
                    className="flex items-center gap-1.5 rounded-2xl border border-border px-3 py-2 text-xs font-bold"
                  >
                    <Volume2 className="h-3.5 w-3.5" /> Comparar com o Alex
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={next}
              disabled={!attempt || phase !== "idle"}
              className="rounded-2xl bg-green px-5 py-3.5 text-sm font-bold text-navy-deep disabled:opacity-50"
            >
              {idx + 1 < tasks.length ? "Próxima frase" : "Ver resultado"}
            </button>
          </div>
        )}

        {finished && (
          <div className="flex flex-col gap-3 pb-4">
            <div className="rounded-2xl bg-hero p-5 text-center">
              <p className="font-display text-3xl font-extrabold">{avg}%</p>
              <p className="mt-1 text-xs opacity-80">
                {avg >= 80
                  ? "Boa, meu mano! A tua fala está a soar bem."
                  : avg >= 55
                    ? "Tá-se bem, continua a treinar a pronúncia."
                    : "Calma, fala devagar e repete mais vezes que tu chegas lá."}
              </p>
            </div>
            {tasks.map((t, i) =>
              attempts[i] ? (
                <div key={i} className="rounded-2xl border border-border bg-secondary p-3">
                  <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span className="min-w-0 truncate">{t.target}</span>
                    <span className={`shrink-0 ${tone(attempts[i].score)}`}>
                      {attempts[i].score}%
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{attempts[i].feedback}</p>
                </div>
              ) : null,
            )}
            <button
              onClick={() => setReload((r) => r + 1)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-green px-5 py-3.5 text-sm font-bold text-navy-deep"
            >
              <RotateCcw className="h-4 w-4" /> Novo treino de fala
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-bold"
            >
              <Check className="h-4 w-4" /> Terminar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
