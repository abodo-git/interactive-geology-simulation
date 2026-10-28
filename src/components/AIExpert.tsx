import { useEffect, useRef, useState } from "react";
import {
  Sparkles, Send, X, Settings2, KeyRound, Bot, User, Trash2, Loader2, Eye, EyeOff,
  CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, Wifi, ArrowRight, Info,
} from "lucide-react";
import { aiLocalAnswers, aiFallback } from "../data/content";
import { describeSimState } from "../store";
import { blip } from "../audio";
import { askGemini, testGemini, describeGeminiError, keyFormat, cleanKey, type TestResult } from "../gemini";

interface MsgError { status?: number; message: string; hint: string; attempted: string[]; question: string }
interface Msg { role: "user" | "ai"; text: string; model?: string; local?: boolean; notes?: string[]; error?: MsgError }
type Status =
  | { phase: "idle" }
  | { phase: "testing" }
  | { phase: "ok"; data: TestResult }
  | { phase: "error"; error: ReturnType<typeof describeGeminiError> };

const SUGGESTIONS = [
  "ما الفرق بين الموجات P و S؟",
  "لماذا تنفجر بعض البراكين وتتدفق أخرى بهدوء؟",
  "حلّل حالة المحاكاة الحالية",
  "أخبرني عن الصفيحة العربية",
  "ماذا أفعل أثناء الزلزال؟",
];

function md(t: string) {
  return t.split("**").map((part, i) => (i % 2 === 1 ? <strong key={i} className="text-ember font-black">{part}</strong> : <span key={i}>{part}</span>));
}

const SYSTEM_PROMPT = `أنت «المستشار الجيولوجي» خبير علوم أرض ودود يشرح لطلاب المدارس بالعربية الفصحى المبسطة.
أجب بدقة علمية وبأسلوب مشوق في 180 كلمة كحد أقصى، واستخدم ** للمصطلحات المهمة.
إن سُئلت عن حالة المحاكاة، اربط إجابتك بالأرقام المذكورة في السياق وقدّم اقتراحاً عملياً واحداً للتجربة.
حالة المحاكاة الحالية في التطبيق:
`;

function localAnswer(q: string): string {
  for (const item of aiLocalAnswers) {
    if (item.keys.some((k) => q.includes(k))) {
      if (item.a === "__SIM__") {
        return `إليك قراءة فورية لأجهزة المحاكاة الآن:\n${describeSimState()}\n\n**تحليلي:** ارفع الشدة في محاكي الزلازل تدريجياً ولاحظ أن المباني تتحمل حتى عتبة معينة ثم تنهار فجأة — هذا هو سلوك المنشآت الحقيقية. وفي البركان: اجعل السيليكا 70% والغاز 90% لتحصل على انفجار بليني.`;
      }
      return item.a;
    }
  }
  return aiFallback;
}

