import { Award, Clock, Flame, GraduationCap } from "lucide-react";
import type { AppStore } from "@/lib/excelencia/state";
import { levelOf } from "@/lib/excelencia/state";

const allBadges = [
  { id: "first100", label: "Primeiros 100 XP", emoji: "🌱" },
  { id: "streak3", label: "3 dias seguidos", emoji: "🔥" },
  { id: "streak7", label: "Semana completa", emoji: "🏅" },
  { id: "mil", label: "1000 XP", emoji: "💎" },
];

const skillLabels: Record<string, string> = {
  listening: "Listening",
  speaking: "Speaking",
  reading: "Reading",
  grammar: "Grammar",
};

export function ProgressTab({ store }: { store: AppStore }) {
  const { state } = store;
  const stats = [
    { icon: Flame, label: "Streak", value: `${state.streak} dias`, color: "text-coral" },
    { icon: GraduationCap, label: "Nível", value: `${levelOf(state.xp)}`, color: "text-gold" },
    { icon: Clock, label: "Minutos", value: `${state.minutes}`, color: "text-blue" },
    { icon: Award, label: "Badges", value: `${state.badges.length}`, color: "text-green" },
  ];

  return (
    <div className="flex flex-col gap-5 px-4 pb-28 pt-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">O teu progresso</h1>
        <p className="text-sm text-muted-foreground">Nível declarado: {state.level}</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
              <Icon className={`h-5 w-5 ${s.color}`} />
              <p className="mt-2 font-display text-xl font-extrabold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Competências</h2>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          {Object.entries(state.skills).map(([key, value]) => (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold">{skillLabels[key] ?? key}</span>
                <span className="text-muted-foreground">{Math.min(100, value)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-hero"
                  style={{ width: `${Math.min(100, value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Badges</h2>
        <div className="grid grid-cols-2 gap-3">
          {allBadges.map((b) => {
            const won = state.badges.includes(b.id);
            return (
              <div
                key={b.id}
                className={`rounded-2xl border p-4 text-center ${
                  won ? "border-gold/60 bg-gold/10" : "border-border bg-card opacity-50"
                }`}
              >
                <p className="text-2xl">{b.emoji}</p>
                <p className="mt-1 text-xs font-semibold">{b.label}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
