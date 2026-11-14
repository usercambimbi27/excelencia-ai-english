import { Home, MessageCircle, BarChart3, Trophy, Bot } from "lucide-react";

export type TabId = "home" | "chat" | "progress" | "ranking" | "tutor";

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "progress", label: "Progresso", icon: BarChart3 },
  { id: "ranking", label: "Ranking", icon: Trophy },
  { id: "tutor", label: "Tutor AI", icon: Bot },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-navy/95 backdrop-blur">
      <div className="mx-auto grid max-w-[480px] grid-cols-5 px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex flex-col items-center gap-1 py-2.5"
              aria-label={t.label}
            >
              <Icon
                className={`h-5 w-5 transition ${on ? "text-gold" : "text-muted-foreground"}`}
              />
              <span
                className={`text-[10px] font-semibold ${on ? "text-gold" : "text-muted-foreground"}`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
