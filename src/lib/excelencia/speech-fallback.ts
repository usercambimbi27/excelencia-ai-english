/** Voz de reserva do navegador, usada quando a voz da Groq não está disponível. */
export function browserSpeak(text: string, lang: "pt" | "en" = "en"): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "pt" ? "pt-PT" : "en-GB";
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}
