import { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Search, Plus, FileSpreadsheet, Download, Trash2, Pencil, Mail, Globe, ShieldCheck, ShieldAlert, Copy, MapPin, Sparkles, Phone, ClipboardList } from "lucide-react";
import * as db from "../lib/db";
import { stageMeta, chipStyle, prioMeta, typeBadge, waLink, normUrl, prettyDomain, isNewLead, todayISO } from "../lib/helpers";
import LeadModal from "../components/LeadModal";
import DuplicateModal from "../components/DuplicateModal";
import AiDraftPopup from "../components/AiDraftPopup";
import ProgressPopup from "../components/ProgressPopup";
import { getFieldLabel, getCategories, isFieldHidden, getCustomFieldSlots, getCompanyTypeOptions } from "../lib/industryTemplates";

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

export default function Leads({ leads, stages, settings, industry, onChanged }) {
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fType, setFType] = useState("");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showDup, setShowDup] = useState(false);
  const [draftPopup, setDraftPopup] = useState(null); // { lead, rect }
  const [progressPopup, setProgressPopup] = useState(null); // { lead, rect, autoFocus }
  const titleLabel = getFieldLabel(industry, "key_person_title", "Jabatan");
  const keyPersonLabel = getFieldLabel(industry, "key_person", "Key Person");
  const productLabel = getFieldLabel(industry, "product", "Produk");
  const hideKeyPerson = isFieldHidden(industry, "key_person");
  const hideTitle = isFieldHidden(industry, "key_person_title");
  const hideWebsite = isFieldHidden(industry, "website");
  const customSlots = getCustomFieldSlots(industry);
  const categories = getCategories(industry);
  const showTypeFilter = !isFieldHidden(industry, "company_type");
  const companyTypeOptions = getCompanyTypeOptions(industry).filter((t) => t.v);

  const filtered = useMemo(() => leads.filter((c) => {
    if (fCat && c.category !== fCat) return false;
    if (fType && (c.company_type || "") !== fType) return false;
    if (q) {
      const s = q.toLowerCase();
      const fieldHay = [c.name, c.city, c.province, c.key_person, c.product, c.sales_owner].map((x) => (x || "").toLowerCase());
      const progressHay = (c.progressLog || []).map((p) => (p.text || "").toLowerCase());
      const allHay = [...fieldHay, ...progressHay];
      if (!allHay.some((h) => h.includes(s))) return false;
    }
    return true;
  }), [leads, q, fCat, fType]);

  const blank = () => ({ name: "", category: categories[0], stage_key: stages[0]?.key, company_type: "", priority: "", verified: false });

  const importFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const firstStage = stages[0]?.key;
      const existing = new Set(leads.map((l) => l.name.trim().toLowerCase()));
      const out = [];
      let usedAiFallback = false;

      for (const sn of wb.SheetNames) {
        const headerRows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
        const nonEmptyRows = headerRows.filter((r) => Object.values(r).some((v) => String(v).trim()));
        let sheetOut = [];
        for (const r of headerRows) { const m = mapRow(r, "Lainnya", firstStage); if (m) sheetOut.push(m); }

        // Kalau nebak dari judul kolom gagal buat sebagian besar baris (header aneh / ga ada header),
        // coba cara AI: baca isi datanya langsung, bukan cuma nama kolomnya.
        if (nonEmptyRows.length > 0 && sheetOut.length < nonEmptyRows.length * 0.5) {
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
          const nonEmptyAoa = aoa.filter((r) => r.some((v) => String(v).trim()));
          if (nonEmptyAoa.length > 0) {
            try {
              const sample = nonEmptyAoa.slice(0, 8);
              const { data_start_row, mapping } = await db.smartImportMap(sample);
              if (mapping && (mapping.name !== null && mapping.name !== undefined)) {
                const startAt = Math.min(Math.max(data_start_row || 0, 0), nonEmptyAoa.length);
                const dataRows = nonEmptyAoa.slice(startAt);
                const aiOut = [];
                for (const row of dataRows) {
                  const get = (idx) => (idx === null || idx === undefined ? "" : String(row[idx] ?? "").trim());
                  const name = get(mapping.name);
                  if (!name || /^(xxx|yyyy-mm-dd|mr\/ms xxx)$/i.test(name.trim())) continue;
                  aiOut.push({
                    name, category: "Lainnya", stage_key: firstStage,
                    company_type: get(mapping.company_type), email: get(mapping.email), phone: get(mapping.phone),
                    key_person: get(mapping.key_person), key_person_title: get(mapping.key_person_title),
                    product: get(mapping.product), city: get(mapping.city), province: get(mapping.province),
                    website: get(mapping.website), background: get(mapping.background), source: "import",
                  });
                }
                if (aiOut.length > sheetOut.length) { sheetOut = aiOut; usedAiFallback = true; }
              }
            } catch (aiErr) { console.error("Smart import AI gagal:", aiErr); }
          }
        }

        for (const m of sheetOut) {
          const key = (m.name || "").trim().toLowerCase();
          if (key && !existing.has(key)) { existing.add(key); out.push({ ...m, name: m.name.trim() }); }
        }
      }

      if (out.length === 0) { alert("Ga ada baris kebaca. Pastikan ada data nama perusahaan."); return; }
      for (let i = 0; i < out.length; i += 200) await db.bulkInsertLeads(out.slice(i, i + 200));
      alert(`✅ Import selesai${usedAiFallback ? " (dibantu AI baca formatnya)" : ""}. Masuk: ${out.length} lead.`);
      onChanged();
    } catch (e) { alert("Gagal import: " + e.message); }
    finally { setBusy(false); }
  };

  const exportCSV = () => {
    const rows = filtered.map((c) => ({ Nama: c.name, Kategori: c.category, Tipe: c.company_type, Produk: c.product, Tahap: stageMeta(stages, c.stage_key).label, Email: c.email, Telepon_WA: c.phone, Key_Person: c.key_person, Jabatan: c.key_person_title, Kota: c.city, Website: c.website }));
    const csv = Papa.unparse(rows); const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nexto-leads-${todayISO()}.csv`; a.click();
  };

  const del = async (id) => { if (!window.confirm("Hapus lead ini?")) return; await db.deleteLead(id); onChanged(); };

  return (
    <div>
      <div className="sticky top-14 md:top-0 z-20 bg-slate-50 pt-0.5 pb-2">
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <div className="relative flex-1 min-w-40"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / kota / PIC / produk / progress…" className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" /></div>
          <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="text-sm border border-slate-300 rounded-xl px-2 py-1.5 bg-white"><option value="">Semua kategori</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          {showTypeFilter && (
            <select value={fType} onChange={(e) => setFType(e.target.value)} className="text-sm border border-slate-300 rounded-xl px-2 py-1.5 bg-white"><option value="">Semua tipe</option>{companyTypeOptions.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
          )}
          <button onClick={() => setEdit(blank())} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-1.5 rounded-xl font-medium shadow-sm shadow-orange-600/20"><Plus size={14} /> Lead</button>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="text-xs flex items-center gap-1.5 border border-emerald-300 text-emerald-700 rounded-lg px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"><FileSpreadsheet size={12} /> {busy ? "Mengimpor…" : "Import Excel / CSV"}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={(e) => { importFile(e.target.files[0]); e.target.value = ""; }} /></label>
          <button onClick={exportCSV} className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-lg px-2.5 py-1 bg-white hover:bg-slate-50"><Download size={12} /> Export</button>
          <button onClick={() => setShowDup(true)} className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-lg px-2.5 py-1 bg-white hover:bg-slate-50"><Copy size={12} /> Cek Duplikat</button>
          <span className="text-xs text-slate-400 self-center ml-auto">{filtered.length} / {leads.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((c) => {
          const sm = stageMeta(stages, c.stage_key);
          const wa = waLink(c.phone);
          const web = normUrl(c.website);
          return (
            <div
              key={c.id}
              onClick={() => setEdit(c)}
              className="bg-white border rounded-3xl shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.15)] transition-all overflow-hidden"
              style={{ borderColor: `${sm.hex}40` }}
            >
              {/* Aksen warna atas - ngikutin warna tahap pipeline, biar gampang di-scan sekilas */}
              <div style={{ height: 5, background: `linear-gradient(90deg, ${sm.hex}, ${sm.hex}99)` }} />

              <div className="p-4" style={{ background: `linear-gradient(180deg, ${sm.hex}0d, transparent 90px)` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{c.name}</span>
                      {typeBadge(c.company_type) && <span className="text-[9px] font-bold px-1 rounded bg-slate-200 text-slate-600 shrink-0">{typeBadge(c.company_type)}</span>}
                      {isNewLead(c) && <span className="text-[9px] font-bold px-1 rounded bg-emerald-500 text-white shrink-0">NEW</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">{c.category || "—"}</div>
                  </div>
                  {c.verified ? <ShieldCheck size={14} className="text-emerald-500 shrink-0" /> : <ShieldAlert size={14} className="text-slate-300 shrink-0" />}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={chipStyle(sm.hex)}>{sm.label}</span>
                  {c.priority && prioMeta(c.priority) && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={chipStyle(prioMeta(c.priority).hex)}>{prioMeta(c.priority).label}</span>}
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 truncate"><MapPin size={12} className="text-slate-300 shrink-0" /> {c.city || "—"}</div>
                  {c.product && <div className="truncate"><span className="text-slate-400">{productLabel}:</span> {c.product}</div>}
                  {!hideKeyPerson && c.key_person && <div className="truncate"><span className="text-slate-400">{keyPersonLabel}:</span> {c.key_person}</div>}
                  {!hideTitle && c.key_person_title && <div className="truncate"><span className="text-slate-400">{titleLabel}:</span> {c.key_person_title}</div>}
                  {c.phone && <div className="truncate flex items-center gap-1.5"><Phone size={12} className="text-slate-300 shrink-0" /> {c.phone}</div>}
                  {c.email && <div className="truncate flex items-center gap-1.5"><Mail size={12} className="text-slate-300 shrink-0" /> {c.email}</div>}
                  {!hideWebsite && web && <div className="truncate flex items-center gap-1.5"><Globe size={12} className="text-slate-300 shrink-0" /> {prettyDomain(c.website)}</div>}
                  {customSlots.map((slot) => c[slot.key] ? (
                    <div key={slot.key} className="truncate"><span className="text-slate-400">{slot.label}:</span> {c[slot.key]}</div>
                  ) : null)}
                  {c.next_action && <div className="mt-2 text-[11px] text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-2 py-1.5 line-clamp-2">📌 {c.next_action}</div>}
                  {c.wait_until && new Date(c.wait_until) >= new Date(todayISO()) && (
                    <div className="mt-1.5 text-[11px] text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-2 py-1.5">⏸️ Nunggu sampai {new Date(c.wait_until).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {c.phone && (wa ? <a href={wa} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title={c.phone}><Phone size={13} /></a> : <span className="p-1.5 text-slate-300" title={c.phone}><Phone size={13} /></span>)}
                  {c.email && <a href={`mailto:${c.email}`} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title={c.email}><Mail size={13} /></a>}
                  <button onClick={(e) => setDraftPopup({ lead: c, rect: e.currentTarget.getBoundingClientRect() })} className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50" title="Draft follow-up (AI)"><Sparkles size={13} /></button>
                  <div className="ml-auto flex items-center gap-0.5">
                    <button onClick={() => setEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={13} /></button>
                    <button onClick={() => del(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Kolom quick-update progress harian - garis solid slate-300
                    (senada sama kotak search/filter di atas), nyala oranye
                    pas di-hover buat kasih tau ini interaktif. */}
                <button
                  onClick={(e) => { e.stopPropagation(); setProgressPopup({ lead: c, rect: e.currentTarget.getBoundingClientRect(), autoFocus: true }); }}
                  className="mt-2.5 w-full flex items-center gap-2 text-left text-xs text-slate-500 border-2 border-slate-300 bg-slate-50 rounded-xl px-3 py-2 hover:border-orange-400 hover:text-orange-700 hover:bg-orange-50 transition-colors"
                  title="Update progress harian"
                >
                  <ClipboardList size={13} className="shrink-0 text-slate-400 group-hover:text-orange-400" />
                  <span className="truncate">{c.progressLog?.[0] ? c.progressLog[0].text : "Update progress hari ini…"}</span>
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full p-8 text-center text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-3xl">Belum ada lead yang cocok. Import Excel atau tambah manual.</div>}
      </div>

      {edit && <LeadModal lead={edit} stages={stages} settings={settings} industry={industry} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onChanged(); }} />}
      {draftPopup && (
        <AiDraftPopup
          lead={draftPopup.lead}
          rect={draftPopup.rect}
          onClose={() => setDraftPopup(null)}
          onSent={onChanged}
        />
      )}
      {progressPopup && (
        <ProgressPopup
          lead={progressPopup.lead}
          rect={progressPopup.rect}
          autoFocus={progressPopup.autoFocus}
          onClose={() => setProgressPopup(null)}
          onChanged={onChanged}
        />
      )}
      {showDup && <DuplicateModal leads={leads} onClose={() => setShowDup(false)} onChanged={onChanged} />}
    </div>
  );
}
