// Versi lama setelah deploy (6 Okt 2026, audit onboarding Enterprise).
// Pengguna yang membiarkan tab terbuka masih memakai index versi lama; saat
// pindah tab, aplikasi memuat potongan kode (chunk) versi lama yang sudah
// tidak ada di server -> "Failed to fetch dynamically imported module" /
// "Importing a module script failed" dan tab gagal tampil. Solusinya: muat
// ulang halaman SEKALI ke versi terbaru. Dijaga sessionStorage supaya tidak
// terjadi loop muat ulang kalau penyebabnya ternyata hal lain (mis. offline).
const KEY = "nexto_stale_reload_at";
const WINDOW_MS = 30000;

export function isStaleChunkError(err) {
  const msg = String(err?.message || err || "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(msg);
}

// true = halaman sedang dimuat ulang; false = sudah dicoba barusan, jangan ulangi.
export function reloadForNewVersion() {
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch (_) { /* storage diblokir */ }
  if (Date.now() - last < WINDOW_MS) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch (_) { /* storage diblokir */ }
  window.location.reload();
  return true;
}
