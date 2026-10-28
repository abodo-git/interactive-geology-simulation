// مخزن حالة عالمي بسيط لمشاركة حالة المحاكاة بين الوحدات والمستشار الذكي
export type FaultType = "strike" | "normal" | "reverse";

export interface SimState {
  earthLayer: string | null;
  explode: number;
  volcano: { silica: number; gas: number; erupting: boolean; style: string };
  quake: { mag: number; fault: FaultType; depth: number; duration: number; active: boolean; lastReport: string | null };
  plate: string | null;
}

export const simState: SimState = {
  earthLayer: null,
  explode: 0,
  volcano: { silica: 58, gas: 55, erupting: false, style: "خامل" },
  quake: { mag: 5.5, fault: "strike", depth: 15, duration: 20, active: false, lastReport: null },
  plate: null,
};

export function describeSimState(): string {
  const v = simState.volcano;
  const q = simState.quake;
  const faultAr = q.fault === "strike" ? "انزلاقي أفقي" : q.fault === "normal" ? "عادي (تمددي)" : "معكوس (انضغاطي)";
  return [
    simState.earthLayer ? `الطبقة المحددة في نموذج الأرض: ${simState.earthLayer} (تفكيك ${(simState.explode * 100) | 0}%)` : "نموذج طبقات الأرض: بدون طبقة محددة",
    `البركان: سيليكا ${v.silica}%، غاز ${v.gas}%، الحالة: ${v.erupting ? "يثور الآن" : "خامل"}، النمط: ${v.style}`,
    `الزلزال: شدة ${q.mag} Mw، الفالق ${faultAr}، عمق البؤرة ${q.depth} كم، المدة ${q.duration} ث، ${q.active ? "هزة نشطة" : "ساكن"}${q.lastReport ? `، آخر تقرير: ${q.lastReport}` : ""}`,
    simState.plate ? `الصفيحة المحددة: ${simState.plate}` : "الصفائح: بدون تحديد",
  ].join("\n");
}
