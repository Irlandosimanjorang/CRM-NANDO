import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Search, Plus, FileSpreadsheet, Download, Trash2, Pencil, MessageCircle, Mail, Globe, ExternalLink, ShieldCheck, ShieldAlert, Copy, MapPin, CheckCircle2 } from "lucide-react";
import * as db from "../lib/db";
import { CATEGORIES, stageMeta, chipStyle, prioMeta, typeBadge, waLink, normUrl, prettyDomain, isNewLead, fmtDate, daysSince, todayISO } from "../lib/helpers";
import LeadModal from "../components/LeadModal";
import DuplicateModal from "../components/DuplicateModal";
import { getFieldLabel } from "../lib/industryTemplates";

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

function findProgressMatch(c, q) {
  if (!q.trim() || !c.progressLog?.length) return null;
  const s = q.toLowerCase();
  const hit = c.progressLog.find((p) => (p.text || "").toLowerCase().includes(s));
  return hit || null;
}

export default function Leads({ leads, stages, settings, industry, onChanged }) {
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fType, setFType] = useState("");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showDup, setShowDup] = useState(false);
  const [progressPopup, setProgressPopup] = useState(null); // { lead, rect }
  const [checkedInToday, setCheckedInToday] = useState(new Set());
  const titleLabel = getFieldLabel(industry, "key_person_title", "Jabatan");
  const productLabel = getFieldLabel(industry, "product", "Produk");

  const loadCheckedInToday = () => {
    db.getTodayCheckedInLeadIds().then((ids) => setCheckedInToday(new Set(ids))).catch(() => {});
  };
  useEffect(() => { loadCheckedInToday(); }, []);

  // Lebar kolom bisa diatur manual kayak Excel - tarik handle di kanan tiap header.
  const [colWidths, setColWidths] = useState({
    name: 220, city: 120, location: 130, keyPerson: 160, title: 150,
    email: 200, phone: 220, website: 180, product: 180, progress: 300,
  });
  const resizingRef = useRef(null);

  const onResizeMove = useCallback((e) => {
    const r = resizingRef.current;
    if (!r) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = clientX - r.startX;
    const newWidth = Math.max(70, r.startWidth + delta);
    setColWidths((prev) => ({ ...prev, [r.key]: newWidth }));
  }, []);
  const onResizeEnd = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeEnd);
    document.removeEventListener("touchmove", onResizeMove);
    document.removeEventListener("touchend", onResizeEnd);
  }, [onResizeMove]);
  const startResize = (key, e) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    resizingRef.current = { key, startX: clientX, startWidth: colWidths[key] };
    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("mouseup", onResizeEnd);
    document.addEventListener("touchmove", onResizeMove);
    document.addEventListener("touchend", onResizeEnd);
  };

  function ColResizeHandle({ colKey }) {
    return (
      <div
        onMouseDown={(e) => startResize(colKey, e)}
        onTouchStart={(e) => startResize(colKey, e)}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-orange-400/60 active:bg-orange-500/80 z-10"
      />
    );
  }

  const popupCloseTimer = useRef(null);
  const openProgressPopup = (lead, rect) => {
    if (popupCloseTimer.current) { clearTimeout(popupCloseTimer.current); popupCloseTimer.current = null; }
    setProgressPopup({ lead, rect });
  };
  const scheduleClosePopup = () => {
    popupCloseTimer.current = setTimeout(() => setProgressPopup(null), 150);
  };
  const cancelClosePopup = () => {
    if (popupCloseTimer.current) { clearTimeout(popupCloseTimer.current); popupCloseTimer.current = null; }
  };

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

  const blank = () => ({ name: "", category: CATEGORIES[0], stage_key: stages[0]?.key, company_type: "", priority: "", verified: false });

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
          <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="text-sm border border-slate-300 rounded-xl px-2 py-1.5 bg-white"><option value="">Semua kategori</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <select value={fType} onChange={(e) => setFType(e.target.value)} className="text-sm border border-slate-300 rounded-xl px-2 py-1.5 bg-white"><option value="">Semua tipe</option><option value="Manufacturer">Manufacturer</option><option value="Trader">Trader</option><option value="Both">M &amp; T</option></select>
          <button onClick={() => setEdit(blank())} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-1.5 rounded-xl font-medium shadow-sm shadow-orange-600/20"><Plus size={14} /> Lead</button>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="text-xs flex items-center gap-1.5 border border-emerald-300 text-emerald-700 rounded-lg px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"><FileSpreadsheet size={12} /> {busy ? "Mengimpor…" : "Import Excel / CSV"}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={(e) => { importFile(e.target.files[0]); e.target.value = ""; }} /></label>
          <button onClick={exportCSV} className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-lg px-2.5 py-1 bg-white hover:bg-slate-50"><Download size={12} /> Export</button>
          <button onClick={() => setShowDup(true)} className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-lg px-2.5 py-1 bg-white hover:bg-slate-50"><Copy size={12} /> Cek Duplikat</button>
          <span className="text-xs text-slate-400 self-center ml-auto">{filtered.length} / {leads.length}</span>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] overflow-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
        <table className="text-sm" style={{ minWidth: "1700px", width: "100%" }}>
          <thead className="text-slate-400 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50 relative" style={{ minWidth: colWidths.name, width: colWidths.name, position: "sticky", left: 0, top: 0, zIndex: 25, boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}>Perusahaan<ColResizeHandle colKey="name" /></th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50 relative" style={{ minWidth: colWidths.city, width: colWidths.city, position: "sticky", top: 0, zIndex: 15 }}>Kota<ColResizeHandle colKey="city" /></th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50 relative" style={{ minWidth: colWidths.location, width: colWidths.location, position: "sticky", top: 0, zIndex: 15 }}>Lokasi<ColResizeHandle colKey="location" /></th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50 relative" style={{ minWidth: colWidths.keyPerson, width: colWidths.keyPerson, position: "sticky", top: 0, zIndex: 15 }}>Key Person<ColResizeHandle colKey="keyPerson" /></th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50 relative" style={{ minWidth: colWidths.title, width: colWidths.title, position: "sticky", top: 0, zIndex: 15 }}>{titleLabel}<ColResizeHandle colKey="title" /></th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50 relative" style={{ minWidth: colWidths.email, width: colWidths.email, position: "sticky", top: 0, zIndex: 15 }}>Email<ColResizeHandle colKey="email" /></th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50 relative" style={{ minWidth: colWidths.phone, width: colWidths.phone, position: "sticky", top: 0, zIndex: 15 }}>Telepon / WA<ColResizeHandle colKey="phone" /></th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50 relative" style={{ minWidth: colWidths.website, width: colWidths.website, position: "sticky", top: 0, zIndex: 15 }}>Website<ColResizeHandle colKey="website" /></th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50 relative" style={{ minWidth: colWidths.product, width: colWidths.product, position: "sticky", top: 0, zIndex: 15 }}>{productLabel}<ColResizeHandle colKey="product" /></th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap bg-slate-50 relative" style={{ minWidth: colWidths.progress, width: colWidths.progress, position: "sticky", top: 0, zIndex: 15 }}>Progress Harian<ColResizeHandle colKey="progress" /></th>
              <th className="px-3 py-2 bg-slate-50" style={{ minWidth: "80px", position: "sticky", top: 0, zIndex: 15 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const wa = waLink(c.phone);
              const web = normUrl(c.website);
              const progressMatch = findProgressMatch(c, q);
              return (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-orange-50/40 transition-colors align-top cursor-pointer group" onClick={() => setEdit(c)}>
                <td className="px-3 py-2 bg-white group-hover:bg-orange-50/40" style={{ position: "sticky", left: 0, zIndex: 10, boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}>
                  <div className="font-medium flex items-center gap-1.5 flex-wrap">
                    {c.name}
                    {typeBadge(c.company_type) && <span className="text-[9px] font-bold px-1 rounded bg-slate-200 text-slate-600">{typeBadge(c.company_type)}</span>}
                    {isNewLead(c) && <span className="text-[9px] font-bold px-1 rounded bg-emerald-500 text-white">NEW</span>}
                    {c.verified ? <ShieldCheck size={12} className="text-emerald-500" /> : <ShieldAlert size={12} className="text-slate-300" />}
                  </div>
                  {progressMatch && (
                    <div className="text-[10px] text-orange-600 mt-1 bg-orange-50 border border-orange-100 rounded-lg px-1.5 py-1 max-w-[200px]">
                      <span className="font-semibold">{fmtDate(progressMatch.date)}:</span> {progressMatch.text.length > 60 ? progressMatch.text.slice(0, 60) + "…" : progressMatch.text}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{c.city || "—"}</td>
                <td className="px-3 py-2 text-xs" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    {checkedInToday.has(c.id) ? (
                      <span className="text-xs border border-blue-300 text-blue-700 bg-blue-50 rounded-lg px-2 py-1 flex items-center gap-1 whitespace-nowrap font-medium">
                        <CheckCircle2 size={12} /> Check-in hari ini
                      </span>
                    ) : c.latitude ? (
                      <span className="text-[11px] text-slate-400">Lokasi tersimpan</span>
                    ) : (
                      <span className="text-[11px] text-slate-300">Belum ada lokasi</span>
                    )}
                    {c.latitude && (
                      <a href={`https://maps.google.com/?q=${c.latitude},${c.longitude}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Lihat di peta" className="text-slate-400 hover:text-emerald-600 shrink-0"><ExternalLink size={13} /></a>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{c.key_person || "—"}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{c.key_person_title || "—"}</td>
                <td className="px-3 py-2 text-xs" onClick={(e) => e.stopPropagation()}>{c.email ? <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline break-all">{c.email}</a> : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2 text-xs whitespace-pre-line" onClick={(e) => e.stopPropagation()}>{c.phone ? (wa ? <a href={wa} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline flex items-center gap-1"><MessageCircle size={11} className="shrink-0" />{c.phone}</a> : <span className="text-slate-600">{c.phone}</span>) : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2 text-xs" onClick={(e) => e.stopPropagation()}>{web ? <a href={web} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{prettyDomain(c.website)}</a> : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{c.product || "—"}</td>
                <td
                  className="px-3 py-2 text-xs rounded-lg transition-colors hover:bg-orange-50/60"
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => { if (c.progressLog && c.progressLog.length > 0) openProgressPopup(c, e.currentTarget.getBoundingClientRect()); }}
                  onMouseLeave={scheduleClosePopup}
                >
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

      {progressPopup && progressPopup.lead.progressLog && progressPopup.lead.progressLog.length > 0 && (
        <div
          className="fixed z-50 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
          style={{
            left: Math.min(progressPopup.rect.right + 10, window.innerWidth - 336),
            top: Math.min(Math.max(progressPopup.rect.top - 10, 12), window.innerHeight - 340),
          }}
          onMouseEnter={cancelClosePopup}
          onMouseLeave={scheduleClosePopup}
        >
          <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-orange-50 to-white border-b border-slate-100">
            <div className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider">Progress Harian</div>
            <div className="font-bold text-slate-900 text-sm mt-0.5 truncate">{progressPopup.lead.name}</div>
          </div>
          <div className="p-4 max-h-72 overflow-y-auto">
            {progressPopup.lead.progressLog.map((p, i) => (
              <div key={p.id} className="flex gap-3 relative">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-4 ring-orange-100 mt-1 shrink-0" />
                  {i < progressPopup.lead.progressLog.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-4">
                  <div className="text-[10px] font-semibold text-slate-400 font-mono mb-1">{fmtDate(p.date)}</div>
                  <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 rounded-2xl rounded-tl-sm px-3 py-2">{p.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {edit && <LeadModal lead={edit} stages={stages} settings={settings} industry={industry} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onChanged(); }} />}
      {showDup && <DuplicateModal leads={leads} onClose={() => setShowDup(false)} onChanged={onChanged} />}
    </div>
  );
}
