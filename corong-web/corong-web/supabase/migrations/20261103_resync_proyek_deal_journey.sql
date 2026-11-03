-- Sinkron ulang proyek_deal yang gagal terkirim ke Journey.
-- Trigger leads_sync_journey memakai net.http_post tanpa retry. Kalau request gagal, proyek tidak muncul di Journey.
-- Job ini berjalan tiap 10 menit dan mengirim ulang lead proyek_deal yang diubah dalam 30 menit terakhir.
-- nexto_upsert_order_journey bersifat upsert, jadi kiriman ulang aman dan tidak membuat proyek ganda.

create or replace function public.resync_proyek_deal_to_journey()
returns integer
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  secret text;
  pub_key text;
  r record;
  n integer := 0;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'journey_sync_secret';
  if secret is null then return 0; end if;
  select decrypted_secret into pub_key from vault.decrypted_secrets where name = 'journey_publishable_key';
  if pub_key is null then return 0; end if;

  for r in
    select * from public.leads
    where stage_key = 'proyek_deal'
      and deleted_at is null
      and updated_at > now() - interval '30 minutes'
  loop
    perform net.http_post(
      url := 'https://dxorkakfzxxlumvyacdd.supabase.co/rest/v1/rpc/nexto_upsert_order_journey',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', pub_key),
      body := jsonb_build_object(
        'p_secret', secret,
        'p_source_ref', r.id::text,
        'p_title', r.name,
        'p_customer', coalesce(nullif(r.memo->>'customer', ''), r.name),
        'p_nilai', coalesce(r.deal_value, 0),
        'p_track_token', r.tracking_token,
        'p_data', jsonb_build_object(
          'nexto_lead_id', r.id,
          'memo', coalesce(r.memo, '{}'::jsonb),
          'detail_proyek', r.detail_proyek,
          'sph_number', r.sph_number,
          'deal_date', r.deal_date,
          'discount_pct', r.discount_pct,
          'discount_total', r.discount_total,
          'pic', coalesce(nullif(r.memo->>'marketing', ''), ''),
          'estimator', coalesce(nullif(r.memo->>'estimator', ''), '')
        )
      )
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.resync_proyek_deal_to_journey() from public, anon, authenticated;

select cron.unschedule('nexto-resync-proyek-deal-journey')
where exists (select 1 from cron.job where jobname = 'nexto-resync-proyek-deal-journey');

select cron.schedule(
  'nexto-resync-proyek-deal-journey',
  '*/10 * * * *',
  $$select public.resync_proyek_deal_to_journey()$$
);
