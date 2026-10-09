// Pembaca file import yang lebih pintar (9 Okt 2026, permintaan Nando: "baca semua kolom yang ada di data file client
// apapun bentuknya"). Semua fungsi di sini MURNI (tanpa AI, tanpa jaringan) sehingga gratis dan bisa diuji di Node:
//  - detectHeaderRow: mencari baris judul sebenarnya meski ada baris judul laporan, logo, atau baris kosong di atas.
//  - profileColumns / smartMapping: menebak isi kolom dari JUDUL dan dari ISI DATA (email, telepon, nilai rupiah, tanggal,
//    status tahap, prioritas, nama perusahaan, kota), termasuk kolom yang judulnya tidak jelas.
//  - normalizer nilai: telepon, rupiah ("Rp 1,5 jt"), tanggal (serial Excel, 05/10/2026, "5 Okt 2026"), prioritas,
//    tahap pipeline (fuzzy ke tahap milik organisasi), penanggung jawab (fuzzy ke nama anggota tim).
//  - suggestExtras: kolom sisa yang belum terpetakan diusulkan jadi field custom, atau dititipkan ke catatan lead.
// Hasilnya hanya TEBAKAN AWAL; pengguna tetap meninjau di layar pemetaan sebelum data masuk.

const norm = (s) => String(s ?? "").toLowerCase().replace(/\u00a0/g, " ").replace(/[_\-./]+/g, " ").replace(/\s+/g, " ").trim();
const isBlank = (v) => v === null || v === undefined || String(v).trim() === "";

// ---------------------------------------------------------------------------
// Sinonim judul kolom untuk field yang BELUM ditangani pemetaan dasar di Leads.jsx.
// ---------------------------------------------------------------------------
export const EXTRA_FIELD_KEYS = {
  deal_value: ["nilai deal", "nilai proyek", "nilai penawaran", "nilai sph", "nilai kontrak", "nilai po", "nilai order", "nilai", "omzet", "omset", "nominal", "harga penawaran", "harga", "budget", "anggaran", "deal value", "contract value", "order value", "amount", "revenue", "value", "total"],
  deal_date: ["tanggal deal", "tgl deal", "tanggal closing", "tgl closing", "tanggal po", "tgl po", "tanggal kontrak", "tgl kontrak", "closing date", "deal date", "won date"],
  created_at: ["tanggal masuk", "tgl masuk", "tanggal input", "tgl input", "tanggal dibuat", "tgl dibuat", "tanggal lead", "tanggal data masuk", "created at", "created date", "created time", "date created", "date added", "entry date", "tanggal"],
  last_contact: ["kontak terakhir", "terakhir dihubungi", "tanggal follow up", "tgl follow up", "tanggal fu", "tgl fu", "follow up terakhir", "last contact", "last contacted", "last follow up", "last activity"],
  source: ["sumber lead", "sumber data", "sumber", "asal lead", "asal data", "channel", "lead source", "source", "referral", "referensi"],
  stage_key: ["tahap", "stage", "status lead", "status pipeline", "status progress", "status penawaran", "status", "progress status", "fase"],
  priority: ["prioritas", "priority", "level prioritas", "temperature", "kehangatan", "hot warm cold"],
  next_action: ["tindak lanjut", "tindakan selanjutnya", "rencana tindak lanjut", "next action", "next step", "rencana", "follow up plan", "action plan"],
  assigned_name: ["sales", "marketing", "petugas", "pic sales", "pic marketing", "handled by", "assigned to", "owner lead", "penanggung jawab lead", "account manager", "am", "salesman", "sales person", "nama sales", "nama marketing"],
  category: ["kategori", "category", "jenis usaha", "bidang usaha", "industri", "industry", "segmen", "segment", "sektor"],
  company_type: ["tipe perusahaan", "jenis perusahaan", "skala", "company type", "tipe customer", "jenis customer", "tipe"],
  address: ["alamat", "address", "lokasi", "location", "alamat lengkap", "alamat proyek", "lokasi proyek"],
};

