-- Target Report memakai sistem target tab Team (sales_targets), jadi kolom target buatan sendiri dibuang (9 Okt 2026).
alter table public.organizations drop column if exists monthly_target;
alter table public.organizations drop column if exists member_targets;
