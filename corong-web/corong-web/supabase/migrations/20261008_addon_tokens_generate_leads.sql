-- Token tambahan (add-on) Generate Leads (8 Okt 2026, permintaan Nando): pengguna yang kuota
-- bulanannya habis (4 pencarian per periode) bisa memakai token tambahan yang diberikan admin
-- (misalnya setelah membeli paket token). 1 token = 1 pencarian.
--
-- Aturan:
--  * Token milik PENGGUNA (sama seperti kuota bulanan), bukan organisasi.
--  * Dipakai SETELAH kuota bulanan habis; bukan pengganti paket (batas paket Professional ke atas tetap).
--  * Satu "lot" = satu pemberian: jumlah token, sisa, kedaluwarsa (opsional), catatan.
--    Lot yang paling cepat kedaluwarsa dipakai lebih dulu; lot yang sudah lewat tidak dipakai.
--  * Pencarian yang gagal mengembalikan tokennya (release_lead_gen_slot).
--  * Pencarian berbayar token TIDAK dihitung sebagai pemakaian kuota bulanan (lead_gen_runs.addon_lot_id).
--  * Klien hanya bisa MEMBACA lot miliknya; memberi/mencabut hanya lewat edge function admin-addon-tokens.
create table if not exists public.addon_token_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null default 'generate-leads' check (feature in ('generate-leads')),
  tokens_total int not null check (tokens_total > 0),
  tokens_left int not null check (tokens_left >= 0),
  expires_at timestamptz,
  note text not null default '',
  granted_by text not null default '',
  created_at timestamptz not null default now(),
  check (tokens_left <= tokens_total)
);
create index if not exists addon_token_lots_user_idx on public.addon_token_lots (user_id, feature, expires_at);
alter table public.addon_token_lots enable row level security;
drop policy if exists addon_token_lots_select_own on public.addon_token_lots;
create policy addon_token_lots_select_own on public.addon_token_lots for select to authenticated
  using (user_id = (select auth.uid()));

alter table public.lead_gen_runs
  add column if not exists addon_lot_id uuid references public.addon_token_lots(id) on delete set null;

-- Saldo token untuk pengguna yang sedang login.
create or replace function public.my_addon_tokens(p_feature text default 'generate-leads')
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'tokens', coalesce(sum(tokens_left), 0),
    'next_expiry', min(expires_at)
  )
  from public.addon_token_lots
  where user_id = auth.uid() and feature = p_feature and tokens_left > 0
    and (expires_at is null or expires_at > now());
$$;
revoke all on function public.my_addon_tokens(text) from public, anon;
grant execute on function public.my_addon_tokens(text) to authenticated;

-- Pemakaian kuota bulanan Generate Leads TIDAK menghitung pencarian berbayar token.
create or replace function public.quota_usage(p_user_id uuid, p_feature text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cycle tstzrange := quota_plan_cycle(p_user_id);
  v_start timestamptz;
  v_reset timestamptz;
  v_used int := 0;
begin
  if v_cycle is not null then
    v_start := lower(v_cycle);
    v_reset := upper(v_cycle);
  else
    v_start := quota_current_start(p_user_id, p_feature, false);
    v_reset := v_start + interval '1 month';
  end if;
  if v_start is not null then
    if p_feature = 'generate-leads' then
      select count(*) into v_used from lead_gen_runs where user_id = p_user_id and generated_at >= v_start and addon_lot_id is null;
    elsif p_feature = 'checkin' then
      select count(*) into v_used from visit_checkins where user_id = p_user_id and checked_in_at >= v_start;
    else
      select count(*) into v_used from edge_function_calls where user_id = p_user_id and function_name = p_feature and called_at >= v_start;
    end if;
  end if;
  return jsonb_build_object('used', v_used, 'period_start', v_start, 'reset_at', v_reset, 'source', case when v_cycle is not null then 'plan' else 'first_use' end);
end;
$$;

-- Kuota habis -> coba token tambahan (lot tercepat kedaluwarsa dulu).
create or replace function public.reserve_lead_gen_slot(p_org_id uuid, p_max integer default 4, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_start timestamptz;
  v_count int := 0;
  v_id uuid;
  v_lot uuid;
begin
  perform pg_advisory_xact_lock(hashtext('lead_gen_quota:' || coalesce(p_user_id::text, p_org_id::text)));
  if p_user_id is not null then
    v_start := quota_current_start(p_user_id, 'generate-leads', false);
    if v_start is not null then
      select count(*) into v_count from lead_gen_runs where user_id = p_user_id and generated_at >= v_start and addon_lot_id is null;
    end if;
  else
    select count(*) into v_count from lead_gen_runs
    where org_id = p_org_id and generated_at >= date_trunc('month', (now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta';
  end if;
  if v_count >= p_max then
    if p_user_id is not null then
      select id into v_lot from addon_token_lots
       where user_id = p_user_id and feature = 'generate-leads' and tokens_left > 0 and (expires_at is null or expires_at > now())
       order by expires_at asc nulls last, created_at asc
       limit 1
       for update;
      if v_lot is not null then
        update addon_token_lots set tokens_left = tokens_left - 1 where id = v_lot;
        insert into lead_gen_runs (org_id, user_id, generated_at, addon_lot_id) values (p_org_id, p_user_id, now(), v_lot) returning id into v_id;
        return v_id;
      end if;
    end if;
    return null;
  end if;
  if p_user_id is not null then
    perform quota_current_start(p_user_id, 'generate-leads', true);
  end if;
  insert into lead_gen_runs (org_id, user_id, generated_at) values (p_org_id, p_user_id, now()) returning id into v_id;
  return v_id;
end;
$$;

-- Pencarian gagal -> slot dilepas; kalau dibayar token, token dikembalikan.
create or replace function public.release_lead_gen_slot(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_lot uuid;
begin
  select addon_lot_id into v_lot from lead_gen_runs where id = p_run_id;
  delete from lead_gen_runs where id = p_run_id;
  if v_lot is not null then
    update addon_token_lots set tokens_left = least(tokens_total, tokens_left + 1) where id = v_lot;
  end if;
end;
$$;
