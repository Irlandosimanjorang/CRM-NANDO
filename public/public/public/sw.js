// Service worker minimal - fungsinya cuma biar Chrome/Android nganggep app ini
// "installable" (syarat teknisnya emang butuh service worker terdaftar).
// Sengaja gak nyimpen cache apa-apa, jadi app tetep selalu ambil data terbaru,
// gak ada resiko keliatan data basi gara-gara di-cache.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Passthrough - biarin browser handle fetch-nya normal, gak di-intercept/cache.
});
