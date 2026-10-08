// Saklar fitur per organisasi (8 Okt 2026). Kolom organizations.features berisi
// {"nama_fitur": true}; fitur yang tidak tercantum dianggap mati. Hanya admin
// platform yang boleh mengubahnya (dijaga trigger protect_organizations_privileged_columns).
//
// Pakai untuk fitur yang sengaja tidak untuk semua klien:
//   {hasOrgFeature(org, "marketing_report") && <TabMarketing />}
// Fungsi/aturan di server untuk fitur itu juga harus mengecek kolom yang sama,
// supaya yang tahu alamatnya tidak bisa memakainya walau menunya tersembunyi.
// Menyalakan untuk satu klien (jalankan sebagai admin):
//   update organizations set features = features || '{"marketing_report": true}' where id = '<org id>';
// Daftar fitur yang bisa dinyalakan per organisasi (tampil di Command Center,
// kartu FITUR KLIEN). Kunci HARUS sama dengan FEATURE_KEYS di
// supabase/functions/admin-org-features. ready=false: fiturnya belum dibangun,
// saklar boleh dinyalakan lebih awal tetapi belum ada efeknya.
export const ORG_FEATURES = [
  { key: "marketing_report", label: "Laporan Marketing", hint: "Lead per platform, budget iklan, biaya per lead dan per deal", ready: false },
  { key: "lead_webhook", label: "Webhook lead", hint: "Lead masuk otomatis dari cekat.ai, Meta, atau TikTok", ready: false },
  { key: "monthly_report", label: "Report bulanan sales", hint: "Tab Report: ringkasan SPH, hot progress, deal, target omzet, dan kalender deal per tanggal", ready: true },
  { key: "owner_monitor", label: "Owner sebagai pemantau", hint: "Owner hanya melihat Dashboard, Leads, Team, dan Pengaturan; rekomendasi NEX AI dan daily digest dimatikan untuk owner. Anggota tim tidak berubah", ready: true },
];

// Menu yang tetap tampil untuk owner saat saklar owner_monitor menyala.
export const OWNER_MONITOR_TABS = ["dashboard", "leads", "laporan", "team", "settings"];

// Preset = kumpulan saklar yang diterapkan sekaligus ke satu organisasi (mengganti
// seluruh saklarnya). Harus sama dengan PRESETS di admin-org-features. Preset
// hanya mengatur saklar fitur; tahap pipeline dan field tetap milik tiap organisasi.
export const ORG_PRESETS = [
  { key: "standar", label: "Standar", hint: "Tanpa fitur khusus", features: [] },
  { key: "marketing", label: "Marketing & Iklan", hint: "Laporan marketing + webhook lead", features: ["marketing_report", "lead_webhook"] },
  { key: "webhook", label: "Hanya webhook lead", hint: "Lead masuk otomatis dari sumber luar", features: ["lead_webhook"] },
];

// Template klien lengkap (8 Okt 2026): diterapkan admin ke satu organisasi dari
// Command Center. Industri template (lihat INDUSTRY_TEMPLATES, adminOnly) membawa
// tahap pipeline, nama field, dan pilihan dropdown; "features" = saklar fitur.
// Pipeline + industri + label field hanya diterapkan ke organisasi yang belum punya
// lead (dijaga di server); saklar fitur selalu diterapkan.
export const ORG_TEMPLATES = [
  { key: "bsb_upvc", label: "Proyek uPVC / WPC / Alumunium (BSB)", industry: "bsb_upvc", features: ["monthly_report"], hint: "Pipeline Data Masuk sampai Pengiriman, tipe pelanggan, nomor SPH, sumber lead, plus laporan bulanan" },
  { key: "iklan_digital", label: "Bisnis Iklan Digital (Meta/TikTok)", industry: "digital_ads", features: ["marketing_report", "lead_webhook"], hint: "Pipeline dari lead iklan sampai deal, field platform/kampanye/channel, plus fitur marketing" },
];

// Preset yang persis sama dengan saklar organisasi sekarang (null kalau campuran/pengecualian).
export const matchPreset = (features) => {
  const on = Object.keys(features || {}).filter((k) => features[k] === true).sort().join(",");
  return ORG_PRESETS.find((p) => [...p.features].sort().join(",") === on) || null;
};

export const hasOrgFeature = (org, key) => org?.features?.[key] === true;
