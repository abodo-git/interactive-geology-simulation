import { useEffect, useState } from "react";
import { Home as HomeIcon, Layers, Flame, Activity, Globe2, BrainCircuit, BookOpenText, ScrollText, ShieldCheck, Volume2, VolumeX, Mountain } from "lucide-react";
import Home from "./components/Home";
import EarthLayers from "./components/EarthLayers";
import Volcano from "./components/Volcano";
import Earthquake from "./components/Earthquake";
import Plates from "./components/Plates";
import Quiz from "./components/Quiz";
import Glossary from "./components/Glossary";
import History from "./components/History";
import Safety from "./components/Safety";
import AIExpert from "./components/AIExpert";
import { initAudio, setMuted, isMuted } from "./audio";

export type PageId = "home" | "layers" | "volcano" | "quake" | "plates" | "quiz" | "glossary" | "history" | "safety";

const NAV: { id: PageId; label: string; icon: typeof Layers; accent: string }[] = [
  { id: "home", label: "الرئيسية", icon: HomeIcon, accent: "#e2e8f0" },
  { id: "layers", label: "طبقات الأرض", icon: Layers, accent: "#fb923c" },
  { id: "volcano", label: "البراكين", icon: Flame, accent: "#f97316" },
  { id: "quake", label: "الزلازل", icon: Activity, accent: "#ef4444" },
  { id: "plates", label: "الصفائح", icon: Globe2, accent: "#38bdf8" },
  { id: "quiz", label: "الاختبار", icon: BrainCircuit, accent: "#fbbf24" },
  { id: "glossary", label: "الموسوعة", icon: BookOpenText, accent: "#4ade80" },
  { id: "history", label: "الكوارث", icon: ScrollText, accent: "#c084fc" },
  { id: "safety", label: "السلامة", icon: ShieldCheck, accent: "#34d399" },
];

export default function App() {
  const [page, setPage] = useState<PageId>("home");
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => {
    const onFirst = () => initAudio();
    window.addEventListener("pointerdown", onFirst, { once: true });
    return () => window.removeEventListener("pointerdown", onFirst);
  }, []);

  const toggleMute = () => {
    const m = !muted;
    setMutedState(m);
    setMuted(m);
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-abyss">
      {/* شريط التنقل — سطح المكتب */}
      <nav className="fixed right-0 top-0 bottom-0 z-50 hidden w-[76px] flex-col items-center border-l border-white/[0.07] bg-[#0a0c11]/90 py-4 backdrop-blur-xl md:flex">
        <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-magma/15" style={{ boxShadow: "inset 0 0 0 1px rgba(249,115,22,.45), 0 0 24px rgba(249,115,22,.2)" }}>
          <Mountain className="size-5 text-magma" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto w-full px-2 py-1">
          {NAV.map((n) => {
            const on = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)} title={n.label}
                className={`group relative grid size-12 w-full place-items-center rounded-xl transition-all duration-200 cursor-pointer ${on ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}>
                <n.icon className="size-[18px] transition-transform duration-200 group-hover:scale-110" style={{ color: on ? n.accent : "#64748b" }} />
                {on && <span className="absolute right-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full" style={{ background: n.accent, boxShadow: `0 0 10px ${n.accent}` }} />}
                <span className={`mt-1 text-[8.5px] font-bold leading-none ${on ? "text-slate-200" : "text-slate-600"}`}>{n.label}</span>
              </button>
            );
          })}
        </div>
        <button onClick={toggleMute} title={muted ? "تشغيل الصوت" : "كتم الصوت"}
          className="mt-2 grid size-11 cursor-pointer place-items-center rounded-xl bg-white/[0.05] text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
          {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px] text-ember" />}
        </button>
      </nav>

      {/* شريط سفلي — الجوال */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-1 overflow-x-auto border-t border-white/[0.08] bg-[#0a0c11]/95 px-2 py-2 backdrop-blur-xl md:hidden">
        {NAV.map((n) => {
          const on = page === n.id;
          return (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-xl px-3 py-1.5 ${on ? "bg-white/[0.09]" : ""}`}>
              <n.icon className="size-[18px]" style={{ color: on ? n.accent : "#64748b" }} />
              <span className={`text-[9px] font-bold ${on ? "text-slate-200" : "text-slate-600"}`}>{n.label}</span>
            </button>
          );
        })}
        <button onClick={toggleMute} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-white/[0.05] text-slate-400">
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-ember" />}
        </button>
      </nav>

      {/* المحتوى */}
      <main className="h-full pb-[74px] md:pb-0 md:pr-[76px]">
        <div className="h-full p-3 md:p-5" key={page}>
          {page === "home" && <Home go={setPage} />}
          {page === "layers" && <EarthLayers />}
          {page === "volcano" && <Volcano />}
          {page === "quake" && <Earthquake />}
          {page === "plates" && <Plates />}
          {page === "quiz" && <Quiz />}
          {page === "glossary" && <Glossary />}
          {page === "history" && <History />}
          {page === "safety" && <Safety />}
        </div>
      </main>

      <AIExpert />
    </div>
  );
}
