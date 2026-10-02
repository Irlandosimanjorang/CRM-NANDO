import { useEffect, useMemo, useRef, useState } from "react";
import * as db from "../lib/db";

// Invoice langganan Nexto (2 Okt 2026, permintaan Nando) - khusus admin
// platform, di Command Center (kartu INVOICE). Ketik nama perusahaan klien:
// kalau cocok dengan klien berbayar di Nexto, paket, owner & jumlah anggota
// terisi otomatis. Tanpa PPN (keputusan Nando).
//
// Invoice DISIMPAN (tabel admin_invoices lewat edge function admin-invoices)
// supaya nomornya berurutan per tahun (INV/NXT/2026/10/0001, 0002, ...) dan
// statusnya bisa dilacak (Belum dibayar / Lunas / Dibatalkan). Invoice yang
// sudah tersimpan tidak bisa diubah - buat invoice baru untuk koreksi.
// PDF dibuat lewat dialog cetak browser ("Simpan sebagai PDF").

const EARLY_BIRD_DEADLINE = new Date("2026-10-15T23:59:59+07:00"); // sama dengan Auth.jsx
const PROFILE_KEY = "nexto-invoice-seller";

// Harga per pengguna/bulan mengikuti PRICING_EARLY_BIRD / PRICING_NORMAL di
// Auth.jsx - kalau harga di sana berubah, samakan di sini.
const PLANS = {
  standard: { label: "Standard", item: "Langganan Nexto Standard", unit: "pengguna", early: 59000, normal: 89000, minSeats: 1 },
  professional: { label: "Professional", item: "Langganan Nexto Professional", unit: "pengguna", early: 229000, normal: 249000, minSeats: 1 },
  enterprise: { label: "Enterprise", item: "Langganan Nexto Enterprise", unit: "anggota tim", early: 249000, normal: 279000, minSeats: 4 },
  custom: { label: "Custom", item: "", unit: "pengguna", early: 0, normal: 0, minSeats: 1 },
};
const priceOf = (plan) => (new Date() < EARLY_BIRD_DEADLINE ? PLANS[plan].early : PLANS[plan].normal);

const STATUS = {
  unpaid: { label: "Belum dibayar", color: "#b45309" },
  paid: { label: "Lunas", color: "#15803d" },
  void: { label: "Dibatalkan", color: "#64748b" },
};

const rp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const isoDay = (d) => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);
const addDays = (iso, n) => isoDay(new Date(new Date(iso + "T00:00:00+07:00").getTime() + n * 86400000));
const addMonths = (iso, n) => {
  const t = new Date(iso + "T00:00:00+07:00");
  t.setMonth(t.getMonth() + n); t.setDate(t.getDate() - 1);
  return isoDay(t);
};
const fmtDate = (iso) => new Date(iso + "T00:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const fmtShort = (iso) => new Date(iso + "T00:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Terbilang rupiah - lazim di invoice B2B Indonesia.
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
export function terbilang(n) {
  const v = Math.round(Number(n) || 0);
  if (v === 0) return "Nol rupiah";
  const t = terbilangInt(v).replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1) + " rupiah";
}

// Olah foto tanda tangan / stempel (2 Okt 2026, diperbaiki untuk foto HP):
// - Foto HEIC (format bawaan iPhone) tidak didukung: konverternya butuh
//   new Function & Worker blob:, yang diblokir CSP production. Pengguna
//   diarahkan memakai JPG/PNG atau screenshot.
// - Latar kertas diukur PER AREA (bukan satu ambang putih), jadi bayangan,
//   kertas bergaris, dan tulisan tembus dari halaman belakang ikut hilang -
//   yang diambil hanya goresan yang jauh lebih gelap dari kertas di sekitarnya.
// - Bintik kecil yang terpisah dibuang, margin dipotong, ukuran diperkecil
//   supaya ringan disimpan bersama setiap invoice.
// - Tanda tangan diwarnai satu warna tinta (rata, seperti pulpen); stempel
//   mempertahankan warna aslinya.
const isHeic = (file) => /hei[cf]/i.test(file.type || "") || /\.hei[cf]$/i.test(file.name || "");

async function decodeImage(file) {
  // Dibaca sebagai data: URL, bukan blob: - CSP production (vercel.json,
  // img-src) dulu hanya mengizinkan data:, jadi blob: URL gagal dimuat.
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  } catch (_) {
    throw new Error("Gambar tidak dapat dibaca. Gunakan file JPG atau PNG.");
  }
}

