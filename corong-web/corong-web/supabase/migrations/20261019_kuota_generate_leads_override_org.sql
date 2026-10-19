-- 19 Okt 2026: kuota generate leads bisa dibatasi per org untuk periode tertentu.
-- Dipakai untuk MAP dan BSB asli: 2 pencarian sampai 31 Okt 2026 (00:00 WIB), lalu kembali ke kuota normal.
-- Masa aktif paket (plan_expires_at) TIDAK diubah.

alter table public.organizations
  add column if not exists generate_leads_quota_override integer,
  add column if not exists generate_leads_quota_override_until timestamptz;

update public.organizations
set generate_leads_quota_override = 2,
    generate_leads_quota_override_until = '2026-10-31T00:00:00+07:00'
where id in ('43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0', 'b6c256bb-681d-4833-af10-ebb665c6d2d0');

create or replace function public.reserve_lead_gen_slot(p_org_id uuid, p_max integer default 4, p_user_id uuid default null::uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_start timestamptz;
  v_count int := 0;
  v_id uuid;
  v_lot uuid;
  v_override int;
begin
  if p_user_id is not null and public.is_monitor_owner(p_user_id) then
    return null;
  end if;
  -- Batas per org (mis. 2 pencarian sampai akhir Oktober) hanya boleh menurunkan kuota, tidak menaikkannya.
  select o.generate_leads_quota_override into v_override
  from organizations o
  where o.id = p_org_id
    and o.generate_leads_quota_override is not null
    and now() < coalesce(o.generate_leads_quota_override_until, 'infinity'::timestamptz);
  if v_override is not null then
    p_max := least(p_max, v_override);
  end if;
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
$function$;

-- Kuota efektif untuk akun yang sedang login (dipakai tampilan "X dari Y").
create or replace function public.my_generate_leads_quota_max()
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select least(4, coalesce(
    (select o.generate_leads_quota_override
       from organization_members m join organizations o on o.id = m.org_id
      where m.user_id = auth.uid()
        and o.generate_leads_quota_override is not null
        and now() < coalesce(o.generate_leads_quota_override_until, 'infinity'::timestamptz)
      limit 1),
    4));
$function$;

revoke execute on function public.my_generate_leads_quota_max() from anon, public;
grant execute on function public.my_generate_leads_quota_max() to authenticated;
