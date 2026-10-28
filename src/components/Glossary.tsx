import { useMemo, useState } from "react";
import { BookOpenText, Search, Quote } from "lucide-react";
import { glossary } from "../data/content";
import { PageHeader, Badge } from "./ui";

const cats = ["الكل", "طبقات", "زلازل", "براكين", "صفائح", "كوارث"];
const catColor: Record<string, string> = { طبقات: "#fb923c", زلازل: "#ef4444", براكين: "#f97316", صفائح: "#38bdf8", كوارث: "#c084fc" };

export default function Glossary() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("الكل");
  const list = useMemo(() => glossary.filter((t) =>
    (cat === "الكل" || t.cat === cat) &&
    (q.trim() === "" || t.t.includes(q) || t.d.includes(q) || t.ex.includes(q))), [q, cat]);

  return (
    <div className="anim-page h-full overflow-y-auto">
      <PageHeader icon={BookOpenText} title="الموسوعة الجيولوجية" sub="قاموس المصطلحات العلمية مع أمثلة واقعية" accent="#38bdf8" />
      <div className="mx-auto max-w-4xl pb-10">
        <div className="sticky top-0 z-10 mb-4 space-y-3 rounded-2xl glass p-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن مصطلح... (مثال: ماغما، فالق، تسونامي)"
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pr-10 pl-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-wave/50" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all cursor-pointer border ${cat === c ? "border-wave/50 bg-wave/15 text-sky-200" : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 && <p className="py-16 text-center text-slate-500 font-bold">لا نتائج — جرّب كلمة أخرى</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((t, i) => (
            <article key={t.t} className="anim-fade-up glass-soft card-hover rounded-2xl p-4 border border-white/[0.06]" style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="font-display text-[15px] font-black text-white">{t.t}</h3>
                <Badge color={catColor[t.cat] ?? "#f97316"}>{t.cat}</Badge>
              </div>
              <p className="text-[12.5px] leading-relaxed text-slate-300 mb-2">{t.d}</p>
              <div className="flex gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.05] p-2.5">
                <Quote className="size-3.5 shrink-0 text-wave mt-0.5" />
                <p className="text-[11.5px] leading-relaxed text-slate-400"><span className="font-black text-sky-300">مثال: </span>{t.ex}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
