// Unduhan laporan ke file Excel (.xlsx) langsung dari peramban. Tab sama dengan ekspor sebelumnya:
// Penjualan, Rencana, dan Rekap. Lebar kolom menyesuaikan isi, kolom angka memakai pemisah ribuan.
export async function downloadReportXlsx({ tabs = [], fileName = "Report.xlsx" }) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const t of tabs) {
    const ws = XLSX.utils.aoa_to_sheet(t.rows);
    const widths = [];
    t.rows.forEach((row) => row.forEach((v, c) => {
      widths[c] = Math.min(60, Math.max(widths[c] || 8, String(v ?? "").length + 2));
    }));
    ws["!cols"] = widths.map((wch) => ({ wch }));
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
