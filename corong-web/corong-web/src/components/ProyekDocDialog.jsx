import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { MEMO_FIELDS } from "../lib/proyekMemo";

const inp = "w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10";
function Field({ label, children }) { return <label className="block"><span className="text-xs font-medium text-slate-500">{label}</span>{children}</label>; }

// Pop-up memo atau detil proyek (31 Okt 2026), dipakai di Lead Modal dan pop-up Proyek Deal.
// Pop-up ini hanya menyimpan ke state pemanggilnya; penyimpanan ke database ada di tombol Simpan induknya.
export default function ProyekDocDialog({ kind, value, onCancel, onSave }) {
  const [detail, setDetail] = useState(value.detail_proyek || "");
  const [memo, setMemo] = useState(() => ({ ...(value.memo || {}) }));
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const isMemo = kind === "memo";
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/30 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900">{isMemo ? "Memo proyek" : "Detil proyek"}</h3>
        {isMemo ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {MEMO_FIELDS.map((m) => (
              <div key={m.key} className={m.wide ? "col-span-2" : ""}>
                <Field label={`${m.label}${m.required ? " *" : ""}`}>
                  <input className={inp} value={memo[m.key] || ""} placeholder={m.placeholder} onChange={(e) => setMemo((p) => ({ ...p, [m.key]: e.target.value }))} />
                </Field>
              </div>
            ))}
          </div>
        ) : (
          <Field label="Detil proyek *">
            <textarea className={`${inp} resize-none`} rows={6} value={detail} placeholder="Ruang lingkup dan detail pekerjaan" onChange={(e) => setDetail(e.target.value)} />
          </Field>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Batal</button>
          <button type="button" onClick={() => onSave(isMemo ? { memo } : { detail_proyek: detail })} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Simpan</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