export async function processSignatureFile(file, { maxW = 600, maxH = 300, keepColor = false } = {}) {
  if (!file) throw new Error("Pilih file gambar.");
  if (isHeic(file)) throw new Error("Foto HEIC (format bawaan iPhone) belum didukung. Unggah dalam format JPG atau PNG, misalnya screenshot dari foto tersebut.");
  if (!/^image\//.test(file.type || "")) throw new Error("File harus berupa gambar JPG atau PNG.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 20 MB.");
  const img = await decodeImage(file);

  // Perkecil foto besar dulu (sisi terpanjang 1400 px) supaya cepat diolah.
  const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.max(1, Math.round(img.naturalWidth * k)), H = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const N = W * H;

  let transparent = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) transparent++;
  const alpha = new Float32Array(N);

  if (transparent > N * 0.05) {
    // Sudah PNG transparan: pakai apa adanya.
    for (let i = 0; i < N; i++) alpha[i] = px[i * 4 + 3] / 255;
  } else {
    const L = new Float32Array(N);
    for (let i = 0; i < N; i++) L[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];

    // Kecerahan kertas per blok (persentil 80 - goresan tipis tidak
    // menurunkannya), lalu diinterpolasi halus ke tiap piksel.
    const B = Math.max(12, Math.round(Math.max(W, H) / 36));
    const gw = Math.ceil(W / B), gh = Math.ceil(H / B);
    const grid = new Float32Array(gw * gh);
    const hist = new Uint32Array(256);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      hist.fill(0);
      let n = 0;
      for (let y = gy * B; y < Math.min(H, (gy + 1) * B); y++) for (let x = gx * B; x < Math.min(W, (gx + 1) * B); x++) { hist[L[y * W + x] | 0]++; n++; }
      let acc = 0, v = 255;
      for (let t = 0; t < 256; t++) { acc += hist[t]; if (acc >= n * 0.8) { v = t; break; } }
      grid[gy * gw + gx] = v;
    }
    const bgAt = (x, y) => {
      const fx = Math.min(gw - 1, Math.max(0, x / B - 0.5)), fy = Math.min(gh - 1, Math.max(0, y / B - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
      const ax = fx - x0, ay = fy - y0;
      return (grid[y0 * gw + x0] * (1 - ax) + grid[y0 * gw + x1] * ax) * (1 - ay) + (grid[y1 * gw + x0] * (1 - ax) + grid[y1 * gw + x1] * ax) * ay;
    };

    // Seberapa gelap tiap piksel dibanding kertas di sekitarnya, relatif
    // terhadap kecerahan kertas itu (foto redup tetap terbaca).
    const diff = new Float32Array(N);
    const dh = new Uint32Array(256);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const bg = Math.max(40, bgAt(x, y));
      const d = Math.max(0, Math.min(255, ((bg - L[i]) / bg) * 255));
      diff[i] = d;
      dh[d | 0]++;
    }
    // Ambang otomatis (Otsu) di antara "kertas + garis tipis" dan "tinta";
    // minimal 70 supaya garis buku & tulisan tembus tidak ikut.
    let sum = 0, total = 0;
    for (let t = 0; t < 256; t++) { sum += t * dh[t]; total += dh[t]; }
    let sumB = 0, wB = 0, best = 0, thr = 70;
    for (let t = 0; t < 256; t++) {
      wB += dh[t]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += t * dh[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = t; }
    }
    thr = Math.max(70, thr);
    const lo = thr * 0.8, hi = thr * 1.25;
    for (let i = 0; i < N; i++) alpha[i] = diff[i] <= lo ? 0 : diff[i] >= hi ? 1 : (diff[i] - lo) / (hi - lo);

    // Kelompokkan goresan yang tersambung. Yang disimpan hanya tanda tangan
    // utama (goresan terbesar) plus goresan yang dekat dengannya (titik huruf
    // i, coretan terpisah). Bintik kecil, noda di tepi foto, dan tulisan lain
    // yang jauh dari tanda tangan dibuang.
    const label = new Int32Array(N).fill(-1);
    const stack = new Int32Array(N);
    const comps = [];
    for (let s0 = 0; s0 < N; s0++) {
      if (alpha[s0] < 0.5 || label[s0] !== -1) continue;
      const id = comps.length;
      const comp = { members: [], x0: W, y0: H, x1: 0, y1: 0 };
      let top = 0;
      stack[top++] = s0; label[s0] = id;
      while (top) {
        const i = stack[--top]; comp.members.push(i);
        const x = i % W, y = (i / W) | 0;
        if (x < comp.x0) comp.x0 = x; if (x > comp.x1) comp.x1 = x; if (y < comp.y0) comp.y0 = y; if (y > comp.y1) comp.y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (alpha[j] >= 0.5 && label[j] === -1) { label[j] = id; stack[top++] = j; }
        }
      }
      comps.push(comp);
    }
    const minArea = Math.max(6, Math.round(N * 0.00003));
    const edge = Math.max(2, Math.round(Math.min(W, H) * 0.01));
    const big = comps.reduce((m, c2) => Math.max(m, c2.members.length), 0);
    const ok = comps.filter((c2) => {
      if (c2.members.length < minArea) return false;
      const touches = c2.x0 <= edge || c2.y0 <= edge || c2.x1 >= W - 1 - edge || c2.y1 >= H - 1 - edge;
      return !(touches && c2.members.length < big * 0.25);
    }).sort((p1, p2) => p2.members.length - p1.members.length);
    const keep = new Set();
    if (ok.length) {
      const box = { x0: ok[0].x0, y0: ok[0].y0, x1: ok[0].x1, y1: ok[0].y1 };
      keep.add(ok[0]);
      for (let grew = true; grew;) {
        grew = false;
        const m = Math.max(box.x1 - box.x0, box.y1 - box.y0) * 0.12 + 4;
        for (const c2 of ok) {
          if (keep.has(c2)) continue;
          if (c2.x1 >= box.x0 - m && c2.x0 <= box.x1 + m && c2.y1 >= box.y0 - m && c2.y0 <= box.y1 + m) {
            keep.add(c2); grew = true;
            box.x0 = Math.min(box.x0, c2.x0); box.y0 = Math.min(box.y0, c2.y0); box.x1 = Math.max(box.x1, c2.x1); box.y1 = Math.max(box.y1, c2.y1);
          }
        }
      }
    }
    for (const c2 of comps) if (!keep.has(c2)) for (const i of c2.members) alpha[i] = 0;
    // Tepi lembut yang tidak menempel ke goresan utama ikut dibuang.
    for (let i = 0; i < N; i++) {
      if (alpha[i] > 0 && alpha[i] < 0.5) {
        const x = i % W, y = (i / W) | 0;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && alpha[ny * W + nx] >= 0.5) { near = true; break; }
        }
        if (!near) alpha[i] = 0;
      }
    }

    // Warna: tanda tangan = satu warna tinta (rata-rata goresan paling
    // pekat, digelapkan); stempel = warna asli diperkuat.
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < N; i++) if (alpha[i] >= 0.95) { r += px[i * 4]; g += px[i * 4 + 1]; b += px[i * 4 + 2]; n++; }
    if (n) { r /= n; g /= n; b /= n; }
    const lum = 0.299 * r + 0.587 * g + 0.114 * b || 1;
    const f = Math.min(1, 45 / lum);
    const ink = [Math.round(r * f), Math.round(g * f), Math.round(b * f)];
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      if (!keepColor) { px[o] = ink[0]; px[o + 1] = ink[1]; px[o + 2] = ink[2]; }
      else { const s = 0.75; px[o] = Math.round(px[o] * s); px[o + 1] = Math.round(px[o + 1] * s); px[o + 2] = Math.round(px[o + 2] * s); }
      px[o + 3] = Math.round(alpha[i] * 255);
    }
    ctx.putImageData(data, 0, 0);
  }

  // Potong margin kosong.
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (alpha[y * W + x] > 0.1) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error("Tanda tangan tidak terdeteksi. Gunakan foto yang lebih jelas: pulpen gelap di kertas polos, cahaya merata.");
  const pad = 4;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const scale = Math.min(1, maxW / w, maxH / h);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w * scale)); out.height = Math.max(1, Math.round(h * scale));
  const octx = out.getContext("2d");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(c, x0, y0, w, h, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

const PROFILE_BASE = { name: "Nexto", address: "", email: "", phone: "", bank: "", account: "", holder: "", signName: "", signTitle: "", signImage: "", stampImage: "" };
// Salinan lokal hanya cache (tampil instan & cadangan saat offline) - sumber
// utamanya tabel admin_settings di server (lihat sinkronisasi di komponen).
function loadProfile() {
  const base = PROFILE_BASE;
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return { ...base, ...saved };
  } catch (_) {
    return base;
  }
}

// Hitung semua angka dari data invoice (dipakai draf & invoice tersimpan).
function computeTotals(d) {
  const subtotal = (Number(d.seats) || 0) * (Number(d.pricePerSeat) || 0) * (Number(d.months) || 0);
  const raw = d.discountType === "percent" ? subtotal * (Number(d.discountValue) || 0) / 100 : Number(d.discountValue) || 0;
  const discount = Math.min(Math.max(0, Math.round(raw)), subtotal);
  return { subtotal, discount, total: subtotal - discount };
}

