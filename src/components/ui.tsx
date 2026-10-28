import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({ icon: Icon, title, sub, accent = "#f97316" }: { icon: LucideIcon; title: string; sub: string; accent?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl" style={{ background: `${accent}1f`, boxShadow: `inset 0 0 0 1px ${accent}55` }}>
          <Icon className="size-5" style={{ color: accent }} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-black text-white leading-tight">{title}</h1>
          <p className="text-[13px] text-slate-400">{sub}</p>
        </div>
      </div>
    </div>
  );
}

export function SliderRow({ label, value, display, min, max, step, onChange, tone = "", hint }: {
  label: string; value: number; display: string; min: number; max: number; step: number;
  onChange: (v: number) => void; tone?: "" | "cool" | "gold"; hint?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[13px]">
        <span className="font-bold text-slate-300">{label}</span>
        <span className="scene-tag text-ember">{display}</span>
      </div>
      <input type="range" className={`geo-slider ${tone}`} dir="ltr" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function InfoRow({ k, v, icon: Icon }: { k: string; v: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 border border-white/[0.06]">
      <span className="flex items-center gap-1.5 text-[12px] font-bold text-slate-400 shrink-0">
        {Icon && <Icon className="size-3.5 text-slate-500" />}{k}
      </span>
      <span className="text-[12px] font-bold text-slate-200 text-left leading-relaxed">{v}</span>
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange, blue = false }: {
  options: { v: T; label: string; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void; blue?: boolean;
}) {
  return (
    <div className={`seg ${blue ? "seg-blue" : ""}`}>
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.icon && <o.icon className="ml-1 inline size-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, children, className = "", icon: Icon }: { title?: string; children: ReactNode; className?: string; icon?: LucideIcon }) {
  return (
    <div className={`glass rounded-2xl p-4 shadow-2xl ${className}`}>
      {title && (
        <div className="mb-3 flex items-center gap-2 border-b border-white/[0.07] pb-2.5">
          {Icon && <Icon className="size-4 text-magma" />}
          <h3 className="font-display text-[13px] font-black text-slate-100">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ children, color = "#f97316" }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold"
      style={{ color, background: `${color}1a`, boxShadow: `inset 0 0 0 1px ${color}40` }}>
      {children}
    </span>
  );
}