// Kolom yang tidak berisi data lead yang berguna.
const JUNK_HEADERS = /^(no|no\.|nomor|#|id|uuid|idx|index|urut|no urut|nomor urut|row|baris|sl|sn|s\/n)$/i;

// ---------------------------------------------------------------------------
// Normalizer nilai
// ---------------------------------------------------------------------------
export function normalizePhone(v) {
  let s = String(v ?? "").trim();
  if (!s) return "";
  // beberapa nomor dalam satu sel: ambil yang pertama
  s = s.split(/[\/;,\n]| atau | dan /i)[0].trim();
  s = s.replace(/^p:/i, "").replace(/^wa[:\s]/i, "");
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(s)) { try { s = BigInt(Math.round(Number(s))).toString(); } catch { /* biarkan */ } } // 6.2812E+11
  let d = s.replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("+")) return d;
  if (d.startsWith("62")) return `+${d}`;
  if (d.startsWith("0")) return d;
  if (/^8\d{8,11}$/.test(d)) return `0${d}`; // Excel membuang angka 0 di depan
  return d;
}

export function looksLikePhone(v) {
  const s = String(v ?? "").trim();
  if (!s || /[a-z]{3,}/i.test(s.replace(/e\+?\d+$/i, ""))) return false;
  const d = normalizePhone(s).replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 && /^(0|62|8)/.test(d);
}
export function looksLikeEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? "").trim()); }
export function looksLikeUrl(v) { return /^(https?:\/\/|www\.)\S+$/i.test(String(v ?? "").trim()) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|co\.id|id|net|org|biz|co|io|web\.id)(\/\S*)?$/i.test(String(v ?? "").trim()); }

// "Rp 1.500.000", "1,5 jt", "250rb", "3 M", "1.250.000,50", 1500000 -> angka (rupiah). Tidak yakin -> null.
export function parseMoney(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/rp\.?|idr|usd|\$|\s/g, "");
  let mult = 1;
  const m = s.match(/(miliar|milyar|juta|jt|ribu|rb|m|k)$/);
  if (m) {
    mult = { miliar: 1e9, milyar: 1e9, juta: 1e6, jt: 1e6, ribu: 1e3, rb: 1e3, m: 1e9, k: 1e3 }[m[1]];
    s = s.slice(0, -m[1].length);
  }
  if (!/^[\d.,]+$/.test(s)) return null;
  // pemisah: titik dan koma. Pola Indonesia 1.234.567,89; Inggris 1,234,567.89
  const dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
  let n;
  if (dots && commas) {
    n = s.lastIndexOf(",") > s.lastIndexOf(".") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s.replace(/,/g, ""));
  } else if (dots > 1 || commas > 1) {
    n = Number(s.replace(/[.,]/g, ""));
  } else if (dots === 1 || commas === 1) {
    const sep = dots ? "." : ",";
    const [a, b] = s.split(sep);
    // tiga digit setelah pemisah dan tanpa pengali = ribuan ("1.500"); selain itu desimal ("1,5 jt")
    n = b.length === 3 && !m ? Number(a + b) : Number(`${a}.${b}`);
  } else n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * mult);
}

const MONTHS_ID = { jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, aug: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, nov: 11, november: 11, nop: 11, des: 12, desember: 12, dec: 12 };
const iso = (y, m, d) => (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null);
// Date (dari XLSX cellDates), serial Excel, "05/10/2026", "5-10-26", "2026-10-05", "5 Okt 2026" -> "YYYY-MM-DD" atau null.
export function parseDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
    return null;
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return iso(y, +m[2], +m[1]); } // format Indonesia: hari/bulan/tahun
  m = s.match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{2,4})/i);
  if (m && MONTHS_ID[m[2].toLowerCase()]) { let y = +m[3]; if (y < 100) y += 2000; return iso(y, MONTHS_ID[m[2].toLowerCase()], +m[1]); }
  if (/^\d{5}$/.test(s)) return parseDate(Number(s));
  return null;
}