/** d = data invoice (draf atau tersimpan), meta = { number, status, paidAt } */
export function buildInvoiceHtml(d, meta = {}) {
  const seller = d.seller || {};
  const { subtotal, discount, total } = computeTotals(d);
  const sellerLines = [seller.address, seller.email, seller.phone, "nexto.site"].filter(Boolean);
  // Pembayaran lewat transfer bank (2 Okt 2026): cukup nomor rekening yang
  // wajib - nama bank & atas nama ditampilkan bila diisi.
  const bank = seller.account
    ? [seller.bank && ["Bank", seller.bank], ["No. rekening", seller.account], seller.holder && ["Atas nama", seller.holder]]
        .filter(Boolean).map(([k, v]) => `<div class="row"><span>${k}</span><span${k === "No. rekening" ? ' class="acc"' : ""}>${esc(v)}</span></div>`).join("")
    : "";
  const logo = `${window.location.origin}/nexto-logo.png`;
  const number = meta.number || "Draf";
  const st = meta.status ? STATUS[meta.status] : null;
  const discountLabel = d.discountLabel?.trim() || "Diskon";
  // Gaya invoice akuntansi: label huruf biasa, garis tipis, total ditandai
  // garis tebal, oranye Nexto hanya untuk angka total.
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(number.replaceAll("/", "-"))} ${esc(d.company)}</title>
<style>
  /* Margin halaman 0 = Chrome tidak mencetak header/footer bawaan (tanggal,
     alamat situs, nomor halaman); jarak tepi diganti padding .doc saat cetak. */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html { overscroll-behavior: contain; }
  body { margin: 0; font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif; color: #1c2230; font-size: 12.5px; line-height: 1.6; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc { max-width: 760px; margin: 0 auto; padding: 36px 36px 28px; }
  .head { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: start; }
  .logo { display: inline-block; background: #1c2230; padding: 8px 12px; border-radius: 4px; }
  .logo img { height: 20px; width: auto; display: block; }
  .from { margin-top: 12px; color: #5b6475; }
  .from b { display: block; color: #1c2230; font-size: 13.5px; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
  .title .no { margin-top: 2px; color: #5b6475; font-variant-numeric: tabular-nums; }
  .title .st { margin-top: 6px; font-weight: 700; }
  .facts { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 20px; margin: 30px 0 26px; padding: 16px 0; border-top: 1px solid #d9dde4; border-bottom: 1px solid #d9dde4; }
  .k { color: #5b6475; font-size: 11.5px; font-weight: 600; margin-bottom: 3px; }
  .v { font-weight: 600; }
  .v small { display: block; font-weight: 400; color: #5b6475; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: #5b6475; font-size: 11.5px; font-weight: 600; padding: 0 0 8px; border-bottom: 1px solid #1c2230; }
  td { padding: 14px 0; border-bottom: 1px solid #e6e9ee; vertical-align: top; }
  td.d { padding-right: 16px; }
  td small { display: block; color: #5b6475; font-size: 12px; }
  .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-left: 16px; }
  .sum { margin: 18px 0 0 auto; width: 320px; }
  .sum .row { display: flex; justify-content: space-between; gap: 16px; padding: 5px 0; color: #5b6475; font-variant-numeric: tabular-nums; }
  .sum .grand { margin-top: 6px; padding-top: 10px; border-top: 2px solid #1c2230; color: #1c2230; font-size: 16px; font-weight: 700; }
  .sum .grand span:last-child { color: #c2410c; }
  .words { margin-top: 10px; text-align: right; color: #5b6475; font-style: italic; }
  .pay { margin-top: 32px; }
  h2 { margin: 0 0 8px; font-size: 13px; }
  .pay .row { display: grid; grid-template-columns: 130px 1fr; gap: 12px; padding: 4px 0; }
  .pay .acc { font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
  .pay .row span:first-child { color: #5b6475; }
  .pay a { color: #1c2230; word-break: break-all; }
  .pay p { margin: 8px 0 0; color: #5b6475; }
  .bottom { display: grid; grid-template-columns: 1fr 220px; gap: 32px; margin-top: 28px; align-items: end; }
  .sign { text-align: center; }
  .sign .space { position: relative; height: 84px; display: flex; align-items: flex-end; justify-content: center; }
  .sign .space .ttd { max-height: 76px; max-width: 200px; position: relative; z-index: 2; }
  .sign .space .cap { position: absolute; left: 6px; top: -6px; height: 92px; max-width: 120px; opacity: 0.9; z-index: 1; }
  .sign .name { font-weight: 700; border-top: 1px solid #1c2230; padding-top: 6px; }
  .sign .role { color: #5b6475; }
  .foot { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e6e9ee; color: #8a92a1; font-size: 11px; display: flex; justify-content: space-between; }
  @media print { .doc { max-width: none; padding: 16mm 18mm; } }
</style></head><body><div class="doc">
  <div class="head">
    <div>
      <div class="logo"><img src="${logo}" alt="Nexto"></div>
      <div class="from"><b>${esc(seller.name || "Nexto")}</b>${sellerLines.map((l) => `${esc(l)}<br>`).join("")}</div>
    </div>
    <div class="title">
      <h1>Invoice</h1>
      <div class="no">${esc(number)}</div>
      ${st ? `<div class="st" style="color:${st.color}">${st.label}${meta.status === "paid" && meta.paidAt ? `, ${fmtShort(meta.paidAt.slice(0, 10))}` : ""}</div>` : ""}
    </div>
  </div>
  <div class="facts">
    <div><div class="k">Ditagihkan kepada</div><div class="v">${esc(d.company || "Nama perusahaan")}${d.contact ? `<small>${esc(d.contact)}</small>` : ""}${d.address ? `<small>${esc(d.address).replace(/\n/g, "<br>")}</small>` : ""}${d.email ? `<small>${esc(d.email)}</small>` : ""}</div></div>
    <div><div class="k">Tanggal invoice</div><div class="v">${fmtDate(d.date)}</div><div class="k" style="margin-top:10px">Jatuh tempo</div><div class="v">${fmtDate(d.due)}</div>${d.po ? `<div class="k" style="margin-top:10px">Nomor PO</div><div class="v">${esc(d.po)}</div>` : ""}</div>
    <div><div class="k">Periode langganan</div><div class="v">${fmtDate(d.start)}<small>sampai ${fmtDate(d.end)}</small></div></div>
  </div>
  <table>
    <thead><tr><th>Deskripsi</th><th class="r">Jumlah</th><th class="r">Harga satuan</th><th class="r">Subtotal</th></tr></thead>
    <tbody><tr>
      <td class="d"><b>${esc(d.item)}</b><small>${d.seats} ${esc(d.unit)}, ${d.months} bulan</small></td>
      <td class="r">${d.seats * d.months}</td>
      <td class="r">${rp(d.pricePerSeat)}<small>per ${esc(d.unit)}/bulan</small></td>
      <td class="r">${rp(subtotal)}</td>
    </tr></tbody>
  </table>
  <div class="sum">
    <div class="row"><span>Subtotal</span><span>${rp(subtotal)}</span></div>
    ${discount > 0 ? `<div class="row"><span>${esc(discountLabel)}${d.discountType === "percent" ? ` (${Number(d.discountValue)}%)` : ""}</span><span>-${rp(discount)}</span></div>` : ""}
    <div class="row grand"><span>Total tagihan</span><span>${rp(total)}</span></div>
  </div>
  <div class="words">Terbilang: ${terbilang(total)}</div>
  <div class="bottom">
    <div class="pay">
      <h2>Cara pembayaran</h2>
      ${d.payLink ? `<div class="row"><span>Pembayaran online</span><a href="${esc(d.payLink)}">${esc(d.payLink)}</a></div>` : ""}
      ${bank}
      <p>${meta.number ? `Cantumkan nomor ${esc(number)} pada berita pembayaran.` : "Nomor invoice dibuat saat invoice disimpan."}</p>
      ${d.note ? `<h2 style="margin-top:18px">Catatan</h2><div>${esc(d.note).replace(/\n/g, "<br>")}</div>` : ""}
    </div>
    <div class="sign">
      <div>Hormat kami,</div>
      <div class="space">${seller.stampImage ? `<img class="cap" src="${seller.stampImage}" alt="">` : ""}${seller.signImage ? `<img class="ttd" src="${seller.signImage}" alt="Tanda tangan">` : ""}</div>
      <div class="name">${esc(seller.signName || seller.name || "Nexto")}</div>
      ${seller.signTitle ? `<div class="role">${esc(seller.signTitle)}</div>` : ""}
    </div>
  </div>
  <div class="foot"><span>Terima kasih telah menggunakan Nexto.</span><span>${esc(number)}</span></div>
</div></body></html>`;
}

// Cetak dokumen lewat iframe sementara (dialog cetak -> "Simpan sebagai PDF").
function printHtml(html) {
  // Tes otomatis (scripts/smoke) memasang window.__nextoPrintHook supaya
  // dialog cetak - yang menahan halaman - tidak terbuka saat pengujian.
  if (typeof window.__nextoPrintHook === "function") { window.__nextoPrintHook(html); return; }
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  f.srcdoc = html;
  f.onload = () => {
    const w = f.contentWindow;
    const done = () => setTimeout(() => f.remove(), 500);
    w.addEventListener("afterprint", done, { once: true });
    const imgs = [...w.document.images].filter((i) => !i.complete);
    Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))).then(() => { w.focus(); w.print(); });
    setTimeout(() => f.isConnected && f.remove(), 60000);
  };
  document.body.appendChild(f);
}

const field = "w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none disabled:opacity-60";
const lbl = "mb-1 block text-[11px] font-semibold text-slate-400";

const CURRENT_PLAN_LABEL = { enterprise: "Enterprise", standard: "Standard", premium: "Professional" };
const fmtWib = (iso) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");

// Aktifkan paket dari invoice Lunas (2 Okt 2026). Dialog selalu meminta
// pratinjau ke server dulu (akun, organisasi, kondisi sekarang vs sesudah),
// tombol Aktifkan baru menyala kalau tidak ada masalah.
const ACTIVATE_AS = [["enterprise", "Enterprise (tim)"], ["professional", "Professional (perorangan)"], ["standard", "Standard (perorangan)"]];

function ActivateDialog({ invoice, onClose, onDone }) {
  const isCustom = invoice.data?.plan === "custom";
  const [asPlan, setAsPlan] = useState(invoice.data?.activatePlan || "enterprise");
  const [email, setEmail] = useState(invoice.data?.email || "");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const check = async (addr, planAs = asPlan) => {
    setLoading(true); setErr("");
    try { const r = await db.adminInvoices("activation_preview", { id: invoice.id, email: addr.trim(), plan: isCustom ? planAs : undefined }); setPreview(r.preview); }
    catch (e) { setPreview(null); setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { check(email); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  const activate = async () => {
    setSaving(true); setErr("");
    try { const r = await db.adminInvoices("activate", { id: invoice.id, email: preview.email, plan: isCustom ? asPlan : undefined }); onDone(r.invoice); }
    catch (e) { setErr(e.message); setSaving(false); }
  };

  const pv = preview;
  const ent = pv?.plan === "enterprise";
  const curPlan = ent ? pv?.org?.plan : pv?.current?.plan;
  const curExp = ent ? pv?.org?.plan_expires_at : pv?.current?.plan_expires_at;
  const rows = pv?.user ? [
    ["Paket", CURRENT_PLAN_LABEL[curPlan] || "Gratis", pv.planLabel],
    ...(ent && pv.org ? [["Kuota anggota", `${curPlan === "enterprise" ? pv.org.member_limit : 1} (terisi ${pv.org.members})`, `${pv.seats} anggota`]] : []),
    ["Aktif sampai", curPlan ? fmtWib(curExp) : "-", `${fmtWib(pv.expires_at)}, 23.59 WIB`],
  ] : [];
  const canActivate = pv && !loading && !saving && pv.problems.length === 0 && email.trim().toLowerCase() === pv.email && (!isCustom || pv.plan === asPlan);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="act-title" className="w-full max-w-[480px] rounded-xl border border-slate-700 bg-[#0f1420] shadow-2xl">
        <div className="border-b border-slate-800 px-5 py-4">
          <h3 id="act-title" className="text-[15px] font-semibold text-slate-100">Aktifkan paket</h3>
          <p className="mt-0.5 text-[12px] text-slate-400"><span className="font-mono">{invoice.number}</span>, {invoice.company}</p>
        </div>
        <div className="space-y-4 px-5 py-4">
          {isCustom && (
            <div>
              <label className={lbl} htmlFor="act-plan">Aktifkan sebagai paket</label>
              <select id="act-plan" className={field} value={asPlan} disabled={saving} onChange={(e) => { setAsPlan(e.target.value); check(email, e.target.value); }}>
                {ACTIVATE_AS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <p className="mt-1 text-[11.5px] text-slate-500">Invoice ini paket Custom. Kuota anggota dan masa aktif tetap mengikuti invoice ({invoice.data?.seats} {invoice.data?.unit || "pengguna"}).</p>
            </div>
          )}
          <div>
            <label className={lbl} htmlFor="act-email">Email akun owner klien</label>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); check(email); }}>
              <input id="act-email" type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@perusahaan.co.id" disabled={saving} />
              <button type="submit" disabled={loading || saving} className="shrink-0 rounded-lg border border-slate-600 px-3 text-[12.5px] font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">Periksa</button>
            </form>
            {pv?.org && <p className="mt-1.5 text-[12px] text-slate-400">Organisasi: <span className="text-slate-200">{pv.org.name || "Tanpa nama"}</span></p>}
          </div>

          {loading ? (
            <p className="text-[12.5px] text-slate-500">Memeriksa akun…</p>
          ) : pv && rows.length > 0 ? (
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-left text-[11px] text-slate-500"><th className="pb-1.5 font-semibold" /><th className="pb-1.5 font-semibold">Sekarang</th><th className="pb-1.5 font-semibold">Sesudah</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map(([k, a, b]) => (
                  <tr key={k}><td className="py-2 pr-3 text-slate-400">{k}</td><td className="py-2 pr-3 text-slate-400">{a}</td><td className="py-2 font-semibold text-slate-100">{b}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {!loading && pv?.problems.map((m) => <p key={m} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">{m}</p>)}
          {!loading && pv?.problems.length === 0 && pv.warnings.map((m) => <p key={m} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-100">{m}</p>)}
          {err && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">{err}</p>}
          {!loading && pv && email.trim().toLowerCase() !== pv.email && <p className="text-[12px] text-slate-400">Email diubah. Klik Periksa untuk memuat ulang data akun.</p>}
          {canActivate && <p className="text-[12px] text-slate-400">{ent ? "Anggota tim bergabung lewat kode undangan dari akun owner sampai kuota terpenuhi. " : ""}Pengingat H-3 dan penurunan paket otomatis tetap berjalan sesuai tanggal di atas.</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">Batal</button>
          <button type="button" onClick={activate} disabled={!canActivate} className="rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Mengaktifkan…" : "Aktifkan paket"}</button>
        </div>
      </div>
    </div>
  );
}

// Tandai lunas dengan tanggal uang benar-benar masuk (2 Okt 2026) - dulu
// otomatis memakai waktu klik, tidak cocok untuk pembukuan.
function PaidDateDialog({ invoice, onClose, onSave }) {
  const todayWib = isoDay(new Date());
  const [d, setD] = useState(invoice.paid_at ? isoDay(new Date(invoice.paid_at)) : todayWib);
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); const ok = await onSave(invoice, d); if (!ok) setSaving(false); };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="paid-title" className="w-full max-w-[360px] rounded-xl border border-slate-700 bg-[#0f1420] shadow-2xl">
        <div className="border-b border-slate-800 px-5 py-4">
          <h3 id="paid-title" className="text-[15px] font-semibold text-slate-100">{invoice.status === "paid" ? "Ubah tanggal pembayaran" : "Tandai lunas"}</h3>
          <p className="mt-0.5 text-[12px] text-slate-400"><span className="font-mono">{invoice.number}</span>, {invoice.company}, {rp(invoice.total)}</p>
        </div>
        <div className="px-5 py-4">
          <label className={lbl} htmlFor="paid-date">Tanggal uang diterima</label>
          <input id="paid-date" type="date" className={field} value={d} max={todayWib} onChange={(e) => setD(e.target.value)} />
          <p className="mt-1.5 text-[11.5px] text-slate-500">Sesuaikan dengan tanggal di mutasi rekening. Tanggal ini tercetak di invoice sebagai tanggal lunas.{invoice.status !== "paid" && !invoice.data?.activation ? " Setelah disimpan, jendela aktivasi paket langsung terbuka." : ""}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">Batal</button>
          <button type="button" onClick={save} disabled={saving || !d || d > todayWib} className="rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">{saving ? "Menyimpan…" : invoice.status !== "paid" && !invoice.data?.activation ? "Simpan & lanjut aktivasi" : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}

export default function EnterpriseInvoicePanel({ users = [] }) {
  // Klien berbayar dari direktori user, per organisasi (paket, owner, jumlah anggota).
  const orgs = useMemo(() => {
    const map = new Map();
    for (const u of users || []) {
      if (!u.org_name || !PLANS[u.plan]) continue;
      const o = map.get(u.org_name) || { name: u.org_name, plan: u.plan, members: 0, owner: null };
      o.members += 1;
      if (u.plan === "enterprise") o.plan = "enterprise";
      if (u.role === "owner") o.owner = u;
      map.set(u.org_name, o);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const today = isoDay(new Date());
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [po, setPo] = useState("");
  const [plan, setPlan] = useState("enterprise");
  const [customItem, setCustomItem] = useState("");
  const [activatePlan, setActivatePlan] = useState("enterprise"); // paket Nexto untuk invoice Custom
  const [seats, setSeats] = useState(PLANS.enterprise.minSeats);
  const [months, setMonths] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState(priceOf("enterprise"));
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(today);
  const [dueDays, setDueDays] = useState(7);
  const [note, setNote] = useState("");
  const [seller, setSeller] = useState(loadProfile);
  const [showSeller, setShowSeller] = useState(false);
  const [viewing, setViewing] = useState(null); // invoice tersimpan yang sedang dilihat
  const [history, setHistory] = useState(null);
  const [historyErr, setHistoryErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState(null); // invoice yang sedang diaktifkan paketnya
  const [paying, setPaying] = useState(null); // invoice yang sedang ditandai lunas (dialog tanggal)
  const [profileSync, setProfileSync] = useState("loading"); // loading | saved | saving | error
  const profileReady = useRef(false);
  const skipAutofill = useRef(false);
  const [emailCheck, setEmailCheck] = useState(null); // null | { status: "checking" | "found" | "notfound" | "invalid", ... }
  const frameRef = useRef(null);
  const topRef = useRef(null);

  const loadHistory = () => {
    setHistoryErr("");
    db.adminInvoices("list").then((r) => setHistory(r.invoices || [])).catch((e) => { setHistory([]); setHistoryErr(e.message); });
  };
  useEffect(loadHistory, []);

  const matched = orgs.find((o) => o.name.toLowerCase() === company.trim().toLowerCase()) || null;

  // Ganti paket -> harga & jumlah minimum ikut paket (tetap bisa diubah manual).
  const choosePlan = (next, members = 0) => {
    setPlan(next);
    if (next !== "custom") setPricePerSeat(priceOf(next));
    setSeats((cur) => {
      if (members) return Math.max(PLANS[next].minSeats, members);
      if (next === "custom") return Math.max(1, Number(cur) || 1);
      return PLANS[next].minSeats;
    });
  };

  useEffect(() => {
    if (skipAutofill.current) { skipAutofill.current = false; return; }
    if (!matched || viewing) return;
    setContact(matched.owner?.display_name || "");
    setEmail(matched.owner?.email || "");
    choosePlan(matched.plan, matched.members);
  }, [matched?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Data penagih tersimpan di server (2 Okt 2026) supaya sama di semua
  // perangkat. Pertama kali: kalau server masih kosong, data di browser ini
  // diunggah. Setelah itu setiap perubahan disimpan otomatis (jeda 0,8 detik).
  useEffect(() => {
    let cancelled = false;
    db.adminInvoices("get_profile").then(async ({ profile }) => {
      if (cancelled) return;
      if (profile) {
        setSeller({ ...PROFILE_BASE, ...profile });
      } else {
        const local = loadProfile();
        if (local.account || local.signImage || local.address) await db.adminInvoices("save_profile", { profile: local });
      }
      profileReady.current = true;
      setProfileSync("saved");
    }).catch(() => { if (!cancelled) { profileReady.current = true; setProfileSync("error"); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(seller)); } catch (_) {}
    if (!profileReady.current) return undefined;
    setProfileSync("saving");
    const t = setTimeout(() => {
      db.adminInvoices("save_profile", { profile: seller }).then(() => setProfileSync("saved")).catch(() => setProfileSync("error"));
    }, 800);
    return () => clearTimeout(t);
  }, [seller]);

  // Cek email klien saat diketik (2 Okt 2026) - salah ketik email ketahuan
  // sebelum invoice disimpan, bukan baru saat aktivasi paket.
  useEffect(() => {
    const e = email.trim();
    if (viewing || !e) { setEmailCheck(null); return undefined; }
    setEmailCheck({ status: "checking" });
    const t = setTimeout(() => {
      db.adminInvoices("check_email", { email: e })
        .then((r) => setEmailCheck(r.invalid ? { status: "invalid" } : r.found ? { status: "found", ...r } : { status: "notfound" }))
        .catch(() => setEmailCheck(null));
    }, 600);
    return () => clearTimeout(t);
  }, [email, viewing]);


  // Data draf saat ini (juga yang disimpan ke database saat "Simpan").
  const draft = {
    company: company.trim(), contact: contact.trim(), email: email.trim(), address: address.trim(), po: po.trim(),
    plan, item: plan === "custom" ? (customItem.trim() || "Layanan Nexto") : PLANS[plan].item, unit: PLANS[plan].unit,
    ...(plan === "custom" ? { activatePlan } : {}),
    seats: Math.max(1, Number(seats) || 1), months: Number(months) || 1, pricePerSeat: Number(pricePerSeat) || 0,
    discountLabel: discountLabel.trim(), discountType, discountValue: Number(discountValue) || 0,
    date, due: addDays(date, Number(dueDays) || 0), start, end: addMonths(start, Number(months) || 1),
    note: note.trim(),
    seller: { name: seller.name, address: seller.address, email: seller.email, phone: seller.phone, bank: seller.bank, account: seller.account, holder: seller.holder, signName: seller.signName, signTitle: seller.signTitle, signImage: seller.signImage, stampImage: seller.stampImage },
  };
  const shown = viewing ? viewing.data : draft;
  const html = viewing
    ? buildInvoiceHtml(viewing.data, { number: viewing.number, status: viewing.status, paidAt: viewing.paid_at })
    : buildInvoiceHtml(draft);
  const { total } = computeTotals(shown);

  // Pratinjau dimuat SEKALI, perubahan berikutnya hanya mengganti isi <body>
  // (tidak berkedip). Pratinjau punya scroll sendiri - overscroll-behavior
  // di dokumen invoice mencegah scroll merembet ke kartu/halaman.
  const [initialHtml] = useState(html);
  const syncFrame = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const next = new DOMParser().parseFromString(html, "text/html");
    if (doc.body.innerHTML !== next.body.innerHTML) doc.body.innerHTML = next.body.innerHTML;
    if (doc.title !== next.title) doc.title = next.title;
  };
  useEffect(syncFrame, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAndPrint = async () => {
    if (!company.trim()) { alert("Isi nama perusahaan terlebih dahulu."); return; }
    const emailWarn = emailCheck?.status === "notfound" ? `\n\nPerhatian: belum ada akun Nexto dengan email ${email.trim()}. Pastikan email benar, karena paket nanti diaktifkan ke akun dengan email ini.`
      : emailCheck?.status === "invalid" ? "\n\nPerhatian: format email klien tidak valid." : !email.trim() ? "\n\nPerhatian: email klien belum diisi." : "";
    if (!window.confirm(`Simpan invoice untuk ${company.trim()} sebesar ${rp(total)}? Nomor invoice dibuat berurutan dan invoice tidak dapat diubah setelah disimpan.${emailWarn}`)) return;
    setBusy(true);
    try {
      const { invoice } = await db.adminInvoices("create", { invoice: { company: draft.company, invoice_date: draft.date, due_date: draft.due, total, data: draft } });
      setViewing(invoice);
      setHistory((h) => [invoice, ...(h || []).filter((x) => x.id !== invoice.id)]);
      printHtml(buildInvoiceHtml(invoice.data, { number: invoice.number, status: invoice.status }));
    } catch (e) {
      alert("Gagal menyimpan invoice: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (inv, status, paidDate) => {
    if (status === "paid" && !paidDate) { setPaying(inv); return false; }
    if (status === "void" && !window.confirm(`Batalkan invoice ${inv.number}? Nomornya tetap tercatat (tidak dipakai ulang).`)) return false;
    const openActivation = status === "paid" && inv.status !== "paid" && !inv.data?.activation && !!PLANS[inv.data?.plan];
    try {
      const { invoice } = await db.adminInvoices("set_status", { id: inv.id, status, paid_date: paidDate });
      setHistory((h) => (h || []).map((x) => (x.id === inv.id ? { ...x, ...invoice } : x)));
      if (viewing?.id === inv.id) setViewing((v) => ({ ...v, ...invoice }));
      setPaying(null);
      // Baru ditandai lunas & paketnya belum diaktifkan -> jendela aktivasi
      // langsung dibuka (tetap perlu konfirmasi; menutupnya aman).
      if (openActivation) setActivating({ ...inv, ...invoice });
      return true;
    } catch (e) {
      alert("Gagal mengubah status: " + e.message);
      return false;
    }
  };

  // Duplikat (2 Okt 2026): salin isi invoice tersimpan ke form baru untuk
  // memperbaiki kesalahan - invoice lama tetap ada dan bisa dibatalkan.
  // Data penagih memakai profil terbaru, tanggal mulai dari hari ini.
  const duplicate = (inv) => {
    const d = inv.data || {};
    skipAutofill.current = (d.company || "") !== company;
    setViewing(null);
    setCompany(d.company || ""); setContact(d.contact || ""); setEmail(d.email || ""); setAddress(d.address || ""); setPo(d.po || "");
    const pl = PLANS[d.plan] ? d.plan : "custom";
    setPlan(pl); setCustomItem(pl === "custom" ? (d.item || "") : ""); setActivatePlan(d.activatePlan || "enterprise");
    setSeats(d.seats || PLANS[pl].minSeats); setMonths(d.months || 1); setPricePerSeat(d.pricePerSeat ?? priceOf(pl === "custom" ? "enterprise" : pl));
    setDiscountLabel(d.discountLabel || ""); setDiscountType(d.discountType || "amount"); setDiscountValue(d.discountValue ? String(d.discountValue) : "");
    setNote(d.note || ""); setDate(today); setStart(today);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onActivated = (patch) => {
    setHistory((h) => (h || []).map((x) => (x.id === patch.id ? { ...x, data: patch.data } : x)));
    if (viewing?.id === patch.id) setViewing((v) => ({ ...v, data: patch.data }));
    setActivating(null);
  };

  const newInvoice = () => { setViewing(null); setCompany(""); setContact(""); setEmail(""); setAddress(""); setPo(""); setNote(""); setDiscountValue(""); setDiscountLabel(""); setDate(today); setStart(today); };

  const unpaid = (history || []).filter((x) => x.status === "unpaid");
  const overdue = unpaid.filter((x) => x.due_date < today);
  const unpaidTotal = unpaid.reduce((s, x) => s + Number(x.total || 0), 0);

  return (
    <div className="space-y-6">
      <div ref={topRef} className="grid scroll-mt-4 gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Kolom form punya scroll sendiri setinggi pratinjau (desktop), jadi
            menggulir form tidak ikut menggeser pratinjau; total & tombol
            simpan tetap terlihat di bawah. */}
        <div className="flex flex-col gap-3 lg:h-[min(72vh,760px)]">
          {viewing && (
            <div className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2.5 text-[12px] text-violet-100">
              Menampilkan invoice tersimpan <b>{viewing.number}</b>. Invoice tersimpan tidak dapat diubah.
              <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                <button type="button" onClick={() => duplicate(viewing)} className="font-semibold underline underline-offset-2">Duplikat untuk diperbaiki</button>
                <button type="button" onClick={newInvoice} className="font-semibold underline underline-offset-2">Buat invoice baru</button>
              </span>
            </div>
          )}
          <div className="space-y-3 lg:-mr-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
          <fieldset disabled={!!viewing} className="space-y-3">
            <div>
              <label className={lbl} htmlFor="inv-company">Nama perusahaan</label>
              <input id="inv-company" list="inv-orgs" className={field} value={viewing ? viewing.company : company} onChange={(e) => setCompany(e.target.value)} placeholder="Ketik nama perusahaan klien" autoComplete="off" />
              <datalist id="inv-orgs">{orgs.map((o) => <option key={o.name} value={o.name} />)}</datalist>
              {!viewing && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {matched ? `Klien ${PLANS[matched.plan].label} ditemukan: ${matched.members} anggota terdaftar, paket & data owner terisi otomatis.` : orgs.length ? `${orgs.length} klien berbayar tersedia di daftar saran.` : "Belum ada klien berbayar - isi data secara manual."}
                </p>
              )}
            </div>
            {!viewing && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Nama PIC</label><input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nama penanggung jawab" /></div>
                  <div><label className={lbl}>Email akun klien</label><input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@perusahaan.com" /></div>
                </div>
                {emailCheck && (
                  <p className={`-mt-1 text-[11.5px] ${emailCheck.status === "found" ? "text-emerald-300" : emailCheck.status === "checking" ? "text-slate-500" : "text-amber-300"}`}>
                    {emailCheck.status === "checking" ? "Memeriksa akun…"
                      : emailCheck.status === "invalid" ? "Format email belum valid."
                      : emailCheck.status === "notfound" ? "Belum ada akun Nexto dengan email ini. Periksa ejaannya, atau minta klien mendaftar dengan email ini."
                      : `Akun ditemukan: ${emailCheck.role === "owner" ? "owner" : emailCheck.role === "manager" ? "manager" : "anggota"} ${emailCheck.org_name || "organisasi tanpa nama"}, paket ${emailCheck.org_plan === "enterprise" ? "Enterprise" : "Free/perorangan"}.${emailCheck.role && emailCheck.role !== "owner" ? " Paket Enterprise diaktifkan ke akun owner." : ""}`}
                  </p>
                )}
                <div><label className={lbl}>Alamat perusahaan</label><textarea rows={2} className={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. ..., Kota, Kode pos" /></div>
                <div><label className={lbl}>Nomor PO klien (opsional)</label><input className={field} value={po} onChange={(e) => setPo(e.target.value)} placeholder="Misal: PO/2026/0153" /></div>
                <div>
                  <label className={lbl} htmlFor="inv-plan">Paket</label>
                  <select id="inv-plan" className={field} value={plan} onChange={(e) => choosePlan(e.target.value)}>
                    {Object.entries(PLANS).map(([k, p]) => (
                      <option key={k} value={k}>{k === "custom" ? "Custom (isi sendiri)" : `${p.label} - ${rp(priceOf(k))}/${p.unit}/bulan${p.minSeats > 1 ? `, min. ${p.minSeats}` : ""}`}</option>
                    ))}
                  </select>
                </div>
                {plan === "custom" && (
                  <>
                    <div><label className={lbl}>Deskripsi layanan</label><input className={field} value={customItem} onChange={(e) => setCustomItem(e.target.value)} placeholder="Misal: Nexto Enterprise + onboarding tim" /></div>
                    <div>
                      <label className={lbl} htmlFor="inv-actplan">Paket Nexto yang diaktifkan setelah lunas</label>
                      <select id="inv-actplan" className={field} value={activatePlan} onChange={(e) => setActivatePlan(e.target.value)}>
                        {ACTIVATE_AS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={lbl}>Jumlah {PLANS[plan].unit}</label><input type="number" min={PLANS[plan].minSeats} className={field} value={seats} onChange={(e) => setSeats(e.target.value)} /></div>
                  <div>
                    <label className={lbl}>Periode</label>
                    <select className={field} value={months} onChange={(e) => setMonths(e.target.value)}>
                      <option value={1}>1 bulan</option><option value={3}>3 bulan</option><option value={6}>6 bulan</option><option value={12}>12 bulan</option>
                    </select>
                  </div>
                  <div><label className={lbl}>Harga/{PLANS[plan].unit === "anggota tim" ? "anggota" : "pengguna"}</label><input type="number" min="0" step="1000" className={field} value={pricePerSeat} onChange={(e) => setPricePerSeat(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-[1fr_96px_110px] gap-3">
                  <div><label className={lbl}>Diskon (opsional)</label><input className={field} value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} placeholder="Misal: Diskon early bird" /></div>
                  <div>
                    <label className={lbl}>Jenis</label>
                    <select className={field} value={discountType} onChange={(e) => setDiscountType(e.target.value)}><option value="amount">Rp</option><option value="percent">%</option></select>
                  </div>
                  <div><label className={lbl}>Nilai</label><input type="number" min="0" className={field} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={lbl}>Tanggal invoice</label><input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></div>
                  <div><label className={lbl}>Mulai periode</label><input type="date" className={field} value={start} onChange={(e) => setStart(e.target.value)} /></div>
                  <div><label className={lbl}>Jatuh tempo</label>
                    <select className={field} value={dueDays} onChange={(e) => setDueDays(e.target.value)}>
                      <option value={3}>3 hari</option><option value={7}>7 hari</option><option value={14}>14 hari</option><option value={30}>30 hari</option>
                    </select>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-700 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={lbl}>Rekening tujuan transfer</div>
                      {seller.account
                        ? <div className="text-[13px] text-slate-100">{[seller.bank, seller.account].filter(Boolean).join(" ")}{seller.holder ? <span className="text-slate-400">, a.n. {seller.holder}</span> : null}</div>
                        : <div className="text-[12.5px] text-amber-300">Nomor rekening belum diisi, bagian Cara pembayaran di invoice akan kosong.</div>}
                    </div>
                    <button type="button" onClick={() => setShowSeller(true)} className="shrink-0 text-[12px] font-semibold text-violet-300 hover:text-violet-200">{seller.account ? "Ubah" : "Isi"}</button>
                  </div>
                </div>
                <div><label className={lbl}>Catatan (opsional)</label><textarea rows={2} className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: perpanjangan periode Oktober" /></div>

                <div className="rounded-lg border border-slate-700">
                  <button type="button" onClick={() => setShowSeller((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-semibold text-slate-300">
                    <span>Data penagih & penanda tangan
                      <span className={`ml-2 font-normal ${profileSync === "error" ? "text-amber-300" : "text-slate-500"}`}>
                        {profileSync === "loading" ? "Memuat…" : profileSync === "saving" ? "Menyimpan…" : profileSync === "error" ? "Belum tersimpan di server" : "Tersimpan di server"}
                      </span>
                    </span>
                    <span className="text-slate-500">{showSeller ? "Tutup" : "Ubah"}</span>
                  </button>
                  {showSeller && (
                    <div className="grid gap-2 border-t border-slate-700 p-3">
                      {[["name", "Nama usaha"], ["address", "Alamat"], ["email", "Email"], ["phone", "Telepon"], ["bank", "Nama bank"], ["account", "No. rekening"], ["holder", "Atas nama rekening"], ["signName", "Nama penanda tangan"], ["signTitle", "Jabatan penanda tangan"]].map(([k, l]) => (
                        <div key={k}><label className={lbl}>{l}</label><input className={field} value={seller[k] || ""} onChange={(e) => setSeller((s) => ({ ...s, [k]: e.target.value }))} /></div>
                      ))}
                      {[["signImage", "Tanda tangan digital"], ["stampImage", "Stempel (opsional)"]].map(([k, l]) => (
                        <div key={k}>
                          <label className={lbl}>{l}</label>
                          <div className="flex items-center gap-3">
                            <div className="flex h-14 w-32 shrink-0 items-center justify-center rounded-md bg-white">
                              {seller[k] ? <img src={seller[k]} alt="" className="max-h-12 max-w-[120px]" /> : <span className="text-[10.5px] text-slate-400">Belum ada</span>}
                            </div>
                            <label className="cursor-pointer rounded-md border border-slate-600 px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-slate-800">
                              {seller[k] ? "Ganti" : "Unggah"}
                              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (e) => {
                                const file = e.target.files?.[0]; e.target.value = "";
                                if (!file) return;
                                try { const dataUrl = await processSignatureFile(file, k === "stampImage" ? { maxW: 360, maxH: 360, keepColor: true } : undefined); setSeller((s) => ({ ...s, [k]: dataUrl })); }
                                catch (err) { alert(err.message); }
                              }} />
                            </label>
                            {seller[k] && <button type="button" onClick={() => setSeller((s) => ({ ...s, [k]: "" }))} className="text-[12px] text-slate-400 hover:text-rose-300">Hapus</button>}
                          </div>
                        </div>
                      ))}
                      <p className="text-[11px] text-slate-500">Foto tanda tangan di kertas putih dengan pulpen hitam/biru - latar putihnya dihapus otomatis. Semua data ini disimpan di perangkat ini; invoice yang sudah tersimpan tetap memakai tanda tangan saat invoice dibuat.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </fieldset>
          </div>

          <div className="shrink-0 space-y-1.5">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/70 px-3 py-2.5">
            <div>
              <div className="text-[11px] text-slate-400">Total tagihan</div>
              <div className="font-mono text-[17px] font-bold text-slate-50">{rp(total)}</div>
            </div>
            {viewing ? (
              <button type="button" onClick={() => printHtml(html)} className="rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-400">Unduh PDF</button>
            ) : (
              <button type="button" disabled={busy} onClick={saveAndPrint} className="rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-400 disabled:opacity-60">{busy ? "Menyimpan…" : "Simpan & unduh PDF"}</button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Pada jendela cetak, pilih "Simpan sebagai PDF".</p>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-700 bg-white">
          <iframe ref={frameRef} title="Pratinjau invoice" srcDoc={initialHtml} onLoad={syncFrame} className="block h-[min(72vh,760px)] w-full bg-white" />
        </div>
      </div>

      {/* Riwayat invoice */}
      <div className="rounded-xl border border-slate-700">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <div className="text-[13px] font-semibold text-slate-100">Riwayat invoice</div>
          {history && history.length > 0 && (
            <div className="text-[12px] text-slate-400">
              Belum dibayar <span className="font-mono font-semibold text-amber-300">{rp(unpaidTotal)}</span> dari {unpaid.length} invoice
              {overdue.length > 0 && <span className="text-rose-300">, {overdue.length} lewat jatuh tempo</span>}
            </div>
          )}
        </div>
        {history === null ? (
          <p className="px-4 py-4 text-[12px] text-slate-500">Memuat riwayat…</p>
        ) : historyErr ? (
          <p className="px-4 py-4 text-[12px] text-rose-300">Riwayat gagal dimuat: {historyErr}</p>
        ) : history.length === 0 ? (
          <p className="px-4 py-4 text-[12px] text-slate-500">Belum ada invoice tersimpan. Invoice pertama akan bernomor 0001.</p>
        ) : (
          <div className="max-h-[360px] overflow-auto overscroll-contain">
            <table className="w-full min-w-[860px] text-[12.5px]">
              <thead className="sticky top-0 bg-[#0b0f17] text-left text-[11px] text-slate-400">
                <tr><th className="px-4 py-2 font-semibold">Nomor</th><th className="px-2 py-2 font-semibold">Klien</th><th className="px-2 py-2 font-semibold">Tanggal</th><th className="px-2 py-2 font-semibold">Jatuh tempo</th><th className="px-2 py-2 text-right font-semibold">Total</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-2 py-2 font-semibold">Paket</th><th className="px-4 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {history.map((x) => {
                  const late = x.status === "unpaid" && x.due_date < today;
                  return (
                    <tr key={x.id} className={viewing?.id === x.id ? "bg-violet-500/10" : ""}>
                      <td className="px-4 py-2 font-mono text-slate-200">{x.number}</td>
                      <td className="max-w-[200px] truncate px-2 py-2 text-slate-200">{x.company}</td>
                      <td className="px-2 py-2 text-slate-400">{fmtShort(x.invoice_date)}</td>
                      <td className={`px-2 py-2 ${late ? "font-semibold text-rose-300" : "text-slate-400"}`}>{fmtShort(x.due_date)}{late ? " (lewat)" : ""}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-100">{rp(x.total)}</td>
                      <td className="px-2 py-2">
                        <select value={x.status} disabled={!!x.data?.activation} title={x.data?.activation ? "Paket sudah diaktifkan dari invoice ini" : undefined} onChange={(e) => setStatus(x, e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[12px]" style={{ color: x.status === "paid" ? "#86efac" : x.status === "void" ? "#94a3b8" : "#fcd34d" }} aria-label={`Status ${x.number}`}>
                          <option value="unpaid">Belum dibayar</option><option value="paid">Lunas</option><option value="void">Dibatalkan</option>
                        </select>
                        {x.status === "paid" && x.paid_at && (
                          <button type="button" onClick={() => setPaying(x)} className="mt-0.5 block text-[11px] text-slate-400 hover:text-slate-200" title="Ubah tanggal pembayaran">Dibayar {fmtShort(isoDay(new Date(x.paid_at)))}</button>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {x.data?.activation ? (
                          <span className="text-[12px] text-emerald-300" title={`Diaktifkan ${fmtWib(x.data.activation.at)} untuk ${x.data.activation.email}`}>Aktif s.d. {fmtShort(isoDay(new Date(x.data.activation.expires_at)))}</span>
                        ) : x.status === "paid" && PLANS[x.data?.plan] ? (
                          <button type="button" onClick={() => setActivating(x)} className="rounded-md border border-violet-400/50 px-2 py-1 text-[12px] font-semibold text-violet-200 hover:bg-violet-500/15">Aktifkan paket</button>
                        ) : (
                          <span className="text-[12px] text-slate-500">{x.status === "void" ? "-" : "Menunggu pembayaran"}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => duplicate(x)} className="mr-3 font-semibold text-slate-400 hover:text-slate-200" title="Salin isi invoice ini ke form baru">Duplikat</button>
                        {viewing?.id === x.id
                          ? <button type="button" onClick={newInvoice} className="font-semibold text-slate-300 hover:text-white">Tutup</button>
                          : <button type="button" onClick={() => { setViewing(x); topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="font-semibold text-violet-300 hover:text-violet-200">Lihat</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {paying && <PaidDateDialog invoice={paying} onClose={() => setPaying(null)} onSave={(inv, d) => setStatus(inv, "paid", d)} />}
      {activating && <ActivateDialog invoice={activating} onClose={() => setActivating(null)} onDone={onActivated} />}
    </div>
  );
}
