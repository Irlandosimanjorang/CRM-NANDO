// Supabase Edge Function: weekly-cleanup-check
// DIMATIIN PERMANEN (16 Sep 2026, permintaan Nando).
//
// Fitur "Rapihin Data" versi OTOMATIS-MINGGUAN via Telegram ini dihapus atas
// permintaan langsung Nando. Cron job Postgres yang manggil function ini
// (`nexto-weekly-cleanup-check`, tiap Senin jam 2 pagi) UDAH di-unschedule
// (`select cron.unschedule('nexto-weekly-cleanup-check')`), jadi function ini
// SEHARUSNYA gak pernah kepanggil lagi sama sekali. Kode di bawah cuma stub
// jaga-jaga - kalau somehow ke-invoke manual, langsung nolak, gak ngerjain apa-apa.
//
// PENTING: fitur "Rapihin Data" versi MANUAL (tombol di tab Pengaturan, buka
// DataCleanupModal.jsx, pake edge function suggest-categories) TETAP ADA -
// itu FITUR TERPISAH yang beda sama sekali dari cron mingguan ini, gak
// disentuh sama sekali. Yang dihapus CUMA versi otomatis-tiap-Senin ini.
Deno.serve(async (req) => {
  return new Response(
    JSON.stringify({ ok: false, note: "Fitur weekly-cleanup-check udah dimatiin permanen atas permintaan Nando (16 Sep 2026). Rapihin Data versi manual masih ada di tab Pengaturan." }),
    { status: 410, headers: { "Content-Type": "application/json" } }
  );
});
