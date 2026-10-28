import { useState } from "react";
import { ShieldCheck, CheckCircle2, Ban, ClipboardList, Siren, HeartPulse, Flame, Activity } from "lucide-react";
import { quakeSafety, volcanoSafety } from "../data/content";
import { PageHeader } from "./ui";

const iconMap: Record<string, typeof ClipboardList> = { clipboard: ClipboardList, alert: Siren, shield: HeartPulse };

export default function Safety() {
  const [mode, setMode] = useState<"quake" | "volcano">("quake");
  const data = mode === "quake" ? quakeSafety : volcanoSafety;
  const accent = mode === "quake" ? "#ef4444" : "#f97316";

  return (
    <div className="anim-page h-full overflow-y-auto">
      <PageHeader icon={ShieldCheck} title="دليل السلامة والوقاية" sub="إجراءات علمية مثبتة تنقذ الأرواح قبل الكارثة وأثناءها وبعدها" accent="#4ade80" />
      <div className="mx-auto max-w-5xl pb-10">
        <div className="seg mb-5 max-w-md mx-auto">
          <button className={mode === "quake" ? "on" : ""} onClick={() => setMode("quake")}>
            <Activity className="ml-1 inline size-4" /> الزلازل والهزات
          </button>
          <button className={mode === "volcano" ? "on" : ""} onClick={() => setMode("volcano")}>
            <Flame className="ml-1 inline size-4" /> البراكين والثوران
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {data.map((sec, i) => {
            const Icon = iconMap[sec.icon] ?? ClipboardList;
            return (
              <section key={mode + sec.title} className="anim-fade-up glass rounded-3xl p-5" style={{ animationDelay: `${i * 90}ms` }}>
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="grid size-10 place-items-center rounded-xl" style={{ background: `${accent}1f`, boxShadow: `inset 0 0 0 1px ${accent}55` }}>
                    <Icon className="size-5" style={{ color: accent }} />
                  </div>
                  <h3 className="font-display text-base font-black text-white">{sec.title}</h3>
                </div>
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black text-leaf"><CheckCircle2 className="size-4" /> افعل</p>
                <ul className="mb-4 space-y-2">
                  {sec.dos.map((d) => (
                    <li key={d} className="flex gap-2 text-[12px] leading-relaxed text-slate-300">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-leaf" />{d}
                    </li>
                  ))}
                </ul>
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black text-magma2"><Ban className="size-4" /> لا تفعل</p>
                <ul className="space-y-2">
                  {sec.donts.map((d) => (
                    <li key={d} className="flex gap-2 text-[12px] leading-relaxed text-slate-400">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-magma2" />{d}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <div className="mt-5 glass rounded-2xl p-5 text-center">
          <p className="font-display text-[15px] font-black text-ember mb-1">القاعدة الذهبية للزلازل</p>
          <p className="font-display text-xl md:text-2xl font-black text-white">انخفض • احتمِ • تمسّك</p>
          <p className="mt-1 text-[12px] text-slate-400">Drop — Cover — Hold On : انخفض على يديك وركبتيك، احتمِ تحت طاولة متينة، وتمسّك بها حتى تتوقف الهزة</p>
        </div>
      </div>
    </div>
  );
}
