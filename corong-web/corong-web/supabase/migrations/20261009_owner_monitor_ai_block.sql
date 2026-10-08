-- Owner pemantau (saklar organizations.features.owner_monitor, 9 Okt 2026): owner organisasi
-- itu tidak boleh memakai fitur AI untuk dirinya sendiri. Tampilan sudah menyembunyikan
-- tombolnya; ini penjaga di server supaya tidak bisa dipakai lewat jalur lain.
-- Memakai jalur kuota yang sudah dipakai semua fungsi AI: reserve_edge_function_call
-- (hanya fungsi AI, bukan kirim email atau verifikasi selfie) dan reserve_lead_gen_slot.
-- Fungsi yang ditolak membalas "kuota sudah terpakai" (null dari reserve).
create or replace function public.is_monitor_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.organizations o
    where o.owner_user_id = p_user_id and o.features @> '{"owner_monitor": true}'::jsonb
  );
$$;
revoke all on function public.is_monitor_owner(uuid) from public, anon, authenticated;

do $$
declare
  v text;
  v2 text;
  g1 text := E'begin\n  if public.is_monitor_owner(p_user_id) and p_function_name in (''draft-followup'', ''guess-outcome-reason'', ''lead-from-url'', ''quick-progress-note'', ''smart-import-map-ts'', ''suggest-categories'', ''suggest-visit-points'', ''summarize-lead-needs'', ''transcribe-meeting'') then\n    return null;\n  end if;\n';
  g2 text := E'begin\n  if p_user_id is not null and public.is_monitor_owner(p_user_id) then\n    return null;\n  end if;\n';
begin
  v := pg_get_functiondef('public.reserve_edge_function_call(uuid, text, timestamptz, integer)'::regprocedure);
  if v like '%is_monitor_owner%' then raise notice 'reserve_edge_function_call sudah memakai penjaga'; else
    v2 := regexp_replace(v, E'\nbegin\n', E'\n' || g1, 'n');
    if v2 = v then raise exception 'begin tidak ditemukan di reserve_edge_function_call'; end if;
    execute v2;
  end if;

  v := pg_get_functiondef('public.reserve_lead_gen_slot(uuid, integer, uuid)'::regprocedure);
  if v like '%is_monitor_owner%' then raise notice 'reserve_lead_gen_slot sudah memakai penjaga'; else
    v2 := regexp_replace(v, E'\nbegin\n', E'\n' || g2, 'n');
    if v2 = v then raise exception 'begin tidak ditemukan di reserve_lead_gen_slot'; end if;
    execute v2;
  end if;
end $$;
