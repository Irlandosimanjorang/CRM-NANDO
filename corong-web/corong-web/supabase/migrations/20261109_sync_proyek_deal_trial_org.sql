-- Trial (9 Nov 2026): org "Organisasi Saya" (simanjorangirlando@gmail.com) ikut dikirim ke Journey
-- saat lead masuk tahap Proyek Deal. Sebelumnya hanya org PT. Bangun Selaras Bersama.
-- Isi fungsi sama dengan versi sebelumnya, hanya daftar org yang diizinkan yang bertambah.

create or replace function public.sync_proyek_deal_to_journey()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare secret text; pub_key text; begin
  -- Hanya lead dari org yang diizinkan (PT. Bangun Selaras Bersama beserta tim marketingnya, dan org trial) yang dikirim ke journey IndoPVC.
  if new.org_id::text not in ('43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0', '217d90e3-36dd-4879-99c2-0de2be11d360') then return new; end if;
  if new.deleted_at is not null or new.stage_key is distinct from 'proyek_deal' then return new; end if;
  if tg_op = 'UPDATE' and old.stage_key = 'proyek_deal' and old.name is not distinct from new.name and old.detail_proyek is not distinct from new.detail_proyek and old.deal_value is not distinct from new.deal_value and old.deal_date is not distinct from new.deal_date and old.sph_number is not distinct from new.sph_number and old.discount_pct is not distinct from new.discount_pct and old.discount_total is not distinct from new.discount_total and old.proyek_checklist is not distinct from new.proyek_checklist and old.tracking_token is not distinct from new.tracking_token then return new; end if;
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
end; $function$;
