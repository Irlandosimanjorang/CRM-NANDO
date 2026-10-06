-- Jenis visit: offline (tatap muka) atau online (7 Okt 2026, permintaan Nando).
-- Bawaan 'offline' supaya semua jadwal visit yang sudah ada tetap bermakna sama.
-- Penambahan kolom dengan nilai bawaan konstan tidak menulis ulang baris dan
-- tidak memicu trigger UPDATE (jadi tidak membanjiri log aktivitas).
alter table public.leads
  add column if not exists visit_mode text not null default 'offline'
  check (visit_mode in ('offline', 'online'));
