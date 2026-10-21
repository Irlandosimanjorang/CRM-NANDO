-- 21 Okt 2026: Dashboard utama, target tim, dan laporan mingguan dihitung per transaksi deal
-- (sama dengan tab Team, Report, dan Performa). Sumber: org_deal_entries.
-- Lead menang tanpa transaksi tetap dihitung sekali dengan deal_value dan deal_date lead.

create or replace function public.get_org_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org_id uuid;
  v_role text;
  v_uid uuid := auth.uid();
  v_mgr boolean;
  v_won_keys text[];
  v_lost_keys text[];
begin
  select org_id, role into v_org_id, v_role from organization_members where user_id = v_uid limit 1;
  if v_org_id is null then
    return jsonb_build_object('total', 0, 'won', 0, 'lost', 0, 'followups', 0, 'visits', 0, 'win_rate', 0, 'deals', 0, 'revenue', 0);
  end if;
  v_mgr := v_role in ('owner', 'manager');

  select coalesce(array_agg(key), array[]::text[]) into v_won_keys from stages where org_id = v_org_id and type = 'won';
  select coalesce(array_agg(key), array[]::text[]) into v_lost_keys from stages where org_id = v_org_id and type = 'lost';

  return (
    with lead_stats as (
      select
        count(*) as total,
        count(*) filter (where stage_key = any(v_won_keys)) as won,
        count(*) filter (where stage_key = any(v_lost_keys)) as lost,
        count(*) filter (where next_action is not null and btrim(next_action) <> '') as followups,
        count(*) filter (where visit_date = ((now() at time zone 'Asia/Jakarta')::date)) as visits
      from leads
      where org_id = v_org_id and deleted_at is null
        and (v_mgr or coalesce(assigned_to, user_id) = v_uid)
    ),
    deal_stats as (
      select count(*) as deals, coalesce(sum(e.deal_value), 0) as revenue
      from org_deal_entries(v_org_id) e
      where v_mgr or e.pic = v_uid
    )
    select jsonb_build_object(
      'total', ls.total,
      'won', ls.won,
      'lost', ls.lost,
      'followups', ls.followups,
      'visits', ls.visits,
      'win_rate', case when ls.won + ls.lost > 0 then round((ls.won::numeric / (ls.won + ls.lost)) * 100) else 0 end,
      'deals', ds.deals,
      'revenue', ds.revenue
    )
    from lead_stats ls, deal_stats ds
  );
end;
$function$;

create or replace function public.get_team_targets(p_month date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org uuid := team_activity_org();
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month')::date;
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'target', coalesce((select amount from sales_targets t where t.org_id = v_org and t.user_id = m.user_id and t.month = v_start), 0),
      'achieved', (select coalesce(sum(e.deal_value), 0) from org_deal_entries(v_org) e
                    where e.pic = m.user_id and e.deal_date >= v_start and e.deal_date < v_end),
      'pipeline', (select coalesce(sum(l.deal_value), 0) from leads l join stages s on s.org_id = v_org and s.key = l.stage_key and s.type = 'normal'
                    where l.org_id = v_org and l.deleted_at is null and coalesce(l.assigned_to, l.user_id) = m.user_id),
      'forecast', (select coalesce(round(sum(l.deal_value * stage_win_probability(v_org, l.stage_key))), 0) from leads l join stages s on s.org_id = v_org and s.key = l.stage_key and s.type = 'normal'
                    where l.org_id = v_org and l.deleted_at is null and coalesce(l.assigned_to, l.user_id) = m.user_id),
      'open_without_value', (select count(*) from leads l join stages s on s.org_id = v_org and s.key = l.stage_key and s.type = 'normal'
                    where l.org_id = v_org and l.deleted_at is null and coalesce(l.assigned_to, l.user_id) = m.user_id and coalesce(l.deal_value, 0) = 0)
    )), '[]'::jsonb)
    from organization_members m where m.org_id = v_org
  );
end;
$function$;

create or replace function public.team_weekly_report(p_org uuid, p_from timestamp with time zone, p_to timestamp with time zone)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_from_d date := (p_from at time zone 'Asia/Jakarta')::date;
  v_to_d date := (p_to at time zone 'Asia/Jakarta')::date;
begin
  return jsonb_build_object(
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'role', m.role,
        'name', coalesce(nullif(btrim(s.community_display_name), ''), split_part(u.email, '@', 1)),
        'visits', (select count(*) from team_activity_events(p_org, p_from, p_to) e where e.user_id = m.user_id and e.kind = 'visit'),
        'notes', (select count(*) from team_activity_events(p_org, p_from, p_to) e where e.user_id = m.user_id and e.kind in ('note', 'email')),
        'new_leads', (select count(*) from team_activity_events(p_org, p_from, p_to) e where e.user_id = m.user_id and e.kind = 'lead'),
        'stage_moves', (select count(*) from team_activity_events(p_org, p_from, p_to) e where e.user_id = m.user_id and e.kind = 'stage'),
        'deleted', (select count(*) from team_activity_events(p_org, p_from, p_to) e where e.user_id = m.user_id and e.kind = 'lead_deleted'),
        'deal_value', (select coalesce(sum(e.deal_value), 0) from org_deal_entries(p_org) e
                        where e.pic = m.user_id and e.deal_date >= v_from_d and e.deal_date < v_to_d),
        'last_activity_at', (select max(e.at) from team_activity_events(p_org, now() - interval '60 days', now()) e where e.user_id = m.user_id)
      ) order by m.role, s.community_display_name), '[]'::jsonb)
      from organization_members m
      left join settings s on s.user_id = m.user_id
      left join auth.users u on u.id = m.user_id
      where m.org_id = p_org
    ),
    'cash_in', (select coalesce(sum(amount), 0) from payment_terms where org_id = p_org and paid_at >= (p_from at time zone 'Asia/Jakarta')::date and paid_at < (p_to at time zone 'Asia/Jakarta')::date),
    'overdue', (select coalesce(jsonb_agg(jsonb_build_object('lead_name', l.name, 'label', p.label, 'amount', p.amount, 'due_date', p.due_date) order by p.due_date), '[]'::jsonb)
      from payment_terms p join leads l on l.id = p.lead_id
      where p.org_id = p_org and p.paid_at is null and p.due_date < v_today and l.deleted_at is null),
    'due_soon', (select coalesce(jsonb_agg(jsonb_build_object('lead_name', l.name, 'label', p.label, 'amount', p.amount, 'due_date', p.due_date) order by p.due_date), '[]'::jsonb)
      from payment_terms p join leads l on l.id = p.lead_id
      where p.org_id = p_org and p.paid_at is null and p.due_date between v_today and v_today + 7 and l.deleted_at is null),
    'targets', (
      select coalesce(jsonb_agg(jsonb_build_object('user_id', t.user_id, 'target', t.amount,
        'achieved', (select coalesce(sum(e.deal_value), 0) from org_deal_entries(p_org) e
          where e.pic = t.user_id and e.deal_date >= t.month and e.deal_date < (t.month + interval '1 month')::date))), '[]'::jsonb)
      from sales_targets t where t.org_id = p_org and t.month = date_trunc('month', v_today)::date
    )
  );
end;
$function$;
