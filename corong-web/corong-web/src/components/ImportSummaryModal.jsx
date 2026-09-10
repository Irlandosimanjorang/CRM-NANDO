import { createPortal } from "react-dom";
import { X, CheckCircle2, Copy, StickyNote, Sparkles } from "lucide-react";

// Ringkasan hasil import Excel/CSV - dulu cuma alert() polos "Import selesai:
// X lead" tanpa detail apa aja yang beneran masuk atau yang dilewatin karena
// duplikat. Sekarang ditampilin lengkap: daftar yang berhasil masuk (+ tanda
// kalau ada catatan yang ikut kesimpen sebagai progress note), dan daftar
// yang DITOLAK karena namanya duplikat (exact match ATAU mirip banget - sama
// threshold kayak fitur "Cek Duplikat"), biar user gak nyangka "kok kurang"
// pas jumlahnya beda dari total baris di Excel.
//
// BUG FIX (10 Sep 2026): duplikat itu bisa dari 2 SUMBER beda - (1) nama
// yang udah ada di CRM dari SEBELUM import ini, atau (2) 2+ baris yang mirip
// di DALAM file Excel yang lagi diimport ini juga. Sebelumnya keduanya
// digeneralisir jadi 1 teks "udah ada di CRM" - bikin akun BARU yang CRM-nya
// masih 100% kosong keliatan aneh/nyurigain pas ada baris yang "dilewati -
// udah ada di CRM" padahal gak ada satupun lead lama. Sekarang dibedain
// tegas lewat field `duplicates[].source` ("existing" vs "this_import").
export default function ImportSummaryModal({ summary, onClose }) {
  const { imported, duplicates, usedAiFallback } = summary;

  // Portal ke document.body - biar gak kena bug "kepotong/nempel ke kiri"
  // kalau dirender inline di dalam tree Leads.jsx (lihat catatan di
  // ManualColumnMapModal.jsx yang lebih lengkap).
  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 pb-28 md:pb-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" /> Ringkasan Import
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1">✅ {imported.length} masuk</span>
          {duplicates.length > 0 && (
            <span className="text-xs font-medium bg-amber-50 text-amber-700 rounded-full px-2.5 py-1">⚠️ {duplicates.length} dilewati (duplikat)</span>
          )}
          {usedAiFallback && (
            <span className="text-xs font-medium bg-violet-50 text-violet-700 rounded-full px-2.5 py-1 flex items-center gap-1"><Sparkles size={11} /> dibantu AI baca formatnya</span>
          )}
        </div>

        {imported.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Berhasil masuk ({imported.length})</p>
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              {imported.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5">
                  <span className="truncate">{l.name}</span>
                  {l.hasNote && <span title="Catatan dari Excel ikut kesimpen sebagai progress note" className="shrink-0 ml-2 text-slate-400"><StickyNote size={12} /></span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="mb-1">
            <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1"><Copy size={12} /> Dilewati - duplikat ({duplicates.length})</p>
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              {duplicates.map((d, i) => (
                <div key={i} className="text-xs bg-amber-50/60 rounded-lg px-2.5 py-1.5">
                  <span className="text-amber-800">{d.name}</span>
                  {/* Dibedain sumbernya - "udah ada di CRM" (data lama) vs
                      "duplikat di file yang sama" (2 baris mirip di Excel
                      yang sama-sama diimport barusan) - sebelumnya digeneralisir
                      jadi 1 teks doang, bikin akun BARU yang CRM-nya masih
                      kosong keliatan aneh pas ada baris "udah ada di CRM". */}
                  <span className="text-amber-500">
                    {" "}→ {d.source === "existing" ? "udah ada di CRM" : "duplikat di file yang sama"}
                    {d.matchedName && d.matchedName.toLowerCase() !== d.name.toLowerCase() && ` ("${d.matchedName}")`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {imported.length === 0 && duplicates.length === 0 && (
          <p className="text-sm text-slate-400 py-6 text-center">Ga ada baris yang diproses.</p>
        )}

        <div className="mt-4"><button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 w-full">Tutup</button></div>
      </div>
    </div>,
    document.body
  );
}
