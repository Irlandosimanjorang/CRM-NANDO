// Daftar step tur interaktif (18 Sep 2026, permintaan Nando) - satu step per
// TAB di sidebar (bukan per elemen dalam halaman, biar gampang diandalkan -
// tinggal switch tab & spotlight tombol nav-nya). `minLevel` dicocokin sama
// TAB_MIN_LEVEL di App.jsx: 0=Free, 1=Standard, 2=Professional. Enterprise
// gak nambah TAB baru (myLevel dia disamain 2 kayak Professional), jadi
// fitur Enterprise (Tim, Komisi, GPS) disisipin sebagai kalimat TAMBAHAN di
// step yang relevan (lihat buildTourSteps) - bukan step/tab terpisah.
export const TOUR_STEPS = [
  { key: "dashboard", minLevel: 0, title: "Dashboard", desc: "Ringkasan performa & rekomendasi AI harian - cek ini tiap pagi buat tau prioritas hari ini." },
  { key: "leads", minLevel: 0, title: "Leads", desc: "Semua data lead kamu ada di sini, tinggal drag antar tahap pipeline." },
  { key: "komunitas", minLevel: 0, title: "Nex", desc: "Komunitas & tips dari sesama sales pengguna Nexto." },
  { key: "visitfollowup", minLevel: 1, title: "Visit & Follow-up", desc: "Jadwal kunjungan & Poin Diskusi (AI) sebelum ketemu customer." },
  { key: "settings", minLevel: 1, title: "Pengaturan", desc: "Profil, integrasi Telegram Bot & Google Calendar." },
  { key: "generateleads", minLevel: 2, title: "Generate Leads", desc: "Cari calon customer baru secara otomatis pakai AI." },
  { key: "deal", minLevel: 2, title: "Deal", desc: "Leaderboard revenue & win rate tim." },
  { key: "kompetitor", minLevel: 2, title: "Kompetitor", desc: "Catat & analisa data kompetitor kamu." },
];

// Bangun daftar step yang beneran ditampilin: filter sesuai level plan user
// SEKARANG, terus (kalau ada) buang step yang levelnya udah kebuka SEBELUM
// upgrade terakhir (previousLevel) - itu yang bikin tur susulan pas upgrade
// cuma nunjukin tab yang BARU kebuka, gak ngulang tab lama.
export function buildTourSteps({ myLevel, isEnterprise, previousLevel }) {
  return TOUR_STEPS
    .filter((s) => s.minLevel <= myLevel)
    .filter((s) => previousLevel == null || s.minLevel > previousLevel)
    .map((s) => {
      if (isEnterprise && s.key === "settings") return { ...s, desc: s.desc + " Termasuk kelola Tim, undang anggota, & atur role." };
      if (isEnterprise && s.key === "deal") return { ...s, desc: s.desc + " Termasuk Sistem Komisi Tim & GPS Check-in." };
      return s;
    });
}
