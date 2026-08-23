import { useState, useEffect } from "react";
import { Sparkles, Loader2, Check, X, Clock, Search } from "lucide-react";
import * as db from "../lib/db";

export default function GenerateLeads({ stages, onChanged }) {
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [cooldownUntil, setCooldownUntil] = useState(null);

  const defaultStageKey = stages?.[0]?.key || "";

  const load = () => {
    setLoadingResults(true);
    Promise.all([db.getGeneratedLeads(), db.getLeadGenCooldown()])
      .then(([r, lastGen]) => {
        setResults(r);
        if (lastGen) {
          const next = new Date(new Date(lastGen).getTime() + 7 * 24 * 3600 * 1000);
          setCooldownUntil(next > new Date() ? next : null);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingResults(false));
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setBusy(true); setMsg("");
    try {
      const res = await db.generateLeads({ keyword, city });
      setMsg(`✅ Ketemu ${res.count} calon lead baru, cek daftar di bawah.`);
      load();
    } catch (e) {
      setMsg("Gagal: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const importLead = async (gl) => {
    try {
      await db.importGeneratedLead(gl, defaultStageKey);
      setResults((prev) => prev.filter((r) => r.id !== gl.id));
      onChanged();
    } catch (e) { alert("Gagal import: " + e.message); }
  };

  const dismissLead = async (id) => {
    try {
      await db.dismissGeneratedLead(id);
      setResults((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { alert("Gagal: " + e.message); }
  };

  const cooldownDaysLeft = cooldownUntil ? Math.ceil((cooldownUntil - new Date()) / 86400000) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Generate Leads</h1>
        <p className="text-sm text-slate-500 mt-1">AI cari calon lead baru lewat web search — Google Maps, LinkedIn, Instagram/TikTok bisnis, dan direktori Kemenperin. Maks 20 lead, 1x seminggu.</p>
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-5">
        {cooldownUntil ? (
          <div className="flex items-center gap-2.5 text-sm text-amber-700 bg-amber-50 rounded-2xl p-4">
            <Clock size={18} className="shrink-0" />
            <span>Udah dipake minggu ini — bisa generate lagi dalam <b>{cooldownDaysLeft} hari</b> ({cooldownUntil.toLocaleDateString("id-ID")}).</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Kata kunci / industri (opsional)</span>
                <input className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" placeholder="misal: distributor kabel listrik" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Kota (opsional)</span>
                <input className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" placeholder="misal: Surabaya" value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
            </div>
            <button onClick={generate} disabled={busy} className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? "Lagi nyari (bisa 1-2 menit)…" : "Generate Leads"}
            </button>
          </div>
        )}
        {msg && <p className={`text-xs mt-3 ${msg.startsWith("Gagal") ? "text-rose-600" : "text-emerald-700"}`}>{msg}</p>}
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">Hasil pencarian ({results.length})</h3>
        {loadingResults ? (
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Memuat…</div>
        ) : results.length === 0 ? (
          <div className="text-sm text-slate-400 bg-white border border-slate-100 rounded-2xl p-6 text-center">Belum ada hasil. Klik "Generate Leads" buat mulai nyari.</div>
        ) : (
          <div className="space-y-2.5">
            {results.map((r) => (
              <div key={r.id} className="bg-white border border-slate-100 rounded-2xl shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{r.name}</div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    {r.key_person && <div>👤 {r.key_person}{r.key_person_title ? ` · ${r.key_person_title}` : ""}</div>}
                    {r.product && <div>📦 {r.product}</div>}
                    {r.city && <div>📍 {r.city}</div>}
                    {r.website && <div>🌐 {r.website}</div>}
                    {r.phone && <div>📞 {r.phone}</div>}
                  </div>
                  {r.source_note && <div className="text-[11px] text-slate-400 mt-1.5 italic">via {r.source_note}</div>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => importLead(r)} title="Tambah ke Leads" className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check size={16} /></button>
                  <button onClick={() => dismissLead(r.id)} title="Abaikan" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
