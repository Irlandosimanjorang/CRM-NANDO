-- Kuota bulanan dihitung 1 bulan sejak PEMAKAIAN PERTAMA (6 Okt 2026,
-- permintaan Nando: "kalo ada client masuk tanggal 28 gimana dong gak bisa
-- maksimal"). Sebelumnya semua kuota bulanan reset tiap tanggal 1 (kalender
-- WIB), jadi pengguna yang mulai di akhir bulan hanya kebagian beberapa hari.
--
-- Aturan: tiap pengguna x fitur punya periode sendiri. Periode dimulai saat
-- fitur itu dipakai pertama kali, berlaku 1 bulan (6 Okt -> 6 Nov). Setelah
-- habis, periode berikutnya dimulai saat fitur dipakai lagi.

create table if not exists public.quota_periods (
  user_id uuid not null,
  feature text not null,
  period_start timestamptz not null,
  primary key (user_id, feature)
);
alter table public.quota_periods enable row level security;
drop policy if exists quota_periods_select_own on public.quota_periods;
create policy quota_periods_select_own on public.quota_periods for select using (user_id = auth.uid());

-- Awal periode yang sedang berjalan; null = belum ada periode aktif (pemakaian
-- 0). p_claim = true memulai periode baru saat ini kalau belum ada/sudah habis.
create or replace function public.quota_current_start(p_user_id uuid, p_feature text, p_claim boolean default false)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_start timestamptz;
begin
  select period_start into v_start from quota_periods where user_id = p_user_id and feature = p_feature;
  if v_start is not null and now() < v_start + interval '1 month' then
    return v_start;
  end if;
  if not p_claim then
    return null;
  end if;
  insert into quota_periods (user_id, feature, period_start) values (p_user_id, p_feature, now())
  on conflict (user_id, feature) do update set period_start = excluded.period_start;
  return now();
end;
$$;

-- Fitur dengan kuota bulanan lewat edge_function_calls.
create or replace function public.is_monthly_quota_feature(p_feature text)
returns boolean
language sql
immutable
as $$
  select p_feature = any (array[
    'quick-progress-note', 'transcribe-meeting', 'lead-from-url', 'summarize-lead-needs',
    'verify-selfie-photo', 'suggest-visit-points', 'guess-outcome-reason',
    'smart-import-map-ts', 'suggest-categories', 'send-lead-email'
  ]);
$$;

-- Kuota bulanan memakai periode sejak pemakaian pertama; jendela lain (harian,
-- seumur hidup Smart Import paket Free) tetap memakai p_window_start.
create or replace function public.reserve_edge_function_call(p_user_id uuid, p_function_name text, p_window_start timestamptz, p_max_calls integer)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_monthly boolean;
  v_start timestamptz;
  v_count int := 0;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_function_name));

  v_monthly := is_monthly_quota_feature(p_function_name) and p_window_start > now() - interval '40 days';
  v_start := case when v_monthly then quota_current_start(p_user_id, p_function_name, false) else p_window_start end;

  if v_start is not null then
    select count(*) into v_count
    from public.edge_function_calls
    where user_id = p_user_id and function_name = p_function_name and called_at >= v_start;
  end if;

  if v_count >= p_max_calls then
    return null;
  end if;

  if v_monthly then
    perform quota_current_start(p_user_id, p_function_name, true);
  end if;

  insert into public.edge_function_calls (user_id, function_name)
  values (p_user_id, p_function_name)
  returning id into v_id;

  return v_id;
end;
$$;

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
begin
  perform pg_advisory_xact_lock(hashtext('lead_gen_quota:' || coalesce(p_user_id::text, p_org_id::text)));
  if p_user_id is not null then
    v_start := quota_current_start(p_user_id, 'generate-leads', false);
    if v_start is not null then
      select count(*) into v_count from lead_gen_runs where user_id = p_user_id and generated_at >= v_start;
    end if;
  else
    select count(*) into v_count from lead_gen_runs
    where org_id = p_org_id and generated_at >= date_trunc('month', (now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta';
  end if;
  if v_count >= p_max then
    return null;
  end if;
  if p_user_id is not null then
    perform quota_current_start(p_user_id, 'generate-leads', true);
  end if;
  insert into lead_gen_runs (org_id, user_id, generated_at) values (p_org_id, p_user_id, now()) returning id into v_id;
  return v_id;
end;
$$;

-- Check-in GPS dihitung di aplikasi dari visit_checkins; periodenya dimulai
-- otomatis saat check-in pertama.
create or replace function public.visit_checkins_claim_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform quota_current_start(new.user_id, 'checkin', true);
  return new;
end;
$$;
drop trigger if exists visit_checkins_claim_quota on public.visit_checkins;
create trigger visit_checkins_claim_quota after insert on public.visit_checkins
for each row execute function public.visit_checkins_claim_quota();

-- Pemakaian periode berjalan + tanggal kuota terisi kembali.
create or replace function public.quota_usage(p_user_id uuid, p_feature text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_start timestamptz;
  v_used int := 0;
begin
  v_start := quota_current_start(p_user_id, p_feature, false);
  if v_start is not null then
    if p_feature = 'generate-leads' then
      select count(*) into v_used from lead_gen_runs where user_id = p_user_id and generated_at >= v_start;
    elsif p_feature = 'checkin' then
      select count(*) into v_used from visit_checkins where user_id = p_user_id and checked_in_at >= v_start;
    else
      select count(*) into v_used from edge_function_calls where user_id = p_user_id and function_name = p_feature and called_at >= v_start;
    end if;
  end if;
  return jsonb_build_object(
    'used', v_used,
    'period_start', v_start,
    'reset_at', case when v_start is null then null else v_start + interval '1 month' end
  );
end;
$$;

-- Versi untuk aplikasi: hanya pemakaian milik sendiri.
create or replace function public.my_quota_usage(p_feature text)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select quota_usage(auth.uid(), p_feature);
$$;

revoke all on function public.quota_current_start(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.reserve_edge_function_call(uuid, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.reserve_lead_gen_slot(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.quota_usage(uuid, text) from public, anon, authenticated;
revoke all on function public.my_quota_usage(text) from public, anon;
grant execute on function public.my_quota_usage(text) to authenticated;

-- Pemakaian yang sudah berjalan bulan ini: periodenya dimulai dari pemakaian
-- pertama bulan ini, supaya hitungan yang sudah terpakai tetap terbawa.
insert into public.quota_periods (user_id, feature, period_start)
select user_id, function_name, min(called_at)
from public.edge_function_calls
where public.is_monthly_quota_feature(function_name)
  and called_at >= date_trunc('month', (now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta'
group by user_id, function_name
on conflict do nothing;

insert into public.quota_periods (user_id, feature, period_start)
select user_id, 'generate-leads', min(generated_at)
from public.lead_gen_runs
where user_id is not null
  and generated_at >= date_trunc('month', (now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta'
group by user_id
on conflict do nothing;

insert into public.quota_periods (user_id, feature, period_start)
select user_id, 'checkin', min(checked_in_at)
from public.visit_checkins
where user_id is not null
  and checked_in_at >= date_trunc('month', (now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta'
group by user_id
on conflict do nothing;
