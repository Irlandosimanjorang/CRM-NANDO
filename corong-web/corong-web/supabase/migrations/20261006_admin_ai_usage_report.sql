-- Laporan pemakaian AI per akun untuk Command Center (6 Okt 2026, permintaan
-- Nando: "setiap akun atau user dari standar sampe enterprise termasuk owner
-- maupun sales rep ... jumlah pemakaian token termasuk biayanya termasuk
-- berapa persen dari total limit keseluruhan").
--
-- Per akun berbayar, periode = siklus langganan berjalan (quota_plan_cycle;
-- cadangan bulan kalender bila paket tanpa tanggal berakhir):
--   - per fitur: jumlah pemakaian vs limit paketnya, token & biaya nyata
--     (dari ai_usage, tercatat sejak 6 Okt 2026), dan perkiraan biaya/1x;
--   - persen total = sum(pakai x biaya/1x) / sum(limit x biaya/1x), jadi fitur
--     mahal (Generate Leads) berbobot lebih besar dari fitur murah.
-- Dipanggil admin-status (service role); tidak bisa dipanggil pengguna.
create or replace function public.admin_ai_usage_report()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_kurs constant numeric := 17700;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  v_month_end timestamptz := (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month') at time zone 'Asia/Jakarta';
  v_result jsonb;
  v_totals jsonb;
begin
  with members as (
    select m.user_id, m.org_id, m.role, o.name as org_name,
      s.community_display_name as display_name, u.email,
      case when o.plan = 'enterprise' then 'enterprise'
           when s.plan = 'premium' then 'professional'
           when s.plan = 'standard' then 'standard'
           else 'free' end as plan
    from organization_members m
    join organizations o on o.id = m.org_id
    left join settings s on s.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
  ),
  win as (
    select p.*, x.c,
      coalesce(lower(x.c), v_month_start) as p_start,
      coalesce(upper(x.c), v_month_end) as p_end
    from members p
    cross join lateral (select quota_plan_cycle(p.user_id) as c) x
    where p.plan <> 'free'
  ),
  -- limit per paket (null = fitur tidak tersedia di paket itu), biaya/1x (Rp).
  feat(key, label, lim_std, lim_pro, lim_ent, est_rp, kind, ord) as (values
    ('generate-leads', 'Generate Leads', null, 4, 4, 17000, 'quota', 1),
    ('quick-progress-note', 'NEX Pro', 25, 150, 150, 275, 'quota', 2),
    ('daily-digest', 'AI Advisor (otomatis)', 22, 22, 22, 1400, 'advisor', 3),
    ('transcribe-meeting', 'Rekam Meeting', null, 8, 8, 4100, 'quota', 4),
    ('draft-followup', 'Draft Follow-up', null, 90, 90, 180, 'daily', 5),
    ('lead-from-url', 'Lead dari Link', 10, 10, 10, 1270, 'quota', 6),
    ('verify-selfie-photo', 'Verifikasi Selfie', null, null, 60, 75, 'quota', 7),
    ('summarize-lead-needs', 'Ringkasan Kebutuhan', null, null, 15, 230, 'quota', 8),
    ('suggest-categories', 'Rapihin Data', 4, 4, 4, 370, 'quota', 9),
    ('suggest-visit-points', 'Poin Diskusi', 10, 10, 10, 110, 'quota', 10),
    ('smart-import-map-ts', 'Smart Import', 8, 8, 8, 125, 'quota', 11),
    ('guess-outcome-reason', 'Tebak Alasan', null, 15, 15, 45, 'quota', 12),
    ('pipeline-review', 'Pipeline Review (otomatis)', null, null, null, 0, 'other', 13),
    ('customer-chat', 'Chat Bantuan', null, null, null, 0, 'other', 14)
  ),
  usage_by_feat as (
    select w.user_id,
      case when a.feature = 'enrich-generated-lead' then 'generate-leads' else a.feature end as key,
      sum(a.input_tokens + a.output_tokens + a.cache_write_tokens + a.cache_read_tokens) as tokens,
      sum(a.input_tokens) as input_tokens, sum(a.output_tokens) as output_tokens,
      sum(a.cache_write_tokens + a.cache_read_tokens) as cache_tokens,
      sum(a.audio_seconds) as audio_seconds,
      sum(a.cost_usd) as cost_usd,
      count(distinct (a.created_at at time zone 'Asia/Jakarta')::date) as active_days
    from win w
    join ai_usage a on a.user_id = w.user_id and a.created_at >= w.p_start
    group by 1, 2
  ),
  rows as (
    select w.user_id, f.key, f.label, f.ord, f.kind, f.est_rp,
      case w.plan when 'standard' then f.lim_std when 'professional' then f.lim_pro else f.lim_ent end as lim,
      case f.kind
        when 'quota' then coalesce((quota_usage(w.user_id, f.key) ->> 'used')::int, 0)
        when 'daily' then (select count(*) from edge_function_calls e where e.user_id = w.user_id and e.function_name = f.key and e.called_at >= w.p_start)::int
        when 'advisor' then coalesce(ub.active_days, 0)::int
        else 0 end as used,
      coalesce(ub.tokens, 0) as tokens, coalesce(ub.input_tokens, 0) as input_tokens,
      coalesce(ub.output_tokens, 0) as output_tokens, coalesce(ub.cache_tokens, 0) as cache_tokens,
      coalesce(ub.audio_seconds, 0) as audio_seconds,
      round(coalesce(ub.cost_usd, 0) * v_kurs) as cost_rp,
      coalesce(ub.cost_usd, 0) as cost_usd
    from win w
    cross join feat f
    left join usage_by_feat ub on ub.user_id = w.user_id and ub.key = f.key
  ),
  per_user as (
    select r.user_id,
      jsonb_agg(jsonb_build_object(
        'key', r.key, 'label', r.label, 'used', r.used, 'limit', r.lim,
        'applicable', r.lim is not null or r.kind = 'other',
        'pct', case when r.lim > 0 then round(100.0 * r.used / r.lim) end,
        'tokens', r.tokens, 'input_tokens', r.input_tokens, 'output_tokens', r.output_tokens,
        'cache_tokens', r.cache_tokens, 'audio_seconds', r.audio_seconds,
        'cost_rp', r.cost_rp, 'cost_usd', round(r.cost_usd, 4), 'est_rp_per_use', r.est_rp
      ) order by r.ord) filter (where r.lim is not null or r.kind = 'other' or r.cost_rp > 0) as features,
      sum(r.tokens) as tokens,
      sum(r.cost_rp) as cost_rp,
      sum(r.cost_usd) as cost_usd,
      sum(case when r.lim is not null then least(r.used, r.lim) * r.est_rp else 0 end) as est_used_rp,
      sum(case when r.lim is not null then r.lim * r.est_rp else 0 end) as est_max_rp
    from rows r
    group by r.user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', w.user_id, 'email', w.email, 'display_name', w.display_name,
      'org_name', w.org_name, 'role', w.role, 'plan', w.plan,
      'period_start', w.p_start, 'period_end', w.p_end, 'period_source', case when w.c is not null then 'plan' else 'month' end,
      'tokens', pu.tokens, 'cost_rp', pu.cost_rp, 'cost_usd', round(pu.cost_usd, 4),
      'est_used_rp', pu.est_used_rp, 'est_max_rp', pu.est_max_rp,
      'pct_of_limit', case when pu.est_max_rp > 0 then round(100.0 * pu.est_used_rp / pu.est_max_rp, 1) else 0 end,
      'features', coalesce(pu.features, '[]'::jsonb)
    ) order by case when pu.est_max_rp > 0 then pu.est_used_rp / pu.est_max_rp else 0 end desc, pu.cost_rp desc), '[]'::jsonb)
  into v_result
  from win w
  join per_user pu on pu.user_id = w.user_id;

  -- Total per paket (6 Okt 2026, permintaan Nando: "secara total pemakaian ai
  -- token berapa banyak, total duitnya in dollar"). Paket = paket akun saat
  -- ini; satu akun dihitung sekali walau anggota beberapa organisasi.
  with acc as (
    select distinct on (m.user_id) m.user_id,
      case when o.plan = 'enterprise' then 'enterprise'
           when s.plan = 'premium' then 'professional'
           when s.plan = 'standard' then 'standard'
           else 'free' end as plan
    from organization_members m
    join organizations o on o.id = m.org_id
    left join settings s on s.user_id = m.user_id
    order by m.user_id, (o.plan = 'enterprise') desc
  ),
  per_acc as (
    select acc.plan, acc.user_id,
      coalesce(sum(a.input_tokens + a.output_tokens + a.cache_write_tokens + a.cache_read_tokens), 0) as tokens_all,
      coalesce(sum(a.cost_usd), 0) as usd_all,
      coalesce(sum(a.input_tokens + a.output_tokens + a.cache_write_tokens + a.cache_read_tokens) filter (where a.created_at >= v_month_start), 0) as tokens_month,
      coalesce(sum(a.cost_usd) filter (where a.created_at >= v_month_start), 0) as usd_month,
      count(a.id) as calls_all
    from acc
    left join ai_usage a on a.user_id = acc.user_id
    where acc.plan <> 'free'
    group by 1, 2
  ),
  by_plan as (
    select plan, count(*) as accounts, count(*) filter (where calls_all > 0) as active_accounts,
      sum(tokens_all) as tokens_all, sum(usd_all) as usd_all,
      sum(tokens_month) as tokens_month, sum(usd_month) as usd_month
    from per_acc group by plan
  )
  select jsonb_build_object(
    'month_start', v_month_start,
    'by_plan', coalesce((select jsonb_agg(jsonb_build_object(
        'plan', x.plan, 'accounts', x.accounts, 'active_accounts', x.active_accounts,
        'tokens_all', x.tokens_all, 'usd_all', round(x.usd_all, 4),
        'tokens_month', x.tokens_month, 'usd_month', round(x.usd_month, 4),
        'avg_usd_per_active', case when x.active_accounts > 0 then round(x.usd_all / x.active_accounts, 4) else 0 end
      ) order by case x.plan when 'standard' then 1 when 'professional' then 2 else 3 end) from by_plan x), '[]'::jsonb),
    -- di luar akun berbayar: pengguna gratis + Chat Bantuan publik (tanpa akun).
    'other', (select jsonb_build_object(
        'tokens_all', coalesce(sum(a.input_tokens + a.output_tokens + a.cache_write_tokens + a.cache_read_tokens), 0),
        'usd_all', round(coalesce(sum(a.cost_usd), 0), 4),
        'tokens_month', coalesce(sum(a.input_tokens + a.output_tokens + a.cache_write_tokens + a.cache_read_tokens) filter (where a.created_at >= v_month_start), 0),
        'usd_month', round(coalesce(sum(a.cost_usd) filter (where a.created_at >= v_month_start), 0), 4))
      from ai_usage a
      where a.user_id is null or a.user_id not in (select user_id from per_acc))
  ) into v_totals;

  return jsonb_build_object(
    'generated_at', now(),
    'totals', v_totals,
    'kurs', v_kurs,
    'tracking_since', (select min(created_at) from ai_usage),
    'accounts', v_result
  );
end;
$$;

revoke all on function public.admin_ai_usage_report() from public, anon, authenticated;
