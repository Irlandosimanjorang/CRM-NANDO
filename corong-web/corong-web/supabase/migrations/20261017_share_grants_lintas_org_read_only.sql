-- 17 Okt 2026: berbagi data antar organisasi (sister company), read-only, atas izin pemilik data.
-- Tabel share_grants menyimpan izin: org pemberi (grantor) mengizinkan org penerima (grantee) membaca datanya.
-- Hanya owner org pemberi yang bisa menyalakan/mematikan izin. Default mati.
-- Data dibaca lewat RPC get_shared_org_snapshot, BUKAN lewat policy tabel, supaya query biasa org penerima
-- tidak tercampur dengan data org lain. Penerima harus owner/manager org-nya sendiri.
-- Sudah diterapkan ke database lewat MCP.

create table if not exists public.share_grants (
  id uuid primary key default gen_random_uuid(),
  grantor_org_id uuid not null references public.organizations(id) on delete cascade,
  grantee_org_id uuid not null references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grantor_org_id, grantee_org_id),
  check (grantor_org_id <> grantee_org_id)
);

alter table public.share_grants enable row level security;

create policy share_grants_select on public.share_grants for select
  using (grantor_org_id in (select my_org_ids()) or grantee_org_id in (select my_org_ids()));

create policy share_grants_insert on public.share_grants for insert
  with check (grantor_org_id in (select my_org_ids()) and my_role() = 'owner');

create policy share_grants_update on public.share_grants for update
  using (grantor_org_id in (select my_org_ids()) and my_role() = 'owner')
  with check (grantor_org_id in (select my_org_ids()) and my_role() = 'owner');

create policy share_grants_delete on public.share_grants for delete
  using (grantor_org_id in (select my_org_ids()) and my_role() = 'owner');

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
    'org', (select jsonb_build_object('id', o.id, 'name', o.name, 'plan', o.plan) from organizations o where o.id = p_org),
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

insert into public.share_grants (grantor_org_id, grantee_org_id, enabled)
values ('b6c256bb-681d-4833-af10-ebb665c6d2d0', '43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0', false)
on conflict (grantor_org_id, grantee_org_id) do nothing;
