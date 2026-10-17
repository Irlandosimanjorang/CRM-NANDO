-- 17 Okt 2026: snapshot lintas org ikut membawa flag project_deal milik org pemberi,
-- supaya tampilan tim di org penerima menghitung omzet dengan aturan yang sama seperti di org asalnya.
-- Isi fungsi lain sama dengan 20261017_share_grants_lintas_org_read_only.sql.
-- Sudah diterapkan ke database lewat MCP.

create or replace function public.get_shared_org_snapshot(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_my_org uuid;
  v_my_role text;
begin
  select m.org_id, m.role into v_my_org, v_my_role from organization_members m where m.user_id = auth.uid() limit 1;
  if v_my_org is null or v_my_role not in ('owner', 'manager') then
    raise exception 'Akses lintas organisasi khusus owner/manager';
  end if;
  if not exists (select 1 from share_grants g where g.grantor_org_id = p_org and g.grantee_org_id = v_my_org and g.enabled) then
    raise exception 'Organisasi ini belum membagikan datanya ke organisasi Anda';
  end if;

  return jsonb_build_object(
    'org', (select jsonb_build_object('id', o.id, 'name', o.name, 'plan', o.plan, 'project_deal', coalesce(o.features->>'project_deal', 'false') = 'true') from organizations o where o.id = p_org),
    'stages', coalesce((select jsonb_agg(to_jsonb(s) order by s.position) from stages s where s.org_id = p_org), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role,
        'name', coalesce(nullif(btrim(st.community_display_name), ''), split_part(u.email, '@', 1))) order by m.role)
      from organization_members m
      left join settings st on st.user_id = m.user_id
      left join auth.users u on u.id = m.user_id
      where m.org_id = p_org
    ), '[]'::jsonb),
    'leads', coalesce((select jsonb_agg(to_jsonb(l)) from leads l where l.org_id = p_org and l.deleted_at is null), '[]'::jsonb),
    'deal_transactions', coalesce((select jsonb_agg(to_jsonb(d)) from deal_transactions d where d.org_id = p_org), '[]'::jsonb),
    'ad_expenses', coalesce((select jsonb_agg(to_jsonb(e)) from ad_expenses e where e.org_id = p_org), '[]'::jsonb),
    'ad_budgets', coalesce((select jsonb_agg(to_jsonb(b)) from ad_budgets b where b.org_id = p_org), '[]'::jsonb),
    'rencana', coalesce((select jsonb_agg(to_jsonb(r)) from rencana r where r.org_id = p_org), '[]'::jsonb),
    'sales_targets', coalesce((select jsonb_agg(to_jsonb(t)) from sales_targets t where t.org_id = p_org), '[]'::jsonb),
    'visit_checkins', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'lead_id', c.lead_id, 'checked_in_at', c.checked_in_at)) from visit_checkins c where c.org_id = p_org and c.checked_in_at > now() - interval '90 days'), '[]'::jsonb),
    'progress_notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'user_id', n.user_id, 'lead_id', n.lead_id, 'text', n.text, 'created_at', n.created_at)) from progress_notes n where n.org_id = p_org and n.created_at > now() - interval '90 days'), '[]'::jsonb),
    'lead_stage_changes', coalesce((select jsonb_agg(jsonb_build_object('lead_id', sc.lead_id, 'changed_by', sc.changed_by, 'from_stage', sc.from_stage, 'to_stage', sc.to_stage, 'changed_at', sc.changed_at)) from lead_stage_changes sc where sc.org_id = p_org and sc.changed_at > now() - interval '90 days'), '[]'::jsonb)
  );
end;
$function$;

revoke execute on function public.get_shared_org_snapshot(uuid) from public, anon;
grant execute on function public.get_shared_org_snapshot(uuid) to authenticated;
