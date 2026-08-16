import { useState } from "react";
import { X, Save, Trash2, Plus, ClipboardList } from "lucide-react";
import * as db from "../lib/db";
import { CATEGORIES, COMPANY_TYPES, PRIORITIES, fmtDate, todayISO } from "../lib/helpers";

const inp = "w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10";
function Field({ label, children }) { return <label className="block"><span className="text-xs font-medium text-slate-500">{label}</span>{children}</label>; }

export default function LeadModal({ lead, stages, settings, onClose, onSaved }) {
  const [f, setF] = useState({ ...lead });
  const [log, setLog] = useState(lead.progressLog || []);
  const [newProg, setNewProg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name?.trim()) { alert("Nama wajib diisi."); return; }
    setBusy(true);
    try { await db.upsertLead(f); onSaved(); }
    catch (e) { alert("Gagal simpan: " + e.message); setBusy(false); }
  };
  const del = async () => { if (!window.confirm("Hapus lead ini?")) return; setBusy(true); await db.deleteLead(lead.id); onSaved(); };

  const addProg = async () => {
    if (!newProg.trim() || !lead.id) { if (!lead.id) alert("Simpan lead-nya dulu sebelum catat progress."); return; }
    const p = await db.addProgress(lead.id, newProg.trim());
    setLog([p, ...log]); setNewProg("");
  };
  const delProg = async (id) => { await db.deleteProgress(id); setLog(log.filter((x) => x.id !== id)); };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">{lead.id ? "Edit Lead" : "Tambah Lead"}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div>
        <div className="space-y-3">
          <Field label="Nama perusahaan *"><input className={inp} value={f.name || ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori"><select className={inp} value={f.category || CATEGORIES[0]} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Tipe perusahaan"><select className={inp} value={f.company_type || ""} onChange={(e) => set("company_type", e.target.value)}>{COMPANY_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tahap"><select className={inp} value={f.stage_key || stages[0]?.key} onChange={(e) => set("stage_key", e.target.value)}>{stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></Field>
            <Field label="Prioritas"><select className={inp} value={f.priority || ""} onChange={(e) => set("priority", e.target.value)}><option value="">—</option>{PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}</select></Field>
          </div>
          <Field label="Produk"><input className={inp} value={f.product || ""} onChange={(e) => set("product", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Email"><input className={inp} value={f.email || ""} onChange={(e) => set("email", e.target.value)} /></Field><Field label="Telepon / WA"><input className={inp} value={f.phone || ""} onChange={(e) => set("phone", e.target.value)} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Key person"><input className={inp} value={f.key_person || ""} onChange={(e) => set("key_person", e.target.value)} /></Field><Field label="Jabatan"><input className={inp} value={f.key_person_title || ""} onChange={(e) => set("key_person_title", e.target.value)} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Kota"><input className={inp} value={f.city || ""} onChange={(e) => set("city", e.target.value)} /></Field><Field label="Provinsi"><input className={inp} value={f.province || ""} onChange={(e) => set("province", e.target.value)} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Website"><input className={inp} value={f.website || ""} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field><Field label="Sales owner"><input className={inp} value={f.sales_owner || ""} onChange={(e) => set("sales_owner", e.target.value)} /></Field></div>
          <div className="border border-amber-200 bg-amber-50/60 rounded-2xl p-3"><Field label="Next action"><input className={inp} value={f.next_action || ""} onChange={(e) => set("next_action", e.target.value)} placeholder="langkah berikutnya" /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Visit date"><input type="date" className={inp} value={f.visit_date || ""} onChange={(e) => set("visit_date", e.target.value)} /></Field><Field label="Chemical"><input className={inp} value={f.chemical || ""} onChange={(e) => set("chemical", e.target.value)} /></Field></div>
          <div className="grid grid-cols-3 gap-3"><Field label="Tgl deal"><input type="date" className={inp} value={f.deal_date || ""} onChange={(e) => set("deal_date", e.target.value)} /></Field><Field label="Tonase"><input type="number" step="any" className={inp} value={f.tonnage || ""} onChange={(e) => set("tonnage", Number(e.target.value))} /></Field><Field label="Nilai (Rp)"><input type="number" className={inp} value={f.deal_value || ""} onChange={(e) => set("deal_value", Number(e.target.value))} /></Field></div>

          <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
            <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5"><ClipboardList size={14} /> Progress harian</div>
            <div className="flex gap-2 mb-2">
              <input className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-amber-500" value={newProg} onChange={(e) => setNewProg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProg()} placeholder={lead.id ? "Update hari ini… (Enter)" : "Simpan lead dulu"} />
              <button onClick={addProg} className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 rounded-lg flex items-center gap-1"><Plus size={13} /> Catat</button>
            </div>
            {log.length === 0 ? <p className="text-xs text-slate-400">Belum ada progress.</p> : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">{log.map((p) => (
                <div key={p.id} className="flex items-start gap-2 text-xs bg-white border border-slate-200 rounded px-2 py-1.5"><span className="text-slate-400 font-mono shrink-0">{fmtDate(p.date)}</span><span className="flex-1 text-slate-700">{p.text}</span><button onClick={() => delProg(p.id)} className="text-slate-300 hover:text-rose-500"><X size={13} /></button></div>
              ))}</div>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!!f.verified} onChange={(e) => set("verified", e.target.checked)} className="w-4 h-4 accent-emerald-600" /><span className="text-slate-500">Kontak terverifikasi</span></label>
        </div>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={save} disabled={busy} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm shadow-amber-600/20"><Save size={15} /> Simpan</button>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50">Batal</button>
          {lead.id && <button onClick={del} className="ml-auto text-sm text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl flex items-center gap-1.5"><Trash2 size={15} /> Hapus</button>}
        </div>
      </div>
    </div>
  );
}
