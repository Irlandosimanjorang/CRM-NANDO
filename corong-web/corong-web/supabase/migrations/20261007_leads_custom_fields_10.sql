-- Slot field custom lead dinaikkan dari 5 ke 10 (7 Okt 2026, permintaan Nando).
-- Kolom baru custom_field_6..10 sama dengan custom_field_1..5 (text, bawaan '').
-- Nilai bawaan konstan: metadata saja, tidak menulis ulang baris dan tidak
-- memicu trigger UPDATE (tidak membanjiri log aktivitas).
alter table public.leads
  add column if not exists custom_field_6 text not null default '',
  add column if not exists custom_field_7 text not null default '',
  add column if not exists custom_field_8 text not null default '',
  add column if not exists custom_field_9 text not null default '',
  add column if not exists custom_field_10 text not null default '';
