import { jsPDF } from "jspdf";
import { terbilang } from "./docKit";

// PDF invoice freelance dibuat langsung dengan jsPDF (bukan dialog cetak browser),
// jadi tidak ada header/footer browser (URL, tanggal, judul halaman) di hasilnya.
// Ukuran dan posisi kolom mengikuti versi HTML awal (lihat buildFreelanceHtml).

const rp = (n) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-");

function totalsOf(d) {
  const subtotal = d.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const tax = Math.round((subtotal * (Number(d.taxPct) || 0)) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

// Tanda tangan bisa berupa data URL (unggahan) atau URL aset; diubah jadi data URL agar bisa ditanam.
async function toDataUrl(src) {
  if (!src) return null;
  if (src.startsWith("data:image/")) return src;
  try {
    const blob = await (await fetch(src)).blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Warna dan posisi (mm) disejajarkan dengan versi HTML: label abu-abu, isi gelap.
const WARNA_LABEL = 136;
const WARNA_ISI = 68;
const WARNA_TEBAL = 26;
const WARNA_GARIS_TIPIS = 229;

const KIRI = 20;
const TENGAH = 110;
const KANAN = 190;
const SIG_X = 127;
const SIG_W = 63;
const BATAS_BAWAH = 265;

// Kolom tabel: deskripsi mengambil sisa ruang, lalu Qty, Harga, Jumlah rata kanan.
const COL_DESK = 30;
const DESK_W = 76;
const QTY_R = 125;
const HARGA_R = 158;
const JUMLAH_R = KANAN;

export async function buildFreelancePdf(d, p) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { subtotal, tax, total } = totalsOf(d);
  const sign = await toDataUrl(p.signImage);
  let y = 24;

  const teks = (text, x, yy, opts) => doc.text(String(text ?? ""), x, yy, opts);
  const label = (text, x, yy) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(WARNA_LABEL);
    teks(text, x, yy);
  };
  const isi = (size, bold = false, warna = WARNA_ISI) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(warna);
  };
  // Blok label + nama + baris alamat; mengembalikan posisi y terakhir.
  const blok = (x, lebar, judul, nama, baris, yAwal) => {
    let yy = yAwal;
    label(judul, x, yy);
    yy += 5;
    if (nama) {
      isi(11, true, WARNA_TEBAL);
      teks(nama, x, yy);
      yy += 5;
    }
    isi(9);
    for (const b of baris.length ? baris : ["-"]) {
      for (const l of doc.splitTextToSize(String(b), lebar)) {
        teks(l, x, yy);
        yy += 4.5;
      }
    }
    return yy;
  };
  const headerTabel = (yy) => {
    isi(8.5, true, 85);
    teks("No", KIRI, yy);
    teks("Deskripsi", COL_DESK, yy);
    teks("Qty", QTY_R, yy, { align: "right" });
    teks("Harga", HARGA_R, yy, { align: "right" });
    teks("Jumlah", JUMLAH_R, yy, { align: "right" });
    doc.setDrawColor(WARNA_TEBAL);
    doc.line(KIRI, yy + 2, KANAN, yy + 2);
    return yy + 7;
  };

  // Judul dan tanggal
  isi(22, true, WARNA_TEBAL);
  teks("Invoice", KIRI, y);
  isi(10, false, 90);
  teks(d.number, KIRI, y + 7);
  isi(9, false, WARNA_ISI);
  teks(`Tanggal: ${fmtDate(d.date)}`, KANAN, y, { align: "right" });
  teks(`Jatuh tempo: ${fmtDate(d.dueDate)}`, KANAN, y + 5, { align: "right" });
  y += 22;

  // Pengirim dan klien
  const dari = [p.address, p.email, p.phone].filter(Boolean);
  const kepada = String(d.clientAddress || "").split("\n").filter((l) => l.trim());
  const yDari = blok(KIRI, 80, "Dari", p.name || "-", dari, y);
  const yKepada = blok(TENGAH, 80, "Kepada", d.client || "-", kepada, y);
  y = Math.max(yDari, yKepada) + 8;

  if (d.project) {
    label("Proyek", KIRI, y);
    y += 5;
    isi(9);
    teks(d.project, KIRI, y);
    y += 10;
  }

  // Tabel item
  y = headerTabel(y);
  const baris = d.items.filter((it) => String(it.desc || "").trim());
  if (baris.length === 0) {
    isi(9, false, WARNA_LABEL);
    teks("Belum ada item", KIRI, y + 4);
    y += 10;
  }
  baris.forEach((it, i) => {
    const desk = doc.splitTextToSize(String(it.desc), DESK_W);
    const tinggi = desk.length * 4.5 + 4;
    if (y + tinggi > BATAS_BAWAH) {
      doc.addPage();
      y = headerTabel(24);
    }
    const jumlah = (Number(it.qty) || 0) * (Number(it.rate) || 0);
    isi(9);
    teks(i + 1, KIRI, y + 4);
    desk.forEach((l, k) => teks(l, COL_DESK, y + 4 + k * 4.5));
    teks(it.qty, QTY_R, y + 4, { align: "right" });
    teks(rp(it.rate), HARGA_R, y + 4, { align: "right" });
    teks(rp(jumlah), JUMLAH_R, y + 4, { align: "right" });
    doc.setDrawColor(WARNA_GARIS_TIPIS);
    doc.line(KIRI, y + tinggi, KANAN, y + tinggi);
    y += tinggi;
  });

  // Ringkasan
  y += 10;
  if (y + 40 > BATAS_BAWAH) {
    doc.addPage();
    y = 24;
  }
  isi(9);
  teks("Subtotal", 130, y);
  teks(rp(subtotal), KANAN, y, { align: "right" });
  y += 5;
  if (d.taxPct) {
    teks(`Pajak (${d.taxPct}%)`, 130, y);
    teks(rp(tax), KANAN, y, { align: "right" });
    y += 5;
  }
  doc.setDrawColor(WARNA_TEBAL);
  doc.line(130, y, KANAN, y);
  y += 6;
  isi(13, true, WARNA_TEBAL);
  teks("Total", 130, y);
  teks(rp(total), KANAN, y, { align: "right" });
  y += 5;
  if (total > 0) {
    isi(8, false, 120);
    teks(terbilang(total), KANAN, y, { align: "right" });
  }
  y += 14;

  // Pembayaran dan syarat
  const yBayar = blok(KIRI, 80, "Pembayaran ke", "", [p.bank, p.account, p.holder && `a.n. ${p.holder}`].filter(Boolean), y);
  label("Syarat pembayaran", TENGAH, y);
  isi(9);
  let ySyarat = y + 5;
  for (const l of doc.splitTextToSize(String(d.paymentTerms || "-"), 80)) {
    teks(l, TENGAH, ySyarat);
    ySyarat += 4.5;
  }
  y = Math.max(yBayar, ySyarat) + 6;

  if (d.notes) {
    label("Catatan", KIRI, y);
    y += 5;
    isi(9);
    for (const l of doc.splitTextToSize(String(d.notes), 170)) {
      teks(l, KIRI, y);
      y += 4.5;
    }
    y += 6;
  }

  // Tanda tangan di kanan bawah, tinggi 17 mm dan lebar mengikuti rasio gambar (seperti versi HTML).
  if (y + 45 > BATAS_BAWAH) {
    doc.addPage();
    y = 24;
  }
  y += 4;
  if (sign) {
    const props = doc.getImageProperties(sign);
    const tinggiTtd = 17;
    const lebarTtd = Math.min(SIG_W, (tinggiTtd * props.width) / props.height);
    doc.addImage(sign, "PNG", SIG_X + (SIG_W - lebarTtd) / 2, y, lebarTtd, tinggiTtd);
    y += tinggiTtd + 1;
  } else {
    y += 16;
  }
  doc.setDrawColor(WARNA_TEBAL);
  doc.line(SIG_X, y, KANAN, y);
  isi(9, false, WARNA_TEBAL);
  doc.text(String(p.name || ""), SIG_X + SIG_W / 2, y + 5, { align: "center" });

  return doc;
}
