-- 24 Okt 2026: tipe payment untuk pipeline faktur (diisi dari dialog Edit faktur).
alter table public.leads add column if not exists payment_type text;
