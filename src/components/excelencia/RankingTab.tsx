const rows = [
  { name: "Nádia M.", xp: 4120, city: "Luanda" },
  { name: "Edvaldo K.", xp: 3890, city: "Benguela" },
  { name: "Yara S.", xp: 3410, city: "Huambo" },
  { name: "Kelson A.", xp: 2980, city: "Lubango" },
  { name: "Márcia D.", xp: 2610, city: "Cabinda" },
  { name: "Tiago F.", xp: 2240, city: "Luanda" },
  { name: "Ilda N.", xp: 1980, city: "Malanje" },
  { name: "Bruno C.", xp: 1705, city: "Namibe" },
];

export function RankingTab({ name, xp }: { name: string; xp: number }) {
  const me = { name: name || "Tu", xp, city: "Angola", me: true };
  const list = [...rows.map((r) => ({ ...r, me: false })), me].sort((a, b) => b.xp - a.xp);

  return (
    <div className="flex flex-col gap-4 px-4 pb-28 pt-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Ranking semanal</h1>
        <p className="text-sm text-muted-foreground">
          Classificação ilustrativa da comunidade Excelência desta semana.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-2">
        {list.map((r, i) => (
          <div
            key={`${r.name}-${i}`}
            className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3 ${
              r.me ? "bg-primary/20" : ""
            }`}
          >
            <span
              className={`text-center text-sm font-extrabold ${
                i === 0 ? "text-gold" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-coral" : "text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {r.name} {r.me && <span className="text-xs text-gold">(tu)</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{r.city}</p>
            </div>
            <span className="text-sm font-bold text-green">{r.xp} XP</span>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Ganha XP nas missões e nas conversas com o Alex para subires.
      </p>
    </div>
  );
}
