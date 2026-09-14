import { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Search, Plus, FileSpreadsheet, Download, Trash2, Pencil, Mail, Globe, ShieldCheck, ShieldAlert, Copy, MapPin, Sparkles, Phone, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
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

// Bracket sudut ala "target lock" HUD robot - signature visual yang bikin
// kartu kerasa lagi "di-scan" sama sistem, bukan cuma kotak biasa. Ditaro di
// LUAR area overflow-hidden biar ujungnya nongol jelas di sudut kartu.
function CornerBrackets({ color = "#0891b2" }) {
  const armStyle = { position: "absolute", width: 14, height: 14, borderColor: color };
  return (
    <>
      <div style={{ ...armStyle, top: -1, left: -1, borderTop: "2px solid", borderLeft: "2px solid", borderTopLeftRadius: 10 }} />
      <div style={{ ...armStyle, top: -1, right: -1, borderTop: "2px solid", borderRight: "2px solid", borderTopRightRadius: 10 }} />
      <div style={{ ...armStyle, bottom: -1, left: -1, borderBottom: "2px solid", borderLeft: "2px solid", borderBottomLeftRadius: 10 }} />
      <div style={{ ...armStyle, bottom: -1, right: -1, borderBottom: "2px solid", borderRight: "2px solid", borderBottomRightRadius: 10 }} />
    </>
  );
}

// Badge tahap/prioritas: font mono uppercase biar berasa "readout" sistem,
// kode warnanya keliatan lewat titik kecil di samping teks (bukan teksnya
// yang diwarnain - biar tetep gampang dibaca gimanapun warna hex-nya).
function StageChip({ hex, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hex, boxShadow: `0 0 4px ${hex}` }} />
      {label}
    </span>
  );
}

