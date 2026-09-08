import { useMemo, useState } from "react";
import { X, Table2, AlertTriangle, Sparkles } from "lucide-react";

// Layar konfirmasi petaan kolom - SEKARANG SELALU muncul tiap kali import
// (dulu cuma muncul kalau deteksi otomatis gagal total). Rule-based/AI di
// Leads.jsx importFile udah nebak duluan & ngisi `initialMapping` - user
// TINGGAL cek & betulin kalau ada yang salah, bukan mulai dari kosong.
// Kalau tebakannya kosong (gagal total), modal ini jadi tempat isi manual
// dari nol - behavior lama, cuma sekarang selalu lewat layar yang sama.
//
// Kolom yang gak punya padanan di field bawaan (misal "Production Lines" di
// Excel-nya user) bisa dipilih "+ Custom..." - nanti dikasih nama sendiri,
// disimpen sebagai custom_field_1..5 (slot bebas yang UDAH ADA di tabel
// leads, cuma dulu cuma bisa dinamain lewat kode/template industri - lihat
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

const MAX_PREVIEW_ROWS = 12;

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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg flex items-center gap-2"><Table2 size={18} className="text-orange-500" /> Cek & Sesuaikan Kolom Import</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-500 mb-1">
          {autoGuessed ? (
            <>Nexto udah coba nebak petaan kolom di sheet <b>"{sheetName}"</b> ini{usedAiGuess ? " pakai AI" : ""} - cek dulu di bawah, betulin kalau ada yang salah, baru klik Import.</>
          ) : (
            <>Nexto gak yakin bisa nebak kolom di sheet <b>"{sheetName}"</b> ini. Tentuin sendiri kolom mana isinya apa lewat dropdown di atas tiap kolom.</>
          )}
        </p>
        <p className="text-xs text-amber-600 flex items-center gap-1 mb-3"><AlertTriangle size={12} /> Wajib pilih satu kolom sebagai "Nama Lead / Perusahaan". Kolom yang gak ada padanannya bisa dipilih "+ Custom..." dan dikasih nama sendiri.</p>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-50 border-b border-slate-200 p-2 text-left w-10 z-10">#</th>
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
                  title="Klik buat tandain: data asli mulai dari baris ini"
                >
                  <td className="sticky left-0 bg-white border-b border-slate-100 p-2 text-slate-400 font-mono">
                    {rowIdx === dataStartRow ? "→" : rowIdx}
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
          Klik salah satu baris di atas buat nandain baris itu sebagai awal DATA ASLI (baris judul/header di atasnya bakal dilewatin).
          {rawRows.length > MAX_PREVIEW_ROWS && ` Cuma ${MAX_PREVIEW_ROWS} baris pertama ditampilin di sini, sisanya (${rawRows.length - MAX_PREVIEW_ROWS} baris lagi) tetep ikut diproses.`}
        </p>
        {existingCustomSlots.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><Sparkles size={11} /> Field custom yang udah ada: {existingCustomSlots.map((s) => s.label).join(", ")}.</p>
        )}

        <div className="flex gap-2 mt-4">
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
  );
}
