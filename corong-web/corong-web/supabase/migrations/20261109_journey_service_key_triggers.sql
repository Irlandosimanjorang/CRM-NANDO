-- Nexto -> Journey memakai service key Journey (journey_service_key di Vault Nexto),
-- bukan publishable key. Setelah ini, anon tidak lagi bisa memanggil
-- nexto_set_drawing dan nexto_upsert_order_journey di project journey-order.
-- Sudah diterapkan ke DB Nexto pada 2026-11-09. Idempotent.
--
-- Prasyarat: secret Vault "journey_service_key" sudah ada di project Nexto.

create or replace function public.sync_drawing_ke_journey() returns trigger language plpgsql security definer set search_path = public, vault, net as $function$
declare
  secret text;
  svc_key text;
begin
  if new.stage_key is distinct from 'proyek_deal' then
    return new;
  end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'journey_sync_secret';
  if secret is null then return new; end if;
  select decrypted_secret into svc_key from vault.decrypted_secrets where name = 'journey_service_key';
  if svc_key is null then return new; end if;

  perform net.http_post(
    url := 'https://dxorkakfzxxlumvyacdd.supabase.co/rest/v1/rpc/nexto_set_drawing',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', svc_key, 'Authorization', 'Bearer ' || svc_key),
    body := jsonb_build_object(
      'p_secret', secret,
      'p_source_ref', new.id::text,
      'p_drawing', coalesce((new.proyek_checklist ? 'drawing'), false)
    )
  );
  return new;
end;
$function$;

create or replace function public.sync_proyek_deal_to_journey() returns trigger language plpgsql security definer set search_path = public, vault, net as $function$
declare secret text; svc_key text; begin
  if new.org_id::text not in ('43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0', '217d90e3-36dd-4879-99c2-0de2be11d360') then return new; end if;
  if new.deleted_at is not null or new.stage_key is distinct from 'proyek_deal' then return new; end if;
  if tg_op = 'UPDATE' and old.stage_key = 'proyek_deal' and old.name is not distinct from new.name and old.detail_proyek is not distinct from new.detail_proyek and old.deal_value is not distinct from new.deal_value and old.deal_date is not distinct from new.deal_date and old.sph_number is not distinct from new.sph_number and old.discount_pct is not distinct from new.discount_pct and old.discount_total is not distinct from new.discount_total and old.proyek_checklist is not distinct from new.proyek_checklist and old.tracking_token is not distinct from new.tracking_token then return new; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'journey_sync_secret';
  if secret is null then return new; end if;
  select decrypted_secret into svc_key from vault.decrypted_secrets where name = 'journey_service_key';
  if svc_key is null then return new; end if;
  perform net.http_post(
    url := 'https://dxorkakfzxxlumvyacdd.supabase.co/rest/v1/rpc/nexto_upsert_order_journey',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', svc_key, 'Authorization', 'Bearer ' || svc_key),
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
end; $function$;

create or replace function public.resync_proyek_deal_to_journey() returns integer language plpgsql security definer set search_path = public, vault, net as $function$
declare
  secret text;
  svc_key text;
  r record;
  n integer := 0;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'journey_sync_secret';
  if secret is null then return 0; end if;
  select decrypted_secret into svc_key from vault.decrypted_secrets where name = 'journey_service_key';
  if svc_key is null then return 0; end if;

  for r in
    select * from public.leads
    where stage_key = 'proyek_deal'
      and deleted_at is null
      and updated_at > now() - interval '30 minutes'
  loop
    perform net.http_post(
      url := 'https://dxorkakfzxxlumvyacdd.supabase.co/rest/v1/rpc/nexto_upsert_order_journey',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', svc_key, 'Authorization', 'Bearer ' || svc_key),
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

-- Cabut anon dari function Journey yang dipanggil sync Nexto (dijalankan di project journey-order):
-- revoke execute on function public.nexto_set_drawing(text, text, boolean) from anon;
-- revoke execute on function public.nexto_upsert_order_journey(text, text, text, text, numeric, jsonb, text) from anon;
