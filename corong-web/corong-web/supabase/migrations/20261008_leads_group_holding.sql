-- Holding / Group (8 Okt 2026, permintaan Nando): tingkat paling atas di atas "perusahaan induk"
-- (parent_company). Hirarki: Holding/Group > Perusahaan > Anak perusahaan (lead itu sendiri).
-- Teks bebas, opsional. Nilai bawaan konstan: metadata saja, tidak menulis ulang baris dan
-- tidak memicu trigger UPDATE (tidak membanjiri log aktivitas).
alter table public.leads
  add column if not exists group_holding text not null default '';
