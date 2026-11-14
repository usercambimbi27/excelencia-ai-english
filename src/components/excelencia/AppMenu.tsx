import { useEffect, useState } from "react";
import { Menu, Lock, Palette, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SCHOOLS, getSchool, setSchool, getUserKey, setUserKey, isUnlocked, setUnlocked,
  onAccessChange, type SchoolId,
} from "@/lib/excelencia/access";
import { verifyUnlock, validateGroqKey } from "@/lib/excelencia/access.functions";

export function AppMenu() {
  const [school, setSchoolState] = useState<SchoolId | null>(null);
  const [unlocked, setUnlockedState] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState(false);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const unlock = useServerFn(verifyUnlock);
  const validate = useServerFn(validateGroqKey);

  useEffect(() => {
    const sync = () => {
      setSchoolState(getSchool());
      setUnlockedState(isUnlocked());
      setHasKey(!!getUserKey());
    };
    sync();
    return onAccessChange(sync);
  }, []);

  const tryUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { ok } = await unlock({ data: { password: pw } });
    setBusy(false);
    setPwErr(!ok);
    if (ok) { setUnlocked(true); setPw(""); }
  };

  const saveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const r = await validate({ data: { key: key.trim() } }).catch(() => ({ ok: false, status: 0 }));
    setBusy(false);
    if (r.ok) { setUserKey(key.trim()); setKey(""); setMsg("Chave guardada. Já podes usar o app."); }
    else if (r.status === 429) setMsg("A Groq está em limite de pedidos. Tenta daqui a pouco.");
    else setMsg("Chave inválida. Confirma e cola outra vez.");
  };

  const current = SCHOOLS.find((s) => s.id === school);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button aria-label="Menu" className="fixed bottom-24 right-3 z-40 flex items-center gap-2 rounded-full bg-card/90 px-3 py-2 text-sm text-foreground shadow-soft backdrop-blur">
          {current && <span className="font-display font-semibold text-primary">{current.name}</span>}
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto bg-background text-foreground">
        <SheetHeader><SheetTitle className="text-foreground">Menu</SheetTitle></SheetHeader>

        <section className="mt-6 space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><Palette className="h-4 w-4" /> Personalizar interface</h3>
          <p className="text-sm text-muted-foreground">És aluno de alguma destas escolas?</p>
          {[...SCHOOLS, { id: "none" as const, name: "Nenhuma destas", tagline: "Tema Excelência AI" }].map((s) => (
            <button key={s.id} onClick={() => setSchool(s.id)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left">
              <span><span className="block font-semibold">{s.name}</span><span className="text-xs text-muted-foreground">{s.tagline}</span></span>
              {school === s.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </section>

        <section className="mt-8 space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" /> Palavra-passe</h3>
          {!unlocked ? (
            <form onSubmit={tryUnlock} className="space-y-2">
              <Input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setPwErr(false); }} autoComplete="off" />
              {pwErr && <p className="text-sm text-destructive">Palavra-passe incorreta</p>}
              <Button type="submit" disabled={busy || !pw} className="w-full">Entrar</Button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {hasKey ? "A tua chave Groq está ativa. Podes trocá-la abaixo." : "Cola a tua chave Groq para ativar o app."}
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                <li>Abre console.groq.com e entra com o teu email.</li>
                <li>Vai a "API Keys" e toca em "Create API Key".</li>
                <li>Copia a chave (começa por gsk_) e cola aqui.</li>
              </ol>
              <form onSubmit={saveKey} className="space-y-2">
                <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="gsk_..." autoComplete="off" />
                <Button type="submit" disabled={busy || key.trim().length < 10} className="w-full">Testar e guardar</Button>
              </form>
              {msg && <p className="text-sm">{msg}</p>}
              <div className="flex gap-2">
                {hasKey && <Button variant="outline" className="flex-1" onClick={() => setUserKey("")}>Remover chave</Button>}
                <Button variant="ghost" className="flex-1" onClick={() => setUnlocked(false)}>Bloquear</Button>
              </div>
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
