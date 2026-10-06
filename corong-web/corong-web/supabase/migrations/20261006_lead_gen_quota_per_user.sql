-- Kuota Generate Leads 4x/bulan per PENGGUNA (sebelumnya per organisasi).
-- 6 Okt 2026, permintaan Nando: "4x per orang".
alter table public.lead_gen_runs add column if not exists user_id uuid;
create index if not exists lead_gen_runs_user_month_idx on public.lead_gen_runs (user_id, generated_at);

drop function if exists public.reserve_lead_gen_slot(uuid, integer);

create or replace function public.reserve_lead_gen_slot(p_org_id uuid, p_max integer default 4, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_month_start timestamptz;
  v_count int;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('lead_gen_quota:' || coalesce(p_user_id::text, p_org_id::text)));
  -- Awal bulan kalender WIB (tanggal 1, jam 00:00 WIB).
  v_month_start := date_trunc('month', (now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta';
  if p_user_id is not null then
    select count(*) into v_count from lead_gen_runs where user_id = p_user_id and generated_at >= v_month_start;
  else
    select count(*) into v_count from lead_gen_runs where org_id = p_org_id and generated_at >= v_month_start;
  end if;
  if v_count >= p_max then
    return null;
  end if;
  insert into lead_gen_runs (org_id, user_id, generated_at) values (p_org_id, p_user_id, now()) returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.reserve_lead_gen_slot(uuid, integer, uuid) from public, anon, authenticated;
