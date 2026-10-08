import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Table2, AlertTriangle, Sparkles } from "lucide-react";

// BUG FIX (17 Sep 2026, permintaan Nando) - koreksi manual user (assign kolom,
// nama field custom, baris awal data) sebelumnya cuma di state React, ilang
// kalau tab-nya di-discard - Leads.jsx sendiri udah nyimpen `request` (file
// yang di-parse), jadi modal ini kebuka lagi, tapi user harus ngulang semua
// koreksinya dari nol. Divalidasi ke `sheetName` biar gak ke-restore ke
// sheet/file yang beda kalau kebetulan ada draft basi dari import lain.
const MANUAL_MAP_DRAFT_KEY = "nexto_manual_map_draft";
const MANUAL_MAP_DRAFT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 jam
function loadManualMapDraft(sheetName) {
  try {
    const raw = localStorage.getItem(MANUAL_MAP_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (Date.now() - d.savedAt > MANUAL_MAP_DRAFT_MAX_AGE) { localStorage.removeItem(MANUAL_MAP_DRAFT_KEY); return null; }
    if (d.sheetName !== sheetName) return null;
    return d;
  } catch { return null; }
}
function clearManualMapDraft() {
  try { localStorage.removeItem(MANUAL_MAP_DRAFT_KEY); } catch {}
}

// Layar konfirmasi petaan kolom - SEKARANG SELALU muncul tiap kali import
// (dulu cuma muncul kalau deteksi otomatis gagal total). Rule-based/AI di
// Leads.jsx importFile udah nebak duluan & ngisi `initialMapping` - user
// TINGGAL cek & betulin kalau ada yang salah, bukan mulai dari kosong.
// Kalau tebakannya kosong (gagal total), modal ini jadi tempat isi manual
// dari nol - behavior lama, cuma sekarang selalu lewat layar yang sama.
//
// Kolom yang gak punya padanan di field bawaan (misal "Production Lines" di
// Excel-nya user) bisa dipilih "+ Custom..." - nanti dikasih nama sendiri,
// disimpen sebagai custom_field_1..10 (slot bebas yang UDAH ADA di tabel
// leads, cuma dulu cuma bisa dinamain lewat kode/template industri - lihat
// organizations.custom_field_labels & handleManualMapConfirm di Leads.jsx).
const BASE_FIELD_OPTIONS = [
  { value: "", label: "— Abaikan —" },
  { value: "name", label: "Nama Lead / Perusahaan *" },
  { value: "company_type", label: "Tipe / skala perusahaan" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telepon / WA" },
  { value: "key_person", label: "Nama Kontak (PIC)" },
  { value: "key_person_title", label: "Jabatan Kontak" },
  { value: "product", label: "Produk" },
  { value: "city", label: "Kota" },
  { value: "province", label: "Provinsi" },
  { value: "entity_level", label: "Peran baris (Holding / Perusahaan / Anak)" },
  { value: "group_holding", label: "Holding / Group" },
  { value: "parent_company", label: "Perusahaan Induk" },
  { value: "website", label: "Website" },
  { value: "background", label: "Latar Belakang" },
  { value: "notes", label: "Catatan (jadi progress note)" },
];
const NEW_CUSTOM_VALUE = "__new_custom__";

const MAX_PREVIEW_ROWS = 12;
// Peran per baris (mode "Tandai hirarki"): holding > perusahaan > anak.
const ROW_ROLES = [
  { value: "", label: "—" },
  { value: "holding", label: "Holding" },
  { value: "perusahaan", label: "Perusahaan" },
  { value: "anak", label: "Anak" },
  { value: "mandiri", label: "Mandiri" },
];

export default function ManualColumnMapModal({ request, onConfirm, onCancel }) {
  const { rawRows, sheetName, initialMapping = {}, initialDataStartRow = 0, usedAiGuess, existingCustomSlots = [] } = request;

  const fieldOptions = useMemo(() => {
    const existingOpts = existingCustomSlots.map((s) => ({ value: s.key, label: s.label }));
    return [...BASE_FIELD_OPTIONS, ...existingOpts, { value: NEW_CUSTOM_VALUE, label: "+ Custom..." }];
  }, [existingCustomSlots]);

  const numCols = useMemo(
    () => rawRows.slice(0, 20).reduce((max, r) => Math.max(max, r.length), 0),
    [rawRows]
  );
  const [mapDraft] = useState(() => loadManualMapDraft(sheetName));
  const [assign, setAssign] = useState(() => {
    if (mapDraft?.assign && mapDraft.assign.length === numCols) return mapDraft.assign;
    const arr = Array(numCols).fill("");
    Object.entries(initialMapping).forEach(([field, idx]) => {
      if (idx !== null && idx !== undefined && idx >= 0 && idx < numCols) arr[idx] = field;
    });
    return arr;
  });
  const [dataStartRow, setDataStartRow] = useState(() => mapDraft?.dataStartRow ?? initialDataStartRow);
  const [customLabels, setCustomLabels] = useState(() => mapDraft?.customLabels || {}); // colIdx -> label yang diketik user
  // Mode tandai hirarki (8 Okt 2026): pilih peran tiap baris (Holding/Perusahaan/Anak) langsung di tabel.
  const [hierMode, setHierMode] = useState(() => !!mapDraft?.hierMode);
  const [follow, setFollow] = useState(() => mapDraft?.follow !== false); // baris tanpa tanda ikut jadi anak
  const [rowRoles, setRowRoles] = useState(() => mapDraft?.rowRoles || {}); // indeks baris mentah -> peran

  // Auto-simpen koreksi manual tiap berubah - lihat komentar MANUAL_MAP_DRAFT_KEY.
  useEffect(() => {
    try {
      localStorage.setItem(MANUAL_MAP_DRAFT_KEY, JSON.stringify({ sheetName, assign, dataStartRow, customLabels, hierMode, follow, rowRoles, savedAt: Date.now() }));
    } catch (_) {}
  }, [sheetName, assign, dataStartRow, customLabels, hierMode, follow, rowRoles]);

  const autoGuessed = initialMapping && initialMapping.name !== undefined && initialMapping.name !== null;

  // Field BIASA cuma boleh dipasangin ke SATU kolom - milih field yang sama
  // di kolom lain otomatis ngosongin pilihan lama. "+ Custom..." DIKECUALIIN
  // dari aturan ini - boleh dipilih di banyak kolom sekaligus (masing-masing
  // jadi field custom yang beda, dengan nama sendiri-sendiri).
  const setColumnField = (colIdx, field) => {
    setAssign((prev) => {
      const next = prev.map((v, i) => (field && field !== NEW_CUSTOM_VALUE && i !== colIdx && v === field ? "" : v));
      next[colIdx] = field;
      return next;
    });
    if (field === NEW_CUSTOM_VALUE && !customLabels[colIdx]) {
      // Pre-fill nama field custom dari teks di baris SEBELUM data mulai
      // (kemungkinan besar itu header aslinya) - biar user gak perlu ngetik
      // ulang kalau nama kolomnya emang udah jelas.
      const headerGuessRow = rawRows[Math.max(0, dataStartRow - 1)];
      const guess = headerGuessRow ? String(headerGuessRow[colIdx] ?? "").trim() : "";
      if (guess) setCustomLabels((prev) => ({ ...prev, [colIdx]: guess }));
    }
  };

  const hasName = assign.includes("name");
  // Mode hirarki menampilkan SEMUA baris (bisa digulir) supaya setiap baris bisa ditandai.
  const preview = hierMode ? rawRows.slice(0, 1000) : rawRows.slice(0, MAX_PREVIEW_ROWS);
  const roleCount = (r) => Object.entries(rowRoles).filter(([i, v]) => v === r && Number(i) >= dataStartRow).length;
  const setRole = (rowIdx, role) => setRowRoles((prev) => {
    const next = { ...prev };
    if (role) next[rowIdx] = role; else delete next[rowIdx];
    return next;
  });

  const handleConfirm = () => {
    const mapping = {};
    const customEntries = [];
    let missingLabel = false;

    assign.forEach((field, idx) => {
      if (!field) return;
      if (field === NEW_CUSTOM_VALUE) {
        const label = (customLabels[idx] || "").trim();
        if (!label) { missingLabel = true; return; }
        customEntries.push({ colIndex: idx, label });
      } else {
        mapping[field] = idx;
      }
    });

    if (missingLabel) {
      alert("Isi terlebih dahulu nama field untuk kolom yang dipilih \"+ Custom...\" (belum diberi nama).");
      return;
    }

    clearManualMapDraft();
    // Peran per baris -> indeks baris DATA (setelah baris judul dibuang).
    const levels = {};
    if (hierMode) {
      for (const [i, role] of Object.entries(rowRoles)) {
        const di = Number(i) - dataStartRow;
        if (role && di >= 0) levels[di] = role;
      }
    }
    onConfirm(mapping, dataStartRow, customEntries, hierMode ? { levels, follow } : undefined);
  };

  const handleCancel = () => { clearManualMapDraft(); onCancel(); };

  // Di-render lewat portal langsung ke document.body - BUKAN inline di dalam
  // tree Leads.jsx. Kalau dirender inline, ancestor tab Leads (yang punya
  // banyak elemen positioned/sticky) bisa ngekurung posisi "fixed" ini jadi
  // relatif ke situ doang, bukan ke viewport beneran - bikin modal keliatan
  // "nempel ke kiri"/kepotong (lihat catatan serupa di App.jsx buat kartu
  // profil ProfileAvatar - pola yang sama dipake di sini).
  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 pb-28 md:pb-4 z-50 overflow-y-auto" onClick={handleCancel}>
      <div className="bg-white rounded-panel shadow-2xl w-full max-w-4xl min-w-0 my-8 p-5" style={{ maxWidth: "min(56rem, calc(100vw - 2rem))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg flex items-center gap-2"><Table2 size={18} className="text-orange-500" /> Cek & Sesuaikan Kolom Import</h2>
          <button onClick={handleCancel} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-500 mb-1">
          {autoGuessed ? (
            <>Nexto sudah mencoba menebak pemetaan kolom di sheet <b>"{sheetName}"</b> ini{usedAiGuess ? " pakai AI" : ""} - periksa di bawah, perbaiki jika ada yang salah, lalu klik Import.</>
          ) : (
            <>Nexto belum yakin dapat menebak kolom di sheet <b>"{sheetName}"</b> ini. Tentukan sendiri isi setiap kolom melalui dropdown di atas tiap kolom.</>
          )}
        </p>
        <p className="text-xs text-amber-600 flex items-center gap-1 mb-3"><AlertTriangle size={12} /> Wajib memilih satu kolom sebagai "Nama Lead / Perusahaan". Kolom yang tidak memiliki padanan dapat dipilih "+ Custom..." dan diberi nama sendiri.</p>

        <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <label className="flex cursor-pointer items-start gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-orange-600" checked={hierMode} onChange={(e) => setHierMode(e.target.checked)} />
            <span>Tandai Holding / Perusahaan / Anak perusahaan per baris
              <span className="block text-[11.5px] font-normal text-slate-500">Muncul pilihan di sisi kiri tiap baris. Tandai baris yang menjadi Holding atau Perusahaan; baris tanpa tanda di bawahnya otomatis jadi anak perusahaannya.</span>
            </span>
          </label>
          {hierMode && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" className="h-3.5 w-3.5 accent-orange-600" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
                Baris tanpa tanda ikut jadi anak dari perusahaan/holding di atasnya
              </label>
              <span className="tabular-nums text-slate-500">Ditandai: {roleCount("holding")} holding, {roleCount("perusahaan")} perusahaan, {roleCount("anak")} anak, {roleCount("mandiri")} mandiri</span>
              {Object.keys(rowRoles).length > 0 && <button type="button" onClick={() => setRowRoles({})} className="font-semibold text-orange-700 hover:text-orange-800">Hapus semua tanda</button>}
            </div>
          )}
        </div>

        <div className={`overflow-x-auto max-w-full border border-slate-200 rounded-2xl ${hierMode ? "max-h-[55vh] overflow-y-auto" : ""}`}>
          <table className="text-xs w-full border-collapse">
            <thead className={hierMode ? "sticky top-0 z-20" : ""}>
              <tr>
                <th className="sticky left-0 bg-slate-50 border-b border-slate-200 p-2 text-left w-10 z-10">{hierMode ? "Peran" : "#"}</th>
                {Array.from({ length: numCols }).map((_, colIdx) => (
                  <th key={colIdx} className="border-b border-l border-slate-200 p-1.5 min-w-[150px] bg-slate-50 align-top">
                    <select
                      value={assign[colIdx] || ""}
                      onChange={(e) => setColumnField(colIdx, e.target.value)}
                      className={`w-full text-[11px] border rounded-lg px-1.5 py-1 ${assign[colIdx] === "name" ? "border-orange-400 bg-orange-50 font-semibold" : "border-slate-300 bg-white"}`}
                    >
                      {fieldOptions.map((opt) => (
                        <option
                          key={opt.value}
                          value={opt.value}
                          disabled={!!opt.value && opt.value !== NEW_CUSTOM_VALUE && assign.includes(opt.value) && assign[colIdx] !== opt.value}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {assign[colIdx] === NEW_CUSTOM_VALUE && (
                      <input
                        type="text"
                        value={customLabels[colIdx] || ""}
                        onChange={(e) => setCustomLabels((prev) => ({ ...prev, [colIdx]: e.target.value }))}
                        placeholder="Nama field, misal: Production Lines"
                        className="w-full mt-1 text-[11px] border border-violet-300 bg-violet-50 rounded-lg px-1.5 py-1"
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  onClick={() => setDataStartRow(rowIdx)}
                  className={`cursor-pointer ${rowIdx === dataStartRow ? "bg-emerald-50" : rowIdx < dataStartRow ? "opacity-40" : "hover:bg-slate-50"}`}
                  title="Klik untuk menandai: data asli dimulai dari baris ini"
                >
                  <td className="sticky left-0 bg-white border-b border-slate-100 p-2 text-slate-400 font-mono">
                    {hierMode && rowIdx >= dataStartRow ? (
                      <select
                        value={rowRoles[rowIdx] || ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRole(rowIdx, e.target.value)}
                        aria-label={`Peran baris ${rowIdx}`}
                        className={`w-[104px] rounded-lg border px-1 py-1 text-[11px] font-sans ${rowRoles[rowIdx] === "holding" ? "border-slate-800 bg-slate-800 text-white" : rowRoles[rowIdx] === "perusahaan" ? "border-orange-400 bg-orange-50 text-orange-800" : rowRoles[rowIdx] ? "border-slate-300 bg-slate-100 text-slate-700" : "border-slate-200 bg-white text-slate-400"}`}
                      >
                        {ROW_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (rowIdx === dataStartRow ? "→" : rowIdx)}
                  </td>
                  {Array.from({ length: numCols }).map((_, colIdx) => (
                    <td key={colIdx} className="border-b border-l border-slate-100 p-1.5 text-slate-700 truncate max-w-[160px]">
                      {String(row[colIdx] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Klik salah satu baris di atas untuk menandai baris tersebut sebagai awal DATA ASLI (baris judul/header di atasnya akan dilewati).
          {!hierMode && rawRows.length > MAX_PREVIEW_ROWS && ` Cuma ${MAX_PREVIEW_ROWS} baris pertama ditampilkan di sini, sisanya (${rawRows.length - MAX_PREVIEW_ROWS} baris lagi) tetap ikut diproses.`}
        </p>
        {existingCustomSlots.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><Sparkles size={11} /> Field custom yang sudah ada: {existingCustomSlots.map((s) => s.label).join(", ")}.</p>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={handleCancel} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 flex-1">Batal</button>
          <button
            onClick={handleConfirm}
            disabled={!hasName}
            className="text-sm px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium flex-1"
          >
            Import
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
