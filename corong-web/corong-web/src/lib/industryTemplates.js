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
    catalogExample: "Misal: Distributor resin PVC & kompon kabel untuk pabrik pipa dan kabel di Jawa Barat.",
    quantityUnits: [{ v: "ton", label: "Ton" }, { v: "kg", label: "Kg" }],
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
      name_short: "Perusahaan",
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
    genLeadsExample: { productSold: "resin PVC, kompon kabel", keyword: "distributor kabel listrik", targetRole: "Purchasing Manager, HRD, atau Ketua Komunitas" },
  },

  automotive: {
    key: "automotive",
    catalogExample: "Misal: Dealer resmi mobil keluarga & kendaraan niaga, melayani pembelian perorangan dan fleet perusahaan di Surabaya.",
    quantityUnits: [{ v: "unit", label: "Unit" }],
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
      name_short: "Pembeli",
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
    genLeadsExample: { productSold: "mobil SUV, motor matic", keyword: "showroom mobil bekas", targetRole: "calon pembeli individu atau fleet manager" },
  },

  property: {
    key: "property",
    catalogExample: "Misal: Developer perumahan cluster & ruko di Tangerang, melayani pembelian KPR dan tunai.",
    quantityUnits: null, // "Budget (Rp)" = uang, sama dengan Total Rp
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
      name_short: "Pembeli",
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
    genLeadsExample: { productSold: "unit apartemen, rumah tapak", keyword: "agen properti Jakarta Selatan", targetRole: "calon pembeli rumah atau investor" },
  },

  b2b_general: {
    key: "b2b_general",
    catalogExample: "Misal: Distributor alat tulis kantor & perlengkapan kantor untuk perusahaan di Jabodetabek.",
    quantityUnits: [{ v: "pcs", label: "Pcs" }, { v: "box", label: "Box" }, { v: "karton", label: "Karton" }, { v: "kg", label: "Kg" }, { v: "ton", label: "Ton" }],
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
      name_short: "Perusahaan",
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
    genLeadsExample: { productSold: "alat tulis kantor, mesin produksi", keyword: "distributor alat tulis kantor", targetRole: "Purchasing Manager atau Owner" },
  },

  insurance: {
    key: "insurance",
    catalogExample: "Misal: Agen asuransi jiwa & kesehatan untuk nasabah perorangan dan program karyawan perusahaan.",
    quantityUnits: null, // "Premi (Rp)" = uang, sama dengan Total Rp
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
      name_short: "Nasabah",
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
    genLeadsExample: { productSold: "asuransi jiwa, produk investasi", keyword: "nasabah asuransi kesehatan", targetRole: "calon nasabah atau agen mitra" },
  },

  retail_fmcg: {
    key: "retail_fmcg",
    catalogExample: "Misal: Distributor minuman & makanan ringan untuk minimarket dan toko kelontong di Jakarta Timur.",
    quantityUnits: [{ v: "karton", label: "Karton" }, { v: "pcs", label: "Pcs" }],
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
      name_short: "Outlet",
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
    genLeadsExample: { productSold: "produk makanan ringan, minuman kemasan", keyword: "toko kelontong area Bekasi", targetRole: "pemilik toko atau distributor area" },
  },

  corporate_consultant: {
    key: "corporate_consultant",
    catalogExample: "Misal: Konsultan HR & training untuk perusahaan 100+ karyawan di Jabodetabek.",
    quantityUnits: null, // "Nilai kontrak/SPK (Rp)" = uang, sama dengan Total Rp
    // Pilihan "Produk" di form Tambah Deal (1 Okt 2026, permintaan Nando).
    // User tetap bisa isi sendiri di luar daftar ini.
    dealProductTypes: ["Rise", "In House Training", "Public Class", "Coaching Mentoring"],
    label: "Corporate Consultant",
    description: "Konsultan/kontraktor jasa berbasis project buat perusahaan (SPK/kontrak kerja)",
    // Pipeline & penamaan PERSIS dari masukan calon klien (bisnis project-based:
    // konsultasi/jasa yang berakhir dengan SPK/kontrak kerja, bukan sekadar
    // retainer bulanan) - BUKAN istilah generik konsultan yang gua karang
    // sendiri di draft awal. 3 stage terakhir (Booking/Revenue/Cash In) SEMUA
    // "type: won" sekaligus - deal-nya udah closed dari stage Booking, tapi
    // masih perlu dilacak progress-nya (pekerjaan kelar -> invoice terbit ->
    // uang masuk) - Nexto ngedukung banyak stage "won" sekaligus buat kasus
    // kayak gini, win-rate/revenue tetep kehitung bener di stage manapun dari
    // 3 itu leadnya lagi ada.
    stages: [
      { key: "prospect", label: "Prospect", hex: "#94a3b8", type: "normal" },
      { key: "lead", label: "Lead", hex: "#60a5fa", type: "normal" },
      { key: "hot_lead", label: "Hot Lead", hex: "#fbbf24", type: "normal" },
      { key: "booking", label: "Booking", hex: "#10b981", type: "won" },
      { key: "revenue", label: "Revenue", hex: "#0d9488", type: "won" },
      { key: "cash_in", label: "Cash In", hex: "#059669", type: "won" },
      { key: "lost", label: "Lost", hex: "#f43f5e", type: "lost" },
    ],
    fieldLabels: {
      name: "Nama perusahaan klien",
      name_short: "Klien",
      category: "Sektor industri klien",
      product: "Scope jasa/project",
      company_type: "Skala perusahaan",
      key_person_title: "Jabatan (decision maker)",
      quantity: "Nilai kontrak/SPK (Rp)",
    },
    // Kategori = sektor industri KLIEN (1 Okt 2026, masukan Nando). Dulu isinya
    // jenis jasa konsultan itu sendiri - gak cocok, karena yang dikategorikan
    // adalah perusahaan kliennya. Tipe klien (Startup/Korporat/BUMN) sudah
    // ada di "Skala perusahaan", jadi gak diulang di sini.
    categories: ["Manufaktur", "Perbankan & Keuangan", "Retail & FMCG", "Teknologi & Telekomunikasi", "Kesehatan & Farmasi", "Energi & Pertambangan", "Properti & Konstruksi", "Logistik & Transportasi", "Pendidikan", "Hospitality & F&B", "Lainnya"],
    companyTypeOptions: [
      { v: "", label: "—" }, { v: "Startup", label: "Startup" }, { v: "UMKM", label: "UMKM" }, { v: "Korporat", label: "Korporat / Enterprise" }, { v: "BUMN/Pemerintah", label: "BUMN / Instansi Pemerintah" },
    ],
    hiddenFields: [],
    customFieldLabels: {
      custom_field_1: "No. SPK / Kontrak",
      custom_field_2: "Sumber lead (RFP/Referral/Networking)",
      custom_field_3: "Termin pembayaran",
      custom_field_4: "Status invoice",
    },
    // Field yang isinya pilihan tetap (dropdown), bukan teks bebas (1 Okt 2026).
    customFieldOptions: {
      custom_field_4: ["Menunggu pembayaran", "Lunas"],
    },
    aiContext: "Bisnis ini jasa/konsultasi korporat berbasis project (strategi/manajemen/hukum/pajak/HR/keuangan/IT). Pipeline-nya: Prospect (terindikasi ada kebutuhan) -> Lead (submit proposal/quotation sampai presentasi) -> Hot Lead (udah nanya lebih detail, potensial closing) -> Booking (deal, ada kontrak kerja/SPK) -> Revenue (pekerjaan selesai, invoice terbit) -> Cash In (uang udah masuk). Istilah relevan: SPK (Surat Perintah Kerja), scope of work, quotation, termin pembayaran, invoice, kickoff, deliverable, decision maker.",
    genLeadsExample: { productSold: "jasa konsultasi manajemen, audit pajak, transformasi digital", keyword: "perusahaan yang butuh konsultan bisnis", targetRole: "Direktur, CEO, CFO, atau Head of Legal/HR" },
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

// Satuan kolom jumlah di tab Deal (30 Sep 2026, audit istilah per industri -
// sebelumnya satuannya selalu "Ton/Kg" & total selalu "ton" di semua industri).
// Balikin null kalau industri ini gak butuh kolom jumlah (jumlahnya berupa uang).
// Daftar pilihan "Produk" di form deal, atau null kalau industri ini gak
// pakai kolom itu.
export function getDealProductTypes(industryKey) {
  return getIndustryTemplate(industryKey).dealProductTypes || null;
}

export function getQuantityUnits(industryKey) {
  const tpl = getIndustryTemplate(industryKey);
  return tpl.quantityUnits === undefined ? INDUSTRY_TEMPLATES[DEFAULT_INDUSTRY].quantityUnits : tpl.quantityUnits;
}

export function getCatalogExample(industryKey) {
  return getIndustryTemplate(industryKey).catalogExample || "Misal: jelaskan singkat bisnis Anda, produk utama, dan siapa target pelanggannya.";
}

export function getGenerateLeadsExample(industryKey) {
  const tpl = getIndustryTemplate(industryKey);
  return tpl.genLeadsExample || INDUSTRY_TEMPLATES[DEFAULT_INDUSTRY].genLeadsExample;
}

export function isFieldHidden(industryKey, fieldName) {
  const tpl = getIndustryTemplate(industryKey);
  return (tpl.hiddenFields || []).includes(fieldName);
}

// 5 slot field bebas (custom_field_1..5 di tabel leads) - tiap template industri
// bisa "ngasih nama" ke slot ini (misal Property: "Luas tanah"). Kalau template
// gak ngedefinisiin nama buat slot tertentu, slot itu disembunyiin di form -
// biar gak keliatan "field kosong gak jelas" pas industri gak butuh semuanya.
//
// `orgOverrides` (opsional, dari organizations.custom_field_labels) - user
// bisa "ngerebut" slot yang belum kepake lewat "+ Custom..." pas import
// Excel (lihat ManualColumnMapModal), namanya sendiri, BUKAN dari template
// industri yang hardcode di kode ini. Override menang kalau ada bentrok nama
// (misal org udah rename custom_field_1 sendiri, beda dari default industri).
export function getCustomFieldSlots(industryKey, orgOverrides) {
  const tpl = getIndustryTemplate(industryKey);
  const labels = { ...(tpl.customFieldLabels || {}), ...(orgOverrides || {}) };
  return ["custom_field_1", "custom_field_2", "custom_field_3", "custom_field_4", "custom_field_5"]
    .filter((key) => labels[key])
    .map((key) => {
      // Pilihan dropdown cuma berlaku kalau slot masih pakai label bawaan
      // template (belum diganti nama lewat import).
      const options = labels[key] === tpl.customFieldLabels?.[key] ? tpl.customFieldOptions?.[key] : undefined;
      return options ? { key, label: labels[key], options } : { key, label: labels[key] };
    });
}
