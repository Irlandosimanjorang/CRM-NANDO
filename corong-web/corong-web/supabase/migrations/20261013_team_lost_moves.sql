-- Kalah di Rekap Aktivitas Tim (13 Okt 2026): kolom "lost" = perpindahan lead ke tahap Lost per anggota,
-- dihitung seperti kolom "deals" (per perpindahan, dikelompokkan menurut pemilik lead). Isi RPC lainnya tidak berubah.
create or replace function public.get_team_activity(p_from timestamp with time zone, p_to timestamp with time zone)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org uuid;
  v_role text;
  v_plan text;
  v_won text[];
  v_lost text[];
  v_members jsonb;
  v_feed jsonb;
begin
  select m.org_id, m.role into v_org, v_role from organization_members m where m.user_id = auth.uid() limit 1;
  select o.plan into v_plan from organizations o where o.id = v_org;
  if v_org is null or v_plan is distinct from 'enterprise' or v_role not in ('owner', 'manager') then
    raise exception 'Rekap aktivitas tim khusus owner/manager paket Enterprise';
  end if;

  select coalesce(array_agg(key), array[]::text[]) into v_won from stages where org_id = v_org and type = 'won';
  select coalesce(array_agg(key), array[]::text[]) into v_lost from stages where org_id = v_org and type = 'lost';

  with mem as (
    select m.user_id, m.role,
      coalesce(nullif(btrim(s.community_display_name), ''), split_part(u.email, '@', 1)) as name
    from organization_members m
    left join settings s on s.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.org_id = v_org
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', mem.user_id, 'role', mem.role, 'name', mem.name,
    'visits', (select count(*) from visit_checkins c where c.org_id = v_org and c.user_id = mem.user_id and c.checked_in_at >= p_from and c.checked_in_at < p_to),
    'notes', (select count(*) from progress_notes n where n.org_id = v_org and n.user_id = mem.user_id and n.created_at >= p_from and n.created_at < p_to and n.text not ilike 'Check-in GPS terverifikasi%'),
    'notes_thin', (select count(*) from progress_notes n where n.org_id = v_org and n.user_id = mem.user_id and n.created_at >= p_from and n.created_at < p_to and n.text not ilike 'Check-in GPS terverifikasi%' and is_thin_note(n.text)),
    'leads_updated', (select count(distinct n.lead_id) from progress_notes n where n.org_id = v_org and n.user_id = mem.user_id and n.created_at >= p_from and n.created_at < p_to and n.text not ilike 'Check-in GPS terverifikasi%'),
    'new_leads', (select count(*) from leads l where l.org_id = v_org and coalesce(l.assigned_to, l.user_id) = mem.user_id and l.created_at >= p_from and l.created_at < p_to and l.deleted_at is null),
    'stage_moves', (select count(*) from lead_stage_changes sc where sc.org_id = v_org and sc.changed_by = mem.user_id and sc.changed_at >= p_from and sc.changed_at < p_to),
    'deals', (select count(*) from lead_stage_changes sc join leads dl on dl.id = sc.lead_id where sc.org_id = v_org and coalesce(dl.assigned_to, dl.user_id) = mem.user_id and sc.changed_at >= p_from and sc.changed_at < p_to and sc.to_stage = any(v_won) and not (coalesce(sc.from_stage, '') = any(v_won))),
    'lost', (select count(*) from lead_stage_changes sc join leads dl on dl.id = sc.lead_id where sc.org_id = v_org and coalesce(dl.assigned_to, dl.user_id) = mem.user_id and sc.changed_at >= p_from and sc.changed_at < p_to and sc.to_stage = any(v_lost) and not (coalesce(sc.from_stage, '') = any(v_lost))),
    'deal_value', (select coalesce(sum(d.deal_value), 0) from deal_transactions d where d.org_id = v_org and d.user_id = mem.user_id and coalesce(d.deal_date, (d.created_at at time zone 'Asia/Jakarta')::date) >= (p_from at time zone 'Asia/Jakarta')::date and coalesce(d.deal_date, (d.created_at at time zone 'Asia/Jakarta')::date) <= (p_to at time zone 'Asia/Jakarta')::date),
    'last_activity_at', greatest(
      (select max(c.checked_in_at) from visit_checkins c where c.org_id = v_org and c.user_id = mem.user_id),
      (select max(n.created_at) from progress_notes n where n.org_id = v_org and n.user_id = mem.user_id),
      (select max(sc.changed_at) from lead_stage_changes sc where sc.org_id = v_org and sc.changed_by = mem.user_id),
      (select max(l.created_at) from leads l where l.org_id = v_org and coalesce(l.assigned_to, l.user_id) = mem.user_id and l.deleted_at is null)
    )
  ) order by mem.name), '[]'::jsonb)
  into v_members
  from mem;

  with ev as (
    select 'visit' as kind, c.user_id, c.checked_in_at as at, c.lead_name as lead_name, null::text as detail
      from visit_checkins c where c.org_id = v_org and c.checked_in_at >= p_from and c.checked_in_at < p_to
    union all
    select 'note', n.user_id, n.created_at, l.name, left(n.text, 140)
      from progress_notes n join leads l on l.id = n.lead_id
      where n.org_id = v_org and n.created_at >= p_from and n.created_at < p_to and n.text not ilike 'Check-in GPS terverifikasi%'
    union all
    select 'stage', sc.changed_by, sc.changed_at, sc.lead_name,
      coalesce((select label from stages where org_id = v_org and key = sc.from_stage), sc.from_stage, '-') || ' → ' ||
      coalesce((select label from stages where org_id = v_org and key = sc.to_stage), sc.to_stage, '-')
      from lead_stage_changes sc where sc.org_id = v_org and sc.changed_at >= p_from and sc.changed_at < p_to
    union all
    select 'lead', coalesce(l.assigned_to, l.user_id), l.created_at, l.name, null
      from leads l where l.org_id = v_org and l.created_at >= p_from and l.created_at < p_to and l.deleted_at is null
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'user_id', user_id, 'at', at, 'lead_name', lead_name, 'detail', detail) order by at desc), '[]'::jsonb)
  into v_feed
  from (select * from ev order by at desc limit 40) x;

  return jsonb_build_object('members', v_members, 'feed', v_feed);
end;
$function$;
