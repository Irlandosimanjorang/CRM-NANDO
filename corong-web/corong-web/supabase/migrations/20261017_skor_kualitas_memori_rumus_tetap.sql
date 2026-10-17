-- 17 Okt 2026: skor kualitas memori (kartu "Kedalaman Riwayat Lead") pakai rumus tetap, bukan tebakan AI.
-- Bobot: cakupan 30%, kedalaman 25%, kesegaran 30%, tindak lanjut 15%. Minimal 5 lead aktif, di bawah itu tidak dinilai.
-- Label: 80+ Sehat, 60-79 Cukup, 40-59 Perlu Perhatian, di bawah 40 Kritis.
-- Cron nexto-memory-health-check sekarang memanggil refresh_memory_health() (sebelumnya memanggil edge function memory-health-check, yang tidak dipakai lagi).
-- Sudah diterapkan ke database lewat MCP.

create or replace function public.memory_quality_score(p_org uuid)
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
  select l.id, l.last_contact, l.next_action,
    (select count(*) from progress_notes n where n.lead_id = l.id) as notes,
    (select max(n.created_at) from progress_notes n where n.lead_id = l.id) as last_note
  from leads l
  where l.org_id = p_org and l.deleted_at is null
    and l.stage_key not in (select key from st where type in ('won', 'lost'))
),
m as (
  select count(*) as n,
    100.0 * count(*) filter (where notes >= 1) / nullif(count(*), 0) as cakupan,
    100.0 * count(*) filter (where notes >= 3) / nullif(count(*), 0) as kedalaman,
    100.0 * count(*) filter (where greatest(coalesce(last_contact::timestamptz, '-infinity'), coalesce(last_note, '-infinity')) >= now() - interval '14 days') / nullif(count(*), 0) as kesegaran,
    100.0 * count(*) filter (where btrim(coalesce(next_action, '')) <> '') / nullif(count(*), 0) as tindak_lanjut
  from act
)
select case when n < 5 then jsonb_build_object('n', n, 'score', null, 'label', 'Data belum cukup (min 5 lead aktif)')
  else jsonb_build_object(
    'n', n,
    'score', round(0.30 * cakupan + 0.25 * kedalaman + 0.30 * kesegaran + 0.15 * tindak_lanjut),
    'label', case when round(0.30 * cakupan + 0.25 * kedalaman + 0.30 * kesegaran + 0.15 * tindak_lanjut) >= 80 then 'Sehat'
                  when round(0.30 * cakupan + 0.25 * kedalaman + 0.30 * kesegaran + 0.15 * tindak_lanjut) >= 60 then 'Cukup'
                  when round(0.30 * cakupan + 0.25 * kedalaman + 0.30 * kesegaran + 0.15 * tindak_lanjut) >= 40 then 'Perlu Perhatian'
                  else 'Kritis' end,
    'cakupan', round(cakupan, 1), 'kedalaman', round(kedalaman, 1), 'kesegaran', round(kesegaran, 1), 'tindak_lanjut', round(tindak_lanjut, 1)
  ) end
from m;
$function$;

revoke execute on function public.memory_quality_score(uuid) from public, anon;
grant execute on function public.memory_quality_score(uuid) to authenticated;

create or replace function public.refresh_memory_health()
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
  for r in select id from organizations loop
    s := public.memory_quality_score(r.id);
    if s->>'score' is not null then
      insert into org_memory_health (org_id, score, label, computed_at)
      values (r.id, (s->>'score')::int, s->>'label', now())
      on conflict (org_id) do update set score = excluded.score, label = excluded.label, computed_at = excluded.computed_at;
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$function$;

revoke execute on function public.refresh_memory_health() from public, anon, authenticated;

select cron.unschedule(11);
select cron.schedule('nexto-memory-health-check', '0 4 * * *', $$select public.refresh_memory_health();$$);
