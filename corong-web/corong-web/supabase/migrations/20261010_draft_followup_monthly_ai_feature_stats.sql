-- 10 Okt 2026 (permintaan Nando):
-- 1) Draft Follow-up berpindah dari 3x per hari ke 60x per bulan (mengikuti siklus langganan seperti fitur bulanan lain).
--    Batas yang sebenarnya dipaksa edge function draft-followup (reserveMonthly, 60); di sini fitur didaftarkan sebagai fitur
--    bulanan supaya reserve_edge_function_call memakai siklus paket, dan angkanya di laporan pemakaian admin disamakan.
-- 2) Laporan admin_ai_usage_report ikut membawa feature_stats (pemakaian dan biaya nyata per fitur AI dari tabel ai_usage)
--    untuk kartu FITUR AI di Command Center. Tidak ada perubahan pada kolom lain.
create or replace function public.is_monthly_quota_feature(p_feature text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select p_feature = any (array[
    'quick-progress-note', 'transcribe-meeting', 'lead-from-url', 'summarize-lead-needs',
    'verify-selfie-photo', 'suggest-visit-points', 'guess-outcome-reason',
    'smart-import-map-ts', 'suggest-categories', 'send-lead-email', 'draft-followup'
  ]);
$$;

do $$
declare
  def text;
  patched text;
begin
  def := pg_get_functiondef('public.admin_ai_usage_report()'::regprocedure);
  patched := replace(def, '(''draft-followup'', ''Draft Follow-up'', null, 90, 90, 180, ''daily'', 5)', '(''draft-followup'', ''Draft Follow-up'', null, 60, 60, 180, ''quota'', 5)');
  if patched = def then
    raise notice 'baris draft-followup sudah berubah atau tidak ditemukan; tidak ada yang diganti';
  end if;
  if position('feature_stats' in patched) = 0 then
    def := patched;
    patched := replace(def, '''accounts'', v_result',
      '''accounts'', v_result, ''feature_stats'', (select coalesce(jsonb_agg(jsonb_build_object(' ||
      '''feature'', s.feature, ''calls_month'', s.calls_month, ''cost_month'', round(s.cost_month, 4), ''calls_all'', s.calls_all, ' ||
      '''cost_all'', round(s.cost_all, 4), ''avg_cost'', round(s.avg_cost, 5), ''max_cost'', round(s.max_cost, 5), ' ||
      '''avg_in'', round(s.avg_in), ''avg_out'', round(s.avg_out), ''audio_s'', s.audio_s, ''users_month'', s.users_month, ''last_at'', s.last_at' ||
      ') order by s.cost_all desc), ''[]''::jsonb) from (' ||
      'select a.feature, count(*) filter (where a.created_at >= v_month_start) as calls_month, ' ||
      'coalesce(sum(a.cost_usd) filter (where a.created_at >= v_month_start), 0) as cost_month, count(*) as calls_all, ' ||
      'coalesce(sum(a.cost_usd), 0) as cost_all, coalesce(avg(a.cost_usd), 0) as avg_cost, coalesce(max(a.cost_usd), 0) as max_cost, ' ||
      'coalesce(avg(a.input_tokens), 0) as avg_in, coalesce(avg(a.output_tokens), 0) as avg_out, coalesce(sum(a.audio_seconds), 0) as audio_s, ' ||
      'count(distinct a.user_id) filter (where a.created_at >= v_month_start) as users_month, max(a.created_at) as last_at ' ||
      'from public.ai_usage a group by a.feature) s)');
    if patched = def then
      raise exception 'penanda accounts/v_result tidak ditemukan di admin_ai_usage_report; migrasi dibatalkan';
    end if;
  end if;
  execute patched;
end $$;
