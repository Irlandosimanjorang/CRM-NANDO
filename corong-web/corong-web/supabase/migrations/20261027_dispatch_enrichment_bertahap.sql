-- Pelengkapan kontak Generate Leads dikirim BERTAHAP (27 Okt 2026).
-- Sebelumnya semua panggilan enrich dikirim sekaligus; function gagal mulai (503 BOOT_ERROR)
-- dan lead tertinggal "pending". Sekarang ada jeda 1,5 detik antar panggilan.
create or replace function public.dispatch_lead_enrichment(p_ids uuid[], p_secret text)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  foreach v_id in array p_ids loop
    if v_count > 0 then
      perform pg_sleep(1.5);
    end if;
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
$$;