export function normalizePriority(v) {
  const s = norm(v);
  if (!s) return "";
  if (/^(high|tinggi|hot|a|p1|1|urgent|penting|prioritas tinggi)$/.test(s)) return "high";
  if (/^(medium|sedang|warm|b|p2|2|normal)$/.test(s)) return "medium";
  if (/^(low|rendah|cold|c|p3|3)$/.test(s)) return "low";
  return "";
}

// Dua teks "sama" untuk pencocokan nama tahap / nama anggota: huruf kecil, tanpa tanda baca, boleh saling memuat.
const squash = (s) => norm(s).replace(/[^a-z0-9 ]/g, "").trim();
function similarity(a, b) {
  const x = squash(a), y = squash(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) / Math.max(x.length, y.length) * 0.5 + 0.5;
  const xt = new Set(x.split(" ")), yt = new Set(y.split(" "));
  const inter = [...xt].filter((t) => yt.has(t)).length;
  return inter / Math.max(xt.size, yt.size);
}

// Sinonim umum nama tahap pipeline -> kata yang biasa ada di label tahap organisasi.
const STAGE_HINTS = [
  [/baru|new|masuk|incoming|data masuk|prospek|prospect|cold/, ["baru", "new", "masuk", "prospek", "lead"]],
  [/follow|fu|hubungi|kontak|contact|proses|progress|jalan/, ["follow", "kontak", "contact", "progress", "proses"]],
  [/sph|penawaran|quotation|quote|proposal|offer/, ["sph", "penawaran", "quotation", "proposal"]],
  [/hot|panas|negosiasi|nego|closing soon/, ["hot", "nego", "negosiasi"]],
  [/deal|menang|won|closing|closed won|goal|kontrak|spk|po\b|sukses/, ["deal", "menang", "won", "kontrak", "closing"]],
  [/no deal|gagal|lost|batal|cancel|tidak jadi|drop|kalah|reject|tolak/, ["no deal", "lost", "kalah", "gagal", "batal"]],
];
// stages: [{ key, label, type }]. Balikan: key tahap atau null bila tidak yakin.
export function matchStage(value, stages) {
  const v = String(value ?? "").trim();
  if (!v || !stages?.length) return null;
  let best = null, bestScore = 0;
  for (const st of stages) {
    const sc = Math.max(similarity(v, st.label), similarity(v, st.key));
    if (sc > bestScore) { best = st; bestScore = sc; }
  }
  if (best && bestScore >= 0.6) return best.key;
  const nv = norm(v);
  for (const [re, words] of STAGE_HINTS) {
    if (!re.test(nv)) continue;
    const isLost = words.includes("lost"), isWon = words.includes("won");
    const cand = stages.filter((st) => (isLost ? st.type === "lost" : isWon ? st.type === "won" : st.type === "normal") || words.some((w) => squash(`${st.label} ${st.key}`).includes(w)));
    const byWord = cand.find((st) => words.some((w) => squash(`${st.label} ${st.key}`).includes(w)));
    if (byWord) return byWord.key;
  }
  return null;
}

// members: [{ user_id, display_name }]. Cocok nama persis / mengandung / kata pertama sama. Balikan: user_id atau null.
export function matchMember(value, members) {
  const v = squash(value);
  if (!v || !members?.length) return null;
  let best = null, bestScore = 0;
  for (const m of members) {
    const n = squash(m.display_name || m.name || "");
    if (!n) continue;
    let sc = similarity(v, n);
    if (sc < 0.7 && v.split(" ")[0] === n.split(" ")[0] && v.split(" ")[0].length >= 3) sc = 0.75;
    if (sc > bestScore) { best = m; bestScore = sc; }
  }
  return best && bestScore >= 0.7 ? best.user_id : null;
}

