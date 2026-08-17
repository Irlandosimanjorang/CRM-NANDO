import { useState } from "react";
import { X, Save, Trash2, Plus, Building2 } from "lucide-react";
import * as db from "../lib/db";

const inp = "w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10";
function Field({ label, children }) { return <label className="block"><span className="text-xs font-medium text-slate-500">{label}</span>{children}</label>; }

export default function CompetitorModal({ comp, onClose, onSaved }) {
  const [f, setF] = useState({ ...comp, usages: comp.usages ? [...comp.usages] : [] });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setUse = (i, k, v) => setF((p) => ({ ...p, usages: p.usages.map((u, idx) => (idx === i ? { ...u, [k]: v } : u)) }));
  const addUse = () => setF((p) => ({ ...p, usages: [...p.usages, { company: "", product: "", price: "", quantity: "" }] }));
  const delUse = (i) => setF((p) => ({ ...p, usages: p.usages.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!f.name?.trim()) { alert("Nama company/trading wajib diisi."); return; }
    setBusy(true);
    try { await db.upsertCompetitor(f); onSaved(); }
    catch (e) { alert("Gagal simpan: " + e.message); setBusy(false); }
  };
  const del = async () => { if (!window.confirm("Hapus kompetitor ini?")) return; setBusy(true); await db.deleteCompetitor(comp.id); onSaved(); };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">{comp.id ? "Edit Kompetitor" : "Tambah Kompetitor"}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div>
        <div className="space-y-3">
          <Field label="Nama company / trading *"><input className={inp} value={f.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="mis. DCC (trading), atau merek" /></Field>
          <Field label="Produk umum"><input className={inp} value={f.product || ""} onChange={(e) => set("product", e.target.value)} placeholder="Lini produk utama mereka" /></Field>
          <Field label="Background"><textarea className={inp} rows={2} value={f.background || ""} onChange={(e) => set("background", e.target.value)} /></Field>

          <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Building2 size={14} /> Company pemakai ({f.usages.length})</span><button onClick={addUse} className="text-xs text-orange-600 flex items-center gap-1"><Plus size={12} /> tambah company</button></div>
            {f.usages.length === 0 && <p className="text-xs text-slate-400 mb-2">Tambah company pemakai produk ini.</p>}
            {f.usages.map((u, i) => (
              <div key={i} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center">
                <input className="col-span-3 px-2 py-1.5 text-xs border border-slate-300 rounded-lg" placeholder="Company" value={u.company} onChange={(e) => setUse(i, "company", e.target.value)} />
                <input className="col-span-3 px-2 py-1.5 text-xs border border-slate-300 rounded-lg" placeholder="Produk dipakai" value={u.product} onChange={(e) => setUse(i, "product", e.target.value)} />
                <input className="col-span-2 px-2 py-1.5 text-xs border border-slate-300 rounded-lg" placeholder="Harga" value={u.price} onChange={(e) => setUse(i, "price", e.target.value)} />
                <input className="col-span-2 px-2 py-1.5 text-xs border border-slate-300 rounded-lg" placeholder="Jumlah" value={u.quantity} onChange={(e) => setUse(i, "quantity", e.target.value)} />
                <button onClick={() => delUse(i)} className="col-span-2 text-slate-300 hover:text-rose-500"><X size={14} /></button>
              </div>
            ))}
          </div>

          <Field label="Catatan umum"><textarea className={inp} rows={2} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={save} disabled={busy} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm shadow-orange-600/20"><Save size={15} /> Simpan</button>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50">Batal</button>
          {comp.id && <button onClick={del} className="ml-auto text-sm text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl flex items-center gap-1.5"><Trash2 size={15} /> Hapus</button>}
        </div>
      </div>
    </div>
  );
}
