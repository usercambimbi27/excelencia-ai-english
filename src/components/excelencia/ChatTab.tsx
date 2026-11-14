import { useEffect, useRef, useState } from "react";
import { Send, AudioLines, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import type { AppStore, ChatMessage } from "@/lib/excelencia/state";
import { detectLangSwitch, langLabel } from "@/lib/excelencia/lang";
import { chatWithAlex } from "@/lib/excelencia/groq.functions";
import { VoiceCall } from "./VoiceCall";


const uid = () => Math.random().toString(36).slice(2);

export function ChatTab({ store }: { store: AppStore }) {
  const { state, update, addXp, completeMission } = store;
  const sendToAlex = useServerFn(chatWithAlex);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voice, setVoice] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const messages = state.messages;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const pushExchange = (userText: string, alexText: string) => {
    update((s) => ({
      messages: [
        ...s.messages,
        { id: uid(), role: "user", text: userText } as ChatMessage,
        { id: uid(), role: "model", text: alexText } as ChatMessage,
      ],
      minutes: s.minutes + 1,
      skills: { ...s.skills, speaking: Math.min(100, s.skills.speaking + 2) },
    }));
    addXp(10);
    if (messages.length + 2 >= 10) completeMission("chat5", 30);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    const switched = detectLangSwitch(text);
    const lang = switched ?? state.lang;
    if (switched && switched !== state.lang) update({ lang: switched });
    const userMsg: ChatMessage = { id: uid(), role: "user", text };
    update((s) => ({ messages: [...s.messages, userMsg] }));
    setLoading(true);
    try {
      const { text: answer } = await sendToAlex({
        data: {
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          text,
          level: state.level,
          name: state.name,
          voice: false,
          lang,
        },
      });
      update((s) => ({
        messages: [...s.messages, { id: uid(), role: "model", text: answer }],
        skills: { ...s.skills, reading: Math.min(100, s.skills.reading + 1) },
      }));
      addXp(10);
      if (messages.length + 2 >= 10) completeMission("chat5", 30);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na conversa");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-navy/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-goldgrad font-display font-extrabold text-navy-deep">
            A
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold">Alex</p>
            <p className="truncate text-xs text-green">
              Professor de inglês · a falar {langLabel(state.lang)}
            </p>

          </div>
        </div>
        <button
          onClick={() => setVoice(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          <AudioLines className="h-4 w-4" /> Voz
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4 pb-28">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed">
            Epá, tudo bem? Sou o Alex, teu professor de inglês. Diz-me lá, o que queres treinar
            hoje?
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user"
                ? "self-end bg-primary text-primary-foreground"
                : "self-start border border-border bg-card"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="self-start rounded-2xl border border-border bg-card px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-xs text-coral">{error}</p>}
        <div ref={endRef} />
      </div>

      <div className="fixed inset-x-0 bottom-[64px] z-20 border-t border-border bg-navy/95 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] items-end gap-2 px-3 py-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Escreve para o Alex..."
            className="min-w-0 flex-1 rounded-2xl border border-input bg-secondary px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={send}
            disabled={loading}
            aria-label="Enviar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-green text-navy-deep disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      {voice && (
        <VoiceCall
          onClose={() => setVoice(false)}
          level={state.level}
          name={state.name}
          accent={state.accent}
          lang={state.lang}
          onLangChange={(lang) => update({ lang })}
          history={messages}

          onExchange={(u, a) => {
            pushExchange(u, a);
            completeMission("voice1", 50);
          }}
        />
      )}

    </div>
  );
}
