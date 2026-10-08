-- Target omzet bulanan per organisasi (9 Okt 2026), dipakai laporan bulanan sales (saklar monthly_report).
-- Owner boleh mengubahnya sendiri lewat kebijakan update organisasi yang sudah ada.
alter table public.organizations add column if not exists monthly_target bigint not null default 0 check (monthly_target >= 0);
