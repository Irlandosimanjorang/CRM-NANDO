-- Pengeluaran iklan dan budget per marketing (16 Okt 2026): marketing mengisi pengeluaran dan budget miliknya sendiri.
-- Owner dan manager tetap bisa mengisi untuk semua marketing.
drop policy if exists ad_expenses_insert on public.ad_expenses;
drop policy if exists ad_expenses_update on public.ad_expenses;
drop policy if exists ad_expenses_delete on public.ad_expenses;

create policy ad_expenses_insert on public.ad_expenses for insert
  with check (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])));
create policy ad_expenses_update on public.ad_expenses for update
  using (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])))
  with check (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])));
create policy ad_expenses_delete on public.ad_expenses for delete
  using (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])));

drop policy if exists ad_budgets_write on public.ad_budgets;
create policy ad_budgets_write on public.ad_budgets for all
  using (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])))
  with check (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])));
