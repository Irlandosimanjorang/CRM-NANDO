-- Jenis produk per deal (1 Okt 2026, permintaan Nando untuk Corporate
-- Consultant: Rise / In House Training / Public Class / Coaching Mentoring /
-- isian bebas). Kolom opsional, nullable - deal lama tidak terpengaruh.
alter table public.deal_transactions add column if not exists product_type text;
