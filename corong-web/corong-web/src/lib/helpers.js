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
export const fmtRp = (n) => (n ? "Rp " +
