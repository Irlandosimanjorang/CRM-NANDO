
export const COMPANY_TYPES = [
  { v: "", label: "—" }, { v: "Manufacturer", label: "Manufacturer" },
  { v: "Trader", label: "Trader" }, { v: "Both", label: "Manufacturer & Trader" },
];

export const PRIORITIES = [
  { v: "high", label: "High", hex: "#e11d48" },
  { v: "medium", label: "Medium", hex: "#d97706" },
  { v: "low", label: "Low", hex: "#64748b" },
];

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); };
export const fmtRp = (n) => (n ? "Rp " + Number(n).toLocaleString("id-ID") : "Rp 0");
// BUG FIX (audit 16 Sep 2026): kalau `iso` cuma tanggal doang ("YYYY-MM-DD",
// kayak last_contact/note_date), `new Date(iso)` diparse sebagai UTC
// MIDNIGHT, bukan lokal midnight - buat user WIB (UTC+7) ini bisa bikin
// hasil daysSince meleset 1 hari deket pergantian tanggal (dampaknya:
// warna urgency di kartu Leads bisa salah hijau/kuning/merah tergantung
// jam berapa dibuka). Tanggal-doang sekarang dipaksa diparse sebagai lokal
// (tempel "T00:00:00" eksplisit); timestamp lengkap yang udah bawa info
// jam+offset dibiarin apa adanya.
export const daysSince = (iso) => {
  if (!iso) return null;
  const hasTime = typeof iso === "string" && iso.includes("T");
  const d = Math.floor((Date.now() - new Date(hasTime ? iso : `${iso}T00:00:00`).getTime()) / 86400000);
  return isNaN(d) ? null : d;
};

export const stageMeta = (stages, key) => stages.find((s) => s.key === key) || (stages[0] || { label: "—", hex: "#94a3b8" });
export const chipStyle = (hex) => ({ color: hex, borderColor: hex, backgroundColor: hex + "14" });
export const prioMeta = (v) => PRIORITIES.find((p) => p.v === v) || null;
export const typeBadge = (t) => {
  if (!t) return "";
  if (t === "Manufacturer") return "M";
  if (t === "Trader") return "T";
  if (t === "Both") return "M&T";
  return t; // industri lain (Automotive/Property/Asuransi): tampilin apa adanya, misal "Fleet" atau "Korporat"
};

// Kolom telepon bisa berisi beberapa nomor ("0812-xxx, 021-xxx"). Dulu semua
// digit digabung jadi satu nomor ngawur. Sekarang dipecah per nomor dan
// dinormalisasi ke format 62xxx (1 Okt 2026).
export const phoneNumbers = (phone) =>
  String(phone || "")
    .split(/[,;/\n]|\s{2,}/)
    .map((x) => {
      let p = x.replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "");
      if (p.startsWith("+")) p = p.slice(1);
      if (p.startsWith("0")) p = "62" + p.slice(1);
      return p;
    })
    .filter((p) => p.length >= 8);

// Nomor HP Indonesia (62 8xx) - yang bisa dipakai WhatsApp.
const isMobile = (p) => /^628\d{7,12}$/.test(p);

// Link WhatsApp ke nomor HP pertama. Nomor kantor (021-xxx) gak dipakai,
// karena hampir pasti bukan nomor WhatsApp.
export const waLink = (phone) => {
  const mobile = phoneNumbers(phone).find(isMobile);
  return mobile ? `https://wa.me/${mobile}` : "";
};

// Link telepon ke nomor pertama (HP atau kantor).
export const telLink = (phone) => {
  const first = phoneNumbers(phone)[0];
  return first ? `tel:+${first}` : "";
};
export const normUrl = (u) => { const s = String(u || "").trim(); if (!s) return ""; return /^https?:\/\//i.test(s) ? s : "https://" + s; };
export const prettyDomain = (u) => { let s = String(u || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, ""); return s.replace(/\/.*$/, "") || s; };
export const isNewLead = (c) => { const d = daysSince(c.created_at); return d !== null && d <= 2; };

export const normalizeCompanyName = (s) => {
  let x = String(s || "").toLowerCase();
  x = x.replace(/\b(pt|cv|tbk|ltd|inc|corp|corporation|company|co|group|indonesia|persero|perusahaan)\b/g, " ");
  x = x.replace(/[.,\-_/()&]/g, " ");
  x = x.replace(/\s+/g, " ").trim();
  return x;
};
// Key person + Jabatan berpasangan (8 Okt 2026): kolom key_person dan key_person_title
// tetap 2 kolom teks, masing-masing dipisah koma dan DISEJAJARKAN menurut urutan
// ("Budi, Sari" + "CEO, CFO" = Budi CEO, Sari CFO). Data lama tetap terbaca: kalau
// jumlah jabatan LEBIH BANYAK dari jumlah nama (mis. satu orang berjabatan
// "Manager, Sales"), seluruh teks jabatan dianggap milik orang pertama, tidak dipecah.
export const MAX_KEY_PEOPLE = 5;
export function parsePeople(keyPerson, keyTitle) {
  const names = String(keyPerson || "").split(",").map((x) => x.trim());
  let titles = String(keyTitle || "").split(",").map((x) => x.trim());
  if (titles.length > names.length) titles = [String(keyTitle || "").trim()];
  const n = Math.max(names.length, titles.length, 1);
  return Array.from({ length: n }, (_, i) => ({ name: names[i] || "", title: titles[i] || "" }));
}
// Gabung lagi jadi dua teks. Satu orang: disimpan apa adanya. Beberapa orang: koma di dalam
// nama/jabatan diganti " / " supaya urutannya tidak bergeser.
export function joinPeople(rows) {
  if (rows.length <= 1) return { key_person: rows[0]?.name || "", key_person_title: rows[0]?.title || "" };
  const clean = (x) => String(x || "").replace(/\s*,\s*/g, " / ").trim();
  return { key_person: rows.map((r) => clean(r.name)).join(", "), key_person_title: rows.map((r) => clean(r.title)).join(", ") };
}
// Dipakai saat menyimpan: buang baris yang nama dan jabatannya sama-sama kosong, maksimal 5 orang.
export function normalizePeopleForSave(keyPerson, keyTitle) {
  const rows = parsePeople(keyPerson, keyTitle).filter((r) => r.name || r.title).slice(0, MAX_KEY_PEOPLE);
  return joinPeople(rows.length ? rows : [{ name: "", title: "" }]);
}

// Daftar nilai dipisah koma (email, telepon): buang yang kosong dan potong ke `max` pertama.
export const limitMulti = (value, max = 5) =>
  String(value || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, max).join(", ");

// Kunci pengelompokan nama grup/induk perusahaan: "PT Maju Jaya" dan
// "maju jaya" dianggap grup yang sama.
export const groupKey = (s) => normalizeCompanyName(s) || String(s || "").trim().toLowerCase();
const bigrams = (s) => { const arr = []; for (let i = 0; i < s.length - 1; i++) arr.push(s.slice(i, i + 2)); return arr; };
export const nameSimilarity = (a, b) => {
  const na = normalizeCompanyName(a), nb = normalizeCompanyName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const bA = bigrams(na), bB = bigrams(nb);
  if (!bA.length || !bB.length) return na === nb ? 1 : 0;
  let matches = 0; const pool = [...bB];
  for (const bg of bA) { const idx = pool.indexOf(bg); if (idx !== -1) { matches++; pool.splice(idx, 1); } }
  return (2 * matches) / (bA.length + bB.length);
};
