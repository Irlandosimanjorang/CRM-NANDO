-- Checklist proyek (SPH ditandatangani, berkas QR code, performa invoice) dan tanggal/nilai deal
-- ikut dikirim ke Journey. Memo tidak lagi dikirim (langkah memo sudah dihapus dari form Proyek Deal).
-- Perubahan checklist juga memicu sinkron, tidak hanya perubahan nilai/SPH.

create or replace function public.journey_deal_payload(r public.leads)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'nexto_lead_id', r.id,
    'detail_proyek', r.detail_proyek,
    'sph_number', r.sph_number,
    'deal_date', r.deal_date,
    'tanggal_deal', r.deal_date,
    'nilai_deal', coalesce(r.deal_value, 0),
    'discount_pct', r.discount_pct,
    'discount_total', r.discount_total,
    'pic', coalesce(nullif(r.memo->>'marketing', ''), ''),
    'estimator', coalesce(nullif(r.memo->>'estimator', ''), ''),
    'sph_ttd', coalesce(r.proyek_checklist ? 'sph_ttd', false),
    'berkas_qr', coalesce(r.proyek_checklist ? 'qr_berkas', false),
    'invoice_proforma', coalesce(r.proyek_checklist ? 'invoice_performa', false)
  );
$$;

create or replace function public.sync_proyek_deal_to_journey()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare
  secret text;
  pub_key text;
begin
  if new.deleted_at is not null or new.stage_key is distinct from 'proyek_deal' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.stage_key = 'proyek_deal'
     and old.name is not distinct from new.name
     and old.detail_proyek is not distinct from new.detail_proyek
     and old.deal_value is not distinct from new.deal_value
     and old.deal_date is not distinct from new.deal_date
     and old.sph_number is not distinct from new.sph_number
     and old.discount_pct is not distinct from new.discount_pct
     and old.discount_total is not distinct from new.discount_total
     and old.proyek_checklist is not distinct from new.proyek_checklist
     and old.tracking_token is not distinct from new.tracking_token then
    return new;
  end if;

  select decrypted_secret into secret from vault.decrypted_secrets where name = 'journey_sync_secret';
  if secret is null then return new; end if;
  select decrypted_secret into pub_key from vault.decrypted_secrets where name = 'journey_publishable_key';
  if pub_key is null then return new; end if;

  perform net.http_post(
    url := 'https://dxorkakfzxxlumvyacdd.supabase.co/rest/v1/rpc/nexto_upsert_order_journey',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', pub_key),
    body := jsonb_build_object(
      'p_secret', secret,
      'p_source_ref', new.id::text,
      'p_title', new.name,
      'p_customer', coalesce(nullif(new.memo->>'customer', ''), new.name),
      'p_nilai', coalesce(new.deal_value, 0),
      'p_track_token', new.tracking_token,
      'p_data', public.journey_deal_payload(new)
    )
  );
  return new;
end;
$function$;

create or replace function public.resync_proyek_deal_to_journey()
returns integer
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
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
        'p_data', public.journey_deal_payload(r)
      )
    );
    n := n + 1;
  end loop;
  return n;
end;
$function$;