export default function AIExpert() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "settings">("chat");
  const [key, setKey] = useState(() => localStorage.getItem("geo_gemini_key") || "");
  const [model, setModel] = useState(() => localStorage.getItem("geo_gemini_model") || "");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: "ai",
    text: "أهلاً بك! أنا **المستشار الجيولوجي**. بدون مفتاح أعمل من مكتبة معرفية محلية، وبإضافة مفتاح Gemini أحلّل أسئلتك وحالة محاكاة الأرض لحظياً. ابدأ بضغط ⚙️ لإضافة مفتاحك واختباره، أو اسألني مباشرة.",
  }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTestedKey = useRef("");

  const fmt = keyFormat(key);
  const hasKey = cleanKey(key).length > 0;
  const connected = status.phase === "ok" && !status.data.generationError;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, open, tab]);

  const runTest = async (rawKey: string) => {
    const k = cleanKey(rawKey);
    if (!k) {
      setStatus({ phase: "error", error: { message: "لم تُدخل مفتاح API بعد", hint: "الصق مفتاحك من Google AI Studio في الحقل ثم اضغط «اختبار الاتصال».", attempted: [] } });
      return;
    }
    lastTestedKey.current = k;
    setStatus({ phase: "testing" });
    blip(700);
    try {
      const data = await testGemini(k, model);
      setStatus({ phase: "ok", data });
      if (data.generationError) blip(320);
      else blip(980);
    } catch (e) {
      setStatus({ phase: "error", error: describeGeminiError(e) });
      blip(240);
    }
  };

  const saveKey = (thenTest = false) => {
    const k = cleanKey(key);
    setKey(k);
    localStorage.setItem("geo_gemini_key", k);
    localStorage.setItem("geo_gemini_model", model.trim());
    if (thenTest) void runTest(k);
  };

  const removeKey = () => {
    setKey("");
    setModel("");
    localStorage.removeItem("geo_gemini_key");
    localStorage.removeItem("geo_gemini_model");
    setStatus({ phase: "idle" });
  };

  const ask = async (text: string, appendUser = true) => {
    const q = text.trim();
    if (!q || busy) return;
    blip(760);
    if (appendUser) setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");

    if (!hasKey) {
      setMsgs((m) => [...m, { role: "ai", text: localAnswer(q), local: true }]);
      return;
    }

    setBusy(true);
    try {
      const history = msgs.filter((m) => !m.error).slice(-8).map((m) => ({ role: m.role, text: m.text }));
      const out = await askGemini({
        key,
        system: SYSTEM_PROMPT + describeSimState(),
        history,
        question: q,
        preferredModel: model || undefined,
      });
      setMsgs((m) => [...m, { role: "ai", text: out.text, model: out.model, notes: out.notes }]);
    } catch (e) {
      const d = describeGeminiError(e);
      setMsgs((m) => [...m, { role: "ai", text: "", error: { ...d, question: q } }]);
    } finally {
      setBusy(false);
    }
  };

  const useLocal = (q: string) => {
    setMsgs((m) => [...m, { role: "ai", text: localAnswer(q), local: true }]);
  };

  return (
    <>
      <button onClick={() => { setOpen(!open); blip(660); }}
        className="fixed bottom-24 left-4 z-[60] grid size-14 cursor-pointer place-items-center rounded-2xl bg-magma text-[#131010] shadow-[0_14px_40px_-8px_rgba(249,115,22,.65)] transition-transform hover:scale-105 active:scale-95 md:bottom-6"
        title="المستشار الجيولوجي الذكي">
        <Sparkles className="size-6" />
      </button>

      {open && (
        <div className="anim-fade-up fixed bottom-[9.5rem] left-3 z-[60] flex h-[590px] max-h-[calc(100vh-120px)] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl glass shadow-2xl md:bottom-24">
          {/* الرأس */}
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="relative grid size-9 place-items-center rounded-xl bg-magma/15" style={{ boxShadow: "inset 0 0 0 1px rgba(249,115,22,.4)" }}>
                <Bot className="size-[18px] text-magma" />
                <span className={`absolute -bottom-0.5 -left-0.5 size-2.5 rounded-full border-2 border-[#12151e] ${connected ? "bg-leaf" : status.phase === "error" ? "bg-magma2" : hasKey ? "bg-amber-400" : "bg-slate-500"}`} />
              </div>
              <div>
                <div className="font-display text-[13px] font-black text-white">المستشار الجيولوجي</div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  {status.phase === "testing" ? (
                    <><Loader2 className="size-2.5 animate-spin text-amber-400" /> جارٍ اختبار الاتصال...</>
                  ) : connected ? (
                    <><Wifi className="size-2.5 text-leaf" /> Gemini متصل • {(status.phase === "ok" && status.data.chosen) || model || "تلقائي"}</>
                  ) : hasKey ? (
                    <>مفتاح محفوظ — اضغط ⚙️ للاختبار</>
                  ) : (
                    <>وضع المعرفة المحلية</>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setTab(tab === "chat" ? "settings" : "chat")}
                className={`rounded-lg p-2 transition-colors cursor-pointer ${tab === "settings" ? "bg-magma/20 text-magma" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
                title="إعدادات الاتصال"><Settings2 className="size-4" /></button>
              <button onClick={() => setMsgs(msgs.slice(0, 1))} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white cursor-pointer" title="مسح المحادثة"><Trash2 className="size-4" /></button>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white cursor-pointer" title="إغلاق"><X className="size-4" /></button>
            </div>
          </div>

          {tab === "settings" ? (
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[12px] font-black text-white"><KeyRound className="size-3.5 text-ember" /> مفتاح Gemini API</p>
                  <span className={`rounded-md px-2 py-0.5 text-[9.5px] font-extrabold ${!hasKey ? "bg-white/10 text-slate-400" : fmt.kind === "auth" ? "bg-leaf/15 text-emerald-300" : fmt.kind === "legacy" ? "bg-amber-400/15 text-amber-300" : "bg-white/10 text-slate-400"}`}>{hasKey ? fmt.label : "بانتظار المفتاح"}</span>
                </div>
                <div className="relative">
                  <input
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveKey(true)}
                    type={showKey ? "text" : "password"}
                    placeholder="AQ.Ab8... أو AIza..."
                    autoComplete="off" spellCheck={false}
                    className="w-full rounded-xl border border-white/10 bg-[#0b0e15] py-2.5 pr-3 pl-10 text-[12px] text-slate-200 outline-none focus:border-magma/50"
                    dir="ltr"
                  />
                  <button onClick={() => setShowKey(!showKey)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:text-slate-200 cursor-pointer" title={showKey ? "إخفاء" : "إظهار"}>
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1.5 flex items-start gap-1 text-[10.5px] leading-relaxed text-slate-500"><Info className="mt-0.5 size-3 shrink-0" /> {fmt.note}</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button onClick={() => saveKey(true)} disabled={status.phase === "testing"} className="btn btn-primary !py-2 !text-[12px]">
                    {status.phase === "testing" ? <><Loader2 className="size-3.5 animate-spin" /> جارٍ الاختبار</> : <><Wifi className="size-3.5" /> اختبار الاتصال</>}
                  </button>
                  <button onClick={() => saveKey(false)} className="btn btn-ghost !py-2 !text-[12px]"><CheckCircle2 className="size-3.5" /> حفظ فقط</button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10.5px] font-bold text-sky-300 hover:underline">
                    <ExternalLink className="size-3" /> احصل على مفتاح مجاني من Google AI Studio
                  </a>
                  {hasKey && <button onClick={removeKey} className="text-[10.5px] font-bold text-magma2 hover:underline cursor-pointer">إزالة المفتاح</button>}
                </div>
              </div>

              {/* النموذج */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
                <p className="mb-1.5 text-[12px] font-black text-white">النموذج المستخدم <span className="font-bold text-slate-500">(اختياري)</span></p>
                <input value={model} onChange={(e) => setModel(e.target.value)} onBlur={() => localStorage.setItem("geo_gemini_model", model.trim())}
                  placeholder="تلقائي — يفضّل gemini-flash-latest ثم gemini-2.5-flash"
                  className="w-full rounded-xl border border-white/10 bg-[#0b0e15] px-3 py-2 text-[12px] text-slate-200 outline-none focus:border-magma/50" dir="ltr" spellCheck={false} />
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500">اتركه فارغاً ليكتشف التطبيق تلقائياً أفضل نموذج متاح لمفتاحك من قائمة Google. إذا أعدت خطأ 404 فسيجرّب النماذج الأخرى للمفتاح نفسه.</p>
              </div>

              {/* حالة الاتصال */}
              {status.phase === "testing" && (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-3.5">
                  <p className="flex items-center gap-2 text-[12px] font-bold text-amber-200"><Loader2 className="size-4 animate-spin" /> جارٍ التحقق من المفتاح وجلب النماذج المتاحة من Google...</p>
                </div>
              )}
              {status.phase === "error" && (
                <div className="anim-fade-up space-y-2 rounded-2xl border border-magma2/30 bg-magma2/[0.07] p-3.5">
                  <p className="flex items-center gap-1.5 text-[12px] font-black text-red-300">
                    <AlertTriangle className="size-4" /> فشل الاتصال {status.error.status ? `— HTTP ${status.error.status}` : ""}
                  </p>
                  <p className="break-words rounded-lg bg-black/30 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-red-200/90" dir="ltr">{status.error.message}</p>
                  <p className="text-[11px] leading-relaxed text-slate-300">{status.error.hint}</p>
                  {status.error.attempted.length > 0 && (
                    <p className="text-[10px] text-slate-500" dir="ltr">tried: {status.error.attempted.join(" · ")}</p>
                  )}
                  <button onClick={() => runTest(key)} className="btn btn-ghost !py-1.5 !text-[11px] w-full"><RefreshCw className="size-3.5" /> إعادة الاختبار</button>
                </div>
              )}
              {status.phase === "ok" && (
                <div className="anim-fade-up space-y-2 rounded-2xl border border-leaf/30 bg-leaf/[0.07] p-3.5">
                  <p className="flex items-center gap-1.5 text-[12px] font-black text-emerald-300"><CheckCircle2 className="size-4" /> تم التحقق من المفتاح بنجاح</p>
                  <div className="space-y-1 text-[11px] text-slate-300">
                    <p>عدد النماذج المتاحة: <b className="text-white">{status.data.models.length}</b></p>
                    <p>النموذج المختار: <b className="text-emerald-200" dir="ltr">{status.data.chosen}</b></p>
                    {status.data.sample && <p className="rounded-lg bg-black/25 px-2.5 py-1.5 text-[10.5px] text-slate-400">رد تجريبي: {status.data.sample}</p>}
                  </div>
                  {status.data.generationError ? (
                    <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.08] p-2">
                      <p className="mb-0.5 flex items-center gap-1 text-[10.5px] font-black text-amber-200"><AlertTriangle className="size-3" /> المفتاح صالح لكن التوليد فشل</p>
                      <p className="font-mono text-[10px] leading-relaxed text-amber-100/80" dir="ltr">{describeGeminiError(status.data.generationError).message}</p>
                      <p className="mt-1 text-[10.5px] text-slate-300">{describeGeminiError(status.data.generationError).hint}</p>
                    </div>
                  ) : (
                    <button onClick={() => { setModel(status.data.chosen); localStorage.setItem("geo_gemini_model", status.data.chosen); }} className="btn btn-ghost !py-1.5 !text-[11px] w-full">تثبيت هذا النموذج</button>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button onClick={() => setTab("chat")} className="btn btn-primary !py-1.5 !text-[11px]">ابدأ المحادثة <ArrowRight className="size-3.5 -scale-x-100" /></button>
                    <button onClick={() => runTest(key)} className="btn btn-ghost !py-1.5 !text-[11px]"><RefreshCw className="size-3.5" /> فحص مجدد</button>
                  </div>
                </div>
              )}
              {status.phase === "idle" && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                  <p className="mb-1 text-[11.5px] font-black text-slate-200">كيف يعمل الاختبار؟</p>
                  <ol className="space-y-1 text-[10.5px] leading-relaxed text-slate-400 list-decimal pr-4">
                    <li>يرسل مفتاحك إلى Google عبر ترويسة <code dir="ltr" className="text-sky-300">x-goog-api-key</code> (المطلوبة لمفاتيح AQ. الجديدة).</li>
                    <li>يجلب قائمة النماذج المتاحة لمشروعك للتحقق من الصلاحية.</li>
                    <li>يرسل رسالة تجريبية قصيرة ويتيح لك تثبيت النموذج الناجح.</li>
                  </ol>
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500"><KeyRound className="size-3" /> يُخزَّن المفتاح في متصفحك فقط ولا يُرسل إلا إلى Google.</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* الرسائل */}
              <div ref={scrollRef} className="chat-scroll flex-1 space-y-3 overflow-y-auto p-3.5">
                {msgs.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`grid size-7 shrink-0 place-items-center rounded-lg ${m.role === "ai" ? (m.local ? "bg-slate-500/20 text-slate-300" : "bg-magma/15 text-magma") : "bg-wave/15 text-wave"}`}>
                      {m.role === "ai" ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
                    </div>
                    <div className={`max-w-[82%] ${m.role === "user" ? "" : "min-w-0"}`}>
                      {m.text && (
                        <div className={`rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${m.role === "ai" ? "rounded-tr-sm bg-white/[0.06] text-slate-200 border border-white/[0.06]" : "rounded-tl-sm bg-magma/90 text-[#1a0f08] font-bold"}`}>
                          {md(m.text)}
                        </div>
                      )}
                      {m.error && (
                        <div className="anim-fade-in space-y-2 rounded-2xl rounded-tr-sm border border-magma2/30 bg-magma2/[0.08] p-3">
                          <p className="flex items-center gap-1.5 text-[11.5px] font-black text-red-300"><AlertTriangle className="size-3.5" /> تعذّر الحصول على رد من Gemini {m.error.status ? `(HTTP ${m.error.status})` : ""}</p>
                          <p className="break-words rounded-lg bg-black/35 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-red-200/90" dir="ltr">{m.error.message}</p>
                          <p className="text-[10.5px] leading-relaxed text-slate-300">{m.error.hint}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => ask(m.error!.question, false)} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[10.5px] font-bold text-white hover:bg-white/20 cursor-pointer"><RefreshCw className="ml-1 inline size-3" /> إعادة المحاولة</button>
                            <button onClick={() => useLocal(m.error!.question)} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[10.5px] font-bold text-slate-300 hover:bg-white/10 cursor-pointer">إجابة محلية</button>
                            <button onClick={() => setTab("settings")} className="rounded-lg bg-magma/20 px-2.5 py-1.5 text-[10.5px] font-bold text-orange-200 hover:bg-magma/30 cursor-pointer"><Settings2 className="ml-1 inline size-3" /> الإعدادات</button>
                          </div>
                        </div>
                      )}
                      {(m.model || m.local) && (
                        <p className="mt-1 px-1 text-[9px] font-bold text-slate-500">
                          {m.local ? "المكتبة المحلية — بدون إنترنت" : `Gemini • ${m.model}`}
                        </p>
                      )}
                      {m.notes && m.notes.length > 0 && (
                        <p className="mt-1 px-1 text-[9.5px] leading-relaxed text-slate-500">ℹ️ {m.notes.join(" ")}</p>
                      )}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex gap-2">
                    <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-magma/15 text-magma"><Bot className="size-3.5" /></div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-tr-sm border border-white/[0.06] bg-white/[0.06] px-4 py-3">
                      <span className="typing-dot size-1.5 rounded-full bg-slate-400" />
                      <span className="typing-dot size-1.5 rounded-full bg-slate-400" />
                      <span className="typing-dot size-1.5 rounded-full bg-slate-400" />
                    </div>
                  </div>
                )}
              </div>

              {/* اقتراحات */}
              {msgs.length <= 1 && (
                <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition-colors hover:border-magma/40 hover:bg-magma/10 cursor-pointer">{s}</button>
                  ))}
                </div>
              )}

              {/* شريط الحالة السريع */}
              {hasKey && status.phase === "error" && (
                <button onClick={() => setTab("settings")} className="mx-3.5 mb-1 flex items-center gap-1.5 rounded-lg border border-magma2/30 bg-magma2/10 px-2.5 py-1.5 text-[10px] font-bold text-red-300 cursor-pointer">
                  <AlertTriangle className="size-3" /> مشكلة في الاتصال — اضغط للتشخيص
                </button>
              )}

              {/* الإدخال */}
              <div className="border-t border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex gap-2">
                  <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(input)}
                    placeholder={hasKey ? "اسأل Gemini عن أي ظاهرة جيولوجية..." : "اسأل من المكتبة المحلية أو أضف مفتاح Gemini..."}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-[13px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-magma/50" />
                  <button onClick={() => ask(input)} disabled={busy || !input.trim()} className="btn btn-primary !rounded-xl !px-3.5">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 -scale-x-100" />}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-1">
                  <button onClick={() => setTab("settings")} className="flex items-center gap-1 text-[9.5px] font-bold text-slate-500 hover:text-slate-300 cursor-pointer">
                    <Settings2 className="size-2.5" /> {hasKey ? `المفتاح: ••••${cleanKey(key).slice(-6)}` : "إضافة مفتاح Gemini للتحليل الذكي"}
                  </button>
                  <span className="text-[9px] font-bold text-slate-600">{connected ? "متصل" : hasKey ? "غير مُختبر" : "محلي"}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
