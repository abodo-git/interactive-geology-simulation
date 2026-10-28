import { useMemo, useState } from "react";
import { BrainCircuit, CheckCircle2, XCircle, RotateCcw, Trophy, Lightbulb } from "lucide-react";
import { quiz } from "../data/content";
import { PageHeader, Badge } from "./ui";
import { blip } from "../audio";

export default function Quiz() {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);

  const q = quiz[idx];
  const pct = useMemo(() => Math.round((score / quiz.length) * 100), [score]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.a) { setScore(score + 1); setStreak(streak + 1); blip(880); }
    else { setStreak(0); blip(220); }
  };
  const next = () => {
    setPicked(null);
    if (idx + 1 >= quiz.length) setDone(true);
    else setIdx(idx + 1);
  };
  const restart = () => { setIdx(0); setPicked(null); setScore(0); setDone(false); setStreak(0); };

  if (done) {
    return (
      <div className="anim-page h-full overflow-y-auto">
        <PageHeader icon={BrainCircuit} title="اختبار المفاهيم الجيولوجية" sub="النتيجة النهائية" accent="#fbbf24" />
        <div className="mx-auto max-w-xl">
          <div className="glass rounded-3xl p-10 text-center">
            <div className="mx-auto mb-4 grid size-20 place-items-center rounded-full" style={{ background: `${pct >= 70 ? "#4ade80" : pct >= 40 ? "#fbbf24" : "#ef4444"}1c`, boxShadow: `inset 0 0 0 2px ${pct >= 70 ? "#4ade80" : pct >= 40 ? "#fbbf24" : "#ef4444"}66` }}>
              <Trophy className="size-9" style={{ color: pct >= 70 ? "#4ade80" : pct >= 40 ? "#fbbf24" : "#ef4444" }} />
            </div>
            <div className="font-display text-5xl font-black text-white mb-1">{pct}%</div>
            <div className="text-slate-400 mb-1">أجبت بشكل صحيح على {score} من {quiz.length}</div>
            <p className="text-sm text-slate-400 mb-6">
              {pct >= 80 ? "ممتاز! أنت جيولوجي بامتياز — عقلك صخري صلب كالنواة الداخلية." : pct >= 50 ? "جيد جداً! راجع الأسئلة التي أخطأت فيها وارجع أقوى." : "البداية جيدة — استكشف الموسوعة والمحاكاة ثم أعد المحاولة."}
            </p>
            <button className="btn btn-primary" onClick={restart}><RotateCcw className="size-4" /> إعادة الاختبار</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-page h-full overflow-y-auto">
      <PageHeader icon={BrainCircuit} title="اختبار المفاهيم الجيولوجية" sub={`سؤال ${idx + 1} من ${quiz.length} — سلسلة صحيحة: ${streak}`} accent="#fbbf24" />
      <div className="mx-auto max-w-2xl pb-8">
        {/* شريط التقدم */}
        <div className="mb-4 h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-ember transition-all duration-500" style={{ width: `${((idx + (picked !== null ? 1 : 0)) / quiz.length) * 100}%` }} />
        </div>
        <div key={idx} className="anim-fade-up glass rounded-3xl p-6 md:p-8">
          <div className="mb-2 flex items-center gap-2">
            <Badge color="#fbbf24">{q.cat}</Badge>
          </div>
          <h2 className="font-display text-lg md:text-xl font-black text-white leading-relaxed mb-5">{q.q}</h2>
          <div className="space-y-2.5">
            {q.opts.map((o, i) => {
              const state = picked === null ? "idle" : i === q.a ? "right" : i === picked ? "wrong" : "dim";
              return (
                <button key={i} onClick={() => pick(i)}
                  className={`w-full rounded-2xl border px-4 py-3.5 text-right text-[14px] font-bold transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                    state === "idle" ? "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.09] hover:border-magma/40 hover:-translate-y-0.5"
                    : state === "right" ? "border-leaf/60 bg-leaf/10 text-emerald-200"
                    : state === "wrong" ? "border-magma2/60 bg-magma2/10 text-red-200"
                    : "border-white/5 bg-white/[0.02] text-slate-500"}`}>
                  <span>{o}</span>
                  {state === "right" && <CheckCircle2 className="size-5 text-leaf shrink-0" />}
                  {state === "wrong" && <XCircle className="size-5 text-magma2 shrink-0" />}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="anim-fade-up mt-4 rounded-2xl border border-wave/25 bg-wave/[0.06] p-4">
              <p className="text-[13px] leading-relaxed text-slate-200">
                <span className="inline-flex items-center gap-1 font-black text-wave ml-1"><Lightbulb className="size-4" /> الشرح العلمي:</span>
                {q.why}
              </p>
            </div>
          )}
          {picked !== null && (
            <button onClick={next} className="btn btn-primary mt-4 w-full">
              {idx + 1 >= quiz.length ? "عرض النتيجة النهائية" : "السؤال التالي"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
