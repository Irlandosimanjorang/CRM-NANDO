-- 18 Okt 2026: satu aturan deal di semua tampilan.
-- Deal = lead yang sekarang di tahap menang (type = 'won'), nilainya deal_value lead,
-- tanggalnya deal_date lead, penanggung jawabnya assigned_to (atau pembuat lead kalau kosong).
-- Berlaku untuk get_sales_company_view (Performa saya / perusahaan) dan get_team_activity (Rekap aktivitas).
-- Tidak lagi memakai baris deal_transactions untuk angka deal dan omzet.

-- 1) Kartu Performa (sales & manager/owner)
create or replace function public.get_sales_company_view()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_plan text;
  v_start date := date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date;
  v_end date := (date_trunc('month', (now() at time zone 'Asia/Jakarta')) + interval '1 month')::date;
  v_mgr boolean;
begin
  select m.org_id, m.role into v_org, v_role from organization_members m where m.user_id = v_uid limit 1;
  select o.plan into v_plan from organizations o where o.id = v_org;
  if v_org is null or v_plan is distinct from 'enterprise' then
    raise exception 'Performa khusus anggota paket Enterprise';
  end if;
  v_mgr := v_role in ('owner', 'manager');

  return jsonb_build_object(
    'month', v_start,
    'company', case when v_mgr then (
      select jsonb_build_object(
        'revenue', coalesce(sum(l.deal_value), 0),
        'deals', count(*),
        'target', (select coalesce(sum(t.amount), 0) from sales_targets t where t.org_id = v_org and t.month = v_start)
      )
      from leads l join stages s on s.org_id = v_org and s.key = l.stage_key and s.type = 'won'
      where l.org_id = v_org and l.deleted_at is null and l.deal_date >= v_start and l.deal_date < v_end
    ) else null end,
    'me', jsonb_build_object(
      'revenue', (select coalesce(sum(l.deal_value), 0) from leads l join stages s on s.org_id = v_org and s.key = l.stage_key and s.type = 'won'
                  where l.org_id = v_org and l.deleted_at is null and coalesce(l.assigned_to, l.user_id) = v_uid and l.deal_date >= v_start and l.deal_date < v_end),
      'deals', (select count(*) from leads l join stages s on s.org_id = v_org and s.key = l.stage_key and s.type = 'won'
                where l.org_id = v_org and l.deleted_at is null and coalesce(l.assigned_to, l.user_id) = v_uid and l.deal_date >= v_start and l.deal_date < v_end),
      'target', coalesce((select t.amount from sales_targets t where t.org_id = v_org and t.user_id = v_uid and t.month = v_start), 0),
      'forecast', (select coalesce(round(sum(l.deal_value * stage_win_probability(v_org, l.stage_key))), 0) from leads l join stages s on s.org_id = v_org and s.key = l.stage_key and s.type = 'normal'
                   where l.org_id = v_org and l.deleted_at is null and coalesce(l.assigned_to, l.user_id) = v_uid)
    ),
    'trend', (
      select coalesce(jsonb_agg(jsonb_build_object('month', g.m, 'revenue',
        (select coalesce(sum(l.deal_value), 0) from leads l join stages s on s.org_id = v_org and s.key = l.stage_key and s.type = 'won'
           where l.org_id = v_org and l.deleted_at is null
           and (v_mgr or coalesce(l.assigned_to, l.user_id) = v_uid)
           and l.deal_date >= g.m and l.deal_date < (g.m + interval '1 month')::date)
      ) order by g.m), '[]'::jsonb)
      from (select (v_start - make_interval(months => i))::date as m from generate_series(0, 5) i) g
    )
  );
end;
$function$;

-- 2) Rekap aktivitas tim: kolom deals dan deal_value memakai lead menang per penanggung jawab
-- dengan tanggal deal di dalam periode (p_from..p_to, WIB).
do $$
declare
  v text := pg_get_functiondef('public.get_team_activity(timestamp with time zone, timestamp with time zone)'::regprocedure);
  old_deals text := $a$'deals', (select count(*) from lead_stage_changes sc join leads dl on dl.id = sc.lead_id where sc.org_id = v_org and coalesce(dl.assigned_to, dl.user_id) = mem.user_id and sc.changed_at >= p_from and sc.changed_at < p_to and sc.to_stage = any(v_won) and not (coalesce(sc.from_stage, '') = any(v_won))),$a$;
  new_deals text := $a$'deals', (select count(*) from leads l join stages s on s.org_id = v_org and s.key = l.stage_key and s.type = 'won' where l.org_id = v_org and l.deleted_at is null and coalesce(l.assigned_to, l.user_id) = mem.user_id and l.deal_date is not null and (l.deal_date::timestamp at time zone 'Asia/Jakarta') >= p_from and (l.deal_date::timestamp at time zone 'Asia/Jakarta') < p_to),$a$;
  old_val text := $a$'deal_value', (select coalesce(sum(d.deal_value), 0) from deal_transactions d where d.org_id = v_org and d.user_id = mem.user_id and coalesce(d.deal_date, (d.created_at at time zone 'Asia/Jakarta')::date) >= (p_from at time zone 'Asia/Jakarta')::date and coalesce(d.deal_date, (d.created_at at time zone 'Asia/Jakarta')::date) <= (p_to at time zone 'Asia/Jakarta')::date),$a$;
  new_val text := $a$'deal_value', (select coalesce(sum(l.deal_value), 0) from leads l join stages s on s.org_id = v_org and s.key = l.stage_key and s.type = 'won' where l.org_id = v_org and l.deleted_at is null and coalesce(l.assigned_to, l.user_id) = mem.user_id and l.deal_date is not null and (l.deal_date::timestamp at time zone 'Asia/Jakarta') >= p_from and (l.deal_date::timestamp at time zone 'Asia/Jakarta') < p_to),$a$;
begin
  if position(old_deals in v) = 0 then raise exception 'ekspresi deals tidak ditemukan'; end if;
  if position(old_val in v) = 0 then raise exception 'ekspresi deal_value tidak ditemukan'; end if;
  execute replace(replace(v, old_deals, new_deals), old_val, new_val);
end $$;
