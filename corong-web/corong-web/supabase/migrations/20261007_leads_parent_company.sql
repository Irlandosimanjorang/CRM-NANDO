-- Grup / induk perusahaan (7 Okt 2026, permintaan Nando): satu perusahaan
-- dengan banyak kantor cabang dicatat sebagai banyak lead yang berbagi nama
-- induk yang sama. Teks bebas; tidak ada tabel terpisah.
-- Nilai bawaan konstan: metadata saja, tidak menulis ulang baris dan tidak
-- memicu trigger UPDATE (tidak membanjiri log aktivitas).
alter table public.leads
  add column if not exists parent_company text not null default '';