// ---------------------------------------------------------------------------
// Baris judul
// ---------------------------------------------------------------------------
const ALL_KEYS = () => [
  ...Object.values(EXTRA_FIELD_KEYS).flat(),
  "nama", "name", "perusahaan", "company", "customer", "email", "telepon", "phone", "hp", "wa", "whatsapp", "kota", "city", "provinsi", "jabatan",
  "produk", "product", "website", "catatan", "keterangan", "notes", "pic", "kontak", "contact",
];
function hasKey(cell, key) {
  const h = ` ${norm(cell)} `;
  return h.includes(` ${key} `) || (key.length >= 5 && h.includes(key));
}
function rowScore(row, nextRows) {
  const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean);
  if (cells.length < 2) return 0;
  const textual = cells.filter((c) => Number.isNaN(Number(c.replace(/[.,]/g, ""))) && c.length <= 45).length;
  if (textual < Math.max(2, cells.length * 0.6)) return 0;
  const keys = ALL_KEYS();
  const hits = cells.filter((c) => keys.some((k) => hasKey(c, k))).length;
  // baris data berikutnya harus memuat isi (bukan kosong)
  const filledNext = nextRows.slice(0, 3).filter((r) => r.some((c) => !isBlank(c))).length;
  if (!filledNext) return 0;
  return hits * 3 + textual * 0.5 + (cells.length >= 3 ? 1 : 0);
}
// rows: array of array (tanpa baris kosong). Balikan indeks baris judul (0 bila tidak ada petunjuk lain).
export function detectHeaderRow(rows) {
  let best = 0, bestScore = -1;
  const limit = Math.min(rows.length - 1, 15);
  for (let i = 0; i < limit; i++) {
    const sc = rowScore(rows[i] || [], rows.slice(i + 1));
    if (sc > bestScore + 0.01) { best = i; bestScore = sc; }
  }
  return bestScore > 0 ? best : 0;
}

// ---------------------------------------------------------------------------
// Profil kolom dari isi data
// ---------------------------------------------------------------------------
const CITY_WORDS = ["jakarta", "bandung", "surabaya", "semarang", "yogyakarta", "jogja", "medan", "makassar", "palembang", "tangerang", "bekasi", "depok", "bogor", "malang", "denpasar", "bali", "balikpapan", "pontianak", "banjarmasin", "batam", "pekanbaru", "padang", "manado", "samarinda", "cikarang", "karawang", "sidoarjo", "gresik", "solo", "surakarta", "cirebon", "tasikmalaya", "serang", "cilegon", "lampung", "bandar lampung", "jambi", "pontianak", "kupang", "mataram", "ambon", "jayapura", "banten", "jawa barat", "jawa tengah", "jawa timur", "sumatera", "kalimantan", "sulawesi"];
const COMPANY_WORDS = /\b(pt|cv|ud|pd|tbk|toko|pabrik|koperasi|yayasan|firma|persero|group|grup|corp|inc|ltd|co|indonesia|jaya|abadi|mandiri|sejahtera|makmur|utama|sentosa|karya|bangun|property|konstruksi|contractor|kontraktor)\b/i;

