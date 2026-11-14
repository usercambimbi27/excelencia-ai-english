export type TalkLang = "pt" | "en";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const PT_RE =
  /\b(fala|falar|fale|speak|switch|muda|mudar|volta|voltar|responde|responder)\b[^.?!]{0,30}\b(portugues|portuguese|pt)\b/;
const EN_RE =
  /\b(fala|falar|fale|speak|switch|muda|mudar|responde|responder|let'?s speak|talk)\b[^.?!]{0,30}\b(ingles|english|en)\b/;

/** Deteta pedidos do tipo "Alex fala português" / "Alex, speak English". */
export function detectLangSwitch(text: string): TalkLang | null {
  const t = norm(text);
  if (PT_RE.test(t)) return "pt";
  if (EN_RE.test(t)) return "en";
  return null;
}

export const langLabel = (lang: TalkLang) => (lang === "pt" ? "português" : "inglês");
