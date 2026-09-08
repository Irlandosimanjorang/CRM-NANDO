import { useMemo, useState } from "react";
import { X, Table2, AlertTriangle } from "lucide-react";

// Fallback terakhir buat import Excel/CSV yang gagal ke-baca OTOMATIS (baik
// rule-based maupun AI - lihat Leads.jsx importFile). Dulu di titik ini
// langsung nyerah (alert "Ga ada baris kebaca"), user harus edit ulang
// Excel-nya biar formatnya "biasa" baru bisa ke-import. Sekarang user
// sendiri yang nunjukkin kolom mana isinya apa, dan baris keberapa data
// aslinya mulai (buat ngelewatin baris judul/instruksi kalau ada) - lebih
// jujur daripada maksa nebak-nebak otomatis terus-terusan gagal.
const FIELD_OPTIONS = [
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

const MAX_PREVIEW_ROWS = 12;

export default function ManualColumnMapModal({ request, onConfirm, onCancel }) {
  const { rawRows, sheetName } = request;
  const numCols = useMemo(
    () => rawRows.slice(0, 20).reduce((max, r) => Math.max(max, r.length), 0),
    [rawRows]
  );
  const [assign, setAssign] = useState(() => Array(numCols).fill(""));
  const [dataStartRow, setDataStartRow] = useState(0);

  // Satu field cuma boleh dipasangin ke SATU kolom - milih field yang sama
  // di kolom lain otomatis ngosongin pilihan lama, biar gak ambigu field
  // mana yang beneran dipake pas extractRowsFromMapping.
  const setColumnField = (colIdx, field) => {
    setAssign((prev) => {
      const next = prev.map((v, i) => (field && i !== colIdx && v === field ? "" : v));
      next[colIdx] = field;
      return next;
    });
  };

  const hasName = assign.includes("name");
  const preview = rawRows.slice(0, MAX_PREVIEW_ROWS);

  const handleConfirm = () => {
    const mapping = {};
    assign.forEach((field, idx) => { if (field) mapping[field] = idx; });
    onConfirm(mapping, dataStartRow);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 pb-28 md:pb-4 z-50 overflow-y-auto" onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg flex items-center gap-2"><Table2 size={18} className="text-orange-500" /> Petain Kolom Manual</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-500 mb-1">
          Nexto gak yakin bisa baca kolom di sheet <b>"{sheetName}"</b> ini otomatis. Tentuin sendiri kolom mana isinya apa lewat dropdown di atas tiap kolom.
        </p>
        <p className="text-xs text-amber-600 flex items-center gap-1 mb-3"><AlertTriangle size={12} /> Wajib pilih satu kolom sebagai "Nama Lead / Perusahaan".</p>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-50 border-b border-slate-200 p-2 text-left w-10 z-10">#</th>
                {Array.from({ length: numCols }).map((_, colIdx) => (
                  <th key={colIdx} className="border-b border-l border-slate-200 p-1.5 min-w-[150px] bg-slate-50">
                    <select
                      value={assign[colIdx] || ""}
                      onChange={(e) => setColumnField(colIdx, e.target.value)}
                      className={`w-full text-[11px] border rounded-lg px-1.5 py-1 ${assign[colIdx] === "name" ? "border-orange-400 bg-orange-50 font-semibold" : "border-slate-300 bg-white"}`}
                    >
                      {FIELD_OPTIONS.map((opt) => (
                        <option
                          key={opt.value}
                          value={opt.value}
                          disabled={!!opt.value && assign.includes(opt.value) && assign[colIdx] !== opt.value}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
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

        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 flex-1">Batal</button>
          <button
            onClick={handleConfirm}
            disabled={!hasName}
            className="text-sm px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium flex-1"
          >
            Import Pakai Petaan Ini
          </button>
        </div>
      </div>
    </div>
  );
}
