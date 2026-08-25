import { useState, useEffect } from "react";
import { X, Trash2, RotateCcw, AlertTriangle, Loader2, Inbox } from "lucide-react";
import * as db from "../lib/db";
import { fmtDate } from "../lib/helpers";

// Recycle Bin - jaring pengaman buat lead yang kehapus (baik dihapus manual
// lewat UI, atau nanti kalau bot Telegram/AI ngambil aksi otomatis buat hapus
// lead). deleteLead() itu SOFT delete (isi kolom deleted_at doang, gak beneran
// ilang dari database), jadi selama belum di-"Hapus Permanen" di sini, masih
// bisa dibalikin kapan aja.
export default function RecycleBinModal({ onClose, onChanged }) {
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try { setItems(await db.getDeletedLeads()); }
    catch (e) { alert("Gagal muat: " + e.message); }
  };
  useEffect(() => { load(); }, []);

  const restore = async (id) => {
    setBusyId(id);
    try { await db.restoreLead(id); await load(); onChanged && onChanged(); }
    catch (e) { alert("Gagal restore: " + e.message); }
    finally { setBusyId(null); }
  };

  const purge = async (id, name) => {
    if (!window.confirm(`Hapus PERMANEN "${name}"? Ini gak bisa dibalikin lagi selamanya.`)) return;
    setBusyId(id);
    try { await db.permanentlyDeleteLead(id); await load(); }
    catch (e) { alert("Gagal hapus: " + e.message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg my-8 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2"><Trash2 size={18} className="text-slate-400" /> Recycle Bin</h2>
            <p className="text-xs text-slate-400 mt-0.5">Lead yang kehapus masih bisa dibalikin dari sini.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {items === null ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center"><Loader2 size={15} className="animate-spin" /> Memuat…</div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Inbox size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Recycle bin kosong.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 border border-slate-100 rounded-2xl p-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-800 truncate">{l.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Dihapus {fmtDate(l.deleted_at)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => restore(l.id)} disabled={busyId === l.id} className="text-xs flex items-center gap-1 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 rounded-lg px-2.5 py-1.5 font-medium">
                      <RotateCcw size={12} /> Balikin
                    </button>
                    <button onClick={() => purge(l.id, l.name)} disabled={busyId === l.id} className="text-xs flex items-center gap-1 text-rose-600 hover:bg-rose-50 disabled:opacity-50 rounded-lg px-2.5 py-1.5 font-medium">
                      <AlertTriangle size={12} /> Hapus Permanen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
