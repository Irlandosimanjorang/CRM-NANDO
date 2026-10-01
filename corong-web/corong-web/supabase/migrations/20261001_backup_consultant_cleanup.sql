-- Cadangan kategori & tipe perusahaan lead org Nando sebelum dirapikan ke
-- istilah Corporate Consultant (1 Okt 2026). Untuk mengembalikan:
--   update leads l set category = b.category, company_type = b.company_type
--   from _backup_consultant_cleanup_20261001 b where l.id = b.id;
create table if not exists public._backup_consultant_cleanup_20261001 as
  select id, category, company_type, now() as backed_up_at
  from public.leads where org_id = '217d90e3-36dd-4879-99c2-0de2be11d360';
alter table public._backup_consultant_cleanup_20261001 enable row level security;
