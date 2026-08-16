import { useState } from "react";
import { Lightbulb, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import * as db from "../lib/db";
import { stageMeta, chipStyle, daysSince } from "../lib/helpers";

const uMeta = { high: { label: "High", hex: "#e11d48" }, medium: { label: "Medium", hex: "#d97706" }, low: { label: "Low", hex: "#64748b" } };

export default function Advisor({ leads, stages, saved, onApplied, onOpen }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recs, setRecs] = useState(saved?.recs || []);
  const [ranAt, setRanAt] = useState(saved?.ran_at || "");

  const run = async () => {
    setError(""); setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-advisor`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sess.session.access_token}`, "Content-Type": "application/json" },
      });
      const dat = await resp.json();
      if (!resp.ok) throw new Error(dat.error || `HTTP ${resp.status}`);
      setRecs(dat.recs || []); setRanAt(dat.ranAt || "");
    } catch (e) {
      setError(`Analisis gagal: ${e.message}. Pastikan Edge Function "ai-advisor" sudah di-deploy dan ANTHROPIC_API_KEY sudah diset (lihat README).`);
    } finally { setLoading(false); }
  };

  const applyAction = async (lead, action) => { await db.upsertLead({ ...lead, next_action: action }); onApplied(); };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1"><Lightbulb size={20} className="text-amber-500" /><h1 className="text-2xl font-bold tracking-tight">AI Advisor</h1></div>
      <p className="text-sm text-slate-500 mb-4">Nge-scan lead paling potensial (prioritas tinggi + tahap maju), kasih rekomendasi langkah berikutnya.</p>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-slate-500">{loading ? "Menganalisis…" : ranAt ? `Terakhir dijalankan ${ranAt} · ${recs.length} rekomendasi` : "Belum dijalankan."}</div>
        <button onClick={run} disabled={loading} className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm">{loading ? <><Loader2 size={15} className="animate-spin" /> Menganalisis…</> : <><Lightbulb size={15} /> {ranAt ? "Jalankan ulang" : "Jalankan analisis"}</>}</button>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl p-3 mb-4 flex items-start gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}</div>}

      {recs.length > 0 && (
        <div className="space-y-2.5">
          {recs.map((r, i) => {
            const um = uMeta[r.urgency] || uMeta.low;
            const c = leads.find((x) => x.id === r.id);
            if (!c) return null;
            const ds = daysSince(c.last_contact);
            return (
              <div key={i} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">{c.name}<span className="text-[10px] border rounded-full px-2 py-0.5" style={chipStyle(stageMeta(stages, c.stage_key).hex)}>{stageMeta(stages, c.stage_key).label}</span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: um.hex }}>{um.label}</span></div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{ds === null ? "belum pernah dikontak" : ds === 0 ? "dikontak hari ini" : `${ds} hari sejak kontak terakhir`}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => applyAction(c, r.action)} className="text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5 font-medium flex items-center gap-1"><CheckCircle2 size={13} /> Jadikan next action</button>
                    <button onClick={() => onOpen(c)} className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50">Buka</button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mt-2">{r.assessment}</p>
                <div className="text-sm mt-1.5 flex items-start gap-1.5 text-amber-800 bg-amber-50 rounded-xl px-3 py-2"><Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-500" /> <span><b>Rekomendasi:</b> {r.action}</span></div>
                {Array.isArray(r.steps) && r.steps.length > 0 && <ul className="mt-2 space-y-1 pl-1">{r.steps.map((st, si) => <li key={si} className="text-xs text-slate-600 flex items-start gap-1.5"><span className="text-amber-500 mt-px">•</span><span>{st}</span></li>)}</ul>}
              </div>
            );
          })}
        </div>
      )}
      {!loading && recs.length === 0 && !error && <p className="text-sm text-slate-400">Klik "Jalankan analisis" buat dapetin rekomendasi.</p>}
    </div>
  );
}
