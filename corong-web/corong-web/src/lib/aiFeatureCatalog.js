// Katalog SEMUA fitur AI Nexto untuk kartu FITUR AI di Command Center (10 Okt 2026, permintaan Nando:
// "semua fitur AI tanpa terkecuali ... dibuat seperti dropdown"). Disusun dari audit kode edge function
// (batas/gate, model) dan data nyata tabel ai_usage (biaya). Kalau batas atau model sebuah fitur berubah,
// ubah di sini juga - batas yang SEBENARNYA dipaksa tetap ada di edge function masing-masing.
//
// Field:
//   id        kunci unik            fn        nama edge function
//   group     "user" | "auto" | "public" | "internal" | "off"
//   logKeys   nilai kolom ai_usage.feature yang dijumlahkan untuk fitur ini
//   plans     batas panggilan per bulan per paket (null = fitur tidak tersedia di paket itu, "auto" = tanpa kuota pengguna)
//   est       perkiraan biaya per panggilan (USD) bila belum ada data nyata: avg = rata-rata, worst = kondisi terburuk
//   perRun    true bila 1 "penggunaan" = banyak panggilan AI (Generate Leads: 1 pencarian + enrich tiap lead)
//   logged    false bila panggilan AI fitur ini TIDAK tercatat di ai_usage (biaya tidak muncul di Cash Flow)

export const AI_GROUPS = [
  { key: "user", label: "Fitur pengguna (dipicu manual)" },
  { key: "auto", label: "Otomatis (terjadwal)" },
  { key: "public", label: "Publik (pengunjung website)" },
  { key: "internal", label: "Internal sistem" },
  { key: "off", label: "Tidak memakai AI / sudah dimatikan" },
];

