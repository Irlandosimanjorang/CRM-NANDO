import { useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import * as db from "../lib/db";

// Konfirmasi hapus akun - dulu fitur ini gak ada sama sekali, satu-satunya
// cara hapus akun minta admin platform jalanin SQL manual. Perilakunya beda
// tergantung role (dieksekusi & divalidasi ULANG di edge function
// delete-my-account - ini cuma UI-nya, bukan satu-satunya penjaga):
// - Owner (org solo, ATAU owner tim Enterprise TANPA anggota lain lagi):
//   akun + SELURUH organisasinya (leads, deal, dst) kehapus PERMANEN. Wajib
//   ketik ulang email biar gak kepencet gak sengaja.
// - Role lain (sales_rep, dst): cukup KELUAR dari tim - data organisasi
//   TIDAK disentuh, cuma akun & keanggotaan pribadinya sendiri yang kehapus.
export default function DeleteAccountModal({ isOwner, otherMemberCount, orgName, userEmail, onClose }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const blockedByOtherMembers = isOwner && otherMemberCount > 0;
  const canSubmit = isOwner ? confirmText.trim().toLowerCase() === (userEmail || "").toLowerCase() && !blockedByOtherMembers : true;

  const handleDelete = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setErr("");
    try {
      await db.deleteMyAccount();
      await supabase.auth.signOut();
      // Reload penuh biar semua state React ke-reset bersih ke halaman login,
      // bukan cuma signOut doang yang bisa ninggalin state lama nyangkut.
      window.location.reload();
    } catch (e) {
      setErr(e.message || "Gagal hapus akun, coba lagi.");
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2 text-rose-600">
            <AlertTriangle size={18} /> Hapus Akun
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        {blockedByOtherMembers ? (
          <div className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
            Anda adalah owner team <b>{orgName || "ini"}</b> yang masih memiliki <b>{otherMemberCount} anggota lain</b>. Keluarkan semua anggota lain terlebih dahulu (tab Pengaturan &rarr; Team) sebelum menghapus akun, agar mereka tidak kehilangan akses secara tiba-tiba.
          </div>
        ) : isOwner ? (
          <>
            <p className="text-sm text-slate-600 mb-3">
              Tindakan ini akan menghapus akun Anda <b>DAN SELURUH DATA organisasi</b> <b>{orgName || "Anda"}</b> secara permanen - semua leads, deal, riwayat kunjungan, kompetitor, dan lainnya. <b>Tidak dapat dibatalkan.</b>
            </p>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Ketik ulang email Anda (<span className="font-mono">{userEmail}</span>) untuk konfirmasi:
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={userEmail}
              className="w-full px-3 py-2 text-sm border border-rose-200 rounded-xl bg-white focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
            />
          </>
        ) : (
          <p className="text-sm text-slate-600 mb-1">
            Anda akan keluar dari team <b>{orgName || "ini"}</b> dan akun Anda dihapus permanen. Data team (leads, dan lainnya) <b>TIDAK ikut terhapus</b> - anggota lain tetap dapat mengakses seperti biasa.
          </p>
        )}

        {err && <p className="text-xs text-rose-600 mt-2">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50">Batal</button>
          {!blockedByOtherMembers && (
            <button
              onClick={handleDelete}
              disabled={!canSubmit || busy}
              className="flex-1 text-sm px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null} {busy ? "Menghapus…" : "Ya, Hapus Permanen"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
