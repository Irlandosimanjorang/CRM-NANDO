// Ambil lokasi GPS yang tahan banting (30 Sep 2026, laporan Nando: "titik
// lokasi GPS error"). Dipakai bareng oleh "Simpan Lokasi Ini" di detail lead
// dan tab Visit & Follow-up.
//
// Masalah versi lama:
// - Izin lokasi DITOLAK dicampur dengan "sinyal belum ketemu" - user cuma
//   dapet pesan umum tanpa tahu harus ngapain.
// - Cuma mode GPS presisi tinggi. Di laptop/dalam gedung mode ini sering gak
//   pernah jawab (timeout) -> langsung error. Sekarang ada cadangan lokasi
//   jaringan/WiFi (presisi rendah) kalau GPS presisi belum dapet apa-apa.
// - Timeout sesaat dianggap gagal total. Sekarang cuma izin ditolak yang
//   bikin berhenti; error lain ditunggu sampai batas waktu.

export const GEO_PERMISSION_MESSAGE =
  "Izin lokasi untuk Nexto ditolak. Aktifkan izin lokasi: di HP buka Pengaturan > Aplikasi/Browser > Izin > Lokasi, " +
  "atau di browser klik ikon gembok di sebelah alamat nexto.site > Lokasi > Izinkan. Setelah itu coba lagi.";

export const GEO_NOFIX_MESSAGE =
  "Sinyal lokasi tidak ditemukan. Pastikan GPS/Lokasi di perangkat menyala, lalu coba lagi di tempat terbuka. " +
  "Laptop tidak memiliki GPS, jadi sebaiknya simpan titik lokasi dari HP saat berada di lokasi customer.";

// Titik yang lebih kasar dari ini gak boleh disimpan jadi titik lokasi
// customer - biasanya hasil WiFi/laptop, dan bakal bikin check-in salah.
export const MAX_PIN_ACCURACY_M = 150;

/**
 * Cari posisi terbaik dalam `timeoutMs`. Selesai lebih cepat kalau akurasi
 * sudah <= targetAccuracy. Balikin { promise, cancel }.
 * promise resolve { lat, lng, accuracy } atau reject Error(message).
 */
export function acquireLocation({ targetAccuracy = 30, timeoutMs = 20000, onProgress } = {}) {
  let cancel = () => {};
  const promise = new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Perangkat/browser ini tidak mendukung lokasi GPS."));
      return;
    }
    let best = null;
    let done = false;
    let watchId = null;
    let fallbackTimer = null;
    let endTimer = null;

    const cleanup = () => {
      done = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(fallbackTimer);
      clearTimeout(endTimer);
    };
    const consider = (pos) => {
      if (done) return;
      const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      if (!best || fix.accuracy < best.accuracy) best = fix;
      onProgress?.(best);
      if (best.accuracy <= targetAccuracy) { cleanup(); resolve(best); }
    };
    const onError = (err) => {
      if (done) return;
      if (err && err.code === 1) { cleanup(); reject(new Error(GEO_PERMISSION_MESSAGE)); }
      // Kode 2 (posisi tidak tersedia) & 3 (timeout): tunggu terus sampai batas waktu.
    };

    watchId = navigator.geolocation.watchPosition(consider, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs });

    // Cadangan: kalau separuh waktu lewat belum ada satu pun posisi, minta
    // lokasi jaringan/WiFi (lebih cepat, walau kurang presisi).
    fallbackTimer = setTimeout(() => {
      if (done || best) return;
      navigator.geolocation.getCurrentPosition(consider, onError, { enableHighAccuracy: false, maximumAge: 60000, timeout: Math.max(5000, timeoutMs / 2) });
    }, timeoutMs / 2);

    endTimer = setTimeout(() => {
      if (done) return;
      cleanup();
      if (best) resolve(best);
      else reject(new Error(GEO_NOFIX_MESSAGE));
    }, timeoutMs);

    cancel = () => { if (!done) cleanup(); };
  });
  return { promise, cancel: () => cancel() };
}