export const AI_FEATURES = [
  {
    id: "nex-pro", group: "user", label: "NEX Pro", fn: "quick-progress-note", logKeys: ["quick-progress-note"],
    model: "Claude Haiku 4.5 (+ Whisper untuk suara)", plans: { standard: 25, professional: 125, enterprise: 125 },
    gate: "Standard ke atas. Kuota mengikuti siklus langganan (bukan tanggal 1).",
    desc: "Update lead, catatan progres, dan jadwal lewat suara atau teks (tempel catatan meeting).",
    est: { avg: 0.0034, worst: 0.022 },
    note: "Biaya tertinggi terjadi bila memakai suara 3 menit penuh (Whisper $0,006 per menit). Model Haiku 5.5 lebih murah sekitar 10x, tapi belum diuji kualitasnya.",
  },
  {
    id: "generate-leads", group: "user", label: "Generate Leads", fn: "generate-leads + enrich-generated-lead", logKeys: ["generate-leads", "enrich-generated-lead"],
    model: "Claude Sonnet 5.5 + web search (enrich lead: Haiku 4.5)", plans: { standard: null, professional: 4, enterprise: 4 }, perRun: true,
    gate: "Professional ke atas. Maks 10 lead per pencarian. Token add-on menambah jatah setelah kuota habis.",
    desc: "Mencari calon klien lewat web, lalu tiap lead diperkaya datanya (enrich). Satu pencarian = 1 panggilan utama + beberapa enrich.",
    est: { avg: 0.83, worst: 1.22 },
    note: "Termahal per penggunaan. Biaya per pencarian termasuk biaya pencarian web ($0,01 per pencarian).",
  },
  {
    id: "lead-from-url", group: "user", label: "Lead dari Link", fn: "lead-from-url", logKeys: ["lead-from-url"],
    model: "Claude Sonnet 5.5 + web search", plans: { standard: 10, professional: 10, enterprise: 10 },
    gate: "Standard ke atas.", desc: "Membaca satu link website atau profil dan membuat lead dari isinya.",
    est: { avg: 0.054, worst: 0.061 },
  },
  {
    id: "smart-import", group: "user", label: "Smart Import", fn: "smart-import-map-ts", logKeys: ["smart-import-map-ts"],
    model: "Claude Sonnet 5.5", plans: { standard: 8, professional: 8, enterprise: 8 },
    gate: "Standard ke atas. Paket Free: 1x seumur akun (uji coba).", desc: "Memetakan kolom file Excel/CSV ke field lead.",
    est: { avg: 0.0074, worst: 0.0075 },
  },
  {
    id: "suggest-categories", group: "user", label: "Rapihin Data", fn: "suggest-categories", logKeys: ["suggest-categories"],
    model: "Claude Sonnet 5.5", plans: { standard: 4, professional: 4, enterprise: 4 },
    gate: "Standard ke atas.", desc: "Menyarankan kategori yang rapi untuk lead.",
    est: { avg: 0.021, worst: 0.03 }, estOnly: true,
  },
  {
    id: "visit-points", group: "user", label: "Poin Diskusi", fn: "suggest-visit-points", logKeys: ["suggest-visit-points"],
    model: "Claude Sonnet 5.5", plans: { standard: 10, professional: 10, enterprise: 10 },
    gate: "Standard ke atas.", desc: "Menyiapkan poin diskusi sebelum bertemu klien (meeting prep).",
    est: { avg: 0.0096, worst: 0.015 },
  },
  {
    id: "transcribe-meeting", group: "user", label: "Rekam Meeting", fn: "transcribe-meeting", logKeys: ["transcribe-meeting"],
    model: "Whisper (transkrip) + Claude Sonnet 5.5 (ringkasan)", plans: { standard: null, professional: 8, enterprise: 8 },
    gate: "Professional ke atas. Audio maks sekitar 24 MB.", desc: "Merekam meeting, mentranskrip, lalu meringkas menjadi catatan dan tindak lanjut.",
    est: { avg: 0.2, worst: 0.4 }, estOnly: true,
    note: "Biaya sangat bergantung panjang meeting (Whisper $0,006 per menit). Angka perkiraan: meeting 30 menit (rata-rata) dan 60 menit (terburuk). Data nyata baru 2 tes pendek.",
  },
  {
    id: "draft-followup", group: "user", label: "Draft Follow-up", fn: "draft-followup", logKeys: ["draft-followup"],
    model: "Claude Sonnet 5.5 (+ embedding untuk mencari catatan relevan)", plans: { standard: null, professional: 60, enterprise: 60 },
    gate: "Professional ke atas. 60x per bulan (sebelumnya 3x per hari). Draft yang masih segar (kurang dari 24 jam) dipakai ulang dan tidak mengurangi kuota.",
    desc: "Membuat draft pesan follow-up WhatsApp atau email untuk satu lead.",
    est: { avg: 0.0083, worst: 0.0131 },
  },
  {
    id: "guess-outcome", group: "user", label: "Tebak Alasan (Outcome Memory)", fn: "guess-outcome-reason", logKeys: ["guess-outcome-reason"],
    model: "Claude Sonnet 5.5", plans: { standard: null, professional: 15, enterprise: 15 },
    gate: "Professional ke atas.", desc: "Menebak alasan menang atau kalah sebuah deal untuk memori organisasi.",
    est: { avg: 0.0026, worst: 0.005 },
  },
  {
    id: "verify-selfie", group: "user", label: "Verifikasi Selfie Check-in", fn: "verify-selfie-photo", logKeys: ["verify-selfie-photo"],
    model: "Claude Sonnet 5.5 (membaca gambar)", plans: { standard: null, professional: null, enterprise: 15 },
    gate: "Hanya organisasi Enterprise.", desc: "Memeriksa foto selfie saat check-in kunjungan (GPS).",
    est: { avg: 0.004, worst: 0.006 }, estOnly: true,
  },
  {
    id: "summarize-needs", group: "user", label: "Ringkasan Kebutuhan", fn: "summarize-lead-needs", logKeys: ["summarize-lead-needs"],
    model: "Claude Sonnet 5.5", plans: { standard: null, professional: null, enterprise: 15 },
    gate: "Hanya organisasi Enterprise. 15x per bulan per anggota.", desc: "Meringkas kebutuhan klien dari notulen dan merekomendasikan produk dari katalog.",
    est: { avg: 0.0106, worst: 0.0112 },
  },
  {
    id: "daily-digest", group: "auto", label: "Daily Digest / AI Advisor", fn: "daily-digest", logKeys: ["daily-digest"],
    model: "Claude Sonnet 5.5 (+ embedding, suara opsional)", plans: { standard: 22, professional: 22, enterprise: 22 },
    gate: "Otomatis tiap hari kerja untuk pengguna berbayar yang aktif dalam 7 hari terakhir. Akun contoh @example.com dilewati.",
    desc: "Rekomendasi lead harian dan ringkasan pagi lewat email.",
    est: { avg: 0.0095, worst: 0.016 },
    note: "Fitur dengan jumlah panggilan terbanyak, jadi kontributor biaya terbesar saat ini.",
  },
  {
    id: "pipeline-review", group: "auto", label: "Pipeline Review", fn: "pipeline-review", logKeys: ["pipeline-review"],
    model: "Claude Sonnet 5.5 (+ embedding)", plans: { standard: null, professional: "auto", enterprise: "auto" },
    gate: "Professional ke atas. Otomatis 2x per bulan (tanggal 1 dan 15) per organisasi.", desc: "Laporan kesehatan pipeline dua mingguan dan sintesis pola menang-kalah (org memory).",
    est: null, note: "Belum pernah jalan sejak pencatatan biaya dimulai, jadi biayanya belum diketahui.",
  },
  {
    id: "customer-chat", group: "public", label: "Chat Bantuan (SASA)", fn: "customer-chat", logKeys: ["customer-chat"],
    model: "Claude Sonnet 5.5", plans: { standard: "auto", professional: "auto", enterprise: "auto" },
    gate: "Publik: 20 pesan per hari per pengunjung (60 untuk konteks Enterprise), maksimal 60 per hari per alamat IP.",
    desc: "Chat bantuan di landing page dan aplikasi, menjawab pertanyaan paket dan fitur.",
    est: { avg: 0.0044, worst: 0.0086 },
    note: "Dipakai pengunjung tanpa akun, jadi biayanya tidak termasuk ke pelanggan mana pun.",
  },
  {
    id: "atom", group: "internal", label: "ATOM: ringkasan temuan", fn: "health-check", logKeys: [],
    model: "Claude Sonnet 5.5", plans: { standard: "auto", professional: "auto", enterprise: "auto" }, logged: false,
    gate: "Tiap 8 jam, hanya bila ada temuan yang perlu dikirim ke Telegram.", desc: "Meringkas temuan pengecekan sistem menjadi pesan Telegram yang mudah dibaca.",
    est: { avg: 0.007, worst: 0.012 },
    note: "Panggilan AI-nya belum dicatat di ai_usage, jadi tidak terlihat di Cash Flow. Perkiraan sekitar $0,6 per bulan bila ada temuan terus-menerus.",
  },
  {
    id: "memory-health", group: "internal", label: "Penilai Kualitas Riwayat Lead", fn: "memory-health-check", logKeys: [],
    model: "Claude Sonnet 5.5", plans: { standard: "auto", professional: "auto", enterprise: "auto" }, logged: false,
    gate: "Otomatis tiap hari kerja, satu panggilan per organisasi berbayar.", desc: "Menilai seberapa sehat riwayat catatan lead (skor di Dashboard).",
    est: { avg: 0.001, worst: 0.002 },
    note: "Belum dicatat di ai_usage. Panggilannya sangat kecil (sekitar $0,02 per organisasi per bulan).",
  },
  {
    id: "embedding", group: "internal", label: "Embedding catatan (memori vektor)", fn: "embed-progress-note + backfill-embeddings", logKeys: [],
    model: "OpenAI text-embedding-3-small ($0,02 per 1 juta token)", plans: { standard: "auto", professional: "auto", enterprise: "auto" }, logged: false,
    gate: "Otomatis tiap catatan progres baru. Batas paket Standard ke atas ada di kode tetapi belum aktif (payload trigger tanpa user_id), jadi catatan pengguna Free ikut diproses.",
    desc: "Mengubah catatan progres menjadi vektor agar AI menemukan catatan yang paling relevan.",
    est: { avg: 0.000001, worst: 0.000003 },
    note: "Tidak dicatat di ai_usage. Biayanya hampir nol (sekitar $0,000001 per catatan).",
  },
  {
    id: "mcp", group: "off", label: "MCP Server (Grok Bot)", fn: "mcp-server", logKeys: [],
    model: "Tidak memanggil AI Nexto", plans: { standard: "auto", professional: "auto", enterprise: "auto" },
    gate: "Standard ke atas. Maks 200 panggilan alat per hari per pengguna.", desc: "Pintu bagi agen AI eksternal (Grok Bot) untuk membaca dan menulis data CRM. AI-nya milik pihak luar, bukan Nexto.",
    est: null,
  },
  {
    id: "nova", group: "off", label: "NOVA (konten Instagram)", fn: "content-drafter", logKeys: [],
    model: "Dimatikan permanen 16 Sep 2026", plans: { standard: null, professional: null, enterprise: null },
    gate: "-", desc: "Draft konten mingguan. Fungsinya kini hanya stub yang menolak panggilan.", est: null,
  },
  {
    id: "proactive", group: "off", label: "Chat proaktif siang", fn: "proactive-check", logKeys: [],
    model: "Dimatikan permanen 17 Sep 2026", plans: { standard: null, professional: null, enterprise: null },
    gate: "-", desc: "Pesan AI proaktif harian ke Telegram. Dimatikan karena tidak masuk paket mana pun.", est: null,
  },
  {
    id: "telegram", group: "off", label: "Bot Telegram", fn: "telegram-webhook", logKeys: [],
    model: "Digantikan NEX Pro", plans: { standard: null, professional: null, enterprise: null },
    gate: "-", desc: "Bot Telegram lama sudah tidak aktif (webhook mengembalikan 410). Penggantinya NEX Pro.", est: null,
  },
];

// Biaya token maksimal per pengguna per bulan bila semua kuota fitur terpakai habis (USD), dari est di katalog ini.
// mode "avg" = biaya rata-rata per panggilan, "worst" = biaya tertinggi. Dipakai kotak Rencana top-up di Cash Flow
// supaya angkanya sama dengan kartu FITUR AI.
export function perUserMonthly(planKey, mode = "worst") {
  return AI_FEATURES.reduce((sum, f) => {
    const n = f.plans?.[planKey];
    if (f.group === "off" || typeof n !== "number" || !f.est) return sum;
    return sum + n * f.est[mode];
  }, 0);
}
