-- Pipeline dan profil perusahaan hanya bisa diubah owner (13 Okt 2026). Anggota tim tetap bisa membaca,
-- jadi perubahan owner ikut terlihat di semua akun sales. Produk (katalog) tetap bisa diatur owner dan manager.

-- 1. Tahap pipeline: baca untuk semua anggota organisasi, tulis hanya owner.
drop policy if exists org_access on public.stages;
create policy stages_select on public.stages for select
  using (org_id in (select my_org_ids()));
create policy stages_owner_write on public.stages for all
  using (org_id in (select o.id from public.organizations o where o.owner_user_id = auth.uid()))
  with check (org_id in (select o.id from public.organizations o where o.owner_user_id = auth.uid()));

-- 2. Profil perusahaan (company_profile) di org_product_catalog: hanya owner yang boleh mengubah isinya.
-- Manager tetap bisa menambah dan mengubah produk, asalkan company_profile tidak berubah.
create or replace function public.guard_product_profile_owner()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  -- Panggilan tanpa sesi pengguna (service role, edge function) tidak dibatasi di sini.
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' and coalesce(new.company_profile, '') = '' then return new; end if;
  if tg_op = 'UPDATE' and new.company_profile is not distinct from old.company_profile then return new; end if;
  if exists (select 1 from public.organizations o where o.id = new.org_id and o.owner_user_id = auth.uid()) then return new; end if;
  raise exception 'Profil perusahaan hanya bisa diubah owner.';
end;
$$;

drop trigger if exists guard_product_profile_owner on public.org_product_catalog;
create trigger guard_product_profile_owner
  before insert or update on public.org_product_catalog
  for each row execute function public.guard_product_profile_owner();
