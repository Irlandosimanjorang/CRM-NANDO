-- Rencana tim marketing (16 Okt 2026): rencana kegiatan per tanggal, diisi marketing untuk dirinya sendiri.
-- Owner dan manager bisa melihat dan mengubah rencana semua anggota.
create table if not exists public.rencana (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  plan_date date not null,
  title text not null default '',
  kind text not null default 'lainnya',
  target_value numeric not null default 0,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rencana_org_date_idx on public.rencana (org_id, plan_date);
alter table public.rencana enable row level security;
create policy rencana_select on public.rencana for select
  using (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])));
create policy rencana_insert on public.rencana for insert
  with check (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])));
create policy rencana_update on public.rencana for update
  using (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])))
  with check (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])));
create policy rencana_delete on public.rencana for delete
  using (org_id in (select my_org_ids()) and ((user_id = (select auth.uid())) or (select my_role()) = any (array['owner'::text, 'manager'::text])));
grant select, insert, update, delete on public.rencana to authenticated;
alter publication supabase_realtime add table public.rencana;
