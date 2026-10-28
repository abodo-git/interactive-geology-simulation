// عميل Gemini API — يدعم مفاتيح الصيغة الجديدة (AQ.) عبر ترويسة x-goog-api-key،
// ويكتشف النماذج المتاحة تلقائياً إذا كان اسم النموذج المطلوب غير متاح (خطأ 404).

const BASE = "https://generativelanguage.googleapis.com";
const API_VERSION = "v1beta";
const TIMEOUT_MS = 45000;

export interface GeminiModel {
  id: string;
  displayName: string;
  description: string;
}

export interface ChatTurn {
  role: "user" | "ai";
  text: string;
}

export class GeminiError extends Error {
  status?: number;
  code?: string;
  attempted: string[];
  hint: string;
  constructor(message: string, opts: { status?: number; code?: string; attempted?: string[] } = {}) {
    super(message);
    this.name = "GeminiError";
    this.status = opts.status;
    this.code = opts.code;
    this.attempted = opts.attempted ?? [];
    this.hint = hintFor(opts.status);
  }
}

function hintFor(status?: number): string {
  if (status === 400) return "المفتاح غير صالح أو منسوخ بشكل ناقص. انسخه كاملاً من Google AI Studio بدون مسافات، وتأكد من تفعيل Generative Language API على مشروعك.";
  if (status === 401) return "المفتاح مرفوض. أنشئ مفتاحاً جديداً من AI Studio ثم ألصقه كاملاً.";
  if (status === 403) return "المفتاح أو المشروع لا يملك صلاحية استخدام Gemini. فعّل Gemini API من Google Cloud Console أو استخدم مفتاحاً من Google AI Studio.";
  if (status === 404) return "وصل الطلب إلى Google لكن اسم النموذج غير متاح لهذا المفتاح. التطبيق يكتشف النماذج المتاحة تلقائياً ويعيد المحاولة — اضغط «اختبار الاتصال».";
  if (status === 429) return "تجاوزت الحصة المجانية (Rate limit). انتظر نحو دقيقة ثم أعد المحاولة، أو استخدم مفتاحاً آخر.";
  if (status && status >= 500) return "خدمة Google تتعطل مؤقتاً. أعد المحاولة بعد قليل.";
  return "تعذّر الوصول إلى الشبكة أو أن المتصفح/الامتدادات تمنع الطلب. تحقق من اتصالك ثم أعد المحاولة.";
}

export function keyFormat(key: string): { kind: "auth" | "legacy" | "unknown"; label: string; note: string } {
  const k = key.trim();
  if (k.startsWith("AQ.")) return { kind: "auth", label: "مفتاح Gemini جديد (AQ.)", note: "يُرسل عبر ترويسة x-goog-api-key كما يفرضه Google للمفاتيح الجديدة." };
  if (k.startsWith("AIza")) return { kind: "legacy", label: "مفتاح قديم (AIza)", note: "قد لا تقبل Google المفاتيح القديمة في المشاريع الجديدة؛ إن فشل الاختبار فأنشئ مفتاحاً جديداً من AI Studio." };
  return { kind: "unknown", label: "صيغة غير معروفة", note: "مفاتيح Gemini تبدأ عادةً بـ AQ. (الجديدة) أو AIza (القديمة). تأكد أنك نسخت المفتاح كاملاً وليس معرّف مشروع." };
}

