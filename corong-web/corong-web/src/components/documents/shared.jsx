// Komponen kecil bersama untuk fitur Dokumen (Quotation & Invoice).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { Pill } from "../../ui";
import { STATUS_META, effectiveStatus } from "../../lib/documents";

export const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10 disabled:bg-slate-50 disabled:text-slate-500";
export const lbl = "mb-1 block text-[11.5px] font-semibold text-slate-600";
export const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-strong px-4 py-2 text-[13px] font-semibold text-white hover:bg-orange-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
export const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
export const btnDanger = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50";

export function StatusPill({ doc }) {
  const key = doc.number || doc.status !== "draft" ? effectiveStatus(doc) : "draft";
  const m = STATUS_META[key] || STATUS_META.draft;
  return <Pill tone={m.tone}>{m.label}</Pill>;
}

export function Spinner({ className = "" }) {
  return <Loader2 size={15} className={`animate-spin ${className}`} />;
}

// Modal ringan di atas semua tab. Tutup dengan Esc atau klik latar.
export function Modal({ title, onClose, children, width = "max-w-lg", footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pb-28 md:pb-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`my-8 w-full ${width} rounded-panel bg-white p-5 shadow-float outline-none`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={17} /></button>
        </div>
        {children}
        {footer && <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// Pratinjau dokumen selebar kertas A4 (794px) yang diskalakan agar muat di
// panel; tata letak cetak tetap sama walau panelnya sempit.
export function DocPreview({ html, minHeight = 600 }) {
  const wrap = useRef(null);
  const [w, setW] = useState(0);
  const [h, setH] = useState(minHeight);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const update = () => setW(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = w ? Math.min(1, w / 794) : 1;
  return (
    <div ref={wrap} className="w-full overflow-hidden bg-white" style={{ height: h * scale }}>
      <iframe
        title="Pratinjau dokumen" sandbox="allow-same-origin" srcDoc={html}
        onLoad={(e) => { const d = e.currentTarget.contentDocument; if (d) setH(Math.max(minHeight, d.documentElement.scrollHeight)); }}
        style={{ width: 794, height: h, border: 0, display: "block", transform: `scale(${scale})`, transformOrigin: "top left" }}
      />
    </div>
  );
}

// Pesan galat dari Supabase/RPC -> teks yang bisa dibaca pengguna.
export const errText = (e) => String(e?.message || e || "Terjadi kesalahan.");

// Angka dengan pemisah ribuan untuk kolom input (hanya digit).
export const digits = (v) => String(v ?? "").replace(/[^\d]/g, "");
export const fmtInt = (v) => (v === "" || v == null ? "" : Number(v).toLocaleString("id-ID"));
