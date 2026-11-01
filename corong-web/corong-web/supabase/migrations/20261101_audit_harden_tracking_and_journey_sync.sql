-- Audit keamanan NEXTO (1 Nov 2026):
-- 1. Publishable key journey-order dipindah dari isi fungsi ke Vault.
-- 2. EXECUTE untuk anon dicabut dari fungsi tracking/sync; trigger tidak butuh EXECUTE untuk user mana pun.

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'journey_publishable_key') then
    perform vault.create_secret('sb_publishable_0MjVjXRPnYQU_aaBhQyp6g_h-ZbIox5', 'journey_publishable_key', 'Publishable key journey-order untuk sync dari NEXTO');
  end if;
end $$;

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
     and old.memo is not distinct from new.memo
     and old.detail_proyek is not distinct from new.detail_proyek
     and old.deal_value is not distinct from new.deal_value
     and old.deal_date is not distinct from new.deal_date
     and old.sph_number is not distinct from new.sph_number
     and old.discount_pct is not distinct from new.discount_pct
     and old.discount_total is not distinct from new.discount_total
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
      'p_data', jsonb_build_object(
        'nexto_lead_id', new.id,
        'memo', coalesce(new.memo, '{}'::jsonb),
        'detail_proyek', new.detail_proyek,
        'sph_number', new.sph_number,
        'deal_date', new.deal_date,
        'discount_pct', new.discount_pct,
        'discount_total', new.discount_total,
        'pic', coalesce(nullif(new.memo->>'marketing', ''), ''),
        'estimator', coalesce(nullif(new.memo->>'estimator', ''), '')
      )
    )
  );
  return new;
end;
$function$;

revoke execute on function public.sync_proyek_deal_to_journey() from public, anon, authenticated;
revoke execute on function public.set_tracking_token() from public, anon, authenticated;
-- Dipanggil dari papan lead (db.js getLeadTrackingToken): cukup untuk user login.
revoke execute on function public.get_lead_tracking_token(uuid) from public, anon;
