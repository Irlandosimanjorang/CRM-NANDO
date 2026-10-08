-- Hapus data dummy BSB dan akun uji (dibuat 9 Okt 2026). Lead dummy bertanda source = 'dummy';
-- data iklan dummy bernama kampanye '[DUMMY] ...'. Jalankan per organisasi (ganti id) di SQL Editor Supabase.
-- BSB: 43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0 | akun uji (nexto.agent): f7bd24c5-4bb2-4237-8a58-87bd8b0f7413
delete from deal_transactions where lead_id in (select id from leads where org_id = '<ORG_ID>' and source = 'dummy');
delete from progress_notes where lead_id in (select id from leads where org_id = '<ORG_ID>' and source = 'dummy');
delete from leads where org_id = '<ORG_ID>' and source = 'dummy';
delete from ad_spend where org_id = '<ORG_ID>' and campaign like '[DUMMY]%';
-- opsional: update organizations set monthly_target = 0 where id = '<ORG_ID>';
