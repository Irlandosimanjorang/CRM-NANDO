-- Hardening Nexto <-> Journey (sisi Nexto).
-- Sudah diterapkan manual ke project CRM Nexto (cewggulyfshnbebcpyui) pada 2026-11-09.
-- File ini dibuat agar repo dan database tetap sinkron. Aman dijalankan ulang (idempotent).
--
-- 1. sync_drawing_ke_journey(): fungsi trigger, tidak perlu dipanggil lewat RPC.
--    Trigger tetap jalan karena privilege EXECUTE hanya dicek saat CREATE TRIGGER.
-- 2. kunci_so_di_memo(): set search_path agar tidak bisa dibelokkan lewat schema lain.
--
-- Catatan: cabut EXECUTE dari anon pada journey_set_spk_diterima / journey_tandai_dp /
-- journey_terima_so BELUM dilakukan di sini. Lihat docs/journey-integration-hardening.md.

revoke execute on function public.sync_drawing_ke_journey() from anon, authenticated, public;

alter function public.kunci_so_di_memo() set search_path = public;
