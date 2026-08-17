import { useState } from "react";
import { Save, Plus, X, Trash2, Download, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import * as db from "../lib/db";

const inp = "w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10";

export default function Settings({ settings, stages, onChanged }) {
  const [names, setNames] = useState((settings.sales_names || []).join(", "));
  const [st, setSt] = useState(stages.map((s) => ({ ...s })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [exporting, setExporting] = useState(false);

  const setStage = (i, k, v) => setSt((p) => p.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
  const addStage = () => setSt((p) => [...p, { key: `tahap_${Date.now()}`, label: "Tahap Baru", hex: "#94a3b8", type: "normal" }]);
  const delStage = (i) => setSt((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await db.saveSalesNames(names.split(",").map((s) => s.trim()).filter(Boolean));
      await db.saveStages(st);
      setMsg("Pengaturan tersimpan.");
      onChanged();
    } catch (e) { setMsg("Gagal simpan: " + e.message); }
    finally { setBusy(false); }
  };

  const exportBackup = async () => {
    setExporting(true);
    try {
      const data = await db.exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `corong-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch (e) { alert("Gagal export: " + e.message); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 space-y-3">
        <label className="block"><span className="text-xs font-medium text-slate-500">Nama sales (pisah koma)</span><input className={inp} value={names} onChange={(e) => setNames(e.target.value)} placeholder="Nando, Budi, Sari" /></label>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-sm">Tahap pipeline</h3><button onClick={addStage} className="text-xs text-amber-600 flex items-center gap-1"><Plus size={13} /> tambah tahap</button></div>
        <p className="text-xs text-slate-400 mb-3">Tipe nentuin hitungan dashboard: <b>Deal</b> = menang, <b>Lost</b> = gugur, <b>Normal</b> = masih jalan.</p>
        <div className="space-y-2">
          {st.map((s, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input type="color" className="col-span-1 h-9 rounded border border-slate-300" value={s.hex} onChange={(e) => setStage(i, "hex", e.target.value)} />
              <input className="col-span-5 px-2 py-1.5 text-sm border border-slate-300 rounded-lg" value={s.label} onChange={(e) => setStage(i, "label", e.target.value)} />
              <select className="col-span-4 px-2 py-1.5 text-sm border border-slate-300 rounded-lg" value={s.type} onChange={(e) => setStage(i, "type", e.target.value)}>
                <option value="normal">Normal</option><option value="won">Deal (menang)</option><option value="lost">Lost</option>
              </select>
              <button onClick={() => delStage(i)} className="col-span-2 text-slate-300 hover:text-rose-500 flex justify-center"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      {msg && <div className={`text-sm rounded-xl p-3 ${msg.startsWith("Gagal") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{msg}</div>}
      <button onClick={save} disabled={busy} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm shadow-amber-600/20"><Save size={15} /> Simpan pengaturan</button>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
        <h3 className="font-semibold text-sm mb-1">Backup data</h3>
        <p className="text-xs text-slate-500 mb-3">Supabase Free ga ada backup otomatis. Download semua data (leads, kompetitor, tahap, histori AI Advisor) jadi 1 file — simpen di komputer/HP kamu sesekali biar aman.</p>
        <button onClick={exportBackup} disabled={exporting} className="text-sm border border-slate-300 rounded-xl px-3 py-2 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-1.5">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {exporting ? "Menyiapkan…" : "Export semua data"}
        </button>
      </div>

      <div className="bg-white border border-rose-200 rounded-2xl shadow-sm p-4">
        <h3 className="font-semibold text-sm mb-1 text-rose-600">Zona bahaya</h3>
        <p className="text-xs text-slate-500 mb-2">Keluar dari akun ini di perangkat ini.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-sm border border-rose-300 text-rose-600 rounded-xl px-3 py-2 hover:bg-rose-50">Keluar</button>
      </div>
    </div>
  );
}
