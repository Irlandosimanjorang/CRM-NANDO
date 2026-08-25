export const CATEGORIES = [
  "Resin & Compound", "Pipa & Fitting", "Kabel Listrik", "Flooring / Sheet / Film",
  "Roofing / Ceiling / Profil", "Kulit Sintetis & Vinyl", "Selang Fleksibel",
  "Packaging & Botol", "Produk Konstruksi", "Lainnya",
];

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
export const daysSince = (iso) => { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return isNaN(d) ? null : d; };

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

export const waLink = (phone) => {
  if (!phone) return "";
  let p = String(phone).replace(/[^0-9+]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  p = p.replace(/\+/g, "");
  return p.length >= 8 ? `https://wa.me/${p}` : "";
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
