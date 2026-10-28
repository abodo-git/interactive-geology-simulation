import { Layers, Flame, Activity, Globe2, BrainCircuit, BookOpenText, ScrollText, ShieldCheck, ArrowLeft, Sparkles, Volume2, MousePointer2, Move3d } from "lucide-react";
import type { PageId } from "../App";
import heroImg from "../assets/hero.jpg";

const modules: { id: PageId; icon: typeof Layers; title: string; desc: string; accent: string; tag: string }[] = [
  { id: "layers", icon: Layers, title: "طبقات الأرض", desc: "كرة مقطعة تكشف النواة والوشاح مع مقياس تفكيك طبقي وبيانات حرارية حية", accent: "#fb923c", tag: "محاكاة 3D" },
  { id: "volcano", icon: Flame, title: "مختبر البراكين", desc: "تحكّم بالسيليكا وضغط الغاز وافجِر سحب الرماد والقنابل النارية وأنهار الحمم", accent: "#f97316", tag: "محاكاة فيزيائية" },
  { id: "quake", icon: Activity, title: "محاكي الزلازل", desc: "ثلاثة أنواع من الفوالق، مقياس ريختر، مبانٍ تتشقق وتنهار واقعياً وسيزموجراف حي", accent: "#ef4444", tag: "محاكاة 3D" },
  { id: "plates", icon: Globe2, title: "الصفائح التكتونية", desc: "كرة أرضية بالحدود الفعلية للصفائح وأسهم الانجراف القاري وسرعاته", accent: "#38bdf8", tag: "نموذج تفاعلي" },
  { id: "quiz", icon: BrainCircuit, title: "اختبار المفاهيم", desc: "12 سؤالاً علمياً مع شرح فوري وتقييم ذكي لمستواك", accent: "#fbbf24", tag: "تقييم" },
  { id: "glossary", icon: BookOpenText, title: "الموسوعة الجيولوجية", desc: "أكثر من 20 مصطلحاً علمياً مع أمثلة واقعية وبحث فوري", accent: "#4ade80", tag: "مرجع" },
  { id: "history", icon: ScrollText, title: "الكوارث التاريخية", desc: "من فيزوف إلى توهوكو — قصص الكوارث الكبرى ودروسها", accent: "#c084fc", tag: "قصص" },
  { id: "safety", icon: ShieldCheck, title: "دليل السلامة", desc: "إجراءات مثبتة تنقذ الأرواح قبل وأثناء وبعد الزلازل والبراكين", accent: "#34d399", tag: "إرشاد" },
];

