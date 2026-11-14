import { useRef, useState } from "react";
import { ChevronLeft, GraduationCap, Sparkles } from "lucide-react";
import type { Accent, Level } from "@/lib/excelencia/state";
import { SCHOOLS, applySchoolTheme, type SchoolId } from "@/lib/excelencia/access";

const levels: { id: Level; title: string; desc: string }[] = [
  { id: "A1", title: "A1 · Iniciante", desc: "Estou a começar do zero" },
  { id: "A2", title: "A2 · Básico", desc: "Digo frases simples do dia-a-dia" },
  { id: "B1", title: "B1 · Intermédio", desc: "Já converso, mas com erros" },
  { id: "B2", title: "B2 · Avançado", desc: "Falo bem, quero fluência total" },
];

const accents: { id: Accent; title: string; desc: string; flag: string }[] = [
  { id: "angolano", title: "Angolano", desc: "Voz próxima, à nossa maneira", flag: "🇦🇴" },
  { id: "britanico", title: "Britânico", desc: "Inglês do Reino Unido", flag: "🇬🇧" },
  { id: "americano", title: "Americano", desc: "Inglês dos Estados Unidos", flag: "🇺🇸" },
];

const TOTAL = 4;

export function Onboarding({
  onDone,
}: {
  onDone: (name: string, level: Level, accent: Accent, school: SchoolId) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("A1");
  const [accent, setAccent] = useState<Accent>("angolano");
  const [school, setSchool] = useState<SchoolId | null>(null);
  const touchX = useRef<number | null>(null);

  const canNext = step === 0 ? name.trim().length > 0 : step === 3 ? school !== null : true;
  const go = (n: number) => {
    if (n < 0 || n >= TOTAL) return;
    if (n > step && !canNext) return;
    setStep(n);
  };
  const pickSchool = (s: SchoolId) => {
    setSchool(s);
    applySchoolTheme(s); // pré-visualização das cores
  };
  const finish = () => {
    if (!school) return;
    onDone(name.trim(), level, accent, school);
  };

  const optionCls = (active: boolean) =>
    `rounded-2xl border p-4 text-left transition ${
      active ? "border-primary bg-primary/15" : "border-border bg-card hover:border-primary/40"
    }`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col overflow-hidden py-8">
      {/* topo: voltar + indicadores */}
      <div className="flex items-center gap-3 px-6">
        <button
          onClick={() => go(step - 1)}
          aria-label="Voltar"
          className={`grid h-9 w-9 place-items-center rounded-full bg-secondary transition ${
            step === 0 ? "pointer-events-none opacity-0" : ""
          }`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-1 justify-center gap-2">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : i < step ? "w-2 bg-primary/60" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="w-9 text-right text-xs text-muted-foreground">
          {step + 1}/{TOTAL}
        </span>
      </div>

      {/* carrossel */}
      <div
        className="flex-1 overflow-hidden"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (dx < -50) go(step + 1);
          else if (dx > 50) go(step - 1);
        }}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          {/* 1 — nome */}
          <section className="flex w-full shrink-0 flex-col justify-center gap-6 px-6 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-goldgrad shadow-soft">
              <GraduationCap className="h-10 w-10 text-navy-deep" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold leading-tight">Excelência AI English</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                O teu professor de inglês angolano, sempre no bolso. Conversa com o Alex, ganha XP e
                fala inglês com confiança.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-left">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Qual é o teu nome?
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && go(1)}
                placeholder="O teu nome"
                className="mt-2 w-full rounded-xl border border-input bg-secondary px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </section>

          {/* 2 — nível */}
          <section className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto px-6 pt-6">
            <Header title="Em que nível está o teu inglês?" sub="Isto ajuda o Alex a falar contigo na medida certa." />
            <div className="flex flex-col gap-3">
              {levels.map((l) => (
                <button key={l.id} onClick={() => setLevel(l.id)} className={optionCls(level === l.id)}>
                  <p className="font-display text-base font-bold">{l.title}</p>
                  <p className="text-xs text-muted-foreground">{l.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* 3 — sotaque */}
          <section className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto px-6 pt-6">
            <Header title="Como preferes o sotaque do Alex?" sub="Escolhe a voz com que o Alex fala inglês contigo." />
            <div className="flex flex-col gap-3">
              {accents.map((a) => (
                <button key={a.id} onClick={() => setAccent(a.id)} className={`${optionCls(accent === a.id)} flex items-center gap-4`}>
                  <span className="text-3xl">{a.flag}</span>
                  <span>
                    <p className="font-display text-base font-bold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.desc}</p>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 4 — escola */}
          <section className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto px-6 pt-6">
            <Header title="De qual escola és?" sub="Vamos adaptar as cores do app à tua escola." />
            <div className="flex flex-col gap-3">
              {SCHOOLS.map((s) => (
                <button key={s.id} onClick={() => pickSchool(s.id)} className={optionCls(school === s.id)}>
                  <p className="font-display text-lg font-bold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.tagline}</p>
                </button>
              ))}
              <button onClick={() => pickSchool("none")} className={optionCls(school === "none")}>
                <p className="font-display text-base font-bold">Nenhuma destas</p>
                <p className="text-xs text-muted-foreground">Usar o visual Excelência AI</p>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* botão principal */}
      <div className="px-6 pt-4">
        {step < TOTAL - 1 ? (
          <button
            onClick={() => go(step + 1)}
            disabled={!canNext}
            className="w-full rounded-2xl bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-soft transition active:scale-[0.98] disabled:opacity-50"
          >
            {step === 0 ? "Começar agora" : "Continuar"}
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={!canNext}
            className="w-full rounded-2xl bg-green px-6 py-4 text-sm font-bold text-navy-deep shadow-soft transition active:scale-[0.98] disabled:opacity-50"
          >
            Entrar na aula
          </button>
        )}
      </div>
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs text-gold">
        <Sparkles className="h-3 w-3" /> Podes mudar depois
      </span>
      <h2 className="mt-4 text-2xl font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}
