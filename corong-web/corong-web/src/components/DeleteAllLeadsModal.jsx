import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import * as db from "../lib/db";

// Hapus semua lead (9 Okt 2026, permintaan Nando; berlaku umum untuk owner/manager semua pengguna Nexto).
// Lead masuk Recycle Bin (bisa dipulihkan atau dihapus permanen dari sana). Tombol baru aktif setelah kata konfirmasi diketik.
const WORD = "HAPUS SEMUA";

// request = true (marketing Enterprise): bukan menghapus, tetapi mengirim permintaan persetujuan ke owner/manager.
export default function DeleteAllLeadsModal({ count, onClose, onDone, request = false }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const esc = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [busy, onClose]);

  const ok = request || text.trim().toUpperCase() === WORD;
  const run = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr("");
    try {
      if (request) { const r = await db.requestDeleteAllMyLeads(); onDone?.(r?.count ?? count); }
      else { const n = await db.deleteAllLeads(WORD); onDone?.(n); }
    } catch (e) {
      setErr(String(e?.message || e));
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Hapus semua lead" className="relative my-10 w-full max-w-md rounded-panel bg-white p-6 shadow-float">
        <button type="button" onClick={onClose} disabled={busy} aria-label="Tutup" className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600"><AlertTriangle size={18} /></span>
          <div>
            <h2 className="text-[16px] font-bold tracking-[-0.02em] text-ink">{request ? "Minta hapus semua lead saya" : "Hapus semua lead"}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              {request ? (
                <><b className="text-ink">{count} lead</b> milik Anda akan dipindahkan ke Recycle Bin setelah owner atau manager menyetujui. Sebelum disetujui, lead Anda tidak berubah.</>
              ) : (
                <><b className="text-ink">{count} lead</b> milik seluruh tim akan dipindahkan ke Recycle Bin. Lead di sana masih bisa dipulihkan, dan baru terhapus permanen bila Anda mengosongkan Recycle Bin.</>
              )}
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-1 rounded-inner bg-slate-50 px-4 py-3 text-[12px] text-slate-600">
          {request ? <li>Hanya lead yang Anda pegang. Lead anggota lain tidak ikut.</li> : <li>Berlaku untuk semua anggota tim, bukan hanya lead Anda.</li>}
          <li>Catatan progres, percakapan, dan riwayat lead tersimpan bersama lead di Recycle Bin.</li>
          <li>Tindakan ini tercatat di aktivitas tim.</li>
        </ul>
        {!request && (
        <label className="mt-4 block text-[12px] font-semibold text-slate-700">
          Ketik <span className="font-mono text-rose-600">{WORD}</span> untuk melanjutkan
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }} disabled={busy} autoComplete="off" spellCheck={false} className="mt-1.5 w-full rounded-inner border border-slate-300 px-3 py-2 text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500" />
        </label>
        )}
        {err && <p className="mt-2 text-[12px] text-rose-600">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100">Batal</button>
          <button type="button" onClick={run} disabled={!ok || busy} className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40">
            {busy && <Loader2 size={14} className="animate-spin" />} {request ? "Kirim permintaan" : `Hapus ${count} lead`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
