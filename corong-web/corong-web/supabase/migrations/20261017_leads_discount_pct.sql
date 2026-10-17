-- 17 Okt 2026: total diskon proyek (org project_deal, BSB) diisi dalam persen.
-- discount_total (Rp) tetap dipakai oleh tampilan lain dan dihitung dari discount_pct di aplikasi (db.upsertLead).
-- Sudah diterapkan ke database lewat MCP.

alter table public.leads add column if not exists discount_pct numeric(5,2);
comment on column public.leads.discount_pct is 'Total diskon dalam persen dari nilai proyek (org project_deal). discount_total dihitung dari persen ini.';
