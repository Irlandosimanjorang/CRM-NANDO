-- Target omzet per marketing (9 Okt 2026): {"<user_id>": angka}. Tanpa isian, anggota memakai monthly_target
-- (target bawaan per orang). Owner mengubahnya lewat kebijakan update organisasi yang sudah ada.
alter table public.organizations add column if not exists member_targets jsonb not null default '{}'::jsonb;
