import { useEffect, useState } from "react";
import { Download, Share, X, Plus } from "lucide-react";

const DISMISS_KEY = "excelencia_install_dismissed_v1";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage blocked */
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      timer = setTimeout(() => {
        setShowIos(true);
        setHidden(false);
      }, 2500);
    }

    const onInstalled = () => setHidden(true);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setHidden(true);
  };

  if (hidden || (!deferred && !showIos)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3">
      <div className="mx-auto flex max-w-[480px] items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-goldgrad text-navy-deep">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold">Instala o Excelência AI</p>
          {deferred ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Fica com o ícone no telemóvel e abre mais depressa, mesmo sem net.
              </p>
              <button
                onClick={install}
                className="mt-3 w-full rounded-xl bg-green px-4 py-2.5 text-xs font-bold text-navy-deep active:scale-[0.98]"
              >
                Instalar agora
              </button>
            </>
          ) : (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs leading-relaxed text-muted-foreground">
              No iPhone, toca em
              <Share className="inline h-3.5 w-3.5 text-foreground" />
              <span className="font-semibold text-foreground">Partilhar</span>e depois em
              <Plus className="inline h-3.5 w-3.5 text-foreground" />
              <span className="font-semibold text-foreground">Adicionar ao ecrã principal</span>.
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
