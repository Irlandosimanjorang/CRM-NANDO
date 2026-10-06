// Pembuat PDF invoice langganan Nexto (7 Okt 2026). File ini IDENTIK di
// supabase/functions/invoice-pdf, admin-invoices, dan invoice-reminders -
// kalau diubah, salin ke ketiganya. Dibuat di server dengan pdf-lib supaya
// invoice bisa diunduh langsung (tautan) dan dilampirkan di email tanpa
// bergantung pada dialog cetak browser, yang sering tidak berfungsi di HP dan
// browser dalam aplikasi. Isi dan susunannya mengikuti buildInvoiceHtml di
// src/components/EnterpriseInvoicePanel.jsx.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const INK = rgb(0.11, 0.133, 0.188);
const GRAY = rgb(0.357, 0.392, 0.459);
const LIGHT = rgb(0.851, 0.867, 0.894);
const SOFT = rgb(0.961, 0.965, 0.973);
const ACCENT = rgb(0.76, 0.255, 0.047);
const GREEN = rgb(0.082, 0.502, 0.239);
const W = 595.28, H = 841.89, M = 46;
const CW = W - M * 2;

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const rp = (n) => "Rp" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "-";
};
const wibDay = (ts) => new Date(new Date(ts).getTime() + 7 * 3600000).toISOString().slice(0, 10);
// Huruf di luar WinAnsi tidak bisa digambar dengan font standar PDF.
const clean = (s) => String(s ?? "")
  .replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/·/g, "|")
  .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "?");

