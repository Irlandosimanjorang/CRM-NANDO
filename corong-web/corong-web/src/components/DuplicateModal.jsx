import { useMemo, useState } from "react";
import { X, Copy, Merge, CheckCircle2, Loader2 } from "lucide-react";
import * as db from "../lib/db";
import { nameSimilarity, fmtDate } from "../lib/helpers";

const THRESHOLD = 0.72; // makin tinggi makin ketat

function Info({ lead }) {
  return (
    <div className="text-xs text-slate-600 space-y-0.5">
      {lead.city && <div>📍 {lead.city}{lead.province ? `, ${lead.province}` : ""}</div>}
      {lead.key_person && <div>👤 {lead.key_person}{lead.key_person_title ? ` (${lead.key_person_title})` : ""}</div>}
      {lead.phone && <div>📞 {lead.phone}</div>}
      {lead.email && <div>✉️ {lead.email}</div>}
      {lead.product && <div>📦 {lead.product}</div>}
      <div className="text-slate-400">Dibuat {fmtDate(lead.created_at)} · {(lead.progressLog || []).length} progress</div>
    </div>
  );
}

export default function DuplicateModal({ leads, onClose, onChanged }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [picks, setPicks] = useState({}); // pairKey -> id lead yang dipertahankan

  const pairs = useMemo(() => {
    const out = [];
    for (let i = 0; i < leads.length; i++) {
      for (let j = i + 1; j < leads.length; j++) {
        const score = nameSimilarity(leads[i].name, leads[j].name);
        if (score >= THRESHOLD) out.push({ key: `${leads[i].id}-${leads[j].id}`, a: leads[i], b: leads[j], score });
      }
    }
    return out.sort((x, y) => y.score - x.score);
  }, [leads]);

  const visible = pairs.filter((p) => !dismissed.has(p.key));

  const defaultKeep = (p) => {
    const filled = (l) => Object.values(l).filter((v) => v !== null && v !== undefined && v !== "" && v !== 0 && v !== false).length;
    return picks[p.key] || (filled(p.a) >= filled(p.b) ? p.a.id : p.b.id);
  };

  const merge = async (p) => {
    const keepId = defaultKeep(p);
    const keep = keepId === p.a.id ? p.a : p.b;
    const drop = keepId === p.a.id ? p.b : p.a;
    setBusyId(p.key);
    try {
      const fill = db.computeMergeFill(keep, drop);
      await db.mergeLeads(keep.id, drop.id, fill);
      setDismissed((s) => new Set([...s, p.key]));
      onChanged();
    } catch (e) { alert("Gagal gabungkan: " + e.message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h2 className="font-bold text-lg flex items-center gap-2"><Copy size={18} className="text-amber-500" /> Cek Duplikat</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div>
        <p className="text-sm text-slate-500 mb-4">Ditemukan {visible.length} pasangan nama company yang mirip. Klik kartu buat pilih mana yang mau dipertahankan, lalu Gabungkan.</p>

        {visible.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Ga ada duplikat kemungkinan (atau semua udah diproses). 👍</p>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {visible.map((p) => {
              const keepId = defaultKeep(p);
              return (
                <div key={p.key} className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
                  <div className="text-[10px] text-slate-400 mb-2 uppercase tracking-wide">Kemiripan {Math.round(p.score * 100)}%</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[p.a, p.b].map((l) => {
                      const isKeep = l.id === keepId;
                      return (
                        <div key={l.id} onClick={() => setPicks((pr) => ({ ...pr, [p.key]: l.id }))} className={`rounded-xl p-2.5 cursor-pointer border-2 ${isKeep ? "border-emerald-400 bg-emerald-50/50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <div className="flex items-center gap-1.5 mb-1"><span className="font-medium text-sm">{l.name}</span>{isKeep && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}</div>
                          <Info lead={l} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button onClick={() => merge(p)} disabled={busyId === p.key} className="text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-lg px-3 py-1.5 font-medium flex items-center gap-1.5">
                      {busyId === p.key ? <Loader2 size={13} className="animate-spin" /> : <Merge size={13} />} Gabungkan (simpan yang ditandai ✓)
                    </button>
                    <button onClick={() => setDismissed((s) => new Set([...s, p.key]))} className="text-xs text-slate-500 hover:text-slate-700 px-2">Abaikan, bukan duplikat</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4"><button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 w-full">Tutup</button></div>
      </div>
    </div>
  );
}
