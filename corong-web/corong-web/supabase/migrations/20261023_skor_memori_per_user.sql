-- 23 Okt 2026: skor kualitas memori dihitung PER USER (sales), bukan per org.
-- Lead yang dihitung adalah lead yang di-assign ke user (leads.assigned_to), catatan = catatan di lead itu.
-- Rumus sama dengan 20261023_skor_memori_kedalaman: frekuensi 30, kedalaman 25, kesegaran 20, cakupan 15, kualitas 10.
-- Minimal 5 lead aktif per user. Hasil disimpan di member_memory_health (1 baris per org + user).
-- Owner bisa melihat skor semua anggota org; user biasa hanya skornya sendiri.

create table if not exists public.member_memory_health (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  n integer not null,
  score integer not null,
  label text not null,
  computed_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

alter table public.member_memory_health enable row level security;

drop policy if exists member_memory_health_select on public.member_memory_health;
create policy member_memory_health_select on public.member_memory_health
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.organization_members om
      where om.org_id = member_memory_health.org_id and om.user_id = auth.uid() and om.role = 'owner'
    )
  );

create or replace function public.memory_quality_score_user(p_org uuid, p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
with st as (
  select key, type from stages where org_id = p_org
),
act as (
  select l.id, l.last_contact
  from leads l
  where l.org_id = p_org and l.deleted_at is null and l.assigned_to = p_user
    and l.stage_key not in (select key from st where type in ('won', 'lost'))
),
valid as (
  select n.lead_id, n.created_at
  from progress_notes n
  where n.org_id = p_org
    and n.created_at > now() - interval '30 days'
    and not is_thin_note(n.text)
    and n.text not ilike 'Check-in GPS terverifikasi%'
),
per_lead as (
  select a.id, a.last_contact,
    (select count(distinct (v.created_at at time zone 'Asia/Jakarta')::date) from valid v where v.lead_id = a.id and v.created_at > now() - interval '14 days') as hari14,
    (select count(*) from valid v where v.lead_id = a.id) as catat30,
    (select max(v.created_at) from valid v where v.lead_id = a.id) as terakhir
  from act a
),
notes_all as (
  select count(*) as semua,
    count(*) filter (where not is_thin_note(n.text) and n.text not ilike 'Check-in GPS terverifikasi%') as valid
  from progress_notes n
  join act a on a.id = n.lead_id
  where n.org_id = p_org and n.created_at > now() - interval '30 days'
),
m as (
  select count(*) as n,
    100.0 * avg(least(hari14 / 3.0, 1)) as frekuensi,
    100.0 * avg(least(catat30 / 5.0, 1)) as kedalaman,
    100.0 * count(*) filter (where greatest(coalesce(terakhir, '-infinity'), coalesce(last_contact::timestamptz, '-infinity')) >= now() - interval '7 days') / nullif(count(*), 0) as kesegaran,
    100.0 * count(*) filter (where catat30 >= 1) / nullif(count(*), 0) as cakupan,
    (select 100.0 * valid / nullif(semua, 0) from notes_all) as kualitas
  from per_lead
),
sc as (
  select n, frekuensi, kedalaman, kesegaran, cakupan, kualitas,
    round(0.30 * coalesce(frekuensi, 0) + 0.25 * coalesce(kedalaman, 0) + 0.20 * coalesce(kesegaran, 0) + 0.15 * coalesce(cakupan, 0) + 0.10 * coalesce(kualitas, 0)) as score
  from m
)
select case when n < 5 then jsonb_build_object('n', n, 'score', null, 'label', 'Data belum cukup (min 5 lead aktif)')
  else jsonb_build_object(
    'n', n,
    'score', score,
    'label', case when score >= 85 then 'Sehat' when score >= 70 then 'Cukup' when score >= 50 then 'Perlu Perhatian' else 'Kritis' end,
    'frekuensi', round(coalesce(frekuensi, 0), 1), 'kedalaman', round(coalesce(kedalaman, 0), 1),
    'kesegaran', round(coalesce(kesegaran, 0), 1), 'cakupan', round(coalesce(cakupan, 0), 1), 'kualitas', round(coalesce(kualitas, 0), 1)
  ) end
from sc;
$function$;

revoke execute on function public.memory_quality_score_user(uuid, uuid) from public, anon, authenticated;

create or replace function public.refresh_member_memory_health()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r record;
  s jsonb;
  n integer := 0;
begin
  for r in select om.org_id, om.user_id from organization_members om loop
    s := public.memory_quality_score_user(r.org_id, r.user_id);
    if s->>'score' is not null then
      insert into member_memory_health (org_id, user_id, n, score, label, computed_at)
      values (r.org_id, r.user_id, (s->>'n')::int, (s->>'score')::int, s->>'label', now())
      on conflict (org_id, user_id) do update set n = excluded.n, score = excluded.score, label = excluded.label, computed_at = excluded.computed_at;
      n := n + 1;
    else
      delete from member_memory_health where org_id = r.org_id and user_id = r.user_id;
    end if;
  end loop;
  return n;
end;
$function$;

revoke execute on function public.refresh_member_memory_health() from public, anon, authenticated;

select cron.unschedule('nexto-memory-health-check');
select cron.schedule('nexto-memory-health-check', '0 4 * * *', $$select public.refresh_member_memory_health();$$);

select public.refresh_member_memory_health();
