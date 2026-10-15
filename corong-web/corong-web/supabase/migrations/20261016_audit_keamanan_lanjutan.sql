-- Audit keamanan & performa (16 Okt 2026), perubahan yang sudah diterapkan ke database:
-- 1. RLS: auth.uid() dibungkus (select auth.uid()) di policy documents, quota_periods, stages, member_commissions
--    (cegah re-evaluasi per baris). Logika akses tidak berubah.
-- 2. share count: satu akun hanya bisa menambah hitungan sekali per post (tabel community_post_shares).
-- 3. Extension vector dipindah dari schema public ke extensions; match_progress_notes diberi search_path public, extensions.
-- 4. Index untuk foreign key ad_budgets.user_id.

do $$
declare r record; q text; wc text; stmt text;
begin
  for r in select * from pg_policies where schemaname = 'public' and tablename in ('documents','quota_periods','stages','member_commissions') and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%') loop
    q := case when r.qual is null then null else replace(replace(r.qual, '(select auth.uid())', 'auth.uid()'), 'auth.uid()', '(select auth.uid())') end;
    wc := case when r.with_check is null then null else replace(replace(r.with_check, '(select auth.uid())', 'auth.uid()'), 'auth.uid()', '(select auth.uid())') end;
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    stmt := format('create policy %I on public.%I as %s for %s to %s', r.policyname, r.tablename, r.permissive, r.cmd, array_to_string(r.roles, ', '));
    if q is not null then stmt := stmt || ' using (' || q || ')'; end if;
    if wc is not null then stmt := stmt || ' with check (' || wc || ')'; end if;
    execute stmt;
  end loop;
end $$;

create table if not exists public.community_post_shares (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.community_post_shares enable row level security;

create or replace function public.increment_share_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Harus login.'; end if;
  insert into community_post_shares (post_id, user_id) values (p_post_id, v_uid) on conflict do nothing;
  if found then
    update community_posts set share_count = share_count + 1 where id = p_post_id;
  end if;
end;
$$;

create schema if not exists extensions;
alter function public.match_progress_notes(vector, uuid, integer) set search_path = public, extensions;
alter extension vector set schema extensions;

create index if not exists ad_budgets_user_id_idx on public.ad_budgets (user_id);
