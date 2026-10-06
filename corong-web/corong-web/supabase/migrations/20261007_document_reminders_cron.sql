-- Jadwal pengingat invoice client (7 Okt 2026): tiap hari 08.10 WIB (01.10 UTC),
-- 10 menit setelah pengingat invoice langganan Nexto. Perintahnya disalin dari
-- job nexto-invoice-reminders (termasuk header rahasia cron) dengan nama
-- fungsi diganti, jadi rahasia tidak tertulis di berkas ini.
select cron.schedule(
  'nexto-document-reminders',
  '10 1 * * *',
  replace(command, 'invoice-reminders', 'document-reminders')
)
from cron.job
where jobname = 'nexto-invoice-reminders'
  and not exists (select 1 from cron.job where jobname = 'nexto-document-reminders');
