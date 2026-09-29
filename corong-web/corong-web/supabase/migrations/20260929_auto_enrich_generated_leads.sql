-- Pelengkapan kontak otomatis buat hasil Generate Leads. generate-leads,
-- abis nyimpen hasil, manggil dispatch_lead_enrichment -> pg_net nembak
-- edge function enrich-generated-lead buat tiap lead secara paralel (tiap
-- lead jalan di invocation sendiri, gak kepotong batas 150 detik).
-- p_secret = CRON_SECRET dari env edge function (gak disimpen di DB); fungsi
-- cuma bisa dipanggil service_role.
--
-- Sudah diterapkan ke project cewggulyfshnbebcpyui via migration
-- "auto_enrich_generated_leads" (29 Sep 2026). File ini dokumentasi lokal.

alter table public.generated_leads add column if not exists enrich_status text;
alter table public.generated_leads add column if not exists enrich_started_at timestamptz;

create or replace function public.dispatch_lead_enrichment(p_ids uuid[], p_secret text)
 returns int
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_id uuid;
  v_count int := 0;
begin
  foreach v_id in array p_ids loop
    perform net.http_post(
      url := 'https://cewggulyfshnbebcpyui.supabase.co/functions/v1/enrich-generated-lead',
      headers := jsonb_build_object('x-cron-secret', p_secret, 'Content-Type', 'application/json'),
      body := jsonb_build_object('generated_lead_id', v_id),
      timeout_milliseconds := 180000
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$fn$;

revoke execute on function public.dispatch_lead_enrichment(uuid[], text) from public, anon, authenticated;
grant execute on function public.dispatch_lead_enrichment(uuid[], text) to service_role;
