import { useState, useEffect, useMemo } from "react";
import { X, Sparkles, Loader2, CheckCircle2, AlertTriangle, Tag, Clock, Phone } from "lucide-react";
import * as db from "../lib/db";

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function DataCleanupModal({ leads, stages, onClose, onChanged }) {
  const [tab, setTab] = useState("kategori");

  const lostStage = stages.find((s) => s.type === "lost");
  const wonKeys = stages.filter((s) => s.type === "won").map((s) => s.key);
  const lostKeys = stages.filter((s) => s.type === "lost").map((s) => s.key);
  const active = useMemo(() => leads.filter((l) => !wonKeys.includes(l.stage_key) && !lostKeys.includes(l.stage_key)), [leads]);

  // --- Kategori ---
  const [catSuggestions, setCatSuggestions] = useState(null);
  const [catLoading, setCatLoading] = useState(false);
  const [catChecked, setCatChecked] = useState({});
  const [catBusy, setCatBusy] = useState(false);

  const scanCategories = async () => {
    setCatLoading(true);
    try {
      const s = await db.getSuggestedCategories();
      setCatSuggestions(s);
      setCatChecked(Object.fromEntries(s.map((x) => [x.id, true])));
    } catch (e) { alert("Gagal scan: " + e.message); }
    finally { setCatLoading(false); }
  };
  const applyCategories = async () => {
    const chosen = catSuggestions.filter((s) => catChecked[s.id]);
    if (chosen.length === 0) return;
    setCatBusy(true);
    try {
      await db.bulkUpdateCategory(chosen);
      setCatSuggestions(catSuggestions.filter((s) => !catChecked[s.id]));
      onChanged();
    } catch (e) { alert("Gagal apply: " + e.message); }
    finally { setCatBusy(false); }
  };

  // --- Stale leads ---
  const staleLeads = useMemo(() => active.filter((l) => {
    const ds = daysSince(l.last_contact);
    return ds === null || ds >= 90;
  }), [active]);
  const [staleChecked, setStaleChecked] = useState({});
  const [staleBusy, setStaleBusy] = useState(false);
  const applyStale = async () => {
    if (!lostStage) { alert("Ga ada tahap bertipe 'Lost' di pengaturan pipeline kamu."); return; }
    const ids = staleLeads.filter((l) => staleChecked[l.id]).map((l) => l.id);
    if (ids.length === 0) return;
    setStaleBusy(true);
    try {
      await db.bulkMarkLost(ids, lostStage.key);
      onChanged();
      onClose();
    } catch (e) { alert("Gagal apply: " + e.message); }
    finally { setStaleBusy(false); }
  };

  // --- Kontak kurang lengkap ---
  const incompleteLeads = useMemo(() => active.filter((l) => !l.city || !l.phone), [active]);

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg flex items-center gap-2"><Sparkles size={18} className="text-orange-500" /> Rapihin Data</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Semua perubahan tetap butuh persetujuan kamu — ga ada yang dieksekusi otomatis.</p>

        <div className="flex gap-2 mb-4 border-b border-slate-200">
          <button onClick={() => setTab("kategori")} className={`text-sm px-3 py-2 border-b-2 -mb-px ${tab === "kategori" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500"}`}>Kategori</button>
          <button onClick={() => setTab("stale")} className={`text-sm px-3 py-2 border-b-2 -mb-px ${tab === "stale" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500"}`}>Ga Aktif</button>
          <button onClick={() => setTab("kontak")} className={`text-sm px-3 py-2 border-b-2 -mb-px ${tab === "kontak" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500"}`}>Kontak Kurang</button>
        </div>

        {tab === "kategori" && (
          <div>
            {catSuggestions === null ? (
              <div className="text-center py-8">
                <Tag size={28} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-slate-500 mb-3">Scan lead berkategori "Lainnya" buat cari saran kategori yang lebih spesifik.</p>
                <button onClick={scanCategories} disabled={catLoading} className="text-sm bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl px-4 py-2 font-medium inline-flex items-center gap-1.5">
                  {catLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Scan sekarang
                </button>
              </div>
            ) : catSuggestions.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Ga ada saran baru. Semua lead "Lainnya" udah dicek atau ga ada info cukup. 👍</p>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {catSuggestions.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={!!catChecked[s.id]} onChange={(e) => setCatChecked((p) => ({ ...p, [s.id]: e.target.checked }))} className="w-4 h-4 accent-orange-600" />
                    <div className="flex-1 min-w-0"><div className="font-medium text-sm">{s.name}</div><div className="text-xs text-slate-400">Lainnya → <span className="text-orange-600 font-medium">{s.suggested}</span></div></div>
                  </label>
                ))}
                <button onClick={applyCategories} disabled={catBusy} className="text-sm bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl px-4 py-2 font-medium flex items-center gap-1.5">
                  {catBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Terapkan yang dicentang
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "stale" && (
          <div>
            {staleLeads.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Semua lead aktif masih ada kontak dalam 90 hari terakhir. 👍</p>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {staleLeads.length} lead ga ada kontak 90+ hari. Centang yang mau ditandai "Lost".</p>
                {staleLeads.map((l) => (
                  <label key={l.id} className="flex items-center gap-3 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={!!staleChecked[l.id]} onChange={(e) => setStaleChecked((p) => ({ ...p, [l.id]: e.target.checked }))} className="w-4 h-4 accent-orange-600" />
                    <div className="flex-1 min-w-0"><div className="font-medium text-sm">{l.name}</div><div className="text-xs text-slate-400 flex items-center gap-1"><Clock size={11} /> {daysSince(l.last_contact) === null ? "belum pernah dikontak" : `${daysSince(l.last_contact)} hari lalu`}</div></div>
                  </label>
                ))}
                <button onClick={applyStale} disabled={staleBusy} className="text-sm bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl px-4 py-2 font-medium flex items-center gap-1.5">
                  {staleBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Tandai sebagai Lost
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "kontak" && (
          <div>
            {incompleteLeads.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Semua lead aktif punya data kota & telepon lengkap. 👍</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                <p className="text-xs text-slate-500 mb-2">Ga bisa diisi otomatis (biar ga ada data ngarang) — ini daftar buat kamu lengkapin manual:</p>
                {incompleteLeads.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 border border-slate-200 rounded-xl p-3">
                    <Phone size={14} className="text-slate-300 shrink-0" />
                    <div className="flex-1 min-w-0"><div className="font-medium text-sm">{l.name}</div><div className="text-xs text-slate-400">{!l.city ? "kota kosong" : ""}{!l.city && !l.phone ? " · " : ""}{!l.phone ? "telepon kosong" : ""}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
