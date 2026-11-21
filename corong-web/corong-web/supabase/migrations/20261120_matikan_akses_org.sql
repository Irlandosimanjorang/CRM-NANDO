-- Matikan seluruh akses org (owner dan anggota), dipakai untuk org MAP (20 Nov 2026).
-- Sudah diterapkan ke produksi lewat execute_sql. Data tidak dihapus; kembalikan dengan
-- update organizations set akses_dihentikan = false where id = '<org_id>'.
-- Service role (edge function) tetap bisa mengakses data, karena melewati RLS.

begin;
alter table public.organizations add column if not exists akses_dihentikan boolean not null default false;
update public.organizations set akses_dihentikan = true where id = 'b6c256bb-681d-4833-af10-ebb665c6d2d0';

create or replace function public.org_akses_aktif(p_org uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$ select not coalesce((select o.akses_dihentikan from public.organizations o where o.id = p_org), false) $$;

create or replace function public.my_member_org_ids()
returns setof uuid language sql stable security definer set search_path to 'public'
as $$
  select m.org_id from organization_members m join organizations o on o.id = m.org_id
  where m.user_id = auth.uid() and not o.akses_dihentikan;
$$;

create or replace function public.my_org_ids()
returns setof uuid language sql stable security definer set search_path to 'public'
as $$
  select m.org_id
  from organization_members m
  join organizations o on o.id = m.org_id
  where m.user_id = auth.uid()
    and (m.role = 'owner' or o.owner_user_id = auth.uid() or o.plan = 'enterprise')
    and not o.akses_dihentikan;
$$;

-- Policy yang mengecek pemilik langsung: ditambah syarat org_akses_aktif.
alter policy ad_spend_select on public.ad_spend using (public.org_akses_aktif(ad_spend.org_id) and ((exists (select 1 from organizations o where ((o.id = ad_spend.org_id) and (o.owner_user_id = (select auth.uid() as uid))))) or (exists (select 1 from organization_members m where ((m.org_id = ad_spend.org_id) and (m.user_id = (select auth.uid() as uid)) and (m.role = any (array['owner'::text, 'manager'::text])))))));
alter policy ad_spend_delete on public.ad_spend using (public.org_akses_aktif(ad_spend.org_id) and ((exists (select 1 from organizations o where ((o.id = ad_spend.org_id) and (o.owner_user_id = (select auth.uid() as uid))))) or (exists (select 1 from organization_members m where ((m.org_id = ad_spend.org_id) and (m.user_id = (select auth.uid() as uid)) and (m.role = any (array['owner'::text, 'manager'::text])))))));
alter policy ad_spend_update on public.ad_spend using (public.org_akses_aktif(ad_spend.org_id) and ((exists (select 1 from organizations o where ((o.id = ad_spend.org_id) and (o.owner_user_id = (select auth.uid() as uid))))) or (exists (select 1 from organization_members m where ((m.org_id = ad_spend.org_id) and (m.user_id = (select auth.uid() as uid)) and (m.role = any (array['owner'::text, 'manager'::text])))))) ) with check (public.org_akses_aktif(ad_spend.org_id) and ((exists (select 1 from organizations o where ((o.id = ad_spend.org_id) and (o.owner_user_id = (select auth.uid() as uid))))) or (exists (select 1 from organization_members m where ((m.org_id = ad_spend.org_id) and (m.user_id = (select auth.uid() as uid)) and (m.role = any (array['owner'::text, 'manager'::text])))))));
alter policy ad_spend_insert on public.ad_spend with check (public.org_akses_aktif(ad_spend.org_id) and ((exists (select 1 from organizations o where ((o.id = ad_spend.org_id) and (o.owner_user_id = (select auth.uid() as uid))))) or (exists (select 1 from organization_members m where ((m.org_id = ad_spend.org_id) and (m.user_id = (select auth.uid() as uid)) and (m.role = any (array['owner'::text, 'manager'::text])))))));

alter policy chat_channels_owner on public.chat_channels using (public.org_akses_aktif(chat_channels.org_id) and exists (select 1 from organizations o where o.id = chat_channels.org_id and o.owner_user_id = (select auth.uid()))) with check (public.org_akses_aktif(chat_channels.org_id) and exists (select 1 from organizations o where o.id = chat_channels.org_id and o.owner_user_id = (select auth.uid())));
alter policy chat_webhook_log_owner on public.chat_webhook_log using (public.org_akses_aktif(chat_webhook_log.org_id) and exists (select 1 from organizations o where o.id = chat_webhook_log.org_id and o.owner_user_id = (select auth.uid())));

alter policy invite_owner_manage on public.org_invite_codes using (public.org_akses_aktif(org_id) and org_id in (select organizations.id from organizations where organizations.owner_user_id = (select auth.uid()))) with check (public.org_akses_aktif(org_id) and org_id in (select organizations.id from organizations where organizations.owner_user_id = (select auth.uid())));

alter policy members_manage_owner on public.organization_members using (public.org_akses_aktif(org_id) and org_id in (select organizations.id from organizations where organizations.owner_user_id = (select auth.uid())));
alter policy members_update_owner on public.organization_members using (public.org_akses_aktif(org_id) and org_id in (select organizations.id from organizations where organizations.owner_user_id = (select auth.uid()))) with check (public.org_akses_aktif(org_id) and org_id in (select organizations.id from organizations where organizations.owner_user_id = (select auth.uid())));

alter policy org_update_owner on public.organizations using (public.org_akses_aktif(id) and owner_user_id = (select auth.uid()));

alter policy stages_delete on public.stages using (public.org_akses_aktif(org_id) and org_id in (select o.id from organizations o where o.owner_user_id = (select auth.uid())));
alter policy stages_insert on public.stages with check (public.org_akses_aktif(org_id) and org_id in (select o.id from organizations o where o.owner_user_id = (select auth.uid())));
alter policy stages_update on public.stages using (public.org_akses_aktif(org_id) and org_id in (select o.id from organizations o where o.owner_user_id = (select auth.uid()))) with check (public.org_akses_aktif(org_id) and org_id in (select o.id from organizations o where o.owner_user_id = (select auth.uid())));
commit;