export default function Home({ go }: { go: (p: PageId) => void }) {
  return (
    <div className="anim-page h-full overflow-y-auto">
      {/* البطل */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08]" style={{ minHeight: 420 }}>
        <img src={heroImg} alt="ثوران بركاني" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "rgba(8,9,13,0.52)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 70% at 50% 110%, rgba(249,115,22,0.22), transparent 60%)" }} />
        <div className="relative z-10 flex min-h-[420px] flex-col items-center justify-center px-6 py-14 text-center">
          <div className="anim-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-[12px] font-bold text-orange-200 backdrop-blur-md">
            <Sparkles className="size-3.5 text-ember" /> منصة علوم الأرض التفاعلية — نسخة ثلاثية الأبعاد
          </div>
          <h1 className="anim-fade-up font-display text-4xl md:text-6xl font-black text-white leading-[1.15]" style={{ animationDelay: "80ms" }}>
            جيـولاب
            <span className="block mt-2 text-2xl md:text-4xl font-black text-orange-300">رحلة إلى قلب الأرض الناري</span>
          </h1>
          <p className="anim-fade-up mt-4 max-w-2xl text-[15px] md:text-base font-medium leading-relaxed text-slate-300" style={{ animationDelay: "160ms" }}>
            محاكاة فيزيائية واقعية لطبقات الأرض والزلازل والبراكين والصفائح التكتونية — مع مؤثرات جزيئية حية، أصوات مولّدة فيزيائياً، ومستشار ذكي يجيب عن أسئلتك فوراً.
          </p>
          <div className="anim-fade-up mt-7 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "240ms" }}>
            <button onClick={() => go("quake")} className="btn btn-danger !px-7 !py-3.5 !text-base">
              <Activity className="size-5" /> ابدأ بمحاكي الزلازل <ArrowLeft className="size-4" />
            </button>
            <button onClick={() => go("layers")} className="btn !px-7 !py-3.5 !text-base bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-md">
              <Layers className="size-5" /> استكشف طبقات الأرض
            </button>
          </div>
          <div className="anim-fade-up mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl" style={{ animationDelay: "320ms" }}>
            {[
              { v: "5", l: "طبقات أرضية قابلة للاستكشاف" },
              { v: "9.5", l: "أقصى شدة زلزال بالمحاكاة (Mw)" },
              { v: "12+", l: "صفيحة تكتونية بحركتها الحقيقية" },
              { v: "8", l: "أقصى مؤشر انفجار بركاني VEI" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-white/12 bg-black/45 px-4 py-3 backdrop-blur-md">
                <div className="font-display text-2xl font-black text-ember">{s.v}</div>
                <div className="mt-0.5 text-[10.5px] font-bold leading-snug text-slate-300">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* الوحدات */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <Move3d className="size-5 text-magma" />
        <h2 className="font-display text-xl font-black text-white">وحدات المختبر الجيولوجي</h2>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4 pb-8">
        {modules.map((m, i) => (
          <button key={m.id} onClick={() => go(m.id)}
            className="anim-fade-up card-hover group cursor-pointer rounded-3xl glass p-5 text-right border border-white/[0.07]"
            style={{ animationDelay: `${100 + i * 60}ms` }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="grid size-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110" style={{ background: `${m.accent}1c`, boxShadow: `inset 0 0 0 1px ${m.accent}50` }}>
                <m.icon className="size-6" style={{ color: m.accent }} />
              </div>
              <span className="rounded-md px-2 py-0.5 text-[10px] font-extrabold" style={{ color: m.accent, background: `${m.accent}14`, boxShadow: `inset 0 0 0 1px ${m.accent}35` }}>{m.tag}</span>
            </div>
            <h3 className="font-display text-[16px] font-black text-white mb-1">{m.title}</h3>
            <p className="text-[12px] leading-relaxed text-slate-400 mb-3">{m.desc}</p>
            <span className="inline-flex items-center gap-1 text-[12px] font-black transition-all group-hover:gap-2" style={{ color: m.accent }}>
              افتح الوحدة <ArrowLeft className="size-3.5" />
            </span>
          </button>
        ))}
      </div>

      {/* شريط تلميحات */}
      <div className="mb-8 grid gap-3 md:grid-cols-3">
        <div className="glass-soft rounded-2xl p-4 flex items-center gap-3">
          <MousePointer2 className="size-5 text-wave shrink-0" />
          <p className="text-[12px] text-slate-300 leading-relaxed"><span className="font-black text-white">تحكم كامل:</span> اسحب للتدوير، عجلة الفأرة للتقريب، وانقر على الكائنات للمعلومات</p>
        </div>
        <div className="glass-soft rounded-2xl p-4 flex items-center gap-3">
          <Volume2 className="size-5 text-ember shrink-0" />
          <p className="text-[12px] text-slate-300 leading-relaxed"><span className="font-black text-white">صوتيات فيزيائية:</span> هدير منخفض وانفجارات مولّدة لحظياً — فعّل الصوت للتجربة الكاملة</p>
        </div>
        <div className="glass-soft rounded-2xl p-4 flex items-center gap-3">
          <Sparkles className="size-5 text-magma shrink-0" />
          <p className="text-[12px] text-slate-300 leading-relaxed"><span className="font-black text-white">مستشار ذكي:</span> زر الشرارة أسفل اليسار يفتح خبيراً يحلل حالة محاكاتك ويجيب عن أسئلتك</p>
        </div>
      </div>
    </div>
  );
}
