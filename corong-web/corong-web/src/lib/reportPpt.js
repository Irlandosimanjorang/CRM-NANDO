// Unduh presentasi PowerPoint dari tab Report (16 Okt 2026). Datanya sama dengan ringkasan yang dicetak ke PDF,
// jadi angka di slide dan di layar selalu sama. Pustakanya dimuat saat tombol diklik, tidak ikut di bundel awal.
//
// Desain: latar gelap di judul, putih di isi. Aksen amber (warna Nexto), hijau untuk omzet.
// Judul memakai Georgia, isi memakai Calibri supaya ada kontras antara dua huruf.
const INK = "0F172A";
const INK_SOFT = "1E293B";
const AMBER = "F59E0B";
const EMERALD = "059669";
const MUTED = "64748B";
const SUBTLE = "94A3B8";
const PAPER = "F8FAFC";
const TRACK = "E2E8F0";
const LINE = "E2E8F0";
const HEAD = "Georgia";
const BODY = "Calibri";

// Logo per organisasi (17 Okt 2026). File ada di public/logos.
const ORG_LOGOS = {
  "43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0": "/logos/bsb.png", // PT. Bangun Selaras Bersama
  "b6c256bb-681d-4833-af10-ebb665c6d2d0": "/logos/map.png", // MAP
};

// Logo diubah jadi data URL supaya bisa ditanam langsung di file .pptx. Gagal memuat = tanpa logo.
async function loadLogo(url) {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return null;
  }
}

