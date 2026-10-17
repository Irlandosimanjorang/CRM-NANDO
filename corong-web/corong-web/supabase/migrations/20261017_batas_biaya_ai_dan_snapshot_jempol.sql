-- 17 Okt 2026: batas biaya AI per fitur per org, dan kolom snapshot untuk penilaian jempol.
-- ai_budgets: batas biaya bulanan (USD) per org dan per fitur. Tanpa baris = tidak ada batas.
-- ai_within_budget(org, fitur) dipakai fungsi AI sebelum memanggil Claude (belum dipasang di edge function).
-- ai_feedback.snapshot: salinan teks draft yang dijempol, dipakai sebagai contoh gaya.
-- Sudah diterapkan ke database lewat MCP.

create table if not exists public.ai_budgets (
  org_id uuid not null references public.organizations(id) on delete cascade,
  feature text not null,
  monthly_limit_usd numeric(10,2) not null check (monthly_limit_usd >= 0),
  updated_at timestamptz not null default now(),
  primary key (org_id, feature)
);

alter table public.ai_budgets enable row level security;
-- Tanpa policy: batas biaya bersifat internal, tidak terlihat dari aplikasi. Hanya bisa diatur lewat database.

create or replace function public.ai_feature_spend_month(p_org uuid, p_feature text)
returns numeric
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(sum(cost_usd), 0)
  from ai_usage
  where org_id = p_org and feature = p_feature
    and created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
$function$;

create or replace function public.ai_within_budget(p_org uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (select public.ai_feature_spend_month(p_org, p_feature) < b.monthly_limit_usd
       from ai_budgets b where b.org_id = p_org and b.feature = p_feature),
    true)
$function$;

revoke execute on function public.ai_feature_spend_month(uuid, text) from public, anon, authenticated;
revoke execute on function public.ai_within_budget(uuid, text) from public, anon, authenticated;

alter table public.ai_feedback add column if not exists snapshot text;
