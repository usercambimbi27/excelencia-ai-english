// Estado local de acesso e tema (só no navegador; ler apenas após hidratação).
export type SchoolId = "excelencia" | "fisk" | "prime" | "none";

export const SCHOOLS: { id: Exclude<SchoolId, "none">; name: string; tagline: string }[] = [
  { id: "excelencia", name: "Excelência", tagline: "Grupo Educacional" },
  { id: "fisk", name: "FISK", tagline: "Centro de Ensino" },
  { id: "prime", name: "PRIME", tagline: "Formação e Transformação" },
];

const KEY = "exc.k";
const UNLOCK = "exc.u";
const SCHOOL = "exc.school";
const EVT = "exc-access-change";

const ls = () => (typeof window === "undefined" ? null : window.localStorage);

export const getUserKey = () => ls()?.getItem(KEY) ?? "";
export const setUserKey = (k: string) => {
  if (k) ls()?.setItem(KEY, k);
  else ls()?.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
};
export const isUnlocked = () => ls()?.getItem(UNLOCK) === "1";
export const setUnlocked = (v: boolean) => {
  if (v) ls()?.setItem(UNLOCK, "1");
  else ls()?.removeItem(UNLOCK);
  window.dispatchEvent(new Event(EVT));
};
export const getSchool = (): SchoolId | null => (ls()?.getItem(SCHOOL) as SchoolId | null) ?? null;
export const setSchool = (s: SchoolId) => {
  ls()?.setItem(SCHOOL, s);
  applySchoolTheme(s);
  window.dispatchEvent(new Event(EVT));
};
export function applySchoolTheme(s: SchoolId | null) {
  const el = document.documentElement;
  el.classList.remove("theme-excelencia", "theme-fisk", "theme-prime");
  if (s && s !== "none") el.classList.add(`theme-${s}`);
}
export const onAccessChange = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
};
