const SW_URL = "/sw.js";

function isBlockedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;

  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const host = window.location.hostname;
  const blockedHost =
    host.startsWith("preview--") ||
    host.includes("preview") ||
    host.startsWith("beta.");
  if (blockedHost) return true;

  return new URLSearchParams(window.location.search).get("sw") === "off";
}

async function unregisterAppServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => {
        const url = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? "";
        return url.endsWith(SW_URL);
      })
      .map((registration) => registration.unregister()),
  );
}

export async function registerAppServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (isBlockedContext()) {
    await unregisterAppServiceWorkers();
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
  } catch {
    /* offline support unavailable */
  }
}
