import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileSpreadsheet, X } from "lucide-react";
import * as db from "../lib/db";

// Pengumuman fitur ekspor ke Google Sheet (25 Okt 2026). Muncul sekali per user saat tab Report dibuka,
// lalu tidak muncul lagi setelah ditutup. Disimpan di localStorage per akun, jadi di perangkat lain bisa muncul lagi.
const KEY = "nexto-announce-sheets-export-v1";

export default function SheetsAnnouncement({ enterprise = false }) {
  const [uid, setUid] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    db.getCurrentUserId().then((id) => { if (alive) setUid(id); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!uid) return;
    try {
      if (!localStorage.getItem(`${KEY}:${uid}`)) setOpen(true);
    } catch (_) {
      setOpen(true);
    }
  }, [uid]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(`${KEY}:${uid}`, new Date().toISOString()); } catch (_) {}
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, uid]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sheets-announce-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-emerald-700"><FileSpreadsheet size={18} /></span>
            <div id="sheets-announce-title" className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">Unduh laporan ke Excel</div>
          </div>
          <button type="button" onClick={close} aria-label="Tutup" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink"><X size={16} /></button>
        </div>

        <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-slate-700">
          <p>Laporan di tab Report sekarang bisa diunduh sebagai file Excel. File langsung tersimpan di perangkat Anda dengan tiga tab: <b className="font-semibold text-ink">Penjualan</b>, <b className="font-semibold text-ink">Rencana</b>, dan <b className="font-semibold text-ink">Rekap</b>.</p>
          <p>Isinya sama dengan layar yang sedang Anda lihat, mengikuti periode, filter, dan anggota yang dipilih.</p>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
            {enterprise
              ? "Tombol unduh ada di bagian atas tab Report. Klik sekali, file langsung diunduh tanpa membuka tab baru."
              : "Fitur ini khusus paket Enterprise. Hubungi owner Nexto jika ingin mengaktifkannya."}
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <button type="button" onClick={close} className="rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-slate-800">Mengerti</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
