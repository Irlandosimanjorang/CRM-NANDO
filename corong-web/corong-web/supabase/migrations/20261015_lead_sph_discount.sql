-- No. SPH dan total diskon per lead (15 Okt 2026). Diisi saat lead pindah ke tahap Proyek Deal,
-- atau lewat LeadModal. Nilai proyek tetap di deal_value (bruto); diskon dicatat terpisah.
alter table public.leads
  add column if not exists sph_number text not null default '',
  add column if not exists discount_total numeric not null default 0;
