-- SUDAH DIJALANKAN manual oleh Nando di Supabase SQL Editor (30 Sep 2026).
-- Paket Enterprise team habis -> anggota selain owner dikunci dari data team.
-- Owner tetap bisa masuk. Data tidak dihapus; begitu Enterprise aktif lagi,
-- akses anggota otomatis kembali.

create or replace function public.my_member_org_ids()
returns setof uuid
language sql stable security definer
set search_path to 'public'
as $$
  select org_id from organization_members where user_id = auth.uid();
$$;

create or replace function public.my_org_ids()
returns setof uuid
language sql stable security definer
set search_path to 'public'
as $$
  select m.org_id
  from organization_members m
  join organizations o on o.id = m.org_id
  where m.user_id = auth.uid()
    and (m.role = 'owner' or o.owner_user_id = auth.uid() or o.plan = 'enterprise');
$$;

alter policy members_view on public.organization_members
  using (org_id in (select public.my_member_org_ids()));
alter policy org_view on public.organizations
  using (id in (select public.my_member_org_ids()));
