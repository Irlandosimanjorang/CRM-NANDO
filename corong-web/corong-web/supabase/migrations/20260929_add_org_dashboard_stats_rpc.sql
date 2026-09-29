-- Aggregat performa SELURUH org (bukan cuma lead milik caller) - dipake
-- Dashboard.jsx buat kasih sales_rep di plan Enterprise gambaran performa
-- perusahaan secara umum, tanpa perlu buka data lead individual sales lain.
--
-- SECURITY DEFINER, tapi org_id SELALU diturunin dari auth.uid() sendiri
-- lewat organization_members - gak pernah nerima org_id dari client, jadi
-- gak mungkin dipakai buat query data org lain.
--
-- Sudah diterapkan langsung ke project Supabase (cewggulyfshnbebcpyui) via
-- migration "fix_org_dashboard_stats_rpc_array_bug_v2" pada 29 Sep 2026.
-- File ini cuma dokumentasi lokal (repo sebelumnya gak nyimpen migration
-- SQL di git sama sekali) - kalau perlu re-apply ke project/environment
-- lain, jalankan langsung isi file ini.

create or replace function public.get_org_dashboard_stats()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_org_id uuid;
  v_won_keys text[];
  v_lost_keys text[];
begin
  select org_id into v_org_id from organization_members where user_id = auth.uid() limit 1;
  if v_org_id is null then
    return jsonb_build_object('total', 0, 'won', 0, 'lost', 0, 'followups', 0, 'visits', 0, 'win_rate', 0, 'deals', 0, 'revenue', 0);
  end if;

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
    ),
    deal_stats as (
      select count(*) as deals, coalesce(sum(deal_value), 0) as revenue
      from deal_transactions
      where org_id = v_org_id
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
$fn$;

revoke execute on function public.get_org_dashboard_stats() from public, anon;
grant execute on function public.get_org_dashboard_stats() to authenticated;
