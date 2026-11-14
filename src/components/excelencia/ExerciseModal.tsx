import { useEffect, useRef, useState } from "react";
import { X, Loader2, Check, RotateCcw, Volume2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateExercise, speakWithGroq, type Exercise } from "@/lib/excelencia/groq.functions";
import { browserSpeak } from "@/lib/excelencia/speech-fallback";
import type { Accent, Level } from "@/lib/excelencia/state";


export function ExerciseModal({
  tipo,
  label,
  level,
  accent = "angolano",
  onClose,
  onFinish,
}: {
  tipo: string;
  label: string;
  level: Level;
  accent?: Accent;
  onClose: () => void;
  onFinish: (correct: number, total: number) => void;
}) {
  const run = useServerFn(generateExercise);
  const speak = useServerFn(speakWithGroq);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Record<string, string>>({});
  const [playing, setPlaying] = useState<number | null>(null);

  const playAudio = async (index: number, text: string) => {
    audioRef.current?.pause();
    setPlaying(index);
    try {
      let url = cacheRef.current[text];
      if (!url) {
        const { audio, mimeType } = await speak({ data: { text, accent } });
        if (!audio) {
          await browserSpeak(text, "en");
          setPlaying(null);
          return;
        }
        const bin = atob(audio);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        cacheRef.current[text] = url;
      }

      const el = new Audio(url);
      audioRef.current = el;
      el.onended = () => setPlaying(null);
      el.onerror = () => setPlaying(null);
      await el.play();
    } catch {
      setPlaying(null);
    }
  };

  useEffect(
    () => () => {
      audioRef.current?.pause();
      Object.values(cacheRef.current).forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setExercise(null);
    setAnswers({});
    setDone(false);
    run({ data: { level, tipo } })
      .then((ex) => !cancelled && setExercise(ex))
      .catch((e: unknown) =>
        !cancelled && setError(e instanceof Error ? e.message : "Erro ao gerar o exercício."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [level, reload, run, tipo]);

  const total = exercise?.questions.length ?? 0;
  const correct = exercise
    ? exercise.questions.filter((q, i) => answers[i] === q.answer).length
    : 0;
  const answered = Object.keys(answers).length;

  const finish = () => {
    setDone(true);
    onFinish(correct, total);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-navy-deep/80 backdrop-blur-sm">
      <div className="mx-auto max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="min-w-0 truncate font-display text-lg font-bold">
            {exercise?.title ?? label}
          </h3>
          <button onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> O Alex está a preparar o teu exercício...
          </div>
        )}

        {error && (
          <div className="space-y-3 py-6">
            <p className="text-sm text-coral">{error}</p>
            <button
              onClick={() => setReload((r) => r + 1)}
              className="flex items-center gap-2 rounded-2xl bg-green px-4 py-2.5 text-sm font-bold text-navy-deep"
            >
              <RotateCcw className="h-4 w-4" /> Tentar outra vez
            </button>
          </div>
        )}

        {exercise && (
          <div className="flex flex-col gap-5 pb-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{exercise.intro}</p>
            {exercise.questions.map((q, qi) => (
              <div key={qi} className="flex flex-col gap-2">
                {q.audioText && (
                  <button
                    onClick={() => void playAudio(qi, q.audioText!)}
                    className="flex items-center gap-2 self-start rounded-2xl bg-blue/15 px-4 py-2.5 text-sm font-bold text-blue"
                  >
                    {playing === qi ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                    {playing === qi ? "A tocar..." : "Ouvir frase"}
                  </button>
                )}
                <p className="text-sm font-semibold">
                  {qi + 1}. {q.question}
                </p>

                {q.options.map((opt, oi) => {
                  const picked = answers[qi] === oi;
                  const reveal = done;
                  const isRight = oi === q.answer;
                  return (
                    <button
                      key={oi}
                      disabled={done}
                      onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                      className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm ${
                        reveal && isRight
                          ? "border-green bg-green/15 text-green"
                          : reveal && picked
                            ? "border-coral bg-coral/15 text-coral"
                            : picked
                              ? "border-gold bg-gold/10"
                              : "border-border bg-secondary"
                      }`}
                    >
                      <span>{opt}</span>
                      {reveal && isRight && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
                {done && <p className="text-xs text-muted-foreground">{q.explanation}</p>}
              </div>
            ))}

            {!done ? (
              <button
                onClick={finish}
                disabled={answered < total}
                className="rounded-2xl bg-green px-5 py-3.5 text-sm font-bold text-navy-deep disabled:opacity-50"
              >
                {answered < total ? `Responde às ${total} perguntas` : "Ver resultado"}
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl bg-hero p-4 text-center">
                  <p className="font-display text-2xl font-extrabold">
                    {correct}/{total}
                  </p>
                  <p className="text-xs opacity-80">
                    {correct === total
                      ? "Boa, meu mano! Tudo certo."
                      : correct >= total / 2
                        ? "Tá-se bem, mas dá para melhorar."
                        : "Calma, treina mais um bocado que tu chegas lá."}
                  </p>
                </div>
                <button
                  onClick={() => setReload((r) => r + 1)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-bold"
                >
                  <RotateCcw className="h-4 w-4" /> Novo exercício
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
