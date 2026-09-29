-- lead_needs_summaries & ai_drafts sebelumnya pakai akses per-ORG (semua
-- anggota org bisa baca), padahal janji plan Enterprise: sales_rep gak boleh
-- liat data lead sales lain. Disamain sama pola progress_notes/visit_checkins:
-- owner/manager liat semua, sales_rep cuma baris yang lead-nya di-assign ke
-- dia.
--
-- Sudah diterapkan ke project cewggulyfshnbebcpyui via migration
-- "role_based_access_ai_drafts_needs_summaries" (29 Sep 2026). Dokumentasi lokal.

drop policy if exists lead_needs_summaries_org_access on public.lead_needs_summaries;
create policy lead_needs_summaries_role_access on public.lead_needs_summaries
  for all
  using ((org_id in (select my_org_ids())) and ((my_role() = any (array['owner','manager'])) or (lead_id in (select leads.id from leads where leads.assigned_to = (select auth.uid())))))
  with check ((org_id in (select my_org_ids())) and ((my_role() = any (array['owner','manager'])) or (lead_id in (select leads.id from leads where leads.assigned_to = (select auth.uid())))));

drop policy if exists ai_drafts_org_access on public.ai_drafts;
create policy ai_drafts_role_access on public.ai_drafts
  for all
  using ((org_id in (select my_org_ids())) and ((my_role() = any (array['owner','manager'])) or (lead_id in (select leads.id from leads where leads.assigned_to = (select auth.uid())))))
  with check ((org_id in (select my_org_ids())) and ((my_role() = any (array['owner','manager'])) or (lead_id in (select leads.id from leads where leads.assigned_to = (select auth.uid())))));
