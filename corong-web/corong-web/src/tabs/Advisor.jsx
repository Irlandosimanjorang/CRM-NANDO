import { useEffect, useState } from "react";
import { Lightbulb, Loader2, AlertCircle, CheckCircle2, User, MessageCircle, ExternalLink, Calendar } from "lucide-react";
import * as db from "../lib/db";
import { stageMeta, chipStyle, daysSince, fmtDate } from "../lib/helpers";

const uMeta = { high: { label: "High", hex: "#e11d48" }, medium: { label: "Medium", hex: "#d97706" }, low: { label: "Low", hex: "#64748b" } };

export default function Advisor({ leads, stages, onApplied, onOpen }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null); // run_date yang dipilih

  const load = async () => {
    setLoading(true); setError("");
    try {
      const rows = await db.getAdvisorHistory();
      setHistory(rows);
      setSelected(rows[0]?.run_date || null);
    } catch (e) { setError(`Gagal muat histori: ${e.message}`); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const applyAction = async (lead, action) => { await db.upsertLead({ ...lead, next_action: action }); onApplied(); };

  const today = new Date().toISOString().slice(0, 10);
  const dayLabel = (d) => {
    if (d === today) return "Hari ini";
    const yd = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (d === yd) return "Kemarin";
    return new Date(d).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
  };

  const current = history.find((h) => h.run_date === selected);
  const recs = current?.recs || [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-1"><Lightbulb size={20} className="text-orange-500" /><h1 className="text-2xl font-bold tracking-tight">AI Advisor</h1></div>
      <p className="text-sm text-slate-500 mb-4">Rekomendasi lead paling potensial, dikirim otomatis tiap jam 8 pagi ke email kamu. Histori 7 hari terakhir bisa dilihat di sini.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-10 justify-center"><Loader2 size={16} className="animate-spin" /> Memuat histori…</div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl p-3 flex items-start gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}</div>
      ) : history.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400">
          <Calendar size={32} className="mx-auto text-slate-300 mb-3" />
          Belum ada rekomendasi. Analisis otomatis jalan tiap jam 8 pagi — cek lagi besok, atau lihat email kamu.
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {history.map((h) => (
              <button key={h.run_date} onClick={() => setSelected(h.run_date)} className={`shrink-0 text-xs px-3 py-2 rounded-xl border font-medium ${selected === h.run_date ? "bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-600/20" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {dayLabel(h.run_date)}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400 mb-3">{current?.ran_at ? `Dijalankan ${current.ran_at}` : ""} · {recs.length} rekomendasi</div>

          {recs.length === 0 ? (
            <p className="text-sm text-slate-400">Ga ada rekomendasi di hari ini (mungkin belum ada lead aktif saat itu).</p>
          ) : (
            <div className="space-y-2.5">
              {recs.map((r, i) => {
                const um = uMeta[r.urgency] || uMeta.low;
                const c = leads.find((x) => x.id === r.id);
                if (!c) return null;
                const ds = daysSince(c.last_contact);
                return (
                  <div key={i} className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-semibold flex items-center gap-2 flex-wrap">{c.name}<span className="text-[10px] border rounded-full px-2 py-0.5" style={chipStyle(stageMeta(stages, c.stage_key).hex)}>{stageMeta(stages, c.stage_key).label}</span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: um.hex }}>{um.label}</span></div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{ds === null ? "belum pernah dikontak" : ds === 0 ? "dikontak hari ini" : `${ds} hari sejak kontak terakhir`}</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => applyAction(c, r.action)} className="text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-3 py-1.5 font-medium flex items-center gap-1"><CheckCircle2 size={13} /> Jadikan next action</button>
                        <button onClick={() => onOpen(c)} className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50">Buka</button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">{r.assessment}</p>
                    <div className="text-sm mt-1.5 flex items-start gap-1.5 text-orange-800 bg-orange-50 rounded-xl px-3 py-2"><Lightbulb size={14} className="mt-0.5 shrink-0 text-orange-500" /> <span><b>Rekomendasi:</b> {r.action}</span></div>
                    {Array.isArray(r.steps) && r.steps.length > 0 && <ul className="mt-2 space-y-1 pl-1">{r.steps.map((st, si) => <li key={si} className="text-xs text-slate-600 flex items-start gap-1.5"><span className="text-orange-500 mt-px">•</span><span>{st}</span></li>)}</ul>}

                    {(r.contact_name_guess || r.contact_role) && (
                      <div className="mt-2.5 flex items-start gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <User size={13} className="mt-0.5 shrink-0 text-slate-400" />
                        {r.contact_name_guess ? (
                          <span className="text-slate-700">
                            <b>{r.contact_name_guess}</b>{r.contact_title_guess ? ` — ${r.contact_title_guess}` : ""}
                            <span className="text-orange-600 ml-1">(belum terverifikasi, cek ulang)</span>
                            {r.contact_source && <a href={r.contact_source} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline ml-1 inline-flex items-center gap-0.5">sumber <ExternalLink size={10} /></a>}
                          </span>
                        ) : (
                          <span className="text-slate-600">Cari kontak: <b>{r.contact_role}</b></span>
                        )}
                      </div>
                    )}
                    {r.talking_point && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 text-sky-800">
                        <MessageCircle size={13} className="mt-0.5 shrink-0 text-sky-500" /> "{r.talking_point}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
