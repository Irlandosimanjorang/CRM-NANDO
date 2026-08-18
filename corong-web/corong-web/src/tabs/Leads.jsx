import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Search, Plus, FileSpreadsheet, Download, Trash2, Pencil, MessageCircle, Mail, Globe, ExternalLink, ShieldCheck, ShieldAlert, Copy } from "lucide-react";
import * as db from "../lib/db";
import { CATEGORIES, stageMeta, chipStyle, prioMeta, typeBadge, waLink, normUrl, prettyDomain, isNewLead, fmtDate, daysSince, todayISO } from "../lib/helpers";
import LeadModal from "../components/LeadModal";
import DuplicateModal from "../components/DuplicateModal";

const val = (row, keys) => {
  const lk = Object.keys(row);
  for (const k of keys) { const hit = lk.find((h) => h.toLowerCase().includes(k.toLowerCase())); if (hit && row[hit] != null && String(row[hit]).trim()) return String(row[hit]).trim(); }
  return "";
};
function mapRow(row, category, firstStageKey) {
  const name = val(row, ["公司名称", "company name", "nama perusahaan", "company", "nama"]);
  if (!name) return null;
  return {
    name, category, stage_key: firstStageKey,
    company_type: (() => { const t = val(row, ["公司类型", "company type"]).toLowerCase(); if (t.includes("man") && t.includes("trad")) return "Both"; if (t.includes("man")) return "Manufacturer"; if (t.includes("trad")) return "Trader"; return ""; })(),
    email: val(row, ["邮箱", "email"]), phone: val(row, ["电话", "phone", "telepon", "wa", "hp"]),
    key_person: val(row, ["联系人", "key person", "contact", "pic", "nama kontak"]),
    product: val(row, ["产品", "product", "produk"]), city: val(row, ["城市", "city", "kota"]),
    province: val(row, ["省", "province", "provinsi"]), website: val(row, ["网站", "website", "web"]),
    background: val(row, ["公司背景", "background", "海关"]), source: "import",
  };
}

