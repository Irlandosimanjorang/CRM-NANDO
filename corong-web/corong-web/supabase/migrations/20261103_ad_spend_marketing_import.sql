-- Impor data iklan untuk semua anggota marketing (3 Nov 2026). Sebelumnya ad_spend hanya bisa ditulis owner dan manager.
-- Sekarang anggota org mana pun boleh menulis data iklan org-nya. Pembacaan tidak berubah (anggota org).
-- Budget per orang (ad_budgets) tidak diubah: anggota sudah bisa mengatur budget miliknya sendiri.

drop policy if exists ad_spend_write on public.ad_spend;
create policy ad_spend_write on public.ad_spend for all to authenticated
  using (org_id in (select public.my_member_org_ids()))
  with check (org_id in (select public.my_member_org_ids()));
