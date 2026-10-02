-- Pengaturan admin platform (2 Okt 2026): data penagih invoice (rekening,
-- tanda tangan, stempel) disimpan di server supaya sama di semua perangkat,
-- bukan hanya di localStorage satu browser. Tanpa policy RLS: hanya bisa
-- diakses lewat edge function admin-invoices (service role, cek ADMIN_EMAIL).
create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.admin_settings enable row level security;
revoke all on public.admin_settings from anon, authenticated;
