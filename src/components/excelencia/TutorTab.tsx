import { useState } from "react";
import { Loader2, Sparkles, GraduationCap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateLesson } from "@/lib/excelencia/groq.functions";
import type { AppStore } from "@/lib/excelencia/state";

const temas = [
  "Apresentar-me a alguém",
  "No mercado do Kikolo",
  "Apanhar um candongueiro",
  "Entrevista de emprego",
  "Falar do fim-de-semana",
  "Pedir comida num restaurante",
];

export function TutorTab({ store }: { store: AppStore }) {
  const { state, update, addXp } = store;
  const run = useServerFn(generateLesson);
  const [tema, setTema] = useState("");
  const [lesson, setLesson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const start = async (t: string) => {
    const topic = t.trim();
    if (!topic || loading) return;
    setTema(topic);
    setLoading(true);
    setError("");
    setLesson("");
    try {
      const { text } = await run({ data: { level: state.level, topic, name: state.name } });
      setLesson(text);
      addXp(20);
      update((s) => ({
        lessonsDone: s.lessonsDone + 1,
        minutes: s.minutes + 5,
        skills: { ...s.skills, grammar: Math.min(100, s.skills.grammar + 2) },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui preparar a aula.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-28 pt-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Tutor AI</h1>
        <p className="text-sm text-muted-foreground">
          Aulas guiadas pelo Alex, feitas à medida do teu nível {state.level}.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void start(tema)}
          placeholder="Sobre o que queres a aula?"
          className="min-w-0 flex-1 rounded-2xl border border-input bg-secondary px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => void start(tema)}
          disabled={loading || !tema.trim()}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-green text-navy-deep disabled:opacity-50"
          aria-label="Gerar aula"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {temas.map((t) => (
          <button
            key={t}
            onClick={() => void start(t)}
            className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold"
          >
            {t}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> O Alex está a montar a aula...
        </div>
      )}
      {error && <p className="text-sm text-coral">{error}</p>}

      {lesson && (
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-gold">
            <GraduationCap className="h-4 w-4" />
            <p className="font-display text-sm font-bold">Aula: {tema}</p>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{lesson}</p>
        </article>
      )}
    </div>
  );
}
