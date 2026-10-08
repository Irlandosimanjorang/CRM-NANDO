-- Perapian performa tabel baru (9 Okt 2026): indeks untuk foreign key, dan kebijakan tulis ad_spend dipecah per aksi
-- supaya tidak tumpang tindih dengan kebijakan baca (hasil pemeriksaan advisor Supabase).
create index if not exists ad_spend_created_by_idx on public.ad_spend (created_by);
create index if not exists chat_webhook_log_channel_idx on public.chat_webhook_log (channel_id);
create index if not exists lead_conversations_channel_idx on public.lead_conversations (channel_id);
create index if not exists lead_messages_org_idx on public.lead_messages (org_id);

drop policy if exists ad_spend_write on public.ad_spend;
drop policy if exists ad_spend_insert on public.ad_spend;
drop policy if exists ad_spend_update on public.ad_spend;
drop policy if exists ad_spend_delete on public.ad_spend;
create policy ad_spend_insert on public.ad_spend for insert to authenticated
  with check (
    exists (select 1 from public.organizations o where o.id = ad_spend.org_id and o.owner_user_id = (select auth.uid()))
    or exists (select 1 from public.organization_members m where m.org_id = ad_spend.org_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager'))
  );
create policy ad_spend_update on public.ad_spend for update to authenticated
  using (
    exists (select 1 from public.organizations o where o.id = ad_spend.org_id and o.owner_user_id = (select auth.uid()))
    or exists (select 1 from public.organization_members m where m.org_id = ad_spend.org_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager'))
  )
  with check (
    exists (select 1 from public.organizations o where o.id = ad_spend.org_id and o.owner_user_id = (select auth.uid()))
    or exists (select 1 from public.organization_members m where m.org_id = ad_spend.org_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager'))
  );
create policy ad_spend_delete on public.ad_spend for delete to authenticated
  using (
    exists (select 1 from public.organizations o where o.id = ad_spend.org_id and o.owner_user_id = (select auth.uid()))
    or exists (select 1 from public.organization_members m where m.org_id = ad_spend.org_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager'))
  );
