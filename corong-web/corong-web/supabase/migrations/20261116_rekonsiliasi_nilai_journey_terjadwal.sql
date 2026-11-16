-- Rekonsiliasi terjadwal nilai ke journey (16 Nov 2026). Sudah diterapkan ke produksi lewat apply_migration
-- (rekonsiliasi_nilai_journey_terjadwal). Tiap jam menit ke-7, CRM mengirim nilai semua lead proyek ke journey.
-- Journey hanya memperbarui yang berbeda, jadi selisih yang gagal atau terbalik terkoreksi di siklus berikutnya.

create or replace function public.reconcile_journey_nilai()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  secret text;
  svc_key text;
  items jsonb;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'journey_sync_secret';
  select decrypted_secret into svc_key from vault.decrypted_secrets where name = 'journey_service_key';
  if secret is null or svc_key is null then return; end if;

  select coalesce(jsonb_agg(jsonb_build_object('source_ref', l.id::text, 'nilai', coalesce(l.deal_value, 0))), '[]'::jsonb)
    into items
    from public.leads l
   where l.deleted_at is null
     and l.org_id::text in ('43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0', '217d90e3-36dd-4879-99c2-0de2be11d360')
     and l.stage_key in ('proyek_deal', 'proyek_berjalan', 'proyek_selesai');

  if jsonb_array_length(items) = 0 then return; end if;

  perform net.http_post(
    url := 'https://dxorkakfzxxlumvyacdd.supabase.co/rest/v1/rpc/nexto_reconcile_nilai',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', svc_key, 'Authorization', 'Bearer ' || svc_key),
    body := jsonb_build_object('p_secret', secret, 'p_items', items)
  );
end;
$$;

revoke all on function public.reconcile_journey_nilai() from public, anon, authenticated;

select cron.unschedule('reconcile-journey-nilai') where exists (select 1 from cron.job where jobname = 'reconcile-journey-nilai');
select cron.schedule('reconcile-journey-nilai', '7 * * * *', 'select public.reconcile_journey_nilai()');