export function profileColumns(dataRows, numCols) {
  const sample = dataRows.slice(0, 300);
  const cols = [];
  for (let c = 0; c < numCols; c++) {
    const vals = sample.map((r) => r[c]).filter((v) => !isBlank(v));
    const n = vals.length;
    const strs = vals.map((v) => (v instanceof Date ? "date" : String(v).trim()));
    const frac = (fn) => (n ? vals.filter(fn).length / n : 0);
    const distinct = new Set(strs.map((s) => s.toLowerCase()));
    const numeric = vals.filter((v) => typeof v === "number" || /^[\d.,\s]+$/.test(String(v)));
    cols.push({
      index: c, filled: sample.length ? n / sample.length : 0, n,
      email: frac((v) => looksLikeEmail(v)),
      phone: frac((v) => typeof v !== "boolean" && looksLikePhone(v)),
      url: frac((v) => looksLikeUrl(v)),
      date: frac((v) => parseDate(v) !== null && !(typeof v === "number" && v < 20000)),
      money: frac((v) => { const m = parseMoney(v); return m !== null && m >= 1000; }),
      numeric: n ? numeric.length / n : 0,
      unique: n ? distinct.size / n : 0,
      distinct: distinct.size,
      avgLen: n ? strs.reduce((s, x) => s + x.length, 0) / n : 0,
      city: frac((v) => CITY_WORDS.some((w) => norm(v) === w || norm(v).startsWith(`${w} `) || norm(v).endsWith(` ${w}`))),
      company: frac((v) => COMPANY_WORDS.test(String(v))),
      values: [...distinct].slice(0, 30),
    });
  }
  return cols;
}

