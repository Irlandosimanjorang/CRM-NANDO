-- 17 Okt 2026: sales juga melihat lead yang dia buat sendiri selagi belum di-assign ke siapa pun.
-- Lead yang sudah di-assign ke orang lain tetap tidak terlihat oleh pembuatnya.
-- Sudah diterapkan ke database lewat MCP dan diuji di transaksi yang di-rollback.

drop policy if exists leads_select_access on public.leads;
create policy leads_select_access on public.leads for select
  using (
    org_id in (select my_org_ids())
    and (
      my_role() in ('owner', 'manager')
      or assigned_to = (select auth.uid())
      or (assigned_to is null and user_id = (select auth.uid()))
    )
  );
