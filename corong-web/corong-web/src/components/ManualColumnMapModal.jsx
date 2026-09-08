import { useMemo, useState } from "react";
import { X, Table2, CheckCircle2, Sparkles } from "lucide-react";

// Layar konfirmasi petaan kolom - SELALU muncul tiap kali import (bukan
// cuma pas deteksi otomatis gagal). Rule-based/AI di Leads.jsx importFile
// udah nebak duluan & ngisi `initialMapping` - user TINGGAL cek & betulin
// kalau ada yang salah, bukan mulai dari kosong.
//
// Didesain 2 langkah biar gampang dibaca meski kolomnya banyak:
//   1. Tabel mentah CUMA buat nandain baris mana data asli mulai (klik
//      barisnya) - gak ada dropdown nempel di tabel, jadi gak perlu scroll
//      horizontal buat milih field.
//   2. Daftar VERTIKAL satu kolom = satu baris, dropdown-nya lega & jelas.
//
// Kolom yang gak punya padanan di field bawaan (misal "Production Lines")
// bisa dipilih "+ Custom..." - dikasih nama sendiri, disimpen sebagai
// custom_field_1..5 (slot bebas yang UDAH ADA di tabel leads, lihat
// organizations.custom_field_labels & handleManualMapConfirm di Leads.jsx).
const BASE_FIELD_OPTIONS = [
  { value: "", label: "— Abaikan —" },
  { value: "name", label: "Nama Lead / Perusahaan *" },
  { value: "company_type", label: "Tipe (Manufacturer/Trader)" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telepon / WA" },
  { value: "key_person", label: "Nama Kontak (PIC)" },
  { value: "key_person_title", label: "Jabatan Kontak" },
  { value: "product", label: "Produk" },
  { value: "city", label: "Kota" },
  { value: "province", label: "Provinsi" },
  { value: "website", label: "Website" },
  { value: "background", label: "Latar Belakang" },
  { value: "notes", label: "Catatan (jadi progress note)" },
];
const NEW_CUSTOM_VALUE = "__new_custom__";
const MAX_PREVIEW_ROWS = 8;

function colLetter(i) {
  let s = "", n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

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
  const [assign, setAssign] = useState(() => {
    const arr = Array(numCols).fill("");
    Object.entries(initialMapping).forEach(([field, idx]) => {
      if (idx !== null && idx !== undefined && idx >= 0 && idx < numCols) arr[idx] = field;
    });
    return arr;
  });
  const [dataStartRow, setDataStartRow] = useState(initialDataStartRow);
  const [customLabels, setCustomLabels] = useState({}); // colIdx -> label yang diketik user

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
  const preview = rawRows.slice(0, MAX_PREVIEW_ROWS);
  // Contoh isi tiap kolom - dari baris SEBELUM data mulai (kemungkinan
  // besar header aslinya) kalau ada, kalau kosong pakai baris data pertama.
  const sampleRow = rawRows[Math.max(0, dataStartRow - 1)]?.some((v) => String(v ?? "").trim())
    ? rawRows[Math.max(0, dataStartRow - 1)]
    : rawRows[dataStartRow] || [];

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
      alert("Isi dulu nama field-nya buat kolom yang dipilih \"+ Custom...\" (belum dikasih nama).");
      return;
    }

    onConfirm(mapping, dataStartRow, customEntries);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 pb-28 md:pb-4 z-50 overflow-y-auto" onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-lg flex items-center gap-2"><Table2 size={18} className="text-orange-500" /> Cek & Sesuaikan Kolom Import</h2>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
          </div>
          <p className="text-sm text-slate-500">
            {autoGuessed ? (
              <>Nexto udah nebak petaan kolom sheet <b>"{sheetName}"</b>{usedAiGuess ? " pakai AI" : ""} - cek & betulin kalau ada yang salah.</>
            ) : (
              <>Nexto gak yakin bisa nebak kolom di sheet <b>"{sheetName}"</b>. Tentuin sendiri kolom mana isinya apa.</>
            )}
          </p>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* LANGKAH 1 - data mulai dari baris mana */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">1. Data asli mulai dari baris mana?</p>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-slate-50 border-b border-slate-200 p-2 w-8 z-10"> </th>
                    {Array.from({ length: numCols }).map((_, colIdx) => (
                      <th key={colIdx} className="border-b border-l border-slate-200 p-1.5 min-w-[90px] bg-slate-50 font-mono text-slate-400 font-normal">
                        {colLetter(colIdx)}
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
                      title="Klik buat tandain: data asli mulai dari baris ini"
                    >
                      <td className="sticky left-0 bg-white border-b border-slate-100 text-center">
                        {rowIdx === dataStartRow ? <CheckCircle2 size={13} className="text-emerald-500 inline" /> : <span className="text-slate-300">{rowIdx}</span>}
                      </td>
                      {Array.from({ length: numCols }).map((_, colIdx) => (
                        <td key={colIdx} className="border-b border-l border-slate-100 p-1.5 text-slate-700 truncate max-w-[140px]">
                          {String(row[colIdx] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Klik baris yang jadi awal data asli - baris di atasnya (judul/header) bakal dilewatin.
              {rawRows.length > MAX_PREVIEW_ROWS && ` Cuma ${MAX_PREVIEW_ROWS} baris pertama ditampilin, sisanya (${rawRows.length - MAX_PREVIEW_ROWS} baris lagi) tetep ikut diproses.`}
            </p>
          </div>

          {/* LANGKAH 2 - kolom mana isinya apa */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">2. Kolom mana isinya apa?</p>
            <div className="space-y-1.5">
              {Array.from({ length: numCols }).map((_, colIdx) => {
                const sample = String(sampleRow[colIdx] ?? "").trim();
                const isName = assign[colIdx] === "name";
                const isCustom = assign[colIdx] === NEW_CUSTOM_VALUE;
                return (
                  <div key={colIdx} className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${isName ? "border-orange-300 bg-orange-50/60" : "border-slate-200"}`}>
                    <div className="w-6 shrink-0 text-center text-[10px] font-mono text-slate-400 pt-2">{colLetter(colIdx)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-slate-400 truncate mb-1">{sample ? `"${sample}"` : "(kolom kosong)"}</div>
                      <select
                        value={assign[colIdx] || ""}
                        onChange={(e) => setColumnField(colIdx, e.target.value)}
                        className={`w-full text-sm border rounded-lg px-2 py-1.5 ${isName ? "border-orange-400 font-semibold text-orange-800 bg-white" : "border-slate-300 bg-white"}`}
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
                      {isCustom && (
                        <input
                          type="text"
                          value={customLabels[colIdx] || ""}
                          onChange={(e) => setCustomLabels((prev) => ({ ...prev, [colIdx]: e.target.value }))}
                          placeholder="Nama field, misal: Production Lines"
                          className="w-full mt-1.5 text-sm border border-violet-300 bg-violet-50 rounded-lg px-2 py-1.5"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {existingCustomSlots.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1"><Sparkles size={11} /> Field custom yang udah ada: {existingCustomSlots.map((s) => s.label).join(", ")}.</p>
            )}
          </div>
        </div>

        <div className="p-5 pt-3 border-t border-slate-100 shrink-0">
          {!hasName && <p className="text-xs text-amber-600 mb-2">Pilih satu kolom sebagai "Nama Lead / Perusahaan" dulu buat lanjut.</p>}
          <div className="flex gap-2">
            <button onClick={onCancel} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 flex-1">Batal</button>
            <button
              onClick={handleConfirm}
              disabled={!hasName}
              className="text-sm px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium flex-1"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
