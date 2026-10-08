-- Hapus data dummy BSB dan akun uji (dibuat 9 Okt 2026). Lead dummy bertanda source = 'dummy';
-- data iklan dummy bernama kampanye '[DUMMY] ...'. Jalankan per organisasi (ganti id) di SQL Editor Supabase.
-- BSB: 43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0 | akun uji (nexto.agent): f7bd24c5-4bb2-4237-8a58-87bd8b0f7413
delete from deal_transactions where lead_id in (select id from leads where org_id = '<ORG_ID>' and source = 'dummy');
delete from progress_notes where lead_id in (select id from leads where org_id = '<ORG_ID>' and source = 'dummy');
delete from leads where org_id = '<ORG_ID>' and source = 'dummy';
delete from ad_spend where org_id = '<ORG_ID>' and campaign like '[DUMMY]%';
-- opsional: update organizations set monthly_target = 0 where id = '<ORG_ID>';

-- Anggota dummy akun uji (Adi, Dian, Reza, Rika, Renika; email *.dummy@example.com, tidak bisa login):
-- hapus lead dummy lebih dulu (skrip di atas), lalu riwayat dan akun-akunnya.
delete from lead_stage_changes where org_id = '<ORG_ID>' and lead_id not in (select id from leads where org_id = '<ORG_ID>');
delete from organization_members where user_id in (select id from auth.users where email like '%.dummy@example.com');
delete from auth.users where email like '%.dummy@example.com';

-- Chat dummy dari webhook (akun uji): lead bernomor +62812999900x serta tiga lead chat tanpa nomor.
-- Percakapan dan pesan ikut terhapus otomatis (cascade). Catatan webhook dihapus terpisah.
delete from leads where org_id = '<ORG_ID>' and (phone like '+62812999900%' or ad_campaign like '[DUMMY]%' and source in ('Meta', 'TikTok', 'WhatsApp', 'Instagram') and id in (select lead_id from lead_conversations where org_id = '<ORG_ID>'));
delete from chat_webhook_log where org_id = '<ORG_ID>';
