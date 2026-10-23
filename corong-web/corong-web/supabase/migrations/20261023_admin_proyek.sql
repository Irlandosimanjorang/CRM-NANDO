-- 23 Okt 2026: peran admin_proyek. Admin proyek hanya melihat, menambah, mengubah, dan menghapus lead
-- dengan track = 'proyek' (lead besar yang dikelola manajer). Sales hanya melihat lead track = 'umum'.
-- Owner dan manager tetap melihat semua. Admin proyek tetap dihitung sebagai anggota (kuota tidak berubah).

alter table public.leads add column if not exists track text not null default 'umum';
alter table public.leads drop constraint if exists leads_track_check;
alter table public.leads add constraint leads_track_check check (track in ('umum', 'proyek'));

drop policy if exists leads_select_access on public.leads;
create policy leads_select_access on public.leads for select to authenticated
  using (
    org_id in (select my_org_ids())
    and (
      my_role() in ('owner', 'manager')
      or (my_role() = 'admin_proyek' and track = 'proyek')
      or (my_role() is distinct from 'admin_proyek' and track = 'umum'
          and (assigned_to = (select auth.uid()) or (assigned_to is null and user_id = (select auth.uid()))))
    )
  );

drop policy if exists leads_insert_access on public.leads;
create policy leads_insert_access on public.leads for insert to authenticated
  with check (
    org_id in (select my_org_ids())
    and (
      my_role() in ('owner', 'manager')
      or (my_role() = 'admin_proyek' and track = 'proyek')
      or (my_role() is distinct from 'admin_proyek' and track = 'umum' and assigned_to = (select auth.uid()))
    )
  );

drop policy if exists leads_update_access on public.leads;
create policy leads_update_access on public.leads for update to authenticated
  using (
    org_id in (select my_org_ids())
    and (
      my_role() in ('owner', 'manager')
      or (my_role() = 'admin_proyek' and track = 'proyek')
      or (my_role() is distinct from 'admin_proyek' and track = 'umum' and assigned_to = (select auth.uid()))
    )
  )
  with check (
    org_id in (select my_org_ids())
    and (
      my_role() in ('owner', 'manager')
      or (my_role() = 'admin_proyek' and track = 'proyek')
      or (my_role() is distinct from 'admin_proyek' and track = 'umum' and assigned_to = (select auth.uid()))
    )
  );

drop policy if exists leads_delete_access on public.leads;
create policy leads_delete_access on public.leads for delete to authenticated
  using (
    org_id in (select my_org_ids())
    and (
      my_role() in ('owner', 'manager')
      or (my_role() = 'admin_proyek' and track = 'proyek')
      or (my_role() is distinct from 'admin_proyek' and track = 'umum' and assigned_to = (select auth.uid())
          and not exists (select 1 from organizations o where o.id = leads.org_id and o.plan = 'enterprise'))
    )
  );

drop policy if exists progress_role_access on public.progress_notes;
create policy progress_role_access on public.progress_notes for all to authenticated
  using (
    org_id in (select my_org_ids())
    and (
      my_role() in ('owner', 'manager')
      or lead_id in (select l.id from leads l where l.track = 'proyek' and my_role() = 'admin_proyek')
      or lead_id in (select l.id from leads l where l.track = 'umum' and l.assigned_to = (select auth.uid()))
    )
  )
  with check (
    org_id in (select my_org_ids())
    and (
      my_role() in ('owner', 'manager')
      or lead_id in (select l.id from leads l where l.track = 'proyek' and my_role() = 'admin_proyek')
      or lead_id in (select l.id from leads l where l.track = 'umum' and l.assigned_to = (select auth.uid()))
    )
  );
