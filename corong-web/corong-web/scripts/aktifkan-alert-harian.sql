-- Alert harian owner (edge function daily-alerts) dan pengaman laporan mingguan. Jalankan di Supabase SQL Editor.
-- 1. Nyalakan alert harian hanya untuk akun uji (nexto.agent@gmail.com). Penerima = email owner dan manager organisasi itu.
update organizations set features = features || '{"daily_alerts": true}'::jsonb
where id = 'f7bd24c5-4bb2-4237-8a58-87bd8b0f7413';

-- 2. BSB masih berisi data dummy: matikan laporan mingguan Senin untuk BSB sampai dummy dihapus.
--    (Edge function weekly-team-report versi baru harus sudah di-deploy agar saklar ini dibaca.)
update organizations set features = features || '{"weekly_report_off": true}'::jsonb
where id = '43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0';
-- Nanti, setelah dummy dihapus dan BSB siap menerima laporan:
-- update organizations set features = features - 'weekly_report_off' where id = '43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0';

-- 3. Jadwal harian (07:30 WIB = 00:30 UTC). Salin perintah job laporan mingguan agar memakai kunci cron yang sama:
--    select command from cron.job where jobname = 'nexto-weekly-team-report';
--    Lalu buat job baru dengan perintah itu, ganti alamat fungsi weekly-team-report menjadi daily-alerts:
-- select cron.schedule('nexto-daily-alerts', '30 0 * * *', $$ <perintah yang disalin, alamat diganti daily-alerts> $$);

-- Tes tanpa mengirim email (dry run) dari terminal, ganti <PROJECT> dan <CRON_SECRET>:
--   curl -H "x-cron-secret: <CRON_SECRET>" "https://<PROJECT>.supabase.co/functions/v1/daily-alerts?dry=true&org_id=f7bd24c5-4bb2-4237-8a58-87bd8b0f7413"