export default function Leads({ leads, stages, settings, onChanged }) {
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fType, setFType] = useState("");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showDup, setShowDup] = useState(false);

  const filtered = useMemo(() => leads.filter((c) => {
    if (fCat && c.category !== fCat) return false;
    if (fType && (c.company_type || "") !== fType) return false;
    if (q) { const s = q.toLowerCase(); const hay = [c.name, c.city, c.province, c.key_person, c.product, c.sales_owner].map((x) => (x || "").toLowerCase()); if (!hay.some((h) => h.includes(s))) return false; }
    return true;
  }), [leads, q, fCat, fType]);

  const blank = () => ({ name: "", category: CATEGORIES[0], stage_key: stages[0]?.key, company_type: "", priority: "", verified: false });

  const importFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const firstStage = stages[0]?.key;
      const existing = new Set(leads.map((l) => l.name.toLowerCase()));
      const out = [];
      for (const sn of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
        for (const r of rows) { const m = mapRow(r, "Lainnya", firstStage); if (m && !existing.has(m.name.toLowerCase())) { existing.add(m.name.toLowerCase()); out.push(m); } }
      }
      if (out.length === 0) { alert("Ga ada baris kebaca. Pastikan ada kolom nama perusahaan."); return; }
      for (let i = 0; i < out.length; i += 200) await db.bulkInsertLeads(out.slice(i, i + 200));
      alert(`✅ Import selesai. Masuk: ${out.length} lead.`);
      onChanged();
    } catch (e) { alert("Gagal import: " + e.message); }
    finally { setBusy(false); }
  };

  const exportCSV = () => {
    const rows = filtered.map((c) => ({ Nama: c.name, Kategori: c.category, Tipe: c.company_type, Produk: c.product, Tahap: stageMeta(stages, c.stage_key).label, Email: c.email, Telepon_WA: c.phone, Key_Person: c.key_person, Kota: c.city, Website: c.website }));
    const csv = Papa.unparse(rows); const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nexto-leads-${todayISO()}.csv`; a.click();
  };

  const del = async (id) => { if (!window.confirm("Hapus lead ini?")) return; await db.deleteLead(id); onChanged(); };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <div className="relative flex-1 min-w-40"><Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / kota / PIC / produk…" className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" /></div>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="text-sm border border-slate-300 rounded-xl px-2 py-2 bg-white"><option value="">Semua kategori</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={fType} onChange={(e) => setFType(e.target.value)} className="text-sm border border-slate-300 rounded-xl px-2 py-2 bg-white"><option value="">Semua tipe</option><option value="Manufacturer">Manufacturer</option><option value="Trader">Trader</option><option value="Both">M &amp; T</option></select>
        <button onClick={() => setEdit(blank())} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-2 rounded-xl font-medium shadow-sm shadow-orange-600/20"><Plus size={15} /> Lead</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <label className="text-xs flex items-center gap-1.5 border border-emerald-300 text-emerald-700 rounded-lg px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"><FileSpreadsheet size={13} /> {busy ? "Mengimpor…" : "Import Excel / CSV"}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={(e) => { importFile(e.target.files[0]); e.target.value = ""; }} /></label>
        <button onClick={exportCSV} className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-1.5 bg-white hover:bg-slate-50"><Download size={13} /> Export</button>
        <button onClick={() => setShowDup(true)} className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-1.5 bg-white hover:bg-slate-50"><Copy size={13} /> Cek Duplikat</button>
        <span className="text-xs text-slate-400 self-center ml-auto">{filtered.length} / {leads.length}</span>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-x-auto">
        <table className="text-sm" style={{ minWidth: "1550px", width: "100%" }}>
          <thead className="bg-slate-50/80 text-slate-400 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50" style={{ minWidth: "220px", position: "sticky", left: 0, zIndex: 20, boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}>Perusahaan</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ minWidth: "120px" }}>Kota</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ minWidth: "160px" }}>Key Person</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ minWidth: "200px" }}>Email</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ minWidth: "220px" }}>Telepon / WA</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ minWidth: "180px" }}>Website</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ minWidth: "180px" }}>Produk</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ minWidth: "300px" }}>Progress Harian</th>
              <th className="px-3 py-2" style={{ minWidth: "80px" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => { const wa = waLink(c.phone); const web = normUrl(c.website); return (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-orange-50/40 transition-colors align-top cursor-pointer group" onClick={() => setEdit(c)}>
                <td className="px-3 py-2 bg-white group-hover:bg-orange-50/40" style={{ position: "sticky", left: 0, zIndex: 10, boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}>
                  <div className="font-medium flex items-center gap-1.5 flex-wrap">
                    {c.name}
                    {typeBadge(c.company_type) && <span className="text-[9px] font-bold px-1 rounded bg-slate-200 text-slate-600">{typeBadge(c.company_type)}</span>}
                    {isNewLead(c) && <span className="text-[9px] font-bold px-1 rounded bg-emerald-500 text-white">NEW</span>}
                    {c.verified ? <ShieldCheck size={12} className="text-emerald-500" /> : <ShieldAlert size={12} className="text-slate-300" />}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{c.city || "—"}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{c.key_person || "—"}</td>
                <td className="px-3 py-2 text-xs" onClick={(e) => e.stopPropagation()}>{c.email ? <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline break-all">{c.email}</a> : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2 text-xs whitespace-pre-line" onClick={(e) => e.stopPropagation()}>{c.phone ? (wa ? <a href={wa} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline flex items-center gap-1"><MessageCircle size={11} className="shrink-0" />{c.phone}</a> : <span className="text-slate-600">{c.phone}</span>) : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2 text-xs" onClick={(e) => e.stopPropagation()}>{web ? <a href={web} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{prettyDomain(c.website)}</a> : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{c.product || "—"}</td>
                <td className="px-3 py-2 text-xs" onClick={(e) => e.stopPropagation()}>
                  {c.progressLog && c.progressLog.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {c.progressLog.map((p) => (
                        <div key={p.id} className="border-l-2 border-orange-200 pl-2">
                          <div className="text-[10px] text-slate-400 font-mono">{fmtDate(p.date)}</div>
                          <div className="text-slate-700 leading-snug">{p.text}</div>
                        </div>
                      ))}
                    </div>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setEdit(c)} className="text-slate-400 hover:text-blue-600 p-1"><Pencil size={15} /></button>
                  <button onClick={() => del(c.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 size={15} /></button>
                </td>
              </tr> ); })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-sm text-slate-400">Belum ada lead yang cocok. Import Excel atau tambah manual.</div>}
      </div>

      {edit && <LeadModal lead={edit} stages={stages} settings={settings} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onChanged(); }} />}
      {showDup && <DuplicateModal leads={leads} onClose={() => setShowDup(false)} onChanged={onChanged} />}
    </div>
  );
}
