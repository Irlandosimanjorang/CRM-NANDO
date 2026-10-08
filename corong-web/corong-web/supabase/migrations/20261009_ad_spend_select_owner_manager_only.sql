-- Biaya iklan hanya boleh dibaca owner dan manager (9 Okt 2026). Sebelumnya semua anggota organisasi bisa
-- membacanya lewat API walaupun tampilan Report untuk marketing biasa menyembunyikannya.
drop policy if exists ad_spend_select on public.ad_spend;
create policy ad_spend_select on public.ad_spend for select to authenticated
  using (
    exists (select 1 from public.organizations o where o.id = ad_spend.org_id and o.owner_user_id = (select auth.uid()))
    or exists (select 1 from public.organization_members m where m.org_id = ad_spend.org_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager'))
  );
