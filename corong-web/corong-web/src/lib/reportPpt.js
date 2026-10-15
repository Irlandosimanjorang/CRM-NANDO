// Unduh presentasi PowerPoint dari tab Report (16 Okt 2026). Datanya sama dengan ringkasan yang dicetak ke PDF,
// jadi angka di slide dan di layar selalu sama. Pustakanya dimuat saat tombol diklik, tidak ikut di bundel awal.
const INK = "0F172A";
const MUTED = "64748B";
const LINE = "E2E8F0";
const GOOD = "047857";
const FONT = "Calibri";

export async function downloadReportPpt({ orgName = "", who = "", periodLabel = "", fmtRp, pct, filtered = false, target = 0, summary, deals = [], team = [], showTeam = false }) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inci
  pptx.title = `Report ${who} ${periodLabel}`;

  // Slide 1: judul
  const s1 = pptx.addSlide();
  s1.background = { color: "FFFFFF" };
  s1.addText("Report penjualan", { x: 0.8, y: 2.0, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 20, color: MUTED });
  s1.addText(who, { x: 0.8, y: 2.6, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 44, bold: true, color: INK });
  s1.addText(`${orgName}${orgName ? " · " : ""}${periodLabel}${filtered ? " · terfilter" : ""}`, { x: 0.8, y: 3.9, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 18, color: MUTED });

  // Slide 2: ringkasan angka utama
  const s2 = pptx.addSlide();
  s2.addText("Ringkasan bulan ini", { x: 0.6, y: 0.4, w: 12, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: INK });
  const tiles = [
    { label: "Omzet", value: fmtRp(summary.dealValue), sub: target > 0 ? `${pct(summary.dealValue, target)} dari target ${fmtRp(target)}` : "", color: GOOD },
    { label: "Deal", value: String(summary.dealCount), sub: "", color: INK },
    { label: "Data masuk", value: String(summary.masuk), sub: "", color: INK },
    { label: "SPH belum diproses", value: String(summary.sphCount), sub: fmtRp(summary.sphValue), color: INK },
    { label: "Hot progress", value: String(summary.hotCount), sub: fmtRp(summary.hotValue), color: INK },
  ];
  const tileW = 2.3, gap = 0.2;
  tiles.forEach((t, i) => {
    const x = 0.6 + i * (tileW + gap);
    s2.addShape(pptx.ShapeType.rect, { x, y: 1.6, w: tileW, h: 2.2, fill: { color: "F8FAFC" }, line: { color: LINE, width: 0.75 } });
    s2.addText(t.label, { x: x + 0.2, y: 1.8, w: tileW - 0.4, h: 0.4, fontFace: FONT, fontSize: 12, color: MUTED });
    s2.addText(t.value, { x: x + 0.2, y: 2.2, w: tileW - 0.4, h: 0.8, fontFace: FONT, fontSize: 24, bold: true, color: t.color, fit: "shrink" });
    if (t.sub) s2.addText(t.sub, { x: x + 0.2, y: 3.1, w: tileW - 0.4, h: 0.5, fontFace: FONT, fontSize: 11, color: MUTED, fit: "shrink" });
  });

  // Slide 3: corong (grafik batang)
  const s3 = pptx.addSlide();
  s3.addText("Corong penjualan", { x: 0.6, y: 0.4, w: 12, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: INK });
  s3.addChart(pptx.ChartType.bar, [{ name: "Jumlah", labels: ["Data masuk", "SPH belum diproses", "Hot progress", "Deal"], values: [summary.masuk, summary.sphCount, summary.hotCount, summary.dealCount] }], {
    x: 0.6, y: 1.3, w: 12.1, h: 5.4, barDir: "col", chartColors: ["0F172A"], showValue: true, dataLabelFontSize: 14, dataLabelColor: INK,
    catAxisLabelFontFace: FONT, catAxisLabelFontSize: 13, catAxisLabelColor: MUTED, valAxisHidden: true, valGridLine: { style: "none" }, showLegend: false,
  });

  // Slide 4: deal bulan ini
  const s4 = pptx.addSlide();
  s4.addText("Deal bulan ini", { x: 0.6, y: 0.4, w: 12, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: INK });
  if (deals.length === 0) {
    s4.addText("Belum ada deal pada bulan ini.", { x: 0.6, y: 1.4, w: 12, h: 0.5, fontFace: FONT, fontSize: 16, color: MUTED });
  } else {
    const shown = deals.slice(0, 14);
    const head = [["Tanggal", "Nama", "Nilai"].map((t, i) => ({ text: t, options: { bold: true, color: MUTED, align: i === 2 ? "right" : "left" } }))];
    const body = shown.map((d) => [
      { text: String(d.date).slice(0, 10), options: { color: INK } },
      { text: d.name, options: { color: INK } },
      { text: fmtRp(d.value), options: { color: INK, align: "right" } },
    ]);
    s4.addTable([...head, ...body], { x: 0.6, y: 1.3, w: 12.1, colW: [2.0, 7.3, 2.8], fontFace: FONT, fontSize: 13, border: { type: "solid", pt: 0.5, color: LINE }, rowH: 0.36 });
    if (deals.length > shown.length) s4.addText(`+${deals.length - shown.length} deal lain`, { x: 0.6, y: 6.7, w: 12, h: 0.4, fontFace: FONT, fontSize: 12, color: MUTED });
  }

  // Slide 5: hasil per marketing (hanya tampilan tim)
  if (showTeam && team.length) {
    const s5 = pptx.addSlide();
    s5.addText("Hasil per marketing", { x: 0.6, y: 0.4, w: 12, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: INK });
    const head = [["Marketing", "Lead masuk", "SPH", "Hot", "Deal", "Omzet", "Capaian target"].map((t, i) => ({ text: t, options: { bold: true, color: MUTED, align: i ? "right" : "left" } }))];
    const body = team.map((m) => [
      { text: m.name, options: { color: INK, bold: true } },
      { text: String(m.masuk), options: { color: INK, align: "right" } },
      { text: String(m.sph), options: { color: INK, align: "right" } },
      { text: String(m.hot), options: { color: INK, align: "right" } },
      { text: String(m.deals), options: { color: INK, align: "right" } },
      { text: fmtRp(m.omzet), options: { color: INK, align: "right" } },
      { text: m.target > 0 ? pct(m.omzet, m.target) : "-", options: { color: INK, align: "right" } },
    ]);
    s5.addTable([...head, ...body], { x: 0.6, y: 1.3, w: 12.1, colW: [2.6, 1.5, 1.2, 1.2, 1.2, 2.6, 1.8], fontFace: FONT, fontSize: 13, border: { type: "solid", pt: 0.5, color: LINE }, rowH: 0.42 });
  }

  await pptx.writeFile({ fileName: `Report-${(orgName || "sales").replace(/[^A-Za-z0-9]+/g, "-")}-${periodLabel.replace(/[^A-Za-z0-9]+/g, "-")}.pptx` });
}
