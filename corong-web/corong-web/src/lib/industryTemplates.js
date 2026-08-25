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

import { COMPANY_TYPES } from "./helpers";

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
      name: "Perusahaan",
      product: "Produk",
      company_type: "Tipe perusahaan",
      key_person_title: "Jabatan",
      quantity: "Tonase",
    },
    categories: [
      "Resin & Compound", "Pipa & Fitting", "Kabel Listrik", "Flooring / Sheet / Film",
      "Roofing / Ceiling / Profil", "Kulit Sintetis & Vinyl", "Selang Fleksibel",
      "Packaging & Botol", "Produk Konstruksi", "Lainnya",
    ],
    hiddenFields: [],
    customFieldLabels: {},
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
      name: "Nama calon pembeli",
      product: "Model kendaraan diminati",
      company_type: "Tipe pembeli",
      key_person_title: "Jabatan / Peran",
      quantity: "Unit",
    },
    categories: ["Mobil Baru", "Mobil Bekas", "Motor Baru", "Motor Bekas", "Spare Part", "Aksesoris", "Lainnya"],
    companyTypeOptions: [
      { v: "", label: "—" }, { v: "Individu", label: "Individu" }, { v: "Fleet", label: "Fleet / Perusahaan" },
    ],
    hiddenFields: ["location", "key_person", "key_person_title", "website"],
    customFieldLabels: {
      custom_field_1: "Nilai tukar tambah (trade-in)",
      custom_field_2: "Budget DP / cicilan per bulan",
      custom_field_3: "Cara bayar (Cash/Kredit)",
      custom_field_4: "Warna diminati",
    },
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
      name: "Nama calon pembeli",
      product: "Tipe properti diminati",
      company_type: "Status pembeli",
      key_person_title: "Jabatan / Peran",
      quantity: "Budget (Rp)",
    },
    categories: ["Rumah Tapak", "Apartemen", "Ruko / Rukan", "Tanah Kavling", "Gudang / Pabrik", "Lainnya"],
    companyTypeOptions: [
      { v: "", label: "—" }, { v: "Individu", label: "Individu" }, { v: "Investor", label: "Investor" }, { v: "Korporat", label: "Korporat / Badan Usaha" },
    ],
    hiddenFields: ["location", "key_person", "key_person_title", "website"],
    customFieldLabels: {
      custom_field_1: "Luas tanah/bangunan (m²)",
      custom_field_2: "Status pembiayaan (Cash/KPR)",
      custom_field_3: "Timeline (kapan mau beli/pindah)",
      custom_field_4: "Tipe sertifikat",
    },
    aiContext: "Bisnis ini agen/developer properti. Istilah relevan: viewing, booking fee, KPR, tipe unit, luas tanah/bangunan, timeline pembelian.",
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
      name: "Perusahaan",
      product: "Produk / Jasa",
      company_type: "Tipe perusahaan",
      key_person_title: "Jabatan",
      quantity: "Qty",
    },
    categories: ["Bahan Baku", "Barang Jadi", "Jasa", "Peralatan", "Lainnya"],
    hiddenFields: [],
    customFieldLabels: {
      custom_field_1: "Frekuensi order",
      custom_field_2: "Metode pembayaran (Cash/Termin)",
    },
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
      name: "Nama nasabah",
      product: "Produk diminati",
      company_type: "Tipe nasabah",
      key_person_title: "Jabatan / Peran",
      quantity: "Premi (Rp)",
    },
    categories: ["Asuransi Jiwa", "Asuransi Kesehatan", "Asuransi Umum", "Asuransi Pendidikan", "Investasi", "Lainnya"],
    companyTypeOptions: [
      { v: "", label: "—" }, { v: "Perorangan", label: "Perorangan" }, { v: "Korporat", label: "Perusahaan / Korporat" },
    ],
    hiddenFields: ["location", "key_person", "key_person_title", "website"],
    customFieldLabels: {
      custom_field_1: "Nilai pertanggungan (coverage)",
      custom_field_2: "Tanggal jatuh tempo premi",
      custom_field_3: "Ahli waris (beneficiary)",
      custom_field_4: "Jenis polis",
    },
    aiContext: "Bisnis ini agen asuransi/financial services. Istilah relevan: premi, polis, nilai pertanggungan, ahli waris, konsultasi kebutuhan, renewal.",
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
      name: "Nama outlet / toko",
      product: "Produk diminati",
      company_type: "Tipe outlet",
      key_person: "Nama pemilik",
      key_person_title: "Peran / Sebagai",
      quantity: "Qty (karton/pcs)",
    },
    categories: ["Makanan & Minuman", "Perawatan Diri", "Rumah Tangga", "Elektronik Ringan", "Lainnya"],
    hiddenFields: ["company_type", "website"],
    customFieldLabels: {
      custom_field_1: "Area distribusi",
      custom_field_2: "Jumlah outlet",
      custom_field_3: "Rata-rata nilai order",
    },
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

export function getCategories(industryKey) {
  const tpl = getIndustryTemplate(industryKey);
  return tpl.categories || INDUSTRY_TEMPLATES[DEFAULT_INDUSTRY].categories;
}

// Pilihan dropdown "Tipe perusahaan" juga dinamis per industri - PVC & B2B Umum
// pakai Manufacturer/Trader/Both (COMPANY_TYPES bawaan), industri lain (Automotive,
// Property, Asuransi) punya pilihan sendiri karena leadnya bisa perorangan ATAU
// korporat, bukan cuma salah satu.
export function getCompanyTypeOptions(industryKey) {
  const tpl = getIndustryTemplate(industryKey);
  return tpl.companyTypeOptions || COMPANY_TYPES;
}

export function isFieldHidden(industryKey, fieldName) {
  const tpl = getIndustryTemplate(industryKey);
  return (tpl.hiddenFields || []).includes(fieldName);
}

// 3 slot field bebas (custom_field_1/2/3 di tabel leads) - tiap template industri
// bisa "ngasih nama" ke slot ini (misal Property: "Luas tanah"). Kalau template
// gak ngedefinisiin nama buat slot tertentu, slot itu disembunyiin di form -
// biar gak keliatan "field kosong gak jelas" pas industri gak butuh semuanya.
export function getCustomFieldSlots(industryKey) {
  const tpl = getIndustryTemplate(industryKey);
  const labels = tpl.customFieldLabels || {};
  return ["custom_field_1", "custom_field_2", "custom_field_3", "custom_field_4", "custom_field_5"]
    .filter((key) => labels[key])
    .map((key) => ({ key, label: labels[key] }));
}
