// Daftar step tur interaktif (18 Sep 2026, permintaan Nando) - satu step per
// TAB di sidebar (bukan per elemen dalam halaman, biar gampang diandalkan -
// tinggal switch tab & spotlight tombol nav-nya). `minLevel` dicocokin sama
// TAB_MIN_LEVEL di App.jsx: 0=Free, 1=Standard, 2=Professional. Enterprise
// gak nambah TAB baru (myLevel dia disamain 2 kayak Professional), jadi
// fitur Enterprise (Tim, Komisi, GPS) disisipin sebagai kalimat TAMBAHAN di
// step yang relevan (lihat buildTourSteps) - bukan step/tab terpisah.
// Deskripsi tiap step SENGAJA nyebut fitur konkret per tab (bukan kalimat
// generik) - permintaan Nando (20 Sep 2026) abis liat tur pertama kali:
// "di bagian penjelasan lu jelasin detil mengenai fitur di tab ini". Nama
// fitur yang dipake di sini harus tetep sinkron sama STANDARD_FEATURES/
// PROFESSIONAL_FEATURES/ENTERPRISE_FEATURES di Auth.jsx (sumber kebenaran
// yang sama dipake landing page) - kalau salah satu daftar fitur berubah,
// cek juga teks di sini biar gak keselisih.
export const TOUR_STEPS = [
  { key: "dashboard", minLevel: 0, title: "Dashboard", desc: "Ringkasan performa & rekomendasi AI harian (Daily Digest), plus skor kualitas Memory - makin tinggi, makin nyambung rekomendasi AI-nya sama histori kamu." },
  { key: "leads", minLevel: 0, title: "Leads", desc: "Kartu lead per perusahaan, drag antar tahap pipeline, catat progress harian. Ada juga AI Draft Follow-up (WhatsApp & Email), Deteksi Duplikat, dan (Professional) NEXto - update lead pakai voice note." },
  { key: "komunitas", minLevel: 0, title: "Nex", desc: "Komunitas & tips dari sesama sales pengguna Nexto - share cerita closing & tanya-tanya bareng." },
  { key: "visitfollowup", minLevel: 1, title: "Visit & Follow-up", desc: "Jadwal kunjungan, Poin Diskusi (AI) sebelum ketemu customer, dan Rekam Meeting otomatis biar gak perlu nyatet manual pas ketemu klien." },
  { key: "settings", minLevel: 1, title: "Pengaturan", desc: "Profil, dan sinkron otomatis jadwal visit ke Google Calendar." },
  { key: "generateleads", minLevel: 2, title: "Generate Leads", desc: "AI nyari calon customer baru otomatis sesuai industri & lokasi kamu - tinggal generate, langsung dapet daftar lead siap di-follow-up." },
  { key: "deal", minLevel: 2, title: "Deal", desc: "Leaderboard revenue & win rate, plus Pipeline Review otomatis buat nunjukin deal mana yang butuh perhatian sebelum keburu dingin." },
  { key: "kompetitor", minLevel: 2, title: "Kompetitor", desc: "Catat & analisa data kompetitor - harga, kekuatan, kelemahan - biar strategi penawaran kamu lebih tajam." },
];

// Bangun daftar step yang beneran ditampilin: filter sesuai level plan user
// SEKARANG, terus (kalau ada) buang step yang levelnya udah kebuka SEBELUM
// upgrade terakhir (previousLevel) - itu yang bikin tur susulan pas upgrade
// cuma nunjukin tab yang BARU kebuka, gak ngulang tab lama.
export function buildTourSteps({ myLevel, isEnterprise, previousLevel }) {
  // Fitur Enterprise ditempel ke tab yang PALING nyambung ke fungsinya
  // (bukan bikin step/tab baru - Enterprise gak nambah tab, lihat komentar
  // di atas file ini) - Assign Leads ke tab Leads, GPS Check-in ke Visit &
  // Follow-up, Kelola Tim ke Settings, Komisi Tim ke Deal.
  const ENTERPRISE_EXTRA = {
    leads: " Enterprise: Assign & filter leads per anggota tim, plus approval-gate buat hapus lead & export data.",
    visitfollowup: " Enterprise: GPS Check-in - tracking kunjungan tim secara real-time.",
    settings: " Enterprise: kelola Tim, undang anggota via kode invite, & atur role (Owner/Manager/Sales Rep).",
    deal: " Enterprise: Sistem Komisi Tim (atur % per anggota, otomatis dihitung) & Laporan Performa Tim.",
  };
  return TOUR_STEPS
    .filter((s) => s.minLevel <= myLevel)
    .filter((s) => previousLevel == null || s.minLevel > previousLevel)
    .map((s) => (isEnterprise && ENTERPRISE_EXTRA[s.key] ? { ...s, desc: s.desc + ENTERPRISE_EXTRA[s.key] } : s));
}
