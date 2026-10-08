// Impor data biaya iklan dari ekspor Meta / TikTok / Google Ads (Excel atau CSV).
// Dipakai AdsImportModal; hasilnya disimpan ke tabel ad_spend dan dianalisis di tab Laporan.

export const AD_PLATFORMS = ["Meta", "Instagram", "TikTok", "Google", "Lainnya"];

// Nama sumber/platform apa pun -> nama baku (sama untuk lead dan baris iklan).
export function normalizePlatform(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const l = s.toLowerCase();
  if (/(^|\W)(meta|facebook|fb)(\W|$)/.test(l) || l.startsWith("meta")) return "Meta";
  if (/instagram|(^|\W)ig(\W|$)/.test(l)) return "Instagram";
  if (/tiktok|tik tok/.test(l)) return "TikTok";
  if (/google|youtube|gads/.test(l)) return "Google";
  return s.length > 40 ? s.slice(0, 40) : s;
}

// "Rp1.234.567", "1,234,567.00", "1.234,5", 1234567 -> angka.
export function parseMoney(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (!s || s === "-") return 0;
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    s = s.split(dec === "." ? "," : ".").join("").replace(dec, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = s.split(sep);
    const tail = parts[parts.length - 1];
    // satu pemisah diikuti tepat 3 digit = ribuan; selain itu desimal
    if (parts.length > 2 || tail.length === 3) s = parts.join("");
    else s = parts.join(".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export const parseCount = (v) => Math.max(0, Math.round(parseMoney(v)));

const ID_MONTHS = { jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", mei: "May", jun: "Jun", jul: "Jul", agu: "Aug", agt: "Aug", agustus: "Aug", sep: "Sep", sept: "Sep", okt: "Oct", nov: "Nov", des: "Dec" };
const pad = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Tanggal (objek Date, serial Excel, atau teks) -> "YYYY-MM-DD" atau null.
export function parseDay(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : isoOf(v);
  if (typeof v === "number" && v > 30000 && v < 80000) return isoOf(new Date(Math.round((v - 25569) * 86400000) + 12 * 3600000));
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  const en = s.replace(/[A-Za-z]+/g, (w) => ID_MONTHS[w.toLowerCase()] || w);
  const t = Date.parse(en);
  if (!Number.isNaN(t)) return isoOf(new Date(t));
  return null;
}

const KEYS = {
  campaign: ["campaign name", "nama kampanye", "campaign", "kampanye", "ad group name", "ad set name"],
  day: ["reporting starts", "mulai pelaporan", "stat time day", "by day", "day", "date", "tanggal", "hari"],
  spend: ["amount spent", "jumlah yang dibelanjakan", "total cost", "spend", "cost", "biaya", "total biaya", "amount"],
  impressions: ["impressions", "impression", "tayangan", "impresi"],
  clicks: ["link clicks", "clicks (all)", "clicks", "click", "klik"],
  results: ["results", "hasil", "leads", "lead", "conversions", "conversion", "konversi"],
  platform: ["publisher platform", "platform", "channel", "network", "sumber"],
};

// Tebak kolom dari judul: cocok persis dulu, lalu diawali, lalu mengandung. Judul rasio
// (per hasil, CPC, CTR, persen) tidak dipakai agar tidak tertukar dengan angka totalnya.
const RATIO_RE = /(per|cpc|cpm|ctr|cpa|rate|%|rata)/i;
export function guessAdColumns(headers) {
  const norm = headers.map((h) => String(h ?? "").trim().toLowerCase());
  const out = {};
  const used = new Set();
  for (const [field, keys] of Object.entries(KEYS)) {
    let hit = -1;
    for (const pass of [0, 1, 2]) {
      for (const k of keys) {
        hit = norm.findIndex((h, idx) => {
          if (!h || used.has(idx)) return false;
          if (pass === 0) return h === k;
          if (RATIO_RE.test(h)) return false;
          return pass === 1 ? h.startsWith(k) : h.includes(k);
        });
        if (hit >= 0) break;
      }
      if (hit >= 0) break;
    }
    if (hit >= 0) { out[field] = hit; used.add(hit); }
  }
  return out;
}

// Baris judul = baris pertama yang punya kolom biaya dan paling sedikit 3 sel terisi.
export function findHeaderRow(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const row = aoa[i] || [];
    if (row.filter((c) => String(c ?? "").trim()).length < 3) continue;
    if (guessAdColumns(row).spend !== undefined) return i;
  }
  return 0;
}

const TOTAL_RE = /^(total|grand total|results from|jumlah|subtotal)/i;

// Ubah isi sheet jadi baris siap simpan. fallbackDay dipakai bila tidak ada kolom tanggal.
export function buildAdRows(aoa, headerRow, mapping, { platform, fallbackDay }) {
  const merged = new Map();
  let skipped = 0;
  for (let i = headerRow + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const get = (f) => (mapping[f] === undefined || mapping[f] === null || mapping[f] === "" ? "" : r[Number(mapping[f])]);
    if (!r.some((c) => String(c ?? "").trim())) continue;
    const campaign = String(get("campaign") ?? "").trim().slice(0, 200);
    if (TOTAL_RE.test(campaign)) { skipped++; continue; }
    const spend = parseMoney(get("spend"));
    const rowPlatform = normalizePlatform(get("platform")) || platform;
    const day = mapping.day !== undefined && mapping.day !== "" ? parseDay(get("day")) : fallbackDay;
    if (!day || !rowPlatform || spend <= 0) { skipped++; continue; }
    const key = `${rowPlatform}|${campaign}|${day}`;
    const cur = merged.get(key) || { platform: rowPlatform, campaign, day, spend: 0, impressions: 0, clicks: 0, results: 0 };
    cur.spend += spend;
    cur.impressions += parseCount(get("impressions"));
    cur.clicks += parseCount(get("clicks"));
    cur.results += parseCount(get("results"));
    merged.set(key, cur);
  }
  return { rows: [...merged.values()], skipped };
}

// ---------------------------------------------------------------------------
// Data LEAD dari iklan (Meta Instant Form / Leads Center, TikTok Lead Gen, Google lead form):
// ekspor yang berisi kontak, bukan biaya. Diubah jadi lead Nexto (tahap pertama, sumber = platform).
// ---------------------------------------------------------------------------
const LEAD_KEYS = {
  name: ["full_name", "full name", "nama lengkap", "lead name", "contact name", "nama", "name"],
  company: ["company_name", "company name", "nama perusahaan", "perusahaan", "business name", "company"],
  phone: ["phone_number", "phone number", "nomor telepon", "no. hp", "no hp", "whatsapp", "telepon", "phone", "mobile", "hp"],
  email: ["email address", "e-mail", "email"],
  city: ["city", "kota", "alamat", "address", "location", "lokasi"],
  campaign: ["campaign_name", "campaign name", "nama kampanye", "kampanye", "campaign", "form name", "ad name"],
  day: ["created_time", "created time", "date created", "submitted", "created", "tanggal", "date", "waktu"],
  notes: ["catatan", "keterangan", "message", "pesan", "notes", "comment"],
  platform: ["publisher platform", "platform", "sumber", "source"],
};

export function guessLeadColumns(headers) {
  const norm = headers.map((h) => String(h ?? "").trim().toLowerCase());
  const out = {};
  const used = new Set();
  for (const [field, keys] of Object.entries(LEAD_KEYS)) {
    let hit = -1;
    for (const pass of [0, 1, 2]) {
      for (const k of keys) {
        hit = norm.findIndex((h, idx) => {
          if (!h || used.has(idx)) return false;
          if (pass === 0) return h === k;
          return pass === 1 ? h.startsWith(k) : h.includes(k);
        });
        if (hit >= 0) break;
      }
      if (hit >= 0) break;
    }
    if (hit >= 0) { out[field] = hit; used.add(hit); }
  }
  return out;
}

export function findLeadHeaderRow(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const row = aoa[i] || [];
    if (row.filter((c) => String(c ?? "").trim()).length < 2) continue;
    const g = guessLeadColumns(row);
    if (g.name !== undefined || g.phone !== undefined) return i;
  }
  return 0;
}

const phoneKey = (p) => String(p ?? "").replace(/\D/g, "").slice(-9);

// existing = lead yang sudah ada di Nexto (untuk deteksi duplikat lewat nomor telepon atau nama persis).
export function buildLeadRows(aoa, headerRow, mapping, { platform, stageKey, slotKey, existing = [] }) {
  const seenPhone = new Set(existing.map((l) => phoneKey(l.phone)).filter(Boolean));
  const seenName = new Set(existing.map((l) => String(l.name || "").trim().toLowerCase()).filter(Boolean));
  const rows = [];
  let duplicates = 0, empty = 0;
  for (let i = headerRow + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    if (!r.some((c) => String(c ?? "").trim())) continue;
    const get = (f) => (mapping[f] === undefined || mapping[f] === null || mapping[f] === "" ? "" : r[Number(mapping[f])]);
    const person = String(get("name") ?? "").trim();
    const company = String(get("company") ?? "").trim();
    const name = company || person;
    let phone = String(get("phone") ?? "").trim().replace(/^p:/i, "");
    // Excel sering membuang angka 0 di depan nomor lokal (812... -> harusnya 0812...).
    if (/^8d{8,11}$/.test(phone)) phone = "0" + phone;
    if (!name) { empty++; continue; }
    const pk = phoneKey(phone);
    const nk = name.toLowerCase();
    if ((pk && seenPhone.has(pk)) || seenName.has(nk)) { duplicates++; continue; }
    if (pk) seenPhone.add(pk);
    seenName.add(nk);
    const rowPlatform = normalizePlatform(get("platform")) || platform;
    const campaign = String(get("campaign") ?? "").trim();
    const day = mapping.day !== undefined && mapping.day !== "" ? parseDay(get("day")) : null;
    const lead = {
      name, category: "Lainnya", stage_key: stageKey, source: slotKey ? "ads" : rowPlatform,
      phone, email: String(get("email") ?? "").trim(), city: String(get("city") ?? "").trim(),
      key_person: company ? person : "",
    };
    if (slotKey) lead[slotKey] = rowPlatform;
    if (day) lead.created_at = `${day}T09:00:00+07:00`;
    const note = [`Masuk dari iklan ${rowPlatform}${campaign ? `, kampanye ${campaign}` : ""}.`, String(get("notes") ?? "").trim()].filter(Boolean).join(" ");
    rows.push({ lead, note });
  }
  return { rows, duplicates, empty };
}
