-- Sinkron nilai lead ke journey setelah lead lewat tahap Proyek Deal (16 Nov 2026).
-- Jika lead sudah lewat tahap proyek_deal dan nilainya berubah, nilai dikirim ke proyek journey yang sudah ada
-- lewat nexto_update_nilai_proyek (hanya memperbarui, tidak membuat proyek baru).
-- Perilaku lama tidak berubah untuk lead di tahap proyek_deal.
-- Sudah diterapkan ke produksi lewat apply_migration (nama: sync_nilai_setelah_proyek_deal).
CREATE OR REPLACE FUNCTION public.sync_proyek_deal_to_journey() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault', 'net'
    AS $$
declare secret text; svc_key text; begin
  if new.org_id::text not in ('43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0', '217d90e3-36dd-4879-99c2-0de2be11d360') then return new; end if;
  -- Lead yang sudah lewat tahap Proyek Deal: hanya perubahan nilai yang dikirim, ke proyek journey yang sudah ada.
  if new.deleted_at is null and new.stage_key is distinct from 'proyek_deal' then
    if tg_op = 'UPDATE' and old.deal_value is distinct from new.deal_value then
      select decrypted_secret into secret from vault.decrypted_secrets where name = 'journey_sync_secret';
      select decrypted_secret into svc_key from vault.decrypted_secrets where name = 'journey_service_key';
      if secret is not null and svc_key is not null then
        perform net.http_post(
          url := 'https://dxorkakfzxxlumvyacdd.supabase.co/rest/v1/rpc/nexto_update_nilai_proyek',
          headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', svc_key, 'Authorization', 'Bearer ' || svc_key),
          body := jsonb_build_object('p_secret', secret, 'p_source_ref', new.id::text, 'p_nilai', coalesce(new.deal_value, 0))
        );
      end if;
    end if;
    return new;
  end if;
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
end; $$;
