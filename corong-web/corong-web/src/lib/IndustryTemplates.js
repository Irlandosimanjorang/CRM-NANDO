// ============================================================
// TEMPLATE INDUSTRI — nentuin pipeline default, label field,
// field yang disembunyiin, dan konteks buat prompt AI, per industri.
//
// Org milih salah satu pas onboarding (disimpen di organizations.industry).
// 'pvc_chemical' adalah default/fallback - PERSIS sama kayak pipeline
// bawaan Nexto dari awal, jadi org lama (termasuk org PVC utama) gak
// kerasa ada yang berubah kalau kolom industry-nya kosong/null.
//
// Field DB-nya SENDIRI gak berubah sama sekali (product, company_type,
// key_person_title, dst tetep nama kolom yang sama) - yang berubah cuma
// LABEL yang ditampilin di UI, lewat fieldLabels di bawah.
// ============================================================

export const INDUSTRY_TEMPLATES = {
  pvc_chemical: {
    key: "pvc_chemical",
    label: "PVC / Kimia (Manufaktur)",
    description: "Distributor & manufaktur resin, kompon, bahan kimia industri",
    stages: [
      { key: "prospek", label: "Prospek Baru", hex: "#94a3b8", type: "normal" },
      { key: "kontak", label: "Kontak Awal", hex: "#60a5fa", type: "normal" },
      { key: "presentasi", label: "Presentasi / Visit", hex: "#fbbf24", type: "normal" },
      { key: "negosiasi", label: "Negosiasi", hex: "#f97316", type: "normal" },
      { key: "deal", label: "Deal / Menang", hex: "#10b981", type: "won" },
      { key: "lost", label: "Lost", hex: "#f43f5e", type: "lost" },
    ],
    fieldLabels: {
      product: "Produk",
      company_type: "Tipe perusahaan",
      key_person_title: "Jabatan",
      quantity: "Tonase",
    },
    hiddenFields: [],
    aiContext: "Bisnis ini distribusi/manufaktur PVC dan bahan kimia industri. Istilah relevan: tonase, resin, kompon, purchasing manager, trader vs manufacturer.",
  },

  automotive: {
    key: "automotive",
    label: "Automotive / Dealer",
    description: "Dealer mobil, motor, atau kendaraan",
    stages: [
      { key: "lead_baru", label: "Lead Baru", hex: "#94a3b8", type: "normal" },
      { key: "qualified", label: "Qualified", hex: "#60a5fa", type: "normal" },
      { key: "test_drive", label: "Test Drive", hex: "#fbbf24", type: "normal" },
      { key: "negosiasi", label: "Negosiasi", hex: "#f97316", type: "normal" },
      { key: "booking", label: "Booking", hex: "#a855f7", type: "normal" },
      { key: "closed_won", label: "Closed Won", hex: "#10b981", type: "won" },
      { key: "lost", label: "Lost", hex: "#f43f5e", type: "lost" },
    ],
    fieldLabels: {
      product: "Model kendaraan diminati",
      company_type: "Sumber pembeli",
      key_person_title: "Jabatan / Peran",
      quantity: "Unit",
    },
    hiddenFields: ["company_type"],
    aiContext: "Bisnis ini dealer kendaraan (mobil/motor). Istilah relevan: test drive, unit, tipe/varian, DP, cicilan, trade-in.",
  },

  property: {
    key: "property",
    label: "Property / Real Estate",
    description: "Agen properti, developer, atau broker rumah/apartemen",
    stages: [
      { key: "inquiry", label: "Inquiry", hex: "#94a3b8", type: "normal" },
      { key: "matching", label: "Property Matching", hex: "#60a5fa", type: "normal" },
      { key: "viewing", label: "Viewing", hex: "#fbbf24", type: "normal" },
      { key: "negosiasi", label: "Negosiasi", hex: "#f97316", type: "normal" },
      { key: "booking", label: "Booking Fee", hex: "#a855f7", type: "normal" },
      { key: "closing", label: "Closing", hex: "#10b981", type: "won" },
      { key: "lost", label: "Batal / Lost", hex: "#f43f5e", type: "lost" },
    ],
    fieldLabels: {
      product: "Tipe properti diminati",
      company_type: "Status pembeli",
      key_person_title: "Jabatan / Peran",
      quantity: "Budget (Rp)",
    },
    hiddenFields: ["company_type"],
    aiContext: "Bisnis ini agen/developer properti. Istilah relevan: viewing, booking fee, KPR, tipe unit, luas tanah/bangunan.",
  },

  b2b_general: {
    key: "b2b_general",
    label: "B2B / Distributor Umum",
    description: "Distributor, trading, atau manufaktur non-kimia",
    stages: [
      { key: "prospek", label: "Prospek Baru", hex: "#94a3b8", type: "normal" },
      { key: "sample", label: "Sample / Trial", hex: "#60a5fa", type: "normal" },
      { key: "quotation", label: "Quotation", hex: "#fbbf24", type: "normal" },
      { key: "negosiasi", label: "Negosiasi", hex: "#f97316", type: "normal" },
      { key: "po", label: "PO Diterima", hex: "#10b981", type: "won" },
      { key: "lost", label: "Lost", hex: "#f43f5e", type: "lost" },
    ],
    fieldLabels: {
      product: "Produk / Jasa",
      company_type: "Tipe perusahaan",
      key_person_title: "Jabatan",
      quantity: "Qty",
    },
    hiddenFields: [],
    aiContext: "Bisnis ini B2B umum (distributor/trading). Istilah relevan: quotation, PO, sample, reorder.",
  },

  insurance: {
    key: "insurance",
    label: "Asuransi / Financial Services",
    description: "Agen asuransi jiwa, umum, atau produk finansial",
    stages: [
      { key: "lead", label: "Lead", hex: "#94a3b8", type: "normal" },
      { key: "konsultasi", label: "Konsultasi", hex: "#60a5fa", type: "normal" },
      { key: "proposal", label: "Proposal", hex: "#fbbf24", type: "normal" },
      { key: "negosiasi", label: "Negosiasi", hex: "#f97316", type: "normal" },
      { key: "polis_terbit", label: "Polis Terbit", hex: "#10b981", type: "won" },
      { key: "lost", label: "Lost", hex: "#f43f5e", type: "lost" },
    ],
    fieldLabels: {
      product: "Produk diminati",
      company_type: "Tipe nasabah",
      key_person_title: "Jabatan / Peran",
      quantity: "Premi (Rp)",
    },
    hiddenFields: ["company_type"],
    aiContext: "Bisnis ini agen asuransi/financial services. Istilah relevan: premi, polis, konsultasi kebutuhan, renewal.",
  },

  retail_fmcg: {
    key: "retail_fmcg",
    label: "Retail / FMCG",
    description: "Distribusi produk konsumen ke retailer/toko",
    stages: [
      { key: "prospek", label: "Prospek Baru", hex: "#94a3b8", type: "normal" },
      { key: "kontak", label: "Kontak Awal", hex: "#60a5fa", type: "normal" },
      { key: "penawaran", label: "Penawaran", hex: "#fbbf24", type: "normal" },
      { key: "negosiasi", label: "Negosiasi", hex: "#f97316", type: "normal" },
      { key: "deal", label: "Deal / Order Masuk", hex: "#10b981", type: "won" },
      { key: "lost", label: "Lost", hex: "#f43f5e", type: "lost" },
    ],
    fieldLabels: {
      product: "Produk diminati",
      company_type: "Tipe outlet",
      key_person_title: "Jabatan",
      quantity: "Qty (karton/pcs)",
    },
    hiddenFields: [],
    aiContext: "Bisnis ini distribusi retail/FMCG. Istilah relevan: outlet, karton, distributor area, repeat order.",
  },
};

export const DEFAULT_INDUSTRY = "pvc_chemical";

export function getIndustryTemplate(industryKey) {
  return INDUSTRY_TEMPLATES[industryKey] || INDUSTRY_TEMPLATES[DEFAULT_INDUSTRY];
}

export function getFieldLabel(industryKey, fieldName, fallback) {
  const tpl = getIndustryTemplate(industryKey);
  return (tpl.fieldLabels && tpl.fieldLabels[fieldName]) || fallback;
}

export function isFieldHidden(industryKey, fieldName) {
  const tpl = getIndustryTemplate(industryKey);
  return (tpl.hiddenFields || []).includes(fieldName);
}
