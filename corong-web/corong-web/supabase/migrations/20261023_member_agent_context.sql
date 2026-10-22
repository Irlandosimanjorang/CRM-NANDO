-- 23 Okt 2026: lapisan berpikir (agent) untuk memori per user.
-- member_facts(): fakta pipeline satu user (dihitung dengan aturan, tanpa AI) yang jadi input agent.
-- member_agent_context: ringkasan hasil agent per user. Dipisah dari member_memory supaya refresh mingguan
-- (yang menghapus baris user tanpa deal tertutup) tidak ikut menghapusnya.
-- build_memory_context() memakai ringkasan agent kalau ada, kalau tidak pakai member_memory.summary seperti sebelumnya.

create table if not exists public.member_agent_context (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  summary text not null default '',
  facts_hash text not null default '',
  model text not null default '',
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

alter table public.member_agent_context enable row level security;

drop policy if exists member_agent_context_select on public.member_agent_context;
create policy member_agent_context_select on public.member_agent_context
  for select to authenticated
  using (user_id = (select auth.uid()) or (org_id in (select public.my_org_ids()) and public.my_role() in ('owner', 'manager')));

create or replace function public.member_facts(p_org uuid, p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
with act as (
  select l.id, l.name, l.stage_key, l.next_action, l.visit_date
  from leads l
  where l.org_id = p_org and l.deleted_at is null and l.assigned_to = p_user
    and l.stage_key not in (select s.key from stages s where s.org_id = p_org and s.type in ('won', 'lost'))
),
notes as (
  select n.lead_id, n.text, n.created_at,
    row_number() over (partition by n.lead_id order by n.created_at desc) as rn
  from progress_notes n
  where n.org_id = p_org
    and n.created_at > now() - interval '60 days'
    and not is_thin_note(n.text)
    and n.text not ilike 'Check-in GPS terverifikasi%'
),
lead_rows as (
  select a.name, a.stage_key, a.next_action, a.visit_date,
    (select max(x.created_at) from notes x where x.lead_id = a.id) as last_note,
    (select jsonb_agg(left(x.text, 200) order by x.created_at desc) from notes x where x.lead_id = a.id and x.rn <= 3) as recent
  from act a
)
select jsonb_build_object(
  'lead_aktif', (select count(*) from act),
  'tanpa_catatan_14_hari', (select count(*) from lead_rows where last_note is null or last_note < now() - interval '14 days'),
  'tanpa_next_action', (select count(*) from act where btrim(coalesce(next_action, '')) = ''),
  'visit_7_hari_ke_depan', (select count(*) from act where visit_date >= current_date and visit_date <= current_date + 7),
  'lead', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'nama', r.name,
      'tahap', r.stage_key,
      'next_action', left(coalesce(r.next_action, ''), 120),
      'catatan_terakhir', r.last_note,
      'catatan_terbaru', r.recent
    ) order by r.last_note desc nulls last), '[]'::jsonb)
    from (select * from lead_rows order by last_note desc nulls last limit 15) r
  )
);
$$;

revoke execute on function public.member_facts(uuid, uuid) from public, anon, authenticated;
grant execute on function public.member_facts(uuid, uuid) to service_role;

create or replace function public.build_memory_context(p_org uuid, p_user uuid default null, p_lead uuid default null)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  parts text[] := array[]::text[];
  cat record;
  om record;
  mm text;
  lead_row record;
  sim text;
  prods text;
  objs text;
begin
  select company_profile, products into cat from public.org_product_catalog where org_id = p_org;
  if found then
    select string_agg(coalesce(p->>'name', '') || case when coalesce(p->>'fit_for', '') <> '' then ' (cocok untuk: ' || (p->>'fit_for') || ')' else '' end, '; ')
      into prods from (select p from jsonb_array_elements(case when jsonb_typeof(cat.products) = 'array' then cat.products else '[]'::jsonb end) p limit 8) q
      where coalesce(p->>'name', '') <> '';
    if coalesce(cat.company_profile, '') <> '' or prods is not null then
      parts := parts || ('PROFIL PERUSAHAAN KITA: ' || coalesce(left(cat.company_profile, 500), '') || case when prods is not null then ' Produk: ' || prods || '.' else '' end);
    end if;
  end if;

  select ideal_customer_profile, common_objections, winning_playbook into om from public.org_memory where org_id = p_org;
  if found then
    select string_agg('"' || coalesce(o->>'objection', '') || '" -> ' || coalesce(o->>'how_to_handle', ''), '; ') into objs
      from jsonb_array_elements(case when jsonb_typeof(om.common_objections) = 'array' then om.common_objections else '[]'::jsonb end) o;
    parts := parts || ('POLA ORGANISASI: ' || coalesce(left(om.ideal_customer_profile, 300), '')
      || case when objs is not null then ' Keberatan yang sering muncul dan cara menanganinya: ' || left(objs, 500) || '.' else '' end
      || case when jsonb_typeof(om.winning_playbook) = 'array' and jsonb_array_length(om.winning_playbook) > 0 then ' Taktik yang terbukti berhasil: ' || left((select string_agg(x, '; ') from jsonb_array_elements_text(om.winning_playbook) x), 500) || '.' else '' end);
  end if;

  if p_user is not null then
    select summary into mm from public.member_agent_context where org_id = p_org and user_id = p_user;
    if mm is null or mm = '' then
      select summary into mm from public.member_memory where org_id = p_org and user_id = p_user;
    end if;
    if mm is not null and mm <> '' then parts := parts || ('MEMORI PRIBADI SALES INI: ' || mm); end if;
  end if;

  if p_lead is not null then
    select product, category into lead_row from public.leads where id = p_lead and org_id = p_org;
    if found then
      select string_agg(t, E'\n') into sim from (
        select '- ' || l.name || ' (' || case when st.type = 'won' then 'menang' else 'kalah' end || ')'
               || coalesce(' alasan: ' || nullif(left(coalesce(l.outcome->>'reason', ''), 160), ''), coalesce(' alasan: ' || nullif(l.outcome->>'reason_category', ''), '')) as t
        from public.leads l join public.stages st on st.org_id = l.org_id and st.key = l.stage_key and st.type in ('won', 'lost')
        where l.org_id = p_org and l.id <> p_lead and l.deleted_at is null
          and l.outcome is not null
          and ((coalesce(trim(lead_row.product), '') <> '' and lower(l.product) = lower(lead_row.product))
            or (coalesce(trim(lead_row.category), '') <> '' and lower(l.category) = lower(lead_row.category)))
        order by (lower(l.product) = lower(coalesce(lead_row.product, '#'))) desc, l.updated_at desc limit 3) z;
      if sim is not null then parts := parts || ('KASUS SERUPA YANG SUDAH TERTUTUP DI ORGANISASI INI:' || E'\n' || sim); end if;
    end if;
  end if;

  if array_length(parts, 1) is null then return ''; end if;
  return left(array_to_string(parts, E'\n'), 2400);
end;
$$;
