import { useCallback, useEffect, useState } from "react";
import type { TalkLang } from "./lang";

export const STORAGE_KEY = "excelencia_ai_state_v1";

export type Level = "A1" | "A2" | "B1" | "B2";
export type Accent = "angolano" | "britanico" | "americano";
export type { TalkLang };


export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
}

export interface AppState {
  onboarded: boolean;
  name: string;
  level: Level;
  lang: TalkLang;

  accent: Accent;
  xp: number;
  streak: number;
  lastActiveDay: string | null;
  missionsDone: string[];
  missionsDay: string | null;
  badges: string[];
  skills: { listening: number; speaking: number; reading: number; grammar: number };
  lessonsDone: number;
  minutes: number;
  messages: ChatMessage[];
}

export const defaultState: AppState = {
  onboarded: false,
  name: "",
  level: "A1",
  lang: "pt",

  accent: "angolano",
  xp: 0,
  streak: 0,
  lastActiveDay: null,
  missionsDone: [],
  missionsDay: null,
  badges: [],
  skills: { listening: 10, speaking: 10, reading: 10, grammar: 10 },
  lessonsDone: 0,
  minutes: 0,
  messages: [],
};

export const today = () => new Date().toISOString().slice(0, 10);

export const levelOf = (xp: number) => Math.floor(xp / 500) + 1;
export const xpInLevel = (xp: number) => xp % 500;

function applyDaily(s: AppState): AppState {
  const d = today();
  if (s.lastActiveDay === d) return s;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return {
    ...s,
    streak: s.lastActiveDay === yesterday ? s.streak + 1 : 1,
    lastActiveDay: d,
    missionsDone: s.missionsDay === d ? s.missionsDone : [],
    missionsDay: d,
  };
}

export function useAppState() {
  const [state, setState] = useState<AppState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let loaded = defaultState;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = { ...defaultState, ...(JSON.parse(raw) as Partial<AppState>) };
    } catch {
      /* ignore corrupt state */
    }
    setState(applyDaily(loaded));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked */
    }
  }, [state, hydrated]);

  const update = useCallback((patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  const addXp = useCallback((amount: number) => {
    setState((s) => {
      const xp = s.xp + amount;
      const badges = [...s.badges];
      if (xp >= 100 && !badges.includes("first100")) badges.push("first100");
      if (xp >= 1000 && !badges.includes("mil")) badges.push("mil");
      if (s.streak >= 3 && !badges.includes("streak3")) badges.push("streak3");
      if (s.streak >= 7 && !badges.includes("streak7")) badges.push("streak7");
      return { ...s, xp, badges };
    });
  }, []);

  const completeMission = useCallback(
    (id: string, xp: number) => {
      setState((s) =>
        s.missionsDone.includes(id) ? s : { ...s, missionsDone: [...s.missionsDone, id] },
      );
      addXp(xp);
    },
    [addXp],
  );

  const reset = useCallback(() => setState({ ...defaultState }), []);

  return { state, hydrated, update, addXp, completeMission, reset };
}

export type AppStore = ReturnType<typeof useAppState>;
