// Unduhan laporan ke file Excel (.xlsx) langsung dari peramban. Tab sama dengan ekspor sebelumnya:
// Penjualan, Rencana, dan Rekap. Judul bagian dan header diberi gaya, kolom angka memakai pemisah ribuan,
// dan lebar kolom menyesuaikan isi. Memakai xlsx-js-style karena versi gratis xlsx tidak menyimpan gaya sel.
const HEADER_FILL = "F1F5F9";
const HEADER_TEXT = "334155";
const HEADER_LINE = "CBD5E1";
const SECTION_TEXT = "0F172A";

// Pastikan sel ada (sel kosong di tengah baris tidak otomatis dibuat), lalu beri gaya.
function styleCell(XLSX, ws, r, c, style) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) ws[addr] = { t: "s", v: "" };
  ws[addr].s = { ...(ws[addr].s || {}), ...style };
}

export async function downloadReportXlsx({ tabs = [], fileName = "Report.xlsx" }) {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  for (const t of tabs) {
    const ws = XLSX.utils.aoa_to_sheet(t.rows);
    const colCount = Math.max(1, ...t.rows.map((row) => row.length));
    const widths = [];
    t.rows.forEach((row) => row.forEach((v, c) => {
      widths[c] = Math.min(60, Math.max(widths[c] || 8, String(v ?? "").length + 2));
    }));
    ws["!cols"] = widths.map((wch) => ({ wch }));

    for (const r of t.headerRows) {
      for (let c = 0; c < colCount; c++) {
        styleCell(XLSX, ws, r, c, {
          font: { bold: true, color: { rgb: HEADER_TEXT } },
          fill: { patternType: "solid", fgColor: { rgb: HEADER_FILL } },
          border: { bottom: { style: "thin", color: { rgb: HEADER_LINE } } },
          alignment: { vertical: "center" },
        });
      }
    }
    for (const r of t.sectionRows) {
      styleCell(XLSX, ws, r, 0, { font: { bold: true, sz: 12, color: { rgb: SECTION_TEXT } } });
    }
    for (const c of t.moneyCols) {
      for (let r = 0; r < t.rows.length; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === "number") cell.z = "#,##0";
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, t.title.slice(0, 31));
  }
  XLSX.writeFile(wb, fileName);
}
