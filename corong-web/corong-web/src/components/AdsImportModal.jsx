import { useRef, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import * as db from "../lib/db";
import { fmtRp } from "../lib/helpers";
import { getCustomFieldSlots } from "../lib/industryTemplates";
import { AD_PLATFORMS, buildAdRows, buildLeadRows, unmappedColumns, findHeaderRow, findLeadHeaderRow, guessAdColumns, guessLeadColumns, normalizePlatform } from "../lib/adsImport";

// Impor dari Meta Ads Manager / TikTok Ads Manager / Google Ads (Excel atau CSV), dua jenis file:
//  - "Biaya iklan": laporan performa (biaya, tayangan, klik) -> dianalisis di tab Laporan.
//  - "Data lead": ekspor kontak (Meta Instant Form / Leads Center, TikTok Lead Gen, Google lead form)
//    -> dijadikan lead Nexto di tahap pertama dengan sumber = platform, dan ikut dihitung di laporan.
const COST_FIELDS = [
  ["campaign", "Nama kampanye"], ["day", "Tanggal"], ["spend", "Biaya (wajib)"], ["impressions", "Tayangan"],
  ["clicks", "Klik"], ["results", "Hasil / lead"], ["platform", "Platform (bila ada kolomnya)"],
];
const LEAD_FIELDS = [
  ["name", "Nama kontak (wajib)"], ["phone", "Telepon / WhatsApp"], ["email", "Email"], ["company", "Perusahaan (bila ada)"],
  ["city", "Kota / alamat"], ["campaign", "Nama kampanye / form"], ["day", "Tanggal masuk"], ["notes", "Catatan / pesan"], ["platform", "Platform (bila ada kolomnya)"],
];

export default function AdsImportModal({ ym, leads = [], stages = [], org, onClose, onDone }) {
  const [mode, setMode] = useState("cost"); // cost | lead
  const [sheets, setSheets] = useState(null); // [{ name, aoa }]
  const [sheetIdx, setSheetIdx] = useState(0);
  const [fileName, setFileName] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState({});
  const [platform, setPlatform] = useState("Meta");
  const [fallbackDay, setFallbackDay] = useState(`${ym}-01`);
  const [busy, setBusy] = useState(false);
  const [extraNotes, setExtraNotes] = useState(true);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  const isLead = mode === "lead";
  const applySheet = (list, idx, m = mode) => {
    const aoa = list[idx].aoa;
    const h = m === "lead" ? findLeadHeaderRow(aoa) : findHeaderRow(aoa);
    setSheetIdx(idx); setHeaderRow(h); setMapping((m === "lead" ? guessLeadColumns : guessAdColumns)(aoa[h] || []));
  };
  const switchMode = (m) => { setMode(m); setErr(""); if (sheets) applySheet(sheets, sheetIdx, m); };

  const onFile = async (file) => {
    if (!file) return;
    setErr("");
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: true });
      const list = wb.SheetNames.map((name) => ({ name, aoa: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true }) })).filter((s) => s.aoa.length > 1);
      if (!list.length) { setErr("File kosong atau tidak terbaca. Unduh ulang dari Ads Manager (Excel atau CSV)."); return; }
      setSheets(list); setFileName(file.name);
      applySheet(list, 0);
      const guess = normalizePlatform(file.name);
      if (AD_PLATFORMS.includes(guess)) setPlatform(guess);
    } catch (e) { setErr(`Gagal membaca file: ${String(e?.message || e)}`); }
  };

  const aoa = sheets ? sheets[sheetIdx].aoa : [];
  const headers = aoa[headerRow] || [];
  const firstStage = stages.find((s) => s.type === "normal")?.key || stages[0]?.key || "";
  const slotKey = getCustomFieldSlots(org?.industry, org?.custom_field_labels).find((s) => /sumber/i.test(s.label))?.key || "";

  const needed = isLead ? mapping.name : mapping.spend;
  const ready = sheets && needed !== undefined && needed !== "";
  const costBuilt = ready && !isLead ? buildAdRows(aoa, headerRow, mapping, { platform, fallbackDay }) : null;
  const leadBuilt = ready && isLead ? buildLeadRows(aoa, headerRow, mapping, { platform, stageKey: firstStage, slotKey, existing: leads, extraNotes }) : null;
  const totalSpend = costBuilt ? costBuilt.rows.reduce((s, r) => s + r.spend, 0) : 0;
  const count = isLead ? leadBuilt?.rows.length || 0 : costBuilt?.rows.length || 0;

  const run = async () => {
    if (!count) return;
    setBusy(true); setErr("");
    try {
      if (isLead) {
        let made = 0;
        for (let i = 0; i < leadBuilt.rows.length; i += 200) {
          const chunk = leadBuilt.rows.slice(i, i + 200);
          const inserted = await db.bulkInsertLeads(chunk.map((c) => c.lead));
          made += inserted.length;
          const noteByName = new Map(chunk.map((c) => [c.lead.name.toLowerCase(), c.note]));
          const withNotes = inserted.filter((r) => noteByName.get(String(r.name).toLowerCase()));
          for (let k = 0; k < withNotes.length; k += 20) {
            await Promise.all(withNotes.slice(k, k + 20).map((r) => db.addProgress(r.id, noteByName.get(String(r.name).toLowerCase())).catch((e) => console.error("Gagal menyimpan catatan iklan", r.name, e))));
          }
        }
        onDone?.({ kind: "lead", count: made });
      } else {
        const n = await db.importAdSpend(costBuilt.rows);
        onDone?.({ kind: "cost", count: n });
      }
    } catch (e) { setErr(String(e?.message || e)); setBusy(false); }
  };

  const sel = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px]";
  const fields = isLead ? LEAD_FIELDS : COST_FIELDS;
  const dayMissing = mapping.day === undefined || mapping.day === "";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-bold text-slate-900">Impor data iklan</h3>
            <p className="mt-1 text-[12px] text-slate-500">Unggah ekspor dari Meta, TikTok, atau Google (Excel atau CSV). Pilih jenis file di bawah.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {[["cost", "Biaya iklan", "Laporan performa: biaya, tayangan, klik per kampanye."], ["lead", "Data lead dari iklan", "Daftar kontak dari formulir iklan. Dijadikan lead di Nexto."]].map(([k, t, d]) => (
            <button key={k} type="button" onClick={() => switchMode(k)} className={`rounded-xl border p-3 text-left ${mode === k ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"}`}>
              <div className="text-[13px] font-semibold text-slate-900">{t}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{d}</div>
            </button>
          ))}
        </div>

        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
          <Upload size={16} /> {fileName || "Pilih file Excel atau CSV"}
        </button>

        {sheets && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Platform iklan</label>
                <select className={sel} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  {AD_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">Dipakai untuk semua baris, kecuali file punya kolom platform.</p>
              </div>
              {sheets.length > 1 && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">Sheet</label>
                  <select className={sel} value={sheetIdx} onChange={(e) => applySheet(sheets, Number(e.target.value))}>
                    {sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-[11px] font-semibold text-slate-500">Pemetaan kolom (sudah ditebak, ubah bila keliru)</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {fields.map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-0.5 block text-[11px] text-slate-500">{label}</label>
                    <select className={sel} value={mapping[key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value === "" ? undefined : Number(e.target.value) }))}>
                      <option value="">Tidak ada</option>
                      {headers.map((h, i) => (String(h ?? "").trim() ? <option key={i} value={i}>{String(h)}</option> : null))}
                    </select>
                  </div>
                ))}
              </div>
              {isLead && ready && (() => {
                const extra = unmappedColumns(aoa, headerRow, mapping);
                if (!extra.length) return null;
                return (
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12px] text-slate-700">
                    <input type="checkbox" className="mt-0.5" checked={extraNotes} onChange={(e) => setExtraNotes(e.target.checked)} />
                    <span>Simpan kolom lain di catatan lead ({extra.slice(0, 4).map((c) => c.h).join(", ")}{extra.length > 4 ? `, +${extra.length - 4}` : ""}). Jawaban pertanyaan formulir iklan tidak hilang.</span>
                  </label>
                );
              })()}
              {!isLead && dayMissing && (
                <div className="mt-2">
                  <label className="mb-0.5 block text-[11px] text-slate-500">File tidak punya kolom tanggal. Semua baris dicatat pada tanggal:</label>
                  <input type="date" className={sel} value={fallbackDay} onChange={(e) => setFallbackDay(e.target.value)} />
                </div>
              )}
            </div>

            {ready ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-700">
                {isLead ? (
                  <>
                    <div><b>{leadBuilt.rows.length}</b> lead baru akan dibuat di tahap pertama pipeline{firstStage ? ` (${stages.find((s) => s.key === firstStage)?.label || firstStage})` : ""}{leadBuilt.duplicates ? `, ${leadBuilt.duplicates} dilewati karena nomor telepon atau namanya sudah ada` : ""}{leadBuilt.empty ? `, ${leadBuilt.empty} baris tanpa nama` : ""}.</div>
                    {!slotKey && <div className="mt-1 text-amber-700">Pipeline ini belum punya isian "Sumber lead"; platform disimpan di kolom sumber bawaan.</div>}
                    {leadBuilt.rows.slice(0, 3).map((r, i) => (
                      <div key={i} className="mt-1 text-slate-500">{r.lead.name} · {r.lead.phone || "tanpa telepon"} · {slotKey ? r.lead[slotKey] : r.lead.source}</div>
                    ))}
                  </>
                ) : (
                  <>
                    <div><b>{costBuilt.rows.length}</b> baris siap diimpor, total biaya <b>{fmtRp(totalSpend)}</b>{costBuilt.skipped ? `, ${costBuilt.skipped} baris dilewati (total, kosong, atau biaya 0)` : ""}.</div>
                    {costBuilt.rows.slice(0, 3).map((r, i) => (
                      <div key={i} className="mt-1 text-slate-500">{r.day} · {r.platform} · {r.campaign || "(tanpa nama kampanye)"} · {fmtRp(r.spend)}</div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-amber-700">{isLead ? "Pilih kolom Nama kontak agar pratinjau muncul." : "Pilih kolom Biaya agar pratinjau muncul."}</p>
            )}
          </div>
        )}

        {err && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-[13px] hover:bg-slate-50">Batal</button>
          <button type="button" onClick={run} disabled={busy || !count} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} {isLead ? "Buat" : "Impor"} {count ? `${count} ${isLead ? "lead" : "baris"}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
