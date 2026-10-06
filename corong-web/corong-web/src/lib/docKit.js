// Perkakas dokumen bersama (dipindahkan dari EnterpriseInvoicePanel, 7 Okt 2026):
// terbilang rupiah, pengolah foto tanda tangan/stempel, dan cetak ke PDF.
// Dipakai invoice langganan Nexto (admin) dan fitur Quotation & Invoice client.

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

// Cetak dokumen lewat iframe sementara (dialog cetak -> "Simpan sebagai PDF").
export function printHtml(html) {
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

// Perkecil gambar (logo) jadi data URL ringan. PNG bila kecil (transparansi
// terjaga), kalau lebih dari ~150 KB dialihkan ke JPEG berlatar putih.
// Dibaca sebagai data: URL, bukan blob: - CSP production memblokir blob: untuk
// sebagian konteks (lihat catatan decodeImage di atas).
export async function resizeImageToDataUrl(file, { maxW = 420, maxH = 160 } = {}) {
  if (!file || !/^image\/(png|jpe?g|webp|gif)$/i.test(file.type || "")) throw new Error("Pilih gambar PNG, JPG, atau WebP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Ukuran gambar terlalu besar (maks 8 MB).");
  const src = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Gambar tidak bisa dibaca."));
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Gambar tidak bisa dibuka. Coba format PNG atau JPG."));
    i.src = src;
  });
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const draw = (bg) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    return c;
  };
  const png = draw(null).toDataURL("image/png");
  if (png.length <= 150 * 1024) return png;
  return draw("#ffffff").toDataURL("image/jpeg", 0.85);
}
