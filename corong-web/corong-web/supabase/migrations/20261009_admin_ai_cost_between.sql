-- Jumlah biaya AI (USD) pada rentang waktu, untuk bar saldo token Anthropic di kartu CASH FLOW
-- (9 Okt 2026). Agregasi dilakukan di database supaya polling tiap beberapa detik tetap ringan.
-- Hanya service role (edge function admin-cashflow) yang boleh memanggil.
create or replace function public.admin_ai_cost_between(p_from timestamptz, p_to timestamptz default now())
returns numeric
language sql
stable
security invoker
set search_path to 'public'
as $$
  select coalesce(sum(cost_usd), 0) from public.ai_usage where created_at >= p_from and created_at < p_to
$$;
revoke all on function public.admin_ai_cost_between(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_ai_cost_between(timestamptz, timestamptz) to service_role;
