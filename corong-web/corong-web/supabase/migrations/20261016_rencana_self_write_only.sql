-- Rencana tim (16 Okt 2026): rencana hanya ditulis oleh pemiliknya (marketing). Owner dan manager hanya melihat rencana seluruh tim.
drop policy if exists rencana_insert on public.rencana;
drop policy if exists rencana_update on public.rencana;
drop policy if exists rencana_delete on public.rencana;
create policy rencana_insert on public.rencana for insert
  with check (org_id in (select my_org_ids()) and user_id = (select auth.uid()));
create policy rencana_update on public.rencana for update
  using (org_id in (select my_org_ids()) and user_id = (select auth.uid()))
  with check (org_id in (select my_org_ids()) and user_id = (select auth.uid()));
create policy rencana_delete on public.rencana for delete
  using (org_id in (select my_org_ids()) and user_id = (select auth.uid()));
