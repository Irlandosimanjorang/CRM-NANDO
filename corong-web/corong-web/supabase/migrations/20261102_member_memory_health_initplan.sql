-- Audit performa (2 Nov 2026): bungkus auth.uid() dengan select supaya tidak dihitung ulang per baris.
-- Logika akses sama seperti sebelumnya: anggota melihat baris miliknya sendiri, owner melihat semua baris org-nya.

drop policy if exists member_memory_health_select on public.member_memory_health;
create policy member_memory_health_select on public.member_memory_health for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.organization_members om
    where om.org_id = member_memory_health.org_id
      and om.user_id = (select auth.uid())
      and om.role = 'owner'::text
  )
);