export default function Leads({ leads, stages, settings, industry, onChanged }) {
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fType, setFType] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 60; // kelipatan pas buat grid 2/3/4 kolom
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showDup, setShowDup] = useState(false);
  const [draftPopup, setDraftPopup] = useState(null); // { lead, rect }
  const [progressPopup, setProgressPopup] = useState(null); // { lead, autoFocus }
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

  // Balik ke halaman 1 tiap kali pencarian/filter berubah - biar gak nyangkut
  // di halaman kosong pas hasil filter baru lebih dikit dari sebelumnya.
  useEffect(() => { setPage(1); }, [q, fCat, fType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Sales Workspace</div>
          <h1 className="mt-1 text-[28px] font-black tracking-[-0.04em] text-slate-950">Leads</h1>
          <p className="mt-1 text-[12px] font-medium text-slate-500">Kelola prospek, prioritaskan follow-up, dan jaga setiap opportunity tetap bergerak.</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold text-slate-400">Database</div>
          <div className="mt-0.5 text-sm font-bold text-slate-800">{leads.length} total lead</div>
        </div>
      </div>

      <div className="sticky top-14 md:top-0 z-20 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl px-3 py-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,.45)]">
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <div className="relative flex-1 min-w-40"><Search size={14} className="absolute left-3 top-3 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / kota / PIC / produk / progress…" className="w-full pl-9 pr-3 py-2.5 text-[12px] border border-slate-200 rounded-xl bg-slate-50/70 focus:outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400" /></div>
          <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="text-[12px] border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/70 text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"><option value="">Semua kategori</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          {showTypeFilter && (
            <select value={fType} onChange={(e) => setFType(e.target.value)} className="text-[12px] border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/70 text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"><option value="">Semua tipe</option>{companyTypeOptions.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
          )}
          <button onClick={() => setEdit(blank())} className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-white text-[12px] px-4 py-2.5 rounded-xl font-bold shadow-[0_12px_24px_-14px_rgba(15,23,42,.8)]"><Plus size={14} /> Lead</button>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="text-[11px] flex items-center gap-1.5 border border-emerald-200 text-emerald-700 rounded-xl px-3 py-2 bg-emerald-50/70 hover:bg-emerald-50 cursor-pointer font-semibold"><FileSpreadsheet size={12} /> {busy ? "Mengimpor…" : "Import Excel / CSV"}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={(e) => { importFile(e.target.files[0]); e.target.value = ""; }} /></label>
          <button onClick={exportCSV} className="text-[11px] flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 bg-white hover:bg-slate-50 font-semibold text-slate-600"><Download size={12} /> Export</button>
          <button onClick={() => setShowDup(true)} className="text-[11px] flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 bg-white hover:bg-slate-50 font-semibold text-slate-600"><Copy size={12} /> Cek Duplikat</button>
          <span className="text-[11px] text-slate-400 self-center ml-auto font-semibold">{filtered.length} / {leads.length}</span>
        </div>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 rounded-[26px] p-3 sm:p-4"
        style={{
          background: "#f8fafc",
          backgroundImage: "radial-gradient(rgba(79,70,229,0.035) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        {pageItems.map((c) => {
          const sm = stageMeta(stages, c.stage_key);
          const wa = waLink(c.phone);
          const web = normUrl(c.website);
          return (
            <div
              key={c.id}
              onClick={() => setEdit(c)}
              className="relative rounded-[22px] cursor-pointer hover:-translate-y-1 transition-all duration-200"
              style={{ boxShadow: "0 12px 30px -22px rgba(15,23,42,.55)" }}
            >
              <CornerBrackets color="transparent" />
              <div
                className="rounded-[22px] overflow-hidden bg-white"
                style={{ border: "1px solid rgba(15,23,42,0.07)" }}
              >
                {/* Bar atas oranye tetap - identitas Nexto, KONSISTEN di semua kartu,
                    gak lagi ngikutin warna tahap pipeline */}
                <div style={{ height: 3, background: "linear-gradient(90deg, #4f46e5, #818cf8)" }} />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 text-[13px] leading-5 flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{c.name}</span>
                        {typeBadge(c.company_type) && <span className="text-[9px] font-bold px-1 rounded bg-slate-200 text-slate-600 shrink-0">{typeBadge(c.company_type)}</span>}
                        {isNewLead(c) && <span className="text-[9px] font-bold px-1 rounded bg-emerald-500 text-white shrink-0">NEW</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate font-medium">{c.category || "—"}</div>
                    </div>
                    {c.verified ? <ShieldCheck size={14} className="text-emerald-500 shrink-0" /> : <ShieldAlert size={14} className="text-slate-300 shrink-0" />}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                    <StageChip hex={sm.hex} label={sm.label} />
                    {c.priority && prioMeta(c.priority) && <StageChip hex={prioMeta(c.priority).hex} label={prioMeta(c.priority).label} />}
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-[11px] text-slate-600">
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
                    {c.next_action && <div className="mt-2 text-[10.5px] leading-4 text-indigo-700 bg-indigo-50/70 border border-indigo-100 rounded-xl px-2.5 py-2 line-clamp-2">📌 {c.next_action}</div>}
                    {c.wait_until && new Date(c.wait_until) >= new Date(todayISO()) && (
                      <div className="mt-1.5 text-[10.5px] text-sky-700 bg-sky-50 border border-sky-100 rounded-xl px-2.5 py-2">⏸️ Nunggu sampai {new Date(c.wait_until).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</div>
                    )}
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {c.phone && (wa ? <a href={wa} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title={c.phone}><Phone size={13} /></a> : <span className="p-1.5 text-slate-300" title={c.phone}><Phone size={13} /></span>)}
                    {c.email && <a href={`mailto:${c.email}`} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title={c.email}><Mail size={13} /></a>}
                    <button onClick={(e) => setDraftPopup({ lead: c, rect: e.currentTarget.getBoundingClientRect() })} className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Draft follow-up (AI)"><Sparkles size={13} /></button>
                    <div className="ml-auto flex items-center gap-0.5">
                      <button onClick={() => setEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={13} /></button>
                      <button onClick={() => del(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {/* Kolom quick-update progress harian - font mono biar berasa
                      command-line, nyala biru-cyan pas di-hover (senada bracket sudut) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setProgressPopup({ lead: c, autoFocus: true }); }}
                    className="mt-2.5 w-full flex items-center gap-2 text-left text-[10.5px] font-medium text-slate-500 border border-slate-200 bg-slate-50/80 rounded-xl px-3 py-2.5 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50 transition-colors"
                    title="Update progress harian"
                  >
                    <ClipboardList size={13} className="shrink-0 text-slate-400" />
                    <span className="truncate">{c.progressLog?.[0] ? c.progressLog[0].text : "> update progress hari ini…"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full p-10 text-center text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-[22px]">Belum ada lead yang cocok. Import Excel atau tambah manual.</div>}
      </div>

      {filtered.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">
            <ChevronLeft size={15} />
          </button>
          {(() => {
            // Nomor halaman dipendekin pake "..." kalau kepanjangan (>7 halaman),
            // biar gak numpuk puluhan tombol pas data-nya gede.
            const nums = [];
            const window = 1;
            for (let i = 1; i <= totalPages; i++) {
              if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) nums.push(i);
              else if (nums[nums.length - 1] !== "…") nums.push("…");
            }
            return nums.map((n, idx) =>
              n === "…" ? (
                <span key={`dots-${idx}`} className="px-1.5 text-slate-400 text-sm">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`min-w-[34px] h-[34px] px-2 rounded-lg text-sm font-semibold ${n === page ? "bg-slate-950 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {n}
                </button>
              )
            );
          })()}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">
            <ChevronRight size={15} />
          </button>
          <span className="text-xs text-slate-400 ml-2">Halaman {page}/{totalPages} · {filtered.length} lead</span>
        </div>
      )}

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
          autoFocus={progressPopup.autoFocus}
          onClose={() => setProgressPopup(null)}
          onChanged={onChanged}
        />
      )}
      {showDup && <DuplicateModal leads={leads} onClose={() => setShowDup(false)} onChanged={onChanged} />}
    </div>
  );
}
