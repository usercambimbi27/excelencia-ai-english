import { useEffect, useState } from "react";
import { getSchool, onAccessChange, type SchoolId } from "@/lib/excelencia/access";
import logoExcelencia from "@/assets/logo-excelencia.png";
import logoFisk from "@/assets/logo-fisk.png";
import logoPrime from "@/assets/logo-prime.png";

const schoolLogos: Partial<Record<SchoolId, string>> = {
  excelencia: logoExcelencia,
  fisk: logoFisk,
  prime: logoPrime,
};

function useSchool() {
  const [s, setS] = useState<SchoolId | null>(null);
  useEffect(() => {
    const sync = () => setS(getSchool());
    sync();
    return onAccessChange(sync);
  }, []);
  return s;
}
import { Flame, Zap, Target, BookOpen, Headphones, Mic, PenLine } from "lucide-react";
import type { AppStore } from "@/lib/excelencia/state";
import { levelOf, xpInLevel } from "@/lib/excelencia/state";
import { ExerciseModal } from "./ExerciseModal";
import { SpeakingDrill } from "./SpeakingDrill";

const missions = [
  { id: "chat5", label: "Trocar 5 mensagens com o Alex", xp: 30 },
  { id: "voice1", label: "Falar 1 minuto no modo voz", xp: 50 },
  { id: "exercise1", label: "Completar um exercício", xp: 40 },
];

const modules = [
  { id: "vocabulario", label: "Vocabulário", desc: "Palavras do dia-a-dia", icon: BookOpen, skill: "reading" as const },
  { id: "gramatica", label: "Gramática", desc: "Estruturas essenciais", icon: PenLine, skill: "grammar" as const },
  { id: "listening", label: "Listening", desc: "Treina o ouvido", icon: Headphones, skill: "listening" as const },
  { id: "speaking", label: "Speaking", desc: "Solta a língua", icon: Mic, skill: "speaking" as const },
];

export function HomeTab({ store, onOpenChat }: { store: AppStore; onOpenChat: () => void }) {
  const { state, update, addXp, completeMission } = store;
  const [open, setOpen] = useState<(typeof modules)[number] | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const school = useSchool();

  const finishSpeaking = (avg: number, tasks: number) => {
    if (!tasks) return;
    addXp(20 + Math.round((avg / 100) * 50));
    completeMission("exercise1", 40);
    update((s) => ({
      lessonsDone: s.lessonsDone + 1,
      minutes: s.minutes + 5,
      skills: {
        ...s.skills,
        speaking: Math.min(100, s.skills.speaking + Math.round((avg / 100) * 10) + 2),
        listening: Math.min(100, s.skills.listening + 2),
      },
    }));
  };

  const finishExercise = (correct: number, total: number) => {
    const mod = open;
    if (!mod) return;
    const ratio = total ? correct / total : 0;
    addXp(10 + Math.round(ratio * 40));
    completeMission("exercise1", 40);
    update((s) => ({
      lessonsDone: s.lessonsDone + 1,
      minutes: s.minutes + 3,
      skills: {
        ...s.skills,
        [mod.skill]: Math.min(100, s.skills[mod.skill] + Math.round(ratio * 8) + 2),
      },
    }));
  };

  const lvl = levelOf(state.xp);
  const pct = Math.round((xpInLevel(state.xp) / 500) * 100);


  return (
    <div className="flex flex-col gap-5 px-4 pb-28 pt-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Bem-vindo de volta</p>
          <h1 className="truncate font-display text-2xl font-extrabold">
            {state.name || "Estudante"} 👋
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-1.5">
          <Flame className="h-4 w-4 text-coral" />
          <span className="text-sm font-bold">{state.streak}</span>
        </div>
      </header>

      <section className="rounded-3xl bg-hero p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
              Nível {lvl} · {state.level}
            </p>
            <p className="font-display text-3xl font-extrabold">{state.xp} XP</p>
          </div>
          {school && schoolLogos[school] ? (
            <img
              src={schoolLogos[school]}
              alt={`Logótipo ${school}`}
              className="h-12 w-12 rounded-2xl bg-card object-contain"
            />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-goldgrad">
              <Zap className="h-6 w-6 text-navy-deep" />
            </div>
          )}
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-navy-deep/50">
          <div className="h-full rounded-full bg-goldgrad transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs opacity-80">
          Faltam {500 - xpInLevel(state.xp)} XP para o nível {lvl + 1}
        </p>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <Target className="h-4 w-4 text-green" /> Missões de hoje
        </h2>
        <div className="flex flex-col gap-2">
          {missions.map((m) => {
            const done = state.missionsDone.includes(m.id);
            return (
              <div
                key={m.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <p className={`truncate text-sm ${done ? "text-muted-foreground line-through" : ""}`}>
                  {m.label}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    done ? "bg-green/20 text-green" : "bg-secondary text-gold"
                  }`}
                >
                  {done ? "Feito" : `+${m.xp} XP`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg font-bold">Módulos de estudo</h2>
        <div className="grid grid-cols-2 gap-3">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => (m.id === "speaking" ? setSpeaking(true) : setOpen(m))}
                className="rounded-2xl border border-border bg-card p-4 text-left active:scale-[0.98]"
              >
                <Icon className="h-6 w-6 text-blue" />
                <p className="mt-3 font-display text-sm font-bold">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      <button
        onClick={onOpenChat}
        className="rounded-2xl bg-green px-5 py-4 text-sm font-bold text-navy-deep shadow-soft active:scale-[0.98]"
      >
        Conversar com o Alex
      </button>

      {open && (
        <ExerciseModal
          tipo={open.id}
          label={open.label}
          level={state.level}
          accent={state.accent}
          onClose={() => setOpen(null)}
          onFinish={finishExercise}
        />
      )}

      {speaking && (
        <SpeakingDrill
          level={state.level}
          name={state.name}
          accent={state.accent}
          onClose={() => setSpeaking(false)}
          onFinish={finishSpeaking}
        />
      )}

    </div>
  );
}