export function cleanKey(key: string): string {
  return key.trim().replace(/^["'`]|["'`]$/g, "").replace(/\s+/g, "");
}

const PREFERRED_CANDIDATES = ["gemini-flash-latest", "gemini-2.5-flash"];

const EXCLUDE = /(image|tts|audio|embedding|aqa|learnlm|veo|imagen|robotics|computer-use|deep-research|gemma)/i;

export function rankModels(models: GeminiModel[], preferred?: string): string[] {
  const ids = models.filter((m) => !EXCLUDE.test(m.id)).map((m) => m.id);
  const out: string[] = [];
  const push = (id?: string) => { if (id && ids.includes(id) && !out.includes(id)) out.push(id); };
  push(preferred?.replace(/^models\//, "").trim());
  push("gemini-flash-latest");
  push("gemini-2.5-flash");
  ids.filter((id) => /flash/i.test(id) && /gemini-(3|2\.5)/i.test(id)).forEach(push);
  ids.filter((id) => /flash/i.test(id)).forEach(push);
  ids.forEach(push);
  return out;
}

function headers(key: string): HeadersInit {
  // الأهم: مفاتيح AQ. لا تعمل عبر ?key= إطلاقاً — يجب إرسالها كترويسة
  return { "Content-Type": "application/json", "x-goog-api-key": cleanKey(key) };
}

async function failureFromResponse(res: Response): Promise<GeminiError> {
  let message = `HTTP ${res.status}${res.statusText ? ` — ${res.statusText}` : ""}`;
  let code: string | undefined;
  try {
    const j = await res.json();
    const err = j?.error;
    if (err) {
      message = err.message || message;
      code = err.status;
    }
  } catch { /* ليست استجابة JSON */ }
  return new GeminiError(message, { status: res.status, code });
}

async function safeFetch(url: string, init: RequestInit, attempted?: string[]): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    const err = e as Error;
    const msg = err?.name === "AbortError" ? "انتهت مهلة الطلب (45 ثانية) دون رد من Google" : (err?.message || "تعذّر الاتصال بالشبكة");
    throw new GeminiError(msg, { attempted });
  } finally {
    clearTimeout(timer);
  }
}

// ------------- قائمة النماذج (تُثبت صحة المفتاح) -------------
let modelsCache: { keySuffix: string; models: GeminiModel[] } | null = null;

export async function listModels(key: string, version = API_VERSION): Promise<GeminiModel[]> {
  const k = cleanKey(key);
  if (!k) throw new GeminiError("لم تُدخل مفتاح API بعد", { status: 400 });
  if (modelsCache && modelsCache.keySuffix === k.slice(-10)) return modelsCache.models;
  const res = await safeFetch(`${BASE}/${version}/models?pageSize=200`, { headers: headers(k) });
  if (!res.ok) throw await failureFromResponse(res);
  const data = await res.json().catch(() => null);
  const raw: Array<{ name?: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }> = data?.models ?? [];
  const models: GeminiModel[] = raw
    .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => ({
      id: (m.name as string).replace(/^models\//, ""),
      displayName: m.displayName || (m.name as string).replace(/^models\//, ""),
      description: m.description || "",
    }));
  if (models.length === 0) throw new GeminiError("استجابة Google لا تحتوي أي نموذج يدعم توليد النصوص", { status: 404 });
  modelsCache = { keySuffix: k.slice(-10), models };
  return models;
}

// ------------- توليد المحتوى -------------
interface GenerateOutcome { text: string; model: string }

async function generateOnce(key: string, model: string, system: string, turns: ChatTurn[], question: string, maxTokens = 1200): Promise<GenerateOutcome> {
  const contents = [
    ...turns.slice(-8).map((t) => ({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.text.replace(/\*\*/g, "") }] })),
    { role: "user", parts: [{ text: question }] },
  ];
  const res = await safeFetch(
    `${BASE}/${API_VERSION}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.75, maxOutputTokens: maxTokens, topP: 0.95 },
      }),
    },
    [model],
  );
  if (!res.ok) throw await failureFromResponse(res);
  const data = await res.json().catch(() => null);
  const parts: Array<{ text?: string; thought?: boolean }> = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
  if (!text) {
    const blocked = data?.promptFeedback?.blockReason;
    const finish = data?.candidates?.[0]?.finishReason;
    throw new GeminiError(
      blocked ? `حجبت Google الرد بسبب سياسة المحتوى (${blocked})` : finish === "MAX_TOKENS" ? "انقطع الرد قبل اكتماله، أعد المحاولة بسؤال أقصر" : "وصل رد فارغ من النموذج",
      { status: undefined, attempted: [model] },
    );
  }
  return { text, model };
}

const FATAL = new Set([400, 401, 403, 429]);

export interface AskOptions {
  key: string;
  system: string;
  history: ChatTurn[];
  question: string;
  preferredModel?: string;
}

export async function askGemini(opts: AskOptions): Promise<{ text: string; model: string; notes: string[] }> {
  const key = cleanKey(opts.key);
  if (!key) throw new GeminiError("أضف مفتاح Gemini من الإعدادات أولاً ليُستخدم الذكاء الاصطناعي", { status: 400 });
  const preferred = opts.preferredModel?.replace(/^models\//, "").trim();
  const notes: string[] = [];
  const attempted: string[] = [];
  const state: { last: GeminiError | null } = { last: null };

  const tryModel = async (model: string): Promise<GenerateOutcome | null> => {
    attempted.push(model);
    try {
      return await generateOnce(key, model, opts.system, opts.history, opts.question);
    } catch (e) {
      const err = e instanceof GeminiError ? e : new GeminiError((e as Error)?.message || "خطأ غير معروف", {});
      state.last = err;
      if (err.status === 404) {
        notes.push(`النموذج «${model}» غير متاح لهذا المفتاح — جارٍ تجربة نموذج آخر.`);
      }
      return null;
    }
  };
  const fatal = (): GeminiError | null => {
    const e = state.last;
    return e && e.status && FATAL.has(e.status) ? e : null;
  };

  // 1) النموذج المفضل أو الأسماء الشائعة
  const direct = [...new Set([preferred, ...PREFERRED_CANDIDATES].filter(Boolean) as string[])];
  for (const m of direct) {
    const out = await tryModel(m);
    if (out) return { ...out, notes };
    const f = fatal();
    if (f) throw f;
  }

  // 2) اكتشاف النماذج المتاحة لهذا المفتاح
  try {
    const models = await listModels(key);
    const ranked = rankModels(models, preferred).slice(0, 5).filter((m) => !attempted.includes(m));
    if (ranked.length) notes.push("تم اكتشاف النماذج المتاحة لمفتاحك تلقائياً.");
    for (const m of ranked) {
      const out = await tryModel(m);
      if (out) return { ...out, notes };
      const f = fatal();
      if (f) throw f;
    }
  } catch (e) {
    const err = e instanceof GeminiError ? e : new GeminiError((e as Error)?.message || "تعذّر جلب قائمة النماذج", {});
    // خطأ الصلاحية/الحصة أهم من 404 ويجب أن يظهر للمستخدم أولاً
    if (err.status && FATAL.has(err.status)) state.last = err;
    else if (!state.last) state.last = err;
    if (state.last && !state.last.attempted.length) state.last.attempted = attempted;
  }

  const base = state.last ?? new GeminiError("تعذّر الحصول على رد من Gemini", { attempted });
  throw new GeminiError(base.message, { status: base.status, code: base.code, attempted: [...new Set([...base.attempted, ...attempted])] });
}

// ------------- اختبار شامل للمفتاح -------------
export interface TestResult {
  models: GeminiModel[];
  chosen: string;
  sample?: string;
  generationError?: GeminiError;
}

export async function testGemini(key: string, preferredModel?: string): Promise<TestResult> {
  const k = cleanKey(key);
  if (!k) throw new GeminiError("لم تُدخل مفتاح API بعد — الصق مفتاحك ثم اضغط «اختبار الاتصال».", { status: 400 });
  let models: GeminiModel[];
  try {
    models = await listModels(k);
  } catch (e) {
    if (e instanceof GeminiError && e.status === 404) {
      // بعض المفاتيح لا تسمح بقائمة النماذج — نجرّب التوليد مباشرة
      throw e;
    }
    throw e;
  }
  const preferred = preferredModel?.replace(/^models\//, "").trim();
  const ranked = rankModels(models, preferred);
  const chosen = ranked[0];
  if (!chosen) throw new GeminiError("لا يوجد نموذج نصي متاح لهذا المفتاح", { status: 404 });
  try {
    const out = await generateOnce(k, chosen, "أجب بإيجاز شديد.", [], "اكتب جملة قصيرة جداً بالعربية تؤكد نجاح الاتصال.", 80);
    return { models, chosen: out.model, sample: out.text };
  } catch (e) {
    return { models, chosen, generationError: e instanceof GeminiError ? e : new GeminiError((e as Error)?.message || "فشل التوليد", {}) };
  }
}

export function describeGeminiError(e: unknown): { status?: number; message: string; hint: string; attempted: string[] } {
  if (e instanceof GeminiError) return { status: e.status, message: e.message, hint: e.hint, attempted: e.attempted };
  const err = e as Error;
  return { message: err?.message || "خطأ غير معروف", hint: hintFor(undefined), attempted: [] };
}
