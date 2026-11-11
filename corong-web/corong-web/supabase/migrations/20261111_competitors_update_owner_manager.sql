-- 11 Nov 2026 - audit security: sales di org Enterprise tidak boleh mengubah data kompetitor.
-- Samakan dengan aturan DELETE yang sudah ada: owner/manager untuk Enterprise, bebas untuk paket lain.
-- Sudah diuji: update sebagai sales di org Enterprise = 0 baris.

drop policy if exists competitors_update_access on public.competitors;
create policy competitors_update_access on public.competitors
  for update to public
  using (
    org_id in (select my_org_ids())
    and (
      (my_role() = any (array['owner'::text, 'manager'::text]))
      or not exists (select 1 from organizations o where o.id = competitors.org_id and o.plan = 'enterprise')
    )
  )
  with check (
    org_id in (select my_org_ids())
    and (
      (my_role() = any (array['owner'::text, 'manager'::text]))
      or not exists (select 1 from organizations o where o.id = competitors.org_id and o.plan = 'enterprise')
    )
  );