// ---------------------------------------------------------------------------
// Pemetaan pintar: melengkapi pemetaan dasar (baseMapping dari judul kolom) dengan field tambahan + isi data.
// ctx: { stages, members } untuk membantu menebak kolom status dan kolom nama sales.
// Balikan: { mapping, reasons: { [colIndex]: "judul kolom" | "isi data" }, profiles }
// ---------------------------------------------------------------------------
export function smartMapping(headers, dataRows, baseMapping = {}, ctx = {}) {
  const numCols = Math.max(headers.length, ...dataRows.slice(0, 50).map((r) => r.length), 0);
  const profiles = profileColumns(dataRows, numCols);
  const mapping = { ...baseMapping };
  const reasons = {};
  const used = new Set(Object.values(mapping).filter((v) => v !== null && v !== undefined));
  for (const idx of used) reasons[idx] = "judul kolom";
  const H = (i) => norm(headers[i] ?? "");
  const free = (i) => !used.has(i);
  const take = (field, i, why) => { mapping[field] = i; used.add(i); reasons[i] = why; };

  // 1. Judul kolom untuk field tambahan (kunci panjang/spesifik lebih dulu karena daftar sudah berurutan spesifik -> umum).
  for (const [field, keys] of Object.entries(EXTRA_FIELD_KEYS)) {
    if (mapping[field] !== undefined) continue;
    let found = null;
    for (const k of keys) {
      for (let i = 0; i < numCols; i++) {
        if (!free(i) || JUNK_HEADERS.test(H(i)) || !H(i)) continue;
        const h = ` ${H(i)} `;
        const ok = k.length <= 3 ? h.includes(` ${k} `) : h.includes(` ${k} `) || (k.length >= 6 && h.includes(k));
        if (!ok) continue;
        // jangan merebut kolom tanggal/nilai oleh kata umum ("tanggal" tanpa kata kunci lain hanya bila isinya tanggal)
        if (field === "created_at" && k === "tanggal" && profiles[i].date < 0.6) continue;
        if (field === "deal_value" && ["nilai", "harga", "total", "value", "amount"].includes(k) && profiles[i].money < 0.5 && profiles[i].numeric < 0.6) continue;
        if (field === "stage_key" && k === "status" && profiles[i].distinct > 25) continue;
        if (field === "category" && k === "tipe") continue;
        found = i; break;
      }
      if (found !== null) break;
    }
    if (found !== null) take(field, found, "judul kolom");
  }

  // 2. Dari ISI data untuk field yang masih kosong.
  const best = (pred) => {
    let bi = null, bs = 0;
    for (let i = 0; i < numCols; i++) {
      if (!free(i) || JUNK_HEADERS.test(H(i))) continue;
      const sc = pred(profiles[i], i);
      if (sc > bs) { bi = i; bs = sc; }
    }
    return bi;
  };
  if (mapping.email === undefined) { const i = best((p) => (p.email >= 0.5 && p.n >= 2 ? p.email : 0)); if (i !== null) take("email", i, "isi data"); }
  if (mapping.phone === undefined) { const i = best((p) => (p.phone >= 0.6 && p.n >= 2 && p.email < 0.3 ? p.phone : 0)); if (i !== null) take("phone", i, "isi data"); }
  if (mapping.website === undefined) { const i = best((p) => (p.url >= 0.6 && p.email < 0.3 ? p.url : 0)); if (i !== null) take("website", i, "isi data"); }
  if (mapping.city === undefined) { const i = best((p) => (p.city >= 0.5 ? p.city : 0)); if (i !== null) take("city", i, "isi data"); }
  if (mapping.deal_value === undefined) {
    const i = best((p, idx) => (p.money >= 0.6 && p.phone < 0.5 && p.date < 0.5 && /nilai|harga|omzet|omset|value|amount|budget|rp|total|nominal/.test(H(idx)) ? p.money : 0));
    if (i !== null) take("deal_value", i, "isi data");
  }
  if (mapping.stage_key === undefined && ctx.stages?.length) {
    const i = best((p) => {
      if (p.distinct > 14 || p.n < 2) return 0;
      const hit = p.values.filter((v) => matchStage(v, ctx.stages)).length;
      return hit / Math.max(p.values.length, 1) >= 0.6 ? 0.6 + p.filled / 10 : 0;
    });
    if (i !== null) take("stage_key", i, "isi data");
  }
  if (mapping.priority === undefined) {
    const i = best((p) => (p.distinct <= 6 && p.n >= 2 && p.values.length && p.values.every((v) => normalizePriority(v)) ? 0.9 : 0));
    if (i !== null) take("priority", i, "isi data");
  }
  if (mapping.assigned_name === undefined && ctx.members?.length) {
    const i = best((p) => {
      if (p.n < 2 || p.distinct > 30) return 0;
      const hit = p.values.filter((v) => matchMember(v, ctx.members)).length;
      return hit / Math.max(p.values.length, 1) >= 0.6 ? 0.7 : 0;
    });
    if (i !== null) take("assigned_name", i, "isi data");
  }
  // Nama lead: kolom teks paling unik dan mirip nama perusahaan.
  if (mapping.name === undefined) {
    const i = best((p) => (p.unique >= 0.7 && p.avgLen >= 4 && p.avgLen <= 60 && p.numeric < 0.3 && p.email < 0.3 && p.phone < 0.3 && p.url < 0.3 && p.date < 0.3 ? 0.4 + p.company + p.unique * 0.3 + p.filled * 0.2 : 0));
    if (i !== null) take("name", i, "isi data");
  }
  return { mapping, reasons, profiles };
}

// Kolom yang belum terpetakan tapi punya isi: diusulkan jadi field custom (sebanyak slot kosong), sisanya dititipkan ke catatan.
export function suggestExtras(headers, mapping, profiles, freeSlots = 0) {
  const used = new Set(Object.values(mapping).filter((v) => v !== null && v !== undefined));
  const cands = [];
  for (let i = 0; i < profiles.length; i++) {
    const label = String(headers[i] ?? "").trim();
    if (used.has(i) || !label || JUNK_HEADERS.test(label)) continue;
    if (profiles[i].filled < 0.15 || profiles[i].n < 2) continue;
    cands.push({ colIndex: i, label: label.slice(0, 40), filled: profiles[i].filled, distinct: profiles[i].distinct });
  }
  // kolom yang kaya (terisi banyak, nilainya beragam) jadi custom lebih dulu
  cands.sort((a, b) => b.filled * Math.min(b.distinct, 20) - a.filled * Math.min(a.distinct, 20));
  return { custom: cands.slice(0, Math.max(0, freeSlots)), notes: cands.slice(Math.max(0, freeSlots)) };
}
