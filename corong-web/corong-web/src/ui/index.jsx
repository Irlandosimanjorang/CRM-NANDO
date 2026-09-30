// Komponen bersama Nexto - aturan pemakaiannya di docs/DESIGN.md.
// Halaman baru pakai ini dulu sebelum nulis class sendiri, biar semua tab
// ngomong satu bahasa visual.
import { ArrowRight } from "lucide-react";

const cn = (...v) => v.filter(Boolean).join(" ");

// Wadah pengelompokan: radius 20px, border tipis, tanpa bayangan.
export function Panel({ as: Tag = "section", className = "", children, ...rest }) {
  return <Tag className={cn("rounded-panel border border-slate-200/80 bg-white", className)} {...rest}>{children}</Tag>;
}

// Judul panel: judul (Sora), keterangan opsional, aksi teks opsional di kanan.
export function PanelHeader({ title, meta, action, onAction, right, className = "" }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-2", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
        {meta && <p className="mt-0.5 text-[11.5px] text-slate-500">{meta}</p>}
      </div>
      {right}
      {action && (
        <button onClick={onAction} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full text-[12px] font-semibold text-brand-strong hover:text-orange-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {action}<ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

const TONE_TEXT = { ink: "text-ink", brand: "text-brand-strong", good: "text-emerald-600", warn: "text-amber-600", bad: "text-rose-600", muted: "text-slate-400" };

// Satu angka + label + keterangan. Dipakai di dalam StatRow.
export function Stat({ value, label, hint, tone = "ink", className = "" }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("font-display text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums", TONE_TEXT[tone])}>{value}</div>
      <div className="mt-2 text-[12px] font-semibold text-slate-700">{label}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

// Deretan Stat dalam SATU panel, dipisah garis - bukan 4 kartu terpisah.
export function StatRow({ children, className = "" }) {
  return (
    // gap-px + latar abu = garis pemisah 1px yang rapi di 2 maupun 4 kolom.
    <Panel className={cn("grid grid-cols-2 gap-px overflow-hidden bg-slate-100 lg:grid-cols-4 [&>*]:bg-white [&>*]:px-5 [&>*]:py-4", className)}>
      {children}
    </Panel>
  );
}

const PILL = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-brand-soft text-brand-strong",
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-rose-50 text-rose-700",
  ai: "bg-ai-soft text-ai",
};
export function Pill({ tone = "neutral", children, className = "" }) {
  return <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", PILL[tone], className)}>{children}</span>;
}

const METER = { brand: "bg-brand", good: "bg-emerald-500", ink: "bg-slate-800", warn: "bg-amber-400", bad: "bg-rose-500", muted: "bg-slate-300" };
// Bar satu warna. `value` / `max`; minimal kelihatan tipis kalau > 0.
export function Meter({ value, max, tone = "brand", className = "h-1.5" }) {
  const pct = max > 0 ? Math.min(100, (Number(value) / Number(max)) * 100) : 0;
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500", METER[tone])} style={{ width: `${value > 0 ? Math.max(4, pct) : 0}%` }} />
    </div>
  );
}

// Keadaan kosong yang memberi arah.
export function EmptyState({ children, action, onAction }) {
  return (
    <div className="rounded-inner border border-dashed border-slate-200 px-4 py-6 text-center">
      <p className="text-[12px] text-slate-500">{children}</p>
      {action && <button onClick={onAction} className="mt-2 text-[12px] font-semibold text-brand-strong hover:text-orange-800">{action}</button>}
    </div>
  );
}
