-- 17 Okt 2026: skor kualitas memori diperketat, fokus ke progress harian per lead.
-- Hanya catatan "valid" yang dihitung: bukan catatan tipis (is_thin_note) dan bukan check-in GPS otomatis.
-- Bobot: frekuensi harian 35%, kesegaran 25%, cakupan 20%, kualitas catatan 20%.
--   frekuensi: tiap lead aktif dapat nilai penuh kalau ada catatan valid di 3 hari berbeda dalam 14 hari terakhir.
--   kesegaran: catatan valid atau kontak terakhir maksimal 7 hari lalu (sebelumnya 14 hari).
--   cakupan: lead aktif dengan minimal 1 catatan valid dalam 30 hari.
--   kualitas: porsi catatan 30 hari terakhir yang valid.
-- Minimal 5 lead aktif. Label: 85+ Sehat, 70-84 Cukup, 50-69 Perlu Perhatian, di bawah 50 Kritis.
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
  select l.id, l.last_contact
  from leads l
  where l.org_id = p_org and l.deleted_at is null
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
  select a.id,
    (select count(distinct (v.created_at at time zone 'Asia/Jakarta')::date) from valid v where v.lead_id = a.id and v.created_at > now() - interval '14 days') as hari14,
    (select max(v.created_at) from valid v where v.lead_id = a.id) as terakhir_catat,
    (select count(*) from valid v where v.lead_id = a.id and v.created_at > now() - interval '30 days') as catat30
  from act a
),
notes_all as (
  select count(*) as semua,
    count(*) filter (where not is_thin_note(n.text) and n.text not ilike 'Check-in GPS terverifikasi%') as valid
  from progress_notes n
  where n.org_id = p_org and n.created_at > now() - interval '30 days'
),
m as (
  select count(*) as n,
    100.0 * avg(least(hari14 / 3.0, 1)) as frekuensi,
    100.0 * count(*) filter (where greatest(coalesce(terakhir_catat, '-infinity'), coalesce(last_contact::timestamptz, '-infinity')) >= now() - interval '7 days') / nullif(count(*), 0) as kesegaran,
    100.0 * count(*) filter (where catat30 >= 1) / nullif(count(*), 0) as cakupan,
    (select 100.0 * valid / nullif(semua, 0) from notes_all) as kualitas
  from per_lead pl join act a on a.id = pl.id
)
select case when n < 5 then jsonb_build_object('n', n, 'score', null, 'label', 'Data belum cukup (min 5 lead aktif)')
  else jsonb_build_object(
    'n', n,
    'score', round(0.35 * coalesce(frekuensi, 0) + 0.25 * coalesce(kesegaran, 0) + 0.20 * coalesce(cakupan, 0) + 0.20 * coalesce(kualitas, 0)),
    'label', case when round(0.35 * coalesce(frekuensi, 0) + 0.25 * coalesce(kesegaran, 0) + 0.20 * coalesce(cakupan, 0) + 0.20 * coalesce(kualitas, 0)) >= 85 then 'Sehat'
                  when round(0.35 * coalesce(frekuensi, 0) + 0.25 * coalesce(kesegaran, 0) + 0.20 * coalesce(cakupan, 0) + 0.20 * coalesce(kualitas, 0)) >= 70 then 'Cukup'
                  when round(0.35 * coalesce(frekuensi, 0) + 0.25 * coalesce(kesegaran, 0) + 0.20 * coalesce(cakupan, 0) + 0.20 * coalesce(kualitas, 0)) >= 50 then 'Perlu Perhatian'
                  else 'Kritis' end,
    'frekuensi', round(coalesce(frekuensi, 0), 1), 'kesegaran', round(coalesce(kesegaran, 0), 1),
    'cakupan', round(coalesce(cakupan, 0), 1), 'kualitas', round(coalesce(kualitas, 0), 1)
  ) end
from m;
$function$;

revoke execute on function public.memory_quality_score(uuid) from public, anon;
grant execute on function public.memory_quality_score(uuid) to authenticated;
