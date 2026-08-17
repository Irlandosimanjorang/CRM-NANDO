import { useMemo, useState } from "react";
import { Trophy, Building2, TrendingUp, Plus, Search, Save, X } from "lucide-react";
import * as db from "../lib/db";
import { stageMeta, chipStyle, typeBadge, fmtRp, fmtDate, todayISO } from "../lib/helpers";

const inp = "w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10";

function AddDealModal({ leads, stages, onClose, onSaved }) {
  const wonStages = stages.filter((s) => s.type === "won");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [stageKey, setStageKey] = useState(wonStages[0]?.key || stages[0]?.key);
  const [date, setDate] = useState(todayISO());
  const [chemical, setChemical] = useState("");
  const [tonnage, setTonnage] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = q.trim() ? leads.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const pick = (c) => {
    setSel(c); setQ("");
    setChemical(c.chemical || ""); setTonnage(c.tonnage || ""); setValue(c.deal_value || "");
    setDate(c.deal_date || todayISO());
  };
  const save = async () => {
    if (!sel) { alert("Pilih company dulu."); return; }
    setBusy(true);
    try {
      await db.upsertLead({ ...sel, stage_key: stageKey, deal_date: date, chemical, tonnage: Number(tonnage) || 0, deal_value: Number(value) || 0 });
      onSaved();
    } catch (e) { alert("Gagal simpan: " + e.message); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg flex items-center gap-2"><Trophy size={18} className="text-emerald-500" /> Tambah Deal</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div>
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-slate-500">Company *</span>
            {sel ? (
              <div className="mt-1 flex items-center justify-between border border-orange-300 bg-orange-50 rounded-xl px-3 py-2"><span className="text-sm font-medium">{sel.name}</span><button onClick={() => setSel(null)} className="text-xs text-slate-500 hover:text-rose-500">ganti</button></div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-2.5 top-3.5 text-slate-400" />
                <input autoFocus className="w-full mt-1 pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari company dari leads…" />
                {matches.length > 0 && <div className="mt-1 border border-slate-200 rounded-xl bg-white shadow-sm max-h-52 overflow-y-auto">{matches.map((c) => <div key={c.id} onClick={() => pick(c)} className="px-3 py-2 text-sm hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0"><div className="font-medium">{c.name}</div><div className="text-[11px] text-slate-400">{[c.city, c.category].filter(Boolean).join(" · ")}</div></div>)}</div>}
                {q.trim() && matches.length === 0 && <p className="text-xs text-slate-400 mt-1">Company ga ketemu. Tambahin di tab Leads dulu.</p>}
              </div>
            )}
          </div>
          <div className={sel ? "" : "opacity-40 pointer-events-none"}>
            <label className="block mb-3"><span className="text-xs font-medium text-slate-500">Tahap deal</span>
              <select className={inp} value={stageKey} onChange={(e) => setStageKey(e.target.value)}>{wonStages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block"><span className="text-xs font-medium text-slate-500">Tanggal deal</span><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label className="block"><span className="text-xs font-medium text-slate-500">Chemical</span><input className={inp} value={chemical} onChange={(e) => setChemical(e.target.value)} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-medium text-slate-500">Tonase</span><input type="number" step="any" className={inp} value={tonnage} onChange={(e) => setTonnage(e.target.value)} /></label>
              <label className="block"><span className="text-xs font-medium text-slate-500">Revenue (Rp)</span><input type="number" className={inp} value={value} onChange={(e) => setValue(e.target.value)} /></label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5"><button onClick={save} disabled={busy} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm shadow-orange-600/20"><Save size={15} /> Simpan deal</button><button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50">Batal</button></div>
      </div>
    </div>
  );
}

export default function Deal({ leads, stages, onEdit, onChanged }) {
  const [add, setAdd] = useState(false);
  const wonKeys = stages.filter((s) => s.type === "won").map((s) => s.key);
  const deals = useMemo(() => leads.filter((c) => wonKeys.includes(c.stage_key)), [leads, stages]);
  const totalValue = deals.reduce((a, c) => a + (Number(c.deal_value) || 0), 0);
  const totalTon = deals.reduce((a, c) => a + (Number(c.tonnage) || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Trophy size={20} className="text-emerald-500" /><h1 className="text-2xl font-bold tracking-tight">Deal</h1><span className="text-sm text-slate-400">({deals.length})</span></div>
        <button onClick={() => setAdd(true)} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-2 rounded-xl font-medium shadow-sm shadow-orange-600/20"><Plus size={15} /> Tambah Deal</button>
      </div>
      {deals.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><Trophy size={32} className="mx-auto text-slate-300 mb-3" />Belum ada deal. Klik "Tambah Deal" atau ubah tahap lead jadi "Deal (menang)".</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3"><div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Trophy size={13} /> Total Deal</div><div className="font-mono font-bold text-2xl text-emerald-600">{deals.length}</div></div>
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3"><div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Building2 size={13} /> Total Tonase</div><div className="font-mono font-bold text-2xl text-slate-800">{totalTon.toLocaleString("id-ID")} <span className="text-sm font-normal text-slate-400">ton</span></div></div>
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3"><div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><TrendingUp size={13} /> Total Revenue</div><div className="font-mono font-bold text-base text-slate-800">{fmtRp(totalValue)}</div></div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-400 text-[11px] uppercase tracking-wider"><tr>
                <th className="text-left px-3 py-2 font-medium">Perusahaan</th><th className="text-left px-3 py-2 font-medium">Kota</th><th className="text-left px-3 py-2 font-medium">Tahap</th><th className="text-left px-3 py-2 font-medium">Sales</th><th className="text-left px-3 py-2 font-medium">Tanggal</th><th className="text-left px-3 py-2 font-medium">Chemical</th><th className="text-left px-3 py-2 font-medium">Ton</th><th className="text-left px-3 py-2 font-medium">Revenue</th>
              </tr></thead>
              <tbody>
                {deals.map((c) => { const sm = stageMeta(stages, c.stage_key); return (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-orange-50/40 cursor-pointer" onClick={() => onEdit(c)}>
                    <td className="px-3 py-2"><div className="font-medium flex items-center gap-1.5">{c.name}{typeBadge(c.company_type) && <span className="text-[9px] font-bold px-1 rounded bg-slate-200 text-slate-600">{typeBadge(c.company_type)}</span>}</div></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.city || "—"}</td>
                    <td className="px-3 py-2"><span className="text-[11px] border rounded-full px-2 py-0.5" style={chipStyle(sm.hex)}>{sm.label}</span></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.sales_owner || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.deal_date ? fmtDate(c.deal_date) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.chemical || "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-700">{c.tonnage ? `${Number(c.tonnage).toLocaleString("id-ID")} ton` : "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono text-emerald-700 font-semibold">{c.deal_value ? fmtRp(c.deal_value) : "—"}</td>
                  </tr> ); })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {add && <AddDealModal leads={leads} stages={stages} onClose={() => setAdd(false)} onSaved={() => { setAdd(false); onChanged(); }} />}
    </div>
  );
}
