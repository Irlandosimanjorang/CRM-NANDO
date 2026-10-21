-- 21 Okt 2026: pipeline MAP punya pop-up di tahap Deal (tanggal, barang) dan Faktur (tanggal, no. faktur, nominal).
-- Kolom baru di leads: tanggal masuk tahap Deal dan nomor faktur. Barang memakai kolom product yang sudah ada,
-- tanggal dan nominal faktur memakai deal_date dan deal_value yang sudah dipakai untuk omzet.
-- Fitur diaktifkan per organisasi lewat saklar invoice_pipeline (MAP).

alter table public.leads add column if not exists deal_stage_date date;
alter table public.leads add column if not exists invoice_number text;

update public.organizations
  set features = features || '{"invoice_pipeline": true}'::jsonb
  where id = 'b6c256bb-681d-4833-af10-ebb665c6d2d0';
