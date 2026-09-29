-- Index foreign key lead_needs_summaries (ketauan RAKA/health-check, 30 Sep 2026).
-- Sudah diterapkan ke project cewggulyfshnbebcpyui via migration
-- "index_lead_needs_summaries_fkeys". Dokumentasi lokal.
create index if not exists lead_needs_summaries_org_id_idx on public.lead_needs_summaries (org_id);
create index if not exists lead_needs_summaries_generated_by_idx on public.lead_needs_summaries (generated_by);
