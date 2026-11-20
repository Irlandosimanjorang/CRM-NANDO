-- Progres marketing di Nexto (checklist SPH, berkas QR, invoice, drawing, tanggal, nilai, PIC) ikut ke Journey
-- walaupun lead sudah pindah dari Proyek Deal ke Proyek Berjalan atau Selesai (20 Nov 2026).
-- Sebelumnya hanya perubahan nilai yang dikirim untuk lead yang sudah lewat Proyek Deal.
-- Sisi Journey: nexto_update_proyek_data (hanya memperbarui journey yang sudah ada).

create or replace function public.sync_proyek_deal_to_journey()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare secret text; svc_key text; begin
  if new.org_id::text not in ('43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0', '217d90e3-36dd-4879-99c2-0de2be11d360') then return new; end if;
  -- Lead yang sudah lewat tahap Proyek Deal: perubahan progres dan nilai dikirim ke proyek journey yang sudah ada.
  if new.deleted_at is null and new.stage_key is distinct from 'proyek_deal' then
    if tg_op = 'UPDATE'
       and (old.deal_value is distinct from new.deal_value
         or old.name is distinct from new.name
         or old.detail_proyek is distinct from new.detail_proyek
         or old.deal_date is distinct from new.deal_date
         or old.sph_number is distinct from new.sph_number
         or old.discount_pct is distinct from new.discount_pct
         or old.discount_total is distinct from new.discount_total
         or old.proyek_checklist is distinct from new.proyek_checklist
         or old.memo->'marketing' is distinct from new.memo->'marketing'
         or old.memo->'customer' is distinct from new.memo->'customer') then
      select decrypted_secret into secret from vault.decrypted_secrets where name = 'journey_sync_secret';
      select decrypted_secret into svc_key from vault.decrypted_secrets where name = 'journey_service_key';
      if secret is not null and svc_key is not null then
        perform net.http_post(
          url := 'https://dxorkakfzxxlumvyacdd.supabase.co/rest/v1/rpc/nexto_update_proyek_data',
          headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', svc_key, 'Authorization', 'Bearer ' || svc_key),
          body := jsonb_build_object(
            'p_secret', secret,
            'p_source_ref', new.id::text,
            'p_title', new.name,
            'p_customer', coalesce(nullif(new.memo->>'customer', ''), new.name),
            'p_nilai', coalesce(new.deal_value, 0),
            'p_data', public.journey_deal_payload(new)
          )
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
end; $function$;

-- Drawing (SPK) ikut dikirim untuk semua tahap proyek, bukan hanya Proyek Deal.
create or replace function public.sync_drawing_ke_journey()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare
  secret text;
  svc_key text;
begin
  if new.stage_key is distinct from 'proyek_deal' and new.stage_key is distinct from 'proyek_berjalan' and new.stage_key is distinct from 'proyek_selesai' then
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
