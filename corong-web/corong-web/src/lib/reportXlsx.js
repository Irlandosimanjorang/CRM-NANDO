// Unduhan laporan ke file Excel (.xlsx) langsung dari peramban. Tab sama dengan ekspor sebelumnya:
// Penjualan, Rencana, dan Rekap. Memakai exceljs supaya gaya sel, freeze pane, filter, dan pengaturan cetak tersimpan.
const argb = (hex) => `FF${hex}`;
const HEADER_FILL = argb("F1F5F9");
const HEADER_TEXT = argb("334155");
const HEADER_LINE = argb("CBD5E1");
const SECTION_TEXT = argb("0F172A");
const TOTAL_LINE = argb("0F172A");
const DONE_FILL = argb("E6F4EA");
const DONE_TEXT = argb("15803D");
const PENDING_TEXT = argb("64748B");

const colLetter = (n) => String.fromCharCode(64 + n); // kolom 1 = A; sampai 26 kolom

export async function downloadReportXlsx({ tabs = [], fileName = "Report.xlsx" }) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nexto";
  wb.created = new Date();

  for (const t of tabs) {
    const frozen = t.freezeRow !== undefined;
    const ws = wb.addWorksheet(t.title.slice(0, 31), {
      views: [frozen
        ? { state: "frozen", ySplit: t.freezeRow + 1, topLeftCell: `A${t.freezeRow + 2}`, showGridLines: false }
        : { showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const colCount = Math.max(1, ...t.rows.map((row) => row.length));
    const widths = [];
    t.rows.forEach((row) => row.forEach((v, c) => {
      widths[c] = Math.min(60, Math.max(widths[c] || 8, String(v ?? "").length + 2));
    }));
    ws.columns = widths.map((w) => ({ width: w }));
    t.rows.forEach((row) => ws.addRow(row));

    // Baris Excel mulai dari 1, sedangkan indeks di data mulai dari 0.
    const rowAt = (r) => ws.getRow(r + 1);

    for (const r of t.headerRows) {
      rowAt(r).eachCell({ includeEmpty: false }, (cell, c) => {
        cell.font = { bold: true, color: { argb: HEADER_TEXT } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
        cell.border = { bottom: { style: "thin", color: { argb: HEADER_LINE } } };
        cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "center", wrapText: true };
      });
    }
    for (const r of t.sectionRows) {
      rowAt(r).getCell(1).font = { bold: true, size: 12, color: { argb: SECTION_TEXT } };
    }
    for (const r of t.totalRows) {
      rowAt(r).eachCell({ includeEmpty: false }, (cell) => {
        cell.font = { bold: true, color: { argb: SECTION_TEXT } };
        cell.border = { top: { style: "thin", color: { argb: TOTAL_LINE } } };
      });
    }

    // Angka rata kanan; kolom uang diberi pemisah ribuan.
    ws.eachRow((row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (typeof cell.value !== "number") return;
        cell.alignment = { ...(cell.alignment || {}), horizontal: "right" };
        if (t.moneyCols.includes(colNumber - 1)) cell.numFmt = "#,##0";
      });
    });

    // Status Rencana: Selesai hijau, Belum abu.
    if (t.filterRow !== undefined) {
      const statusCol = t.rows[t.filterRow]?.indexOf("Status");
      if (statusCol !== undefined && statusCol >= 0) {
        for (let r = t.filterRow + 1; r < t.rows.length; r++) {
          const cell = rowAt(r).getCell(statusCol + 1);
          if (cell.value === "Selesai") {
            cell.font = { bold: true, color: { argb: DONE_TEXT } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DONE_FILL } };
          } else if (cell.value === "Belum") {
            cell.font = { color: { argb: PENDING_TEXT } };
          }
        }
      }
      ws.autoFilter = `A${t.filterRow + 1}:${colLetter(colCount)}${t.rows.length}`;
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
