import { useCallback, useEffect, useRef, useState } from "react";
import { X, Mic, Loader2, PhoneOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  speakWithGroq,
  transcribeAudio,
  voiceTurn,
  stripSpeechTags,
} from "@/lib/excelencia/groq.functions";
import { openMic, type Mic as MicHandle } from "@/lib/excelencia/audio";
import { detectLangSwitch, langLabel, type TalkLang } from "@/lib/excelencia/lang";
import type { Accent, ChatMessage, Level } from "@/lib/excelencia/state";

type Orb = "idle" | "listening" | "thinking" | "speaking";

interface Turn {
  role: "user" | "model";
  text: string;
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não consegui ler o áudio."));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });

export function VoiceCall({
  onClose,
  level,
  name,
  accent = "angolano",
  lang = "pt",
  onLangChange,
  history,
  onExchange,
}: {
  onClose: () => void;
  level: Level;
  name: string;
  accent?: Accent;
  lang?: TalkLang;
  onLangChange?: (lang: TalkLang) => void;
  history: ChatMessage[];
  onExchange: (user: string, alex: string) => void;
}) {
  const transcribe = useServerFn(transcribeAudio);
  const turn = useServerFn(voiceTurn);
  const speak = useServerFn(speakWithGroq);

  const [orb, setOrb] = useState<Orb>("idle");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [active, setActive] = useState(false);

  const micRef = useRef<MicHandle | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  const turnsRef = useRef<Turn[]>([]);
  const langRef = useRef<TalkLang>(lang);
  /** frase do Alex que o aluno cortou a meio, para ele retomar só o que faltou */
  const interruptedRef = useRef("");


  const stopAll = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    setOrb("idle");
    micRef.current?.abort();
    micRef.current?.close();
    micRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();

  }, []);

  /** Voz de reserva do navegador, quando a Groq está em limite de pedidos. */
  const speakFallback = useCallback(async (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    setOrb("speaking");
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = langRef.current === "pt" ? "pt-PT" : "en-GB";
      u.rate = 0.95;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  }, []);

  /**
   * Voz do Alex gerada pela Groq, com barge-in.
   * Devolve true se a frase tocou até ao fim, false se o aluno a cortou a meio.
   */
  const playReply = useCallback(
    async (
      audioPromise: Promise<{ audio: string; mimeType: string; error?: string }>,
      text = "",
    ): Promise<boolean> => {
      let url = "";
      try {
        const { audio, mimeType, error: voiceError } = await audioPromise;
        if (!activeRef.current) return false;
        if (!audio) {
          if (voiceError) setError(voiceError);
          if (text) await speakFallback(text);
          return true;
        }
        const bin = atob(audio);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      } catch {
        setError("Não consegui gerar a voz do Alex. Continua a conversa por texto na chamada.");
        if (text) await speakFallback(text);
        return true;
      }
      setOrb("speaking");

      const el = new Audio(url);
      el.preload = "auto";
      audioRef.current = el;
      return await new Promise<boolean>((resolve) => {
        let finished = false;
        const end = (interrupted = false) => {
          if (finished) return;
          finished = true;
          el.pause();
          URL.revokeObjectURL(url);
          if (audioRef.current === el) audioRef.current = null;
          resolve(interrupted);
        };
        el.onended = () => end();
        el.onerror = () => end();
        void el.play().catch(() => end());
        // barge-in: só corta com fala clara e sustentada, para não reagir a ruído
        const mic = micRef.current;
        const bargeAt = Math.max(0.13, (mic?.floor() ?? 0.01) * 7);
        let loudFor = 0;
        let last = performance.now();
        const watch = () => {
          if (finished) return;
          if (!activeRef.current) return end();
          const now = performance.now();
          const dt = now - last;
          last = now;
          loudFor = (mic?.rms() ?? 0) > bargeAt ? loudFor + dt : 0;
          if (loudFor > 260) return end(true);
          requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
      });
    },
    [speakFallback],
  );


  const loop = useCallback(async () => {
    let emptyTurns = 0;
    let failures = 0;
    while (activeRef.current) {
      const mic = micRef.current;
      if (!mic) return;
      // deita fora o pré-buffer: senão a primeira coisa gravada é a voz do Alex
      mic.flush();
      setOrb("listening");
      const { blob, speechMs, reason } = await mic.capture({
        hangoverMs: 560,
        waitMs: 15000,
        maxMs: 25000,
        minSpeechMs: 300,
      });
      if (!activeRef.current || reason === "aborted") return;
      if (!blob || speechMs < 300) {
        emptyTurns += 1;
        setHint(
          emptyTurns > 1
            ? "Não te estou a ouvir bem — chega o telemóvel mais perto e fala normalmente."
            : "",
        );
        continue;
      }
      emptyTurns = 0;
      setHint("");
      setOrb("thinking");
      try {
        const audio = await blobToBase64(blob);
        const { text: said } = await transcribe({ data: { audio, mimeType: "audio/wav" } });
        const cleaned = said.trim();
        if (cleaned.length < 2 || /^[.\s?!,]*$/.test(cleaned)) {
          setHint("Não apanhei isso. Repete devagarinho, se faz favor.");
          continue;
        }
        const switched = detectLangSwitch(cleaned);
        if (switched && switched !== langRef.current) {
          langRef.current = switched;
          onLangChange?.(switched);
        }
        setTurns((t) => {
          const next: Turn[] = [...t, { role: "user", text: cleaned }];
          turnsRef.current = next;
          return next;
        });
        // resposta em fluxo, à maneira do modo de voz do ChatGPT: cada frase sai
        // com a voz já pronta e se o aluno cortar a meio, o Alex memoriza o que
        // ficou por ouvir e retoma só isso na resposta seguinte
        const { text: reply, segments } = await turn({
          data: {
            history: [
              ...history.map((m) => ({ role: m.role, text: m.text })),
              ...turnsRef.current.map((t) => ({ role: t.role, text: t.text })),
            ].slice(-14),
            text: cleaned,
            level,
            name,
            lang: langRef.current,
            accent,
            interrupted: interruptedRef.current,
          },
        });
        interruptedRef.current = "";
        if (!activeRef.current) return;
        const shown = stripSpeechTags(reply);
        setTurns((t) => {
          const next: Turn[] = [...t, { role: "model", text: shown }];
          turnsRef.current = next;
          return next;
        });
        onExchange(cleaned, shown);
        failures = 0;
        setError("");
        for (let i = 0; i < segments.length && activeRef.current; i++) {
          const seg = segments[i];
          const played = await playReply(
            Promise.resolve({ audio: seg.audio, mimeType: seg.mimeType }),
            stripSpeechTags(seg.text),
          );
          if (!played) {
            // cortado a meio: o que ficou por ouvir vai para a próxima resposta
            interruptedRef.current = segments
              .slice(i)
              .map((s) => stripSpeechTags(s.text))
              .join(" ")
              .slice(0, 300);
            break;
          }
        }
      } catch (e) {
        // uma falha pontual (rede, limite de pedidos) não deve desligar a chamada
        failures += 1;
        const msg = e instanceof Error ? e.message : "Falhou a chamada com o Alex.";
        if (failures >= 3) {
          setError(msg);
          stopAll();
          return;
        }
        setHint(`${msg} Já volto — continua a falar.`);
        await new Promise((r) => setTimeout(r, 800 * failures));
      }
    }
  }, [
    accent,
    history,
    level,
    name,
    onExchange,
    onLangChange,
    playReply,
    stopAll,
    transcribe,
    turn,
  ]);


  const start = useCallback(async () => {
    setError("");
    setHint("");
    setOrb("thinking");
    try {
      const { mic } = await openMic();
      micRef.current = mic;
      activeRef.current = true;
      setActive(true);

      const greetingText =
        langRef.current === "pt"
          ? `Olá${name ? `, ${name}` : ""}. Tudo bem contigo? Diz-me lá, sobre o que queres conversar hoje?`
          : `Hello${name ? `, ${name}` : ""}. It is good to hear you. So, tell me, what would you like to talk about today?`;
      const greeting = speak({ data: { text: greetingText, accent, speed: 0.92 } });

      const heardGreeting = await playReply(greeting, greetingText);
      if (!heardGreeting) {
        // cortou o cumprimento a meio: o Alex retoma só o que ficou por ouvir
        interruptedRef.current = greetingText.slice(0, 300);
      }

      void loop();
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Preciso da permissão do microfone para conversarmos."
          : e instanceof Error && (e.name === "NotFoundError" || e.name === "DevicesNotFoundError")
            ? "Não encontrei microfone neste aparelho. Liga um auricular com microfone e tenta de novo."
            : e instanceof Error && e.name === "NotReadableError"
              ? "O microfone está ocupado por outra aplicação. Fecha-a e tenta de novo."
              : e instanceof Error
                ? e.message
                : "Não consegui ligar a chamada.",
      );
      stopAll();
    }
  }, [accent, loop, name, playReply, speak, stopAll]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => stopAll, [stopAll]);


  const labels: Record<Orb, string> = {
    idle: "Toca para ligar ao Alex",
    thinking: "O Alex está a pensar...",
    listening: "A ouvir-te...",
    speaking: "O Alex está a falar",
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy-deep">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col overflow-y-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-sm font-bold">Chamada com o Alex</p>
            <p className="text-xs text-muted-foreground">
              A falar {langLabel(lang)} · diz “Alex fala {lang === "pt" ? "inglês" : "português"}”
            </p>
          </div>

          <button
            onClick={() => {
              stopAll();
              onClose();
            }}
            aria-label="Fechar chamada"
          >
            <X className="h-6 w-6 text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
          <button
            onClick={() => (active ? stopAll() : void start())}
            className="relative grid h-56 w-56 place-items-center"
            aria-label={active ? "Terminar chamada" : "Ligar ao Alex"}
          >
            <span
              className={`absolute inset-0 rounded-full blur-2xl ${
                orb === "listening"
                  ? "bg-green/40"
                  : orb === "thinking"
                    ? "bg-gold/40"
                    : orb === "speaking"
                      ? "bg-blue/50"
                      : "bg-blue/20"
              }`}
              style={{
                animation:
                  orb === "listening"
                    ? "orb-fast 1s ease-in-out infinite"
                    : orb === "idle"
                      ? "orb-pulse 3s ease-in-out infinite"
                      : "orb-pulse 1.6s ease-in-out infinite",
              }}
            />
            <span
              className={`relative grid h-40 w-40 place-items-center rounded-full border-2 ${
                orb === "listening"
                  ? "border-green"
                  : orb === "thinking"
                    ? "border-gold"
                    : orb === "speaking"
                      ? "border-blue"
                      : "border-border"
              } bg-hero`}
            >
              {orb === "thinking" ? (
                <Loader2 className="h-10 w-10 animate-spin text-gold" />
              ) : (
                <Mic className="h-10 w-10 text-foreground" />
              )}
            </span>
          </button>

          <p className="text-sm text-muted-foreground">{labels[orb]}</p>
          {hint && <p className="-mt-6 text-center text-xs text-gold">{hint}</p>}

          {active && (
            <button
              onClick={stopAll}
              className="flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-navy-deep"
            >
              <PhoneOff className="h-4 w-4" /> Terminar chamada
            </button>
          )}

          {turns.length > 0 && (
            <div className="flex w-full flex-col gap-2">
              {turns.slice(-6).map((t, i) => (
                <p
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    t.role === "user"
                      ? "self-end bg-primary text-primary-foreground"
                      : "self-start border border-border bg-card"
                  }`}
                >
                  {t.text}
                </p>
              ))}
            </div>
          )}

          {error && <p className="text-center text-xs text-coral">{error}</p>}
        </div>
      </div>
    </div>
  );
}
