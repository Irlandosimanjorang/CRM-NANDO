// Service worker Nexto - sebelumnya cuma passthrough kosong (gak nge-cache
// apa-apa), jadi walau manifest.json udah bikin app-nya "installable", gak
// ada manfaat offline/loading cepat sama sekali. Sekarang:
// - App shell (index.html) & asset ber-hash (JS/CSS/gambar dari Vite build,
//   nama filenya udah unik per build jadi aman di-cache-first selamanya)
//   di-cache biar reload/buka ulang jauh lebih cepet, dan tetep kebuka
//   (nunjukin shell app-nya) walau lagi offline.
// - Request ke Supabase (data asli: leads, auth, dst) SENGAJA gak pernah
//   di-cache - selalu network, biar data yang ditampilin selalu yang
//   terbaru & gak ada resiko nunjukin data basi/punya org lain dari cache.
const CACHE_NAME = "nexto-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add("/").catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Buang cache versi lama - biar gak numpuk tiap kali nama CACHE_NAME
      // diganti pas ada perubahan strategi caching di masa depan.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch (_) {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Cuma GET yang aman buat di-cache - dan cuma request ke origin sendiri
  // (Supabase/API pihak ketiga selalu langsung ke network, gak disentuh).
  if (request.method !== "GET" || !isSameOrigin(request.url)) return;

  const url = new URL(request.url);
  const isHashedAsset = url.pathname.startsWith("/assets/");
  const isNavigation = request.mode === "navigate";

  if (isHashedAsset) {
    // Cache-first - nama file udah unik per build (content-hash Vite), jadi
    // begitu ke-cache SELALU valid, gak akan pernah jadi basi.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          if (resp.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, resp.clone()));
          return resp;
        });
      })
    );
    return;
  }

  if (isNavigation) {
    // Network-first buat halaman utama - biar user yang online SELALU dapet
    // versi terbaru, fallback ke shell yang ke-cache CUMA kalau beneran
    // offline/network gagal (lebih baik dari halaman error browser polos).
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) caches.open(CACHE_NAME).then((cache) => cache.put("/", resp.clone()));
          return resp;
        })
        .catch(() => caches.match("/"))
    );
  }
});
