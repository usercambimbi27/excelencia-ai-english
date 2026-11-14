import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppMenu } from "@/components/excelencia/AppMenu";
import { SchoolPicker } from "@/components/excelencia/SchoolPicker";
import { applySchoolTheme, getSchool, onAccessChange, setSchool, type SchoolId } from "@/lib/excelencia/access";
import { useAppState } from "@/lib/excelencia/state";
import { Onboarding } from "@/components/excelencia/Onboarding";
import { BottomNav, type TabId } from "@/components/excelencia/BottomNav";
import { HomeTab } from "@/components/excelencia/HomeTab";
import { ChatTab } from "@/components/excelencia/ChatTab";
import { ProgressTab } from "@/components/excelencia/ProgressTab";
import { RankingTab } from "@/components/excelencia/RankingTab";
import { TutorTab } from "@/components/excelencia/TutorTab";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Excelência AI English — Professor de inglês para angolanos" },
      {
        name: "description",
        content:
          "Aprende inglês com o Alex, professor angolano com inteligência artificial. Conversa por texto ou voz, ganha XP e sobe de nível.",
      },
      { property: "og:title", content: "Excelência AI English" },
      {
        property: "og:description",
        content: "O teu professor de inglês angolano com IA: chat, modo voz, missões e ranking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
  ssr: false,
});

function App() {
  const store = useAppState();
  const [tab, setTab] = useState<TabId>("home");
  const [school, setSchoolState] = useState<SchoolId | null | undefined>(undefined);
  useEffect(() => {
    const sync = () => {
      const s = getSchool();
      setSchoolState(s);
      applySchoolTheme(s);
    };
    sync();
    return onAccessChange(sync);
  }, []);

  if (!store.hydrated || school === undefined) {
    return <div className="min-h-dvh bg-background" />;
  }

  if (!store.state.onboarded) {
    return (
      <Onboarding
        onDone={(name, level, accent, chosen) => {
          setSchool(chosen);
          store.update({ name, level, accent, onboarded: true });
        }}
      />
    );
  }

  if (school === null) return <SchoolPicker />;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-background">
      {tab === "home" && <HomeTab store={store} onOpenChat={() => setTab("chat")} />}
      {tab === "chat" && <ChatTab store={store} />}
      {tab === "progress" && <ProgressTab store={store} />}
      {tab === "ranking" && (
        <RankingTab name={store.state.name} xp={store.state.xp} />
      )}
      {tab === "tutor" && <TutorTab store={store} />}
      <AppMenu />
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