export async function downloadReportPpt({ orgId = null, orgName = "", who = "", periodLabel = "", fmtRp, pct, filtered = false, target = 0, summary, deals = [], team = [], showTeam = false, extra = {} }) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inci
  pptx.title = `Report ${who} ${periodLabel}`;
  pptx.company = "Nexto";
  const logo = ORG_LOGOS[orgId] ? await loadLogo(ORG_LOGOS[orgId]) : null;
  const nextoLogo = await loadLogo("/nexto-logo.png");

  const W = 13.333;
  const footer = (s, n) => {
    // Pita gelap di bawah: logo Nexto (putih dan oranye) terlihat jelas di sini.
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 6.82, w: W, h: 0.68, fill: { color: INK }, line: { color: INK, width: 0 } });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 6.82, w: W, h: 0.03, fill: { color: AMBER }, line: { color: AMBER, width: 0 } });
    s.addText(`${orgName || "Nexto"} · ${periodLabel}${filtered ? " · terfilter" : ""}`, { x: 0.6, y: 6.95, w: 7.5, h: 0.35, fontFace: BODY, fontSize: 10, color: SUBTLE });
    if (nextoLogo) s.addImage({ data: nextoLogo, x: W - 2.75, y: 7.04, w: 1.25, h: 0.24, sizing: { type: "contain", w: 1.25, h: 0.24 } });
    s.addText(String(n), { x: W - 1.2, y: 6.95, w: 0.6, h: 0.35, fontFace: BODY, fontSize: 10, color: "FFFFFF", align: "right" });
  };
  const heading = (s, title, sub) => {
    s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.55, w: 0.5, h: 0.08, fill: { color: AMBER }, line: { color: AMBER, width: 0 } });
    if (logo) s.addImage({ data: logo, x: W - 2.7, y: 0.35, w: 2.1, h: 0.9, sizing: { type: "contain", w: 2.1, h: 0.9 } });
    s.addText(title, { x: 0.6, y: 0.75, w: logo ? 9.9 : 12, h: 0.7, fontFace: HEAD, fontSize: 30, bold: true, color: INK });
    if (sub) s.addText(sub, { x: 0.6, y: 1.42, w: 12, h: 0.4, fontFace: BODY, fontSize: 14, color: MUTED });
  };
  let page = 1;

  // Slide 1: judul (latar gelap)
  const s1 = pptx.addSlide();
  s1.background = { color: INK };
  if (logo) {
    // Latar gelap: logo ditaruh di kartu putih supaya warnanya tetap terlihat.
    s1.addShape(pptx.ShapeType.rect, { x: 0.8, y: 0.7, w: 3.6, h: 1.4, fill: { color: "FFFFFF" }, line: { color: "FFFFFF", width: 0 } });
    s1.addImage({ data: logo, x: 0.95, y: 0.8, w: 3.3, h: 1.2, sizing: { type: "contain", w: 3.3, h: 1.2 } });
  }
  s1.addShape(pptx.ShapeType.rect, { x: 0.8, y: 2.3, w: 0.9, h: 0.1, fill: { color: AMBER }, line: { color: AMBER, width: 0 } });
  s1.addText("Report penjualan", { x: 0.8, y: 2.6, w: 11.5, h: 0.6, fontFace: BODY, fontSize: 18, color: SUBTLE });
  s1.addText(who, { x: 0.8, y: 3.2, w: 11.5, h: 1.4, fontFace: HEAD, fontSize: 52, bold: true, color: "FFFFFF", fit: "shrink" });
  s1.addText(`${orgName}${orgName ? "  ·  " : ""}${periodLabel}${filtered ? "  ·  terfilter" : ""}`, { x: 0.8, y: 4.7, w: 11.5, h: 0.5, fontFace: BODY, fontSize: 18, color: AMBER });
  s1.addText(`Dibuat ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, { x: 0.8, y: 6.6, w: 9, h: 0.4, fontFace: BODY, fontSize: 11, color: SUBTLE });
  page++;

  // Slide 2: ringkasan. Omzet sebagai kartu utama, empat angka lain di sampingnya.
  const s2 = pptx.addSlide();
  heading(s2, "Ringkasan bulan ini", "Omzet, pipeline, dan deal dibandingkan dengan target.");
  s2.addShape(pptx.ShapeType.rect, { x: 0.6, y: 2.05, w: 5.6, h: 4.45, fill: { color: INK }, line: { color: INK, width: 0 } });
  s2.addText("OMZET", { x: 0.95, y: 2.35, w: 5, h: 0.35, fontFace: BODY, fontSize: 12, bold: true, color: SUBTLE, charSpacing: 2 });
  s2.addText(fmtRp(summary.dealValue), { x: 0.95, y: 2.75, w: 5.1, h: 1.0, fontFace: HEAD, fontSize: 40, bold: true, color: "FFFFFF", fit: "shrink" });
  s2.addText(`${summary.dealCount} deal`, { x: 0.95, y: 3.75, w: 5, h: 0.4, fontFace: BODY, fontSize: 14, color: AMBER });
  if (target > 0) {
    const ratio = Math.min(summary.dealValue / target, 1);
    s2.addText(`${pct(summary.dealValue, target)} dari target ${fmtRp(target)}`, { x: 0.95, y: 4.5, w: 5, h: 0.4, fontFace: BODY, fontSize: 13, color: "FFFFFF" });
    s2.addShape(pptx.ShapeType.rect, { x: 0.95, y: 5.05, w: 5.0, h: 0.22, fill: { color: INK_SOFT }, line: { color: INK_SOFT, width: 0 } });
    s2.addShape(pptx.ShapeType.rect, { x: 0.95, y: 5.05, w: Math.max(0.05, 5.0 * ratio), h: 0.22, fill: { color: EMERALD }, line: { color: EMERALD, width: 0 } });
  }
  const cards = [
    { label: "Data masuk", value: String(summary.masuk), sub: "lead baru bulan ini" },
    { label: "SPH belum diproses", value: String(summary.sphCount), sub: fmtRp(summary.sphValue) },
    { label: "Hot progress", value: String(summary.hotCount), sub: fmtRp(summary.hotValue) },
    { label: "Deal", value: String(summary.dealCount), sub: fmtRp(summary.dealValue) },
  ];
  cards.forEach((c, i) => {
    const x = 6.6 + (i % 2) * 3.1;
    const y = 2.05 + Math.floor(i / 2) * 2.3;
    s2.addShape(pptx.ShapeType.rect, { x, y, w: 2.95, h: 2.1, fill: { color: PAPER }, line: { color: LINE, width: 0.75 } });
    s2.addShape(pptx.ShapeType.rect, { x, y, w: 0.07, h: 2.1, fill: { color: AMBER }, line: { color: AMBER, width: 0 } });
    s2.addText(c.label, { x: x + 0.3, y: y + 0.25, w: 2.5, h: 0.35, fontFace: BODY, fontSize: 12, color: MUTED });
    s2.addText(c.value, { x: x + 0.3, y: y + 0.65, w: 2.5, h: 0.8, fontFace: HEAD, fontSize: 36, bold: true, color: INK, fit: "shrink" });
    s2.addText(c.sub, { x: x + 0.3, y: y + 1.5, w: 2.5, h: 0.4, fontFace: BODY, fontSize: 11, color: MUTED, fit: "shrink" });
  });
  page++;
  footer(s2, page);

  // Slide 3: pipeline. Grafik batang dan persentase perpindahan antar tahap.
  const s3 = pptx.addSlide();
  heading(s3, "Pipeline", "Dari data masuk sampai deal bulan ini.");
  s3.addChart(pptx.ChartType.bar, [{ name: "Jumlah", labels: ["Data masuk", "SPH belum diproses", "Hot progress", "Deal"], values: [summary.masuk, summary.sphCount, summary.hotCount, summary.dealCount] }], {
    x: 0.6, y: 2.0, w: 8.2, h: 4.6, barDir: "col", chartColors: [INK], barGapWidthPct: 60,
    showValue: true, dataLabelFontSize: 14, dataLabelColor: INK, dataLabelFontFace: BODY,
    catAxisLabelFontFace: BODY, catAxisLabelFontSize: 12, catAxisLabelColor: MUTED,
    valAxisHidden: true, valGridLine: { style: "none" }, catAxisLineShow: false, showLegend: false,
  });
  const rate = (a, b) => (a > 0 ? `${Math.round((b / a) * 100)}%` : "-");
  const conv = [
    { label: "Data masuk → Deal", value: rate(summary.masuk, summary.dealCount) },
    { label: "SPH → Deal", value: rate(summary.sphCount + summary.hotCount + summary.dealCount, summary.dealCount) },
  ];
  conv.forEach((c, i) => {
    const y = 2.2 + i * 1.9;
    s3.addShape(pptx.ShapeType.rect, { x: 9.3, y, w: 3.4, h: 1.6, fill: { color: INK }, line: { color: INK, width: 0 } });
    s3.addText(c.label, { x: 9.6, y: y + 0.25, w: 3.0, h: 0.35, fontFace: BODY, fontSize: 12, color: SUBTLE });
    s3.addText(c.value, { x: 9.6, y: y + 0.6, w: 3.0, h: 0.8, fontFace: HEAD, fontSize: 34, bold: true, color: AMBER, fit: "shrink" });
  });
  page++;
  footer(s3, page);

  // Slide 4: deal bulan ini
  const s4 = pptx.addSlide();
  heading(s4, "Deal bulan ini", deals.length ? `${deals.length} deal dengan total ${fmtRp(summary.dealValue)}` : "Belum ada deal pada bulan ini.");
  if (deals.length) {
    const shown = deals.slice(0, 12);
    const hdr = (t, right) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: INK }, align: right ? "right" : "left", fontFace: BODY, fontSize: 12 } });
    const head = [[hdr("Tanggal"), hdr("Nama"), hdr("Nilai", true)]];
    const body = shown.map((d, i) => {
      const fill = { color: i % 2 ? "FFFFFF" : PAPER };
      return [
        { text: String(d.date).slice(0, 10), options: { color: MUTED, fill, fontFace: BODY, fontSize: 12 } },
        { text: d.name, options: { color: INK, bold: true, fill, fontFace: BODY, fontSize: 12 } },
        { text: fmtRp(d.value), options: { color: EMERALD, bold: true, fill, align: "right", fontFace: BODY, fontSize: 12 } },
      ];
    });
    s4.addTable([...head, ...body], { x: 0.6, y: 2.05, w: 12.1, colW: [2.2, 7.1, 2.8], border: { type: "solid", pt: 0.5, color: LINE }, rowH: 0.34 });
    if (deals.length > shown.length) s4.addText(`+${deals.length - shown.length} deal lain`, { x: 0.6, y: 6.45, w: 12, h: 0.35, fontFace: BODY, fontSize: 11, color: MUTED });
  }
  page++;
  footer(s4, page);

  // Slide tambahan (17 Okt 2026): lead yang sedang berjalan.
  const running = extra.running || [];
  if (running.length) {
    const s6 = pptx.addSlide();
    heading(s6, "Sedang berjalan", `${running.length} lead dengan total ${fmtRp(extra.runningValue || 0)}`);
    const shown = running.slice(0, 12);
    const hdr = (t, right) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: INK }, align: right ? "right" : "left", fontFace: BODY, fontSize: 12 } });
    const head = [[hdr("Lead"), hdr("Tahap"), hdr("Nilai", true)]];
    const body = shown.map((l, i) => {
      const fill = { color: i % 2 ? "FFFFFF" : PAPER };
      return [
        { text: l.name, options: { color: INK, bold: true, fill, fontFace: BODY, fontSize: 12 } },
        { text: l.stage, options: { color: MUTED, fill, fontFace: BODY, fontSize: 12 } },
        { text: fmtRp(l.value), options: { color: EMERALD, bold: true, fill, align: "right", fontFace: BODY, fontSize: 12 } },
      ];
    });
    s6.addTable([...head, ...body], { x: 0.6, y: 2.05, w: 12.1, colW: [6.1, 3.0, 3.0], border: { type: "solid", pt: 0.5, color: LINE }, rowH: 0.34 });
    if (running.length > shown.length) s6.addText(`+${running.length - shown.length} lead lain`, { x: 0.6, y: 6.45, w: 12, h: 0.35, fontFace: BODY, fontSize: 11, color: MUTED });
    page++;
    footer(s6, page);
  }

  // Slide tambahan: perbandingan dengan bulan lalu dan lead kalah.
  if (extra.prevDeal !== undefined || extra.lostCount !== undefined) {
    const s7 = pptx.addSlide();
    heading(s7, "Perbandingan dan lead kalah", "Omzet dibanding bulan sebelumnya, serta lead yang kalah periode ini.");
    const prev = Number(extra.prevDeal) || 0;
    const delta = prev > 0 ? `${summary.dealValue >= prev ? "+" : ""}${Math.round(((summary.dealValue - prev) / prev) * 100)}%` : "-";
    const cards2 = [
      { label: "Omzet bulan ini", value: fmtRp(summary.dealValue), sub: `${summary.dealCount} deal` },
      { label: "Omzet bulan lalu", value: fmtRp(prev), sub: delta === "-" ? "belum ada pembanding" : `selisih ${delta}` },
      { label: "Lead kalah", value: String(extra.lostCount || 0), sub: fmtRp(extra.lostValue || 0) },
    ];
    cards2.forEach((c, i) => {
      const x = 0.6 + i * 4.1;
      s7.addShape(pptx.ShapeType.rect, { x, y: 2.1, w: 3.85, h: 2.4, fill: { color: i === 0 ? INK : PAPER }, line: { color: i === 0 ? INK : LINE, width: 0.75 } });
      s7.addShape(pptx.ShapeType.rect, { x, y: 2.1, w: 0.07, h: 2.4, fill: { color: AMBER }, line: { color: AMBER, width: 0 } });
      s7.addText(c.label, { x: x + 0.3, y: 2.35, w: 3.3, h: 0.35, fontFace: BODY, fontSize: 12, color: i === 0 ? SUBTLE : MUTED });
      s7.addText(c.value, { x: x + 0.3, y: 2.8, w: 3.3, h: 0.9, fontFace: HEAD, fontSize: 28, bold: true, color: i === 0 ? "FFFFFF" : INK, fit: "shrink" });
      s7.addText(c.sub, { x: x + 0.3, y: 3.9, w: 3.3, h: 0.45, fontFace: BODY, fontSize: 12, color: i === 0 ? AMBER : MUTED, fit: "shrink" });
    });
    page++;
    footer(s7, page);
  }

  // Slide 5: hasil per marketing, bar kontribusi omzet dan capaian target
  if (showTeam && team.length) {
    const s5 = pptx.addSlide();
    heading(s5, "Hasil per marketing", "Batang menunjukkan kontribusi omzet. Angka kanan menunjukkan capaian target.");
    const max = Math.max(...team.map((m) => m.omzet), 1);
    const total = team.reduce((t, m) => t + m.omzet, 0);
    team.slice(0, 8).forEach((m, i) => {
      const y = 2.1 + i * 0.55;
      s5.addText(m.name, { x: 0.6, y, w: 2.6, h: 0.4, fontFace: BODY, fontSize: 14, bold: true, color: INK, valign: "middle" });
      s5.addShape(pptx.ShapeType.rect, { x: 3.3, y: y + 0.1, w: 5.4, h: 0.22, fill: { color: TRACK }, line: { color: TRACK, width: 0 } });
      if (m.omzet > 0) s5.addShape(pptx.ShapeType.rect, { x: 3.3, y: y + 0.1, w: Math.max(0.05, 5.4 * (m.omzet / max)), h: 0.22, fill: { color: i === 0 ? AMBER : INK }, line: { color: i === 0 ? AMBER : INK, width: 0 } });
      s5.addText(fmtRp(m.omzet), { x: 8.9, y, w: 2.0, h: 0.4, fontFace: BODY, fontSize: 13, bold: true, color: EMERALD, align: "right", valign: "middle" });
      s5.addText(m.target > 0 ? pct(m.omzet, m.target) : "-", { x: 11.0, y, w: 1.7, h: 0.4, fontFace: BODY, fontSize: 13, color: MUTED, align: "right", valign: "middle" });
    });
    s5.addText(`Total omzet tim: ${fmtRp(total)}`, { x: 0.6, y: 6.3, w: 12, h: 0.35, fontFace: BODY, fontSize: 12, color: MUTED });
    page++;
    footer(s5, page);
  }

  await pptx.writeFile({ fileName: `Report-${(orgName || "sales").replace(/[^A-Za-z0-9]+/g, "-")}-${periodLabel.replace(/[^A-Za-z0-9]+/g, "-")}.pptx` });
}
