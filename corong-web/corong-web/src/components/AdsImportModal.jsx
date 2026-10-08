import { useRef, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import * as db from "../lib/db";
import { fmtRp } from "../lib/helpers";
import { AD_PLATFORMS, buildAdRows, findHeaderRow, guessAdColumns, normalizePlatform } from "../lib/adsImport";

// Impor biaya iklan dari ekspor Excel/CSV Meta Ads Manager, TikTok Ads Manager, atau Google Ads.
// Langkah: pilih file -> cek pemetaan kolom (sudah ditebak) -> lihat pratinjau -> impor.
const FIELDS = [
  ["campaign", "Nama kampanye"],
  ["day", "Tanggal"],
  ["spend", "Biaya (wajib)"],
  ["impressions", "Tayangan"],
  ["clicks", "Klik"],
  ["results", "Hasil / lead"],
  ["platform", "Platform (bila ada kolomnya)"],
];

export default function AdsImportModal({ ym, onClose, onDone }) {
  const [sheets, setSheets] = useState(null); // [{ name, aoa }]
  const [sheetIdx, setSheetIdx] = useState(0);
  const [fileName, setFileName] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState({});
  const [platform, setPlatform] = useState("Meta");
  const [fallbackDay, setFallbackDay] = useState(`${ym}-01`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  const applySheet = (list, idx) => {
    const aoa = list[idx].aoa;
    const h = findHeaderRow(aoa);
    setSheetIdx(idx); setHeaderRow(h); setMapping(guessAdColumns(aoa[h] || []));
  };

  const onFile = async (file) => {
    if (!file) return;
    setErr("");
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
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
  const built = sheets && mapping.spend !== undefined && mapping.spend !== "" ? buildAdRows(aoa, headerRow, mapping, { platform, fallbackDay }) : null;
  const totalSpend = built ? built.rows.reduce((s, r) => s + r.spend, 0) : 0;

  const run = async () => {
    if (!built?.rows.length) return;
    setBusy(true); setErr("");
    try {
      const n = await db.importAdSpend(built.rows);
      onDone?.(n);
    } catch (e) { setErr(String(e?.message || e)); setBusy(false); }
  };

  const sel = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px]";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-bold text-slate-900">Impor data iklan</h3>
            <p className="mt-1 text-[12px] text-slate-500">Unggah ekspor dari Meta Ads Manager, TikTok Ads Manager, atau Google Ads (Excel atau CSV). Mengimpor ulang file yang sama memperbarui angka, tidak menggandakan.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
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
                {FIELDS.map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-0.5 block text-[11px] text-slate-500">{label}</label>
                    <select className={sel} value={mapping[key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value === "" ? undefined : Number(e.target.value) }))}>
                      <option value="">Tidak ada</option>
                      {headers.map((h, i) => (String(h ?? "").trim() ? <option key={i} value={i}>{String(h)}</option> : null))}
                    </select>
                  </div>
                ))}
              </div>
              {(mapping.day === undefined || mapping.day === "") && (
                <div className="mt-2">
                  <label className="mb-0.5 block text-[11px] text-slate-500">File tidak punya kolom tanggal. Semua baris dicatat pada tanggal:</label>
                  <input type="date" className={sel} value={fallbackDay} onChange={(e) => setFallbackDay(e.target.value)} />
                </div>
              )}
            </div>

            {built && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-700">
                <div><b>{built.rows.length}</b> baris siap diimpor, total biaya <b>{fmtRp(totalSpend)}</b>{built.skipped ? `, ${built.skipped} baris dilewati (total, kosong, atau biaya 0)` : ""}.</div>
                {built.rows.slice(0, 3).map((r, i) => (
                  <div key={i} className="mt-1 text-slate-500">{r.day} · {r.platform} · {r.campaign || "(tanpa nama kampanye)"} · {fmtRp(r.spend)}</div>
                ))}
              </div>
            )}
            {!built && <p className="text-[12px] text-amber-700">Pilih kolom Biaya agar pratinjau muncul.</p>}
          </div>
        )}

        {err && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-[13px] hover:bg-slate-50">Batal</button>
          <button type="button" onClick={run} disabled={busy || !built?.rows.length} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} Impor {built?.rows.length ? `${built.rows.length} baris` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
