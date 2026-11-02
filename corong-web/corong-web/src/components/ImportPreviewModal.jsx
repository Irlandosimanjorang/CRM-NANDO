import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

// Pratinjau impor (3 Nov 2026): semua baris dari file tampil, user yang memutuskan mana yang dimasukkan.
// Baris baru tercentang otomatis. Duplikat dan baris tanpa nama tidak tercentang, tapi duplikat bisa dicentang manual.
const STATUS_LABEL = {
  baru: { text: "Baru", cls: "bg-emerald-50 text-emerald-700" },
  duplikat: { text: "Duplikat", cls: "bg-amber-50 text-amber-700" },
  kosong: { text: "Tanpa nama", cls: "bg-slate-100 text-slate-500" },
};

export default function ImportPreviewModal({ items, onCancel, onConfirm }) {
  const [selected, setSelected] = useState(() => new Set(items.filter((it) => it.status === "baru").map((it) => it.key)));
  const counts = useMemo(() => ({
    baru: items.filter((it) => it.status === "baru").length,
    duplikat: items.filter((it) => it.status === "duplikat").length,
    kosong: items.filter((it) => it.status === "kosong").length,
  }), [items]);

  const toggle = (key) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const setAll = (predicate) => setSelected(new Set(items.filter(predicate).map((it) => it.key)));

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-base font-semibold text-slate-900">Pilih lead yang mau diimpor</h3>
          <p className="mt-1 text-[12.5px] text-slate-500">
            {items.length} baris terbaca: {counts.baru} baru, {counts.duplikat} duplikat, {counts.kosong} tanpa nama. Yang dicentang akan dimasukkan.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
            <button type="button" onClick={() => setAll((it) => it.status === "baru")} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">Pilih yang baru</button>
            <button type="button" onClick={() => setAll((it) => it.status !== "kosong")} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">Pilih semua</button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">Kosongkan</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Kota</th>
                <th className="px-3 py-2">Telepon</th>
                <th className="px-3 py-2">PIC</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => {
                const st = STATUS_LABEL[it.status];
                const disabled = it.status === "kosong";
                return (
                  <tr key={it.key} className={disabled ? "opacity-50" : "hover:bg-slate-50"}>
                    <td className="px-3 py-2 align-top">
                      <input type="checkbox" checked={selected.has(it.key)} disabled={disabled} onChange={() => toggle(it.key)} aria-label={`Pilih ${it.name || "baris ini"}`} className="h-4 w-4 accent-orange-600" />
                    </td>
                    <td className="px-3 py-2 align-top font-medium text-slate-800">{it.name || <span className="text-slate-400">(kosong)</span>}</td>
                    <td className="px-3 py-2 align-top text-slate-600">{it.city || "-"}</td>
                    <td className="px-3 py-2 align-top text-slate-600">{it.phone || "-"}</td>
                    <td className="px-3 py-2 align-top text-slate-600">{it.key_person || "-"}</td>
                    <td className="px-3 py-2 align-top">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
                      {it.status === "duplikat" && it.matchedName && <div className="mt-1 text-[11px] text-slate-500">mirip: {it.matchedName}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4">
          <span className="text-[12px] text-slate-500">{selected.size} lead dipilih</span>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Batal</button>
            <button type="button" disabled={selected.size === 0} onClick={() => onConfirm(selected)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              Impor {selected.size} lead
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