// Terbilang rupiah (sama dengan src/lib/docKit.js).
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
function terbilangInt(n) {
  n = Math.floor(n);
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${terbilangInt(n - 10)} belas`;
  if (n < 100) return `${terbilangInt(Math.floor(n / 10))} puluh ${terbilangInt(n % 10)}`.trim();
  if (n < 200) return `seratus ${terbilangInt(n - 100)}`.trim();
  if (n < 1000) return `${terbilangInt(Math.floor(n / 100))} ratus ${terbilangInt(n % 100)}`.trim();
  if (n < 2000) return `seribu ${terbilangInt(n - 1000)}`.trim();
  if (n < 1e6) return `${terbilangInt(Math.floor(n / 1000))} ribu ${terbilangInt(n % 1000)}`.trim();
  if (n < 1e9) return `${terbilangInt(Math.floor(n / 1e6))} juta ${terbilangInt(n % 1e6)}`.trim();
  if (n < 1e12) return `${terbilangInt(Math.floor(n / 1e9))} miliar ${terbilangInt(n % 1e9)}`.trim();
  return `${terbilangInt(Math.floor(n / 1e12))} triliun ${terbilangInt(n % 1e12)}`.trim();
}
function terbilang(n) {
  const v = Math.round(Number(n) || 0);
  if (v === 0) return "Nol rupiah";
  const t = terbilangInt(v).replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1) + " rupiah";
}

function computeTotals(d) {
  const subtotal = (Number(d.seats) || 0) * (Number(d.pricePerSeat) || 0) * (Number(d.months) || 0);
  const raw = d.discountType === "percent" ? subtotal * (Number(d.discountValue) || 0) / 100 : Number(d.discountValue) || 0;
  const discount = Math.min(Math.max(0, Math.round(raw)), subtotal);
  return { subtotal, discount, total: subtotal - discount };
}

const PLAN_NAME = { enterprise: "Enterprise", professional: "Professional", standard: "Standard" };
function subscriptionDetail(d) {
  const key = d.plan === "custom" ? d.activatePlan : d.plan;
  const team = key === "enterprise";
  const seats = Number(d.seats) || 1, months = Number(d.months) || 1;
  return {
    plan: PLAN_NAME[key] ? `Nexto ${PLAN_NAME[key]}` : (d.item || "Layanan Nexto"),
    people: team ? `${seats} anggota tim` : `${seats} pengguna`,
    peopleNote: team ? "Termasuk akun owner; anggota bergabung lewat kode undangan" : seats > 1 ? "Setiap pengguna memakai akun masing-masing" : "Satu akun pengguna",
    duration: `${months} bulan`,
    period: d.start && d.end ? `${fmtDate(d.start)} sampai ${fmtDate(d.end)}` : "",
    price: `${rp(d.pricePerSeat)} per ${team ? "anggota" : "pengguna"}/bulan`,
    account: d.email || "",
  };
}

function dataUrlBytes(u) {
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(String(u || ""));
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { kind: m[1] === "png" ? "png" : "jpg", bytes };
}

/** inv = baris admin_invoices: { number, company, invoice_date, due_date, total, status, paid_at, data } */
export async function buildInvoicePdf(inv) {
  const d = inv.data || {};
  const seller = d.seller || {};
  const { subtotal, discount, total } = computeTotals(d);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${inv.number} ${inv.company}`);
  pdf.setProducer("Nexto");
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const wrap = (text, font, size, maxW) => {
    const out = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) <= maxW) { line = test; continue; }
        if (line) out.push(line);
        // kata tunggal yang lebih lebar dari kolom dipotong per huruf
        if (font.widthOfTextAtSize(word, size) > maxW) {
          let chunk = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxW) { out.push(chunk); chunk = ch; } else chunk += ch;
          }
          line = chunk;
        } else line = word;
      }
      out.push(line);
    }
    return out;
  };
  const text = (s, x, yy, { font = reg, size = 9.5, color = INK, align = "left", maxW } = {}) => {
    const str = clean(s);
    const w = font.widthOfTextAtSize(str, size);
    const px = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    page.drawText(str, { x: px, y: yy, font, size, color, maxWidth: maxW });
  };
  const para = (s, x, yy, maxW, opts = {}) => {
    const size = opts.size || 9.5, lh = opts.lh || size * 1.4;
    const lines = wrap(s, opts.font || reg, size, maxW);
    lines.forEach((ln, i) => text(ln, x, yy - i * lh, { ...opts, size }));
    return lines.length * lh;
  };
  const rule = (yy, x1 = M, x2 = W - M, thickness = 0.6, color = LIGHT) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness, color });
  const ensure = (need) => { if (y - need < M + 24) { page = pdf.addPage([W, H]); y = H - M; } };

  // ---- Kepala: logo + penerbit, judul + nomor + status ----
  // Logo kata NEXTO digambar vektor (logo PNG 400 KB terlalu berat untuk lampiran email).
  page.drawRectangle({ x: M, y: y - 26, width: 104, height: 26, color: INK });
  {
    const parts = [["NE", rgb(1, 1, 1)], ["X", rgb(0.976, 0.451, 0.086)], ["TO", rgb(1, 1, 1)]];
    const size = 13, gap = 1.6;
    const total = parts.reduce((t, [p]) => t + bold.widthOfTextAtSize(p, size) + gap * p.length, 0) - gap;
    let lx = M + (104 - total) / 2;
    for (const [p, col] of parts) {
      for (const ch of p) { page.drawText(ch, { x: lx, y: y - 18, font: bold, size, color: col }); lx += bold.widthOfTextAtSize(ch, size) + gap; }
    }
  }
  let leftY = y - 42;
  text(seller.name || "Nexto", M, leftY, { font: bold, size: 10.5 });
  leftY -= 13;
  for (const l of [seller.address, seller.email, seller.phone, "nexto.site"].filter(Boolean)) {
    leftY -= para(l, M, leftY, 250, { size: 9, color: GRAY });
  }
  text("Invoice", W - M, y - 22, { font: bold, size: 26, align: "right" });
  text(inv.number || "", W - M, y - 40, { size: 10, color: GRAY, align: "right" });
  if (inv.status === "paid") text(`Lunas${inv.paid_at ? `, ${fmtDate(wibDay(inv.paid_at))}` : ""}`, W - M, y - 55, { font: bold, size: 10, color: GREEN, align: "right" });
  else if (inv.status === "void") text("Dibatalkan", W - M, y - 55, { font: bold, size: 10, color: GRAY, align: "right" });
  else text("Belum dibayar", W - M, y - 55, { font: bold, size: 10, color: ACCENT, align: "right" });
  y = Math.min(leftY, y - 62) - 10;

  // ---- Fakta: ditagihkan kepada | tanggal | periode ----
  rule(y); y -= 16;
  const c1 = M, c2 = M + CW * 0.43, c3 = M + CW * 0.72;
  const top = y;
  text("Ditagihkan kepada", c1, y, { size: 8.5, color: GRAY, font: bold });
  let yy = y - 13;
  text(d.company || inv.company || "", c1, yy, { font: bold, size: 10 }); yy -= 12;
  if (d.contact) { yy -= para(d.contact, c1, yy, CW * 0.38, { size: 9, color: GRAY }); }
  if (d.address) { yy -= para(d.address, c1, yy, CW * 0.38, { size: 9, color: GRAY }); }
  if (d.email) { yy -= para(d.email, c1, yy, CW * 0.38, { size: 9, color: GRAY }); }
  text("Tanggal invoice", c2, top, { size: 8.5, color: GRAY, font: bold });
  text(fmtDate(d.date || inv.invoice_date), c2, top - 13, { font: bold, size: 10 });
  text("Jatuh tempo", c2, top - 30, { size: 8.5, color: GRAY, font: bold });
  text(fmtDate(d.due || inv.due_date), c2, top - 43, { font: bold, size: 10 });
  let y2 = top - 43;
  if (d.po) { text("Nomor PO", c2, top - 60, { size: 8.5, color: GRAY, font: bold }); text(d.po, c2, top - 73, { font: bold, size: 10 }); y2 = top - 73; }
  text("Periode langganan", c3, top, { size: 8.5, color: GRAY, font: bold });
  text(fmtDate(d.start), c3, top - 13, { font: bold, size: 10 });
  text(`sampai ${fmtDate(d.end)}`, c3, top - 25, { size: 9, color: GRAY });
  y = Math.min(yy, y2, top - 40) - 12;
  rule(y); y -= 22;

  // ---- Tabel item ----
  const colQ = M + CW * 0.60, colP = M + CW * 0.80, colS = W - M;
  text("Deskripsi", M, y, { size: 8.5, color: GRAY, font: bold });
  text("Jumlah", colQ, y, { size: 8.5, color: GRAY, font: bold, align: "right" });
  text("Harga satuan", colP, y, { size: 8.5, color: GRAY, font: bold, align: "right" });
  text("Subtotal", colS, y, { size: 8.5, color: GRAY, font: bold, align: "right" });
  y -= 6; rule(y, M, W - M, 0.9, INK); y -= 18;
  const rowTop = y;
  const hItem = para(d.item || "Langganan Nexto", M, y, CW * 0.5, { font: bold, size: 10 });
  para(`${d.seats} ${d.unit || "pengguna"}, ${d.months} bulan`, M, y - hItem, CW * 0.5, { size: 9, color: GRAY });
  text(String(Number(d.seats) || 0), colQ, rowTop, { size: 10, align: "right" });
  text(d.unit || "pengguna", colQ, rowTop - 12, { size: 8, color: GRAY, align: "right" });
  text(rp((Number(d.pricePerSeat) || 0) * (Number(d.months) || 0)), colP, rowTop, { size: 10, align: "right" });
  text(`per ${d.unit || "pengguna"}, ${Number(d.months) || 0} bulan`, colP, rowTop - 12, { size: 8, color: GRAY, align: "right" });
  text(rp(subtotal), colS, rowTop, { size: 10, align: "right" });
  y = rowTop - hItem - 22;
  rule(y); y -= 18;

  // ---- Ringkasan ----
  const sx1 = W - M - 220, sx2 = W - M;
  const sumRow = (label, value, o = {}) => { text(label, sx1, y, { size: 9.5, color: o.color || GRAY, font: o.font || reg }); text(value, sx2, y, { size: 9.5, color: o.color || GRAY, font: o.font || reg, align: "right" }); y -= 15; };
  sumRow("Subtotal", rp(subtotal));
  if (discount > 0) sumRow(`${d.discountLabel?.trim() || "Diskon"}${d.discountType === "percent" ? ` (${Number(d.discountValue)}%)` : ""}`, `-${rp(discount)}`);
  y -= 2; rule(y + 8, sx1, sx2, 1.4, INK);
  text("Total tagihan", sx1, y - 4, { size: 12, font: bold });
  text(rp(total), sx2, y - 4, { size: 12, font: bold, color: ACCENT, align: "right" });
  y -= 22;
  const tb = wrap(`Terbilang: ${terbilang(total)}`, ital, 9, 330);
  tb.forEach((ln, i) => text(ln, W - M, y - i * 12, { font: ital, size: 9, color: GRAY, align: "right" }));
  y -= tb.length * 12 + 14;

  // ---- Detail langganan ----
  const s = subscriptionDetail(d);
  ensure(110);
  const boxTop = y;
  const fr = [0.22, 0.25, 0.24, 0.29];
  const colWs = fr.map((f) => (CW - 24 - 24) * f);
  const colXs = colWs.map((_, i) => M + 12 + colWs.slice(0, i).reduce((a, b) => a + b + 8, 0));
  const cells = [
    ["Paket", s.plan, s.price],
    ["Jumlah anggota", s.people, s.peopleNote],
    ["Durasi", s.duration, s.period],
    ["Akun Nexto", s.account || "-", "Aktif setelah pembayaran diterima"],
  ];
  // ukur tinggi tertinggi dulu supaya kotak pas
  let maxH = 0;
  const measured = cells.map(([k, v, note], i) => {
    const vl = wrap(v, bold, 9, colWs[i]), nl = wrap(note || "", reg, 8, colWs[i]);
    maxH = Math.max(maxH, 12 + vl.length * 12 + nl.length * 10);
    return { k, vl, nl };
  });
  const boxH = 24 + maxH + 8;
  page.drawRectangle({ x: M, y: boxTop - boxH, width: CW, height: boxH, color: SOFT });
  text("Detail langganan", M + 12, boxTop - 16, { font: bold, size: 10 });
  measured.forEach((c, i) => {
    const x = colXs[i];
    let cy = boxTop - 34;
    text(c.k, x, cy, { size: 8, color: GRAY, font: bold }); cy -= 12;
    c.vl.forEach((ln) => { text(ln, x, cy, { font: bold, size: 9 }); cy -= 12; });
    c.nl.forEach((ln) => { text(ln, x, cy, { size: 8, color: GRAY }); cy -= 10; });
  });
  y = boxTop - boxH - 24;

  // ---- Pembayaran + catatan (kiri) | tanda tangan (kanan) ----
  ensure(150);
  const payTop = y;
  const leftW = CW * 0.56;
  let py = y;
  text("Cara pembayaran", M, py, { font: bold, size: 10.5 }); py -= 16;
  const kv = (k, v, strong = false) => {
    text(k, M, py, { size: 9, color: GRAY });
    py -= Math.max(para(v, M + 82, py, leftW - 84, { size: 9, font: strong ? bold : reg }), 12);
  };
  if (d.payLink) kv("Pembayaran online", d.payLink);
  if (seller.account) {
    if (seller.bank) kv("Bank", seller.bank);
    kv("No. rekening", seller.account, true);
    if (seller.holder) kv("Atas nama", seller.holder);
  }
  py -= 2;
  py -= para(inv.number ? `Cantumkan nomor ${inv.number} pada berita pembayaran.` : "Nomor invoice dibuat saat invoice disimpan.", M, py, leftW, { size: 9, color: GRAY });
  if (d.note) {
    py -= 8;
    text("Catatan", M, py, { font: bold, size: 10.5 }); py -= 14;
    py -= para(d.note, M, py, leftW, { size: 9 });
  }
  // tanda tangan
  const sgx = W - M - 100;
  text("Hormat kami,", sgx, payTop, { size: 9.5, align: "center" });
  const spaceTop = payTop - 8, spaceH = 72;
  const stamp = dataUrlBytes(seller.stampImage), sign = dataUrlBytes(seller.signImage);
  try {
    if (stamp) {
      const im = stamp.kind === "png" ? await pdf.embedPng(stamp.bytes) : await pdf.embedJpg(stamp.bytes);
      const hh = Math.min(76, im.height), ww = Math.min(80, (im.width / im.height) * hh);
      page.drawImage(im, { x: sgx - 98, y: spaceTop - spaceH + 2, width: ww, height: (im.height / im.width) * ww, opacity: 0.9 });
    }
    if (sign) {
      const im = sign.kind === "png" ? await pdf.embedPng(sign.bytes) : await pdf.embedJpg(sign.bytes);
      const maxw = 140, maxh = 58;
      const sc = Math.min(maxw / im.width, maxh / im.height, 1);
      page.drawImage(im, { x: sgx - (im.width * sc) / 2, y: spaceTop - spaceH + 4, width: im.width * sc, height: im.height * sc });
    }
  } catch (_) { /* tanpa gambar bila format tidak terbaca */ }
  const lineY = spaceTop - spaceH - 2;
  rule(lineY, sgx - 100, sgx + 100, 0.8, INK);
  text(seller.signName || seller.name || "Nexto", sgx, lineY - 12, { font: bold, size: 9.5, align: "center" });
  let sgY = lineY - 12;
  if (seller.signTitle) { sgY -= 11; text(seller.signTitle, sgx, sgY, { size: 9, color: GRAY, align: "center" }); }
  y = Math.min(py, sgY) - 24;

  // ---- Kaki ----
  const footY = Math.max(y, M + 4);
  rule(footY + 10);
  text("Terima kasih telah menggunakan Nexto.", M, footY - 4, { size: 8.5, color: GRAY });
  text(inv.number || "", W - M, footY - 4, { size: 8.5, color: GRAY, align: "right" });

  return await pdf.save();
}

export const pdfFileName = (number) => `Invoice-${String(number || "Nexto").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;

export function toBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}
