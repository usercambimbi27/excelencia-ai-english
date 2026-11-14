import { SCHOOLS, setSchool } from "@/lib/excelencia/access";

export function SchoolPicker() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center gap-4 bg-background px-6">
      <h1 className="font-display text-2xl font-bold">És aluno de alguma destas escolas?</h1>
      <p className="text-sm text-muted-foreground">Vamos adaptar as cores do app à tua escola.</p>
      {SCHOOLS.map((s) => (
        <button key={s.id} onClick={() => setSchool(s.id)}
          className="rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-soft">
          <span className="block font-display text-lg font-bold">{s.name}</span>
          <span className="text-sm text-muted-foreground">{s.tagline}</span>
        </button>
      ))}
      <button onClick={() => setSchool("none")} className="py-3 text-sm text-muted-foreground underline">
        Não, nenhuma destas
      </button>
    </div>
  );
}
