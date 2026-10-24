-- 24 Okt 2026: admin proyek melihat deal dari lead proyek yang dia input sendiri (user_id), walau belum di-assign.
drop policy if exists deal_role_access on public.deal_transactions;
create policy deal_role_access on public.deal_transactions for all to authenticated
  using (
    org_id in (select my_org_ids())
    and (
      my_role() in ('owner', 'manager')
      or lead_id in (select l.id from leads l where l.assigned_to = (select auth.uid()))
      or (my_role() = 'admin_proyek' and lead_id in (select l.id from leads l where l.user_id = (select auth.uid()) and l.track = 'proyek'))
    )
  )
  with check (
    org_id in (select my_org_ids())
    and (
      my_role() in ('owner', 'manager')
      or lead_id in (select l.id from leads l where l.assigned_to = (select auth.uid()))
      or (my_role() = 'admin_proyek' and lead_id in (select l.id from leads l where l.user_id = (select auth.uid()) and l.track = 'proyek'))
    )
  );
