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
