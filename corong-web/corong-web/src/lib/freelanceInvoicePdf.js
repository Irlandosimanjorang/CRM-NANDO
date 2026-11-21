import { jsPDF } from "jspdf";
import { terbilang } from "./docKit";

// PDF invoice freelance dibuat langsung dengan jsPDF (bukan dialog cetak browser),
// jadi tidak ada header/footer browser (URL, tanggal, judul halaman) di hasilnya.

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

const KIRI = 20;
const KANAN = 190;
const TENGAH = 110;
const BATAS_BAWAH = 265;
const GARIS = 225;

export async function buildFreelancePdf(d, p) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { subtotal, tax, total } = totalsOf(d);
  const sign = await toDataUrl(p.signImage);
  let y = 24;

  const teks = (text, x, yy, opts) => doc.text(String(text ?? ""), x, yy, opts);
  const judul = (text, x, yy) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(GARIS);
    teks(text, x, yy);
  };
  const isi = (size, bold = false, warna = 68) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(warna);
  };
  // Blok label + nama + baris alamat; mengembalikan posisi y terakhir.
  const blok = (x, lebar, judulBlok, nama, baris, yAwal) => {
    let yy = yAwal;
    judul(judulBlok, x, yy);
    yy += 5;
    if (nama) {
      isi(11, true, 26);
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
    teks("Deskripsi", 30, yy);
    teks("Qty", 146, yy, { align: "right" });
    teks("Harga", 170, yy, { align: "right" });
    teks("Jumlah", KANAN, yy, { align: "right" });
    doc.setDrawColor(26);
    doc.line(KIRI, yy + 2, KANAN, yy + 2);
    return yy + 7;
  };

  // Judul dan tanggal
  isi(22, true, 26);
  teks("Invoice", KIRI, y);
  isi(10, false, 90);
  teks(d.number, KIRI, y + 7);
  isi(9, false, 68);
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
    judul("Proyek", KIRI, y);
    y += 5;
    isi(9);
    teks(d.project, KIRI, y);
    y += 10;
  }

  // Tabel item
  y = headerTabel(y);
  const baris = d.items.filter((it) => String(it.desc || "").trim());
  if (baris.length === 0) {
    isi(9, false, 136);
    teks("Belum ada item", KIRI, y + 4);
    y += 10;
  }
  baris.forEach((it, i) => {
    const desk = doc.splitTextToSize(String(it.desc), 110);
    const tinggi = desk.length * 4.5 + 4;
    if (y + tinggi > BATAS_BAWAH) {
      doc.addPage();
      y = headerTabel(24);
    }
    const jumlah = (Number(it.qty) || 0) * (Number(it.rate) || 0);
    isi(9);
    teks(i + 1, KIRI, y + 4);
    desk.forEach((l, k) => teks(l, 30, y + 4 + k * 4.5));
    teks(it.qty, 146, y + 4, { align: "right" });
    teks(rp(it.rate), 170, y + 4, { align: "right" });
    teks(rp(jumlah), KANAN, y + 4, { align: "right" });
    doc.setDrawColor(229);
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
  doc.setDrawColor(26);
  doc.line(130, y, KANAN, y);
  y += 6;
  isi(13, true, 26);
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
  judul("Syarat pembayaran", TENGAH, y);
  isi(9);
  let ySyarat = y + 5;
  for (const l of doc.splitTextToSize(String(d.paymentTerms || "-"), 80)) {
    teks(l, TENGAH, ySyarat);
    ySyarat += 4.5;
  }
  y = Math.max(yBayar, ySyarat) + 6;

  if (d.notes) {
    judul("Catatan", KIRI, y);
    y += 5;
    isi(9);
    for (const l of doc.splitTextToSize(String(d.notes), 170)) {
      teks(l, KIRI, y);
      y += 4.5;
    }
    y += 6;
  }

  // Tanda tangan di kanan bawah
  if (y + 45 > BATAS_BAWAH) {
    doc.addPage();
    y = 24;
  }
  y += 6;
  if (sign) {
    doc.addImage(sign, "PNG", 150, y, 40, 16);
    y += 18;
  } else {
    y += 16;
  }
  doc.setDrawColor(26);
  doc.line(130, y, KANAN, y);
  isi(9, false, 26);
  doc.text(String(p.name || ""), 160, y + 5, { align: "center" });

  return doc;
}
