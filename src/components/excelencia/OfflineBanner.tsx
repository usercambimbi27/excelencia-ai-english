import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[env(safe-area-inset-top)]">
      <div className="mt-2 flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground shadow-lg">
        <WifiOff className="h-3.5 w-3.5" />
        Estás offline — o teu progresso fica guardado no telemóvel
      </div>
    </div>
  );
}
