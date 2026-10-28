import { Flame, Activity, ScrollText, Skull, Zap, GraduationCap } from "lucide-react";
import { disasters } from "../data/content";
import { PageHeader, Badge } from "./ui";

export default function History() {
  return (
    <div className="anim-page h-full overflow-y-auto">
      <PageHeader icon={ScrollText} title="الكوارث التاريخية" sub="أعنف الزلازل والبراكين التي غيّرت وجه البشرية — وما تعلمناه منها" accent="#ef4444" />
      <div className="mx-auto max-w-4xl pb-10">
        <div className="relative">
          {/* الخط الزمني */}
          <div className="absolute right-[19px] top-2 bottom-2 w-px bg-white/10" />
          <div className="space-y-4">
            {disasters.map((d, i) => (
              <article key={d.name} className="anim-fade-up relative pr-14" style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}>
                <div className="absolute right-0 top-1 grid size-10 place-items-center rounded-2xl"
                  style={{ background: d.kind === "volcano" ? "rgba(249,115,22,.14)" : "rgba(239,68,68,.14)", boxShadow: `inset 0 0 0 1px ${d.kind === "volcano" ? "rgba(249,115,22,.4)" : "rgba(239,68,68,.4)"}` }}>
                  {d.kind === "volcano" ? <Flame className="size-5 text-magma" /> : <Activity className="size-5 text-magma2" />}
                </div>
                <div className="glass-soft card-hover rounded-2xl p-5 border border-white/[0.06]">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-black text-white">{d.name}</h3>
                    <span className="font-display text-sm font-black text-slate-400">{d.year}</span>
                    <Badge color={d.kind === "volcano" ? "#f97316" : "#ef4444"}>{d.scale}</Badge>
                    <Badge color="#94a3b8">{d.place}</Badge>
                  </div>
                  <p className="text-[13px] leading-relaxed text-slate-300 mb-3">{d.story}</p>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.05] px-3 py-2">
                      <Zap className="size-4 text-ember shrink-0" />
                      <div><div className="text-[10px] font-bold text-slate-500">القوة</div><div className="text-[11.5px] font-bold text-slate-200">{d.power}</div></div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.05] px-3 py-2">
                      <Skull className="size-4 text-slate-400 shrink-0" />
                      <div><div className="text-[10px] font-bold text-slate-500">الضحايا</div><div className="text-[11.5px] font-bold text-slate-200">{d.victims}</div></div>
                    </div>
                  </div>
                  <div className="flex gap-2 rounded-xl border border-leaf/20 bg-leaf/[0.05] p-3">
                    <GraduationCap className="size-4 shrink-0 text-leaf mt-0.5" />
                    <p className="text-[12px] leading-relaxed text-emerald-100/85"><span className="font-black text-leaf">الدرس المستفاد: </span>{d.lesson}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
