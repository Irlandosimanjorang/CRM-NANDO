-- Kirim data Proyek Deal (BSB) ke dashboard Journey Order (31 Okt 2026, permintaan Nando).
-- Secret "journey_sync_secret" disimpan di Vault (bukan di file ini). Sisi penerima ada di project journey-order:
-- fungsi public.nexto_upsert_order_journey dan secret "nexto_sync_secret" di Vault project itu.
-- Gagal kirim tidak menggagalkan simpan lead (fail-open).

create or replace function public.sync_proyek_deal_to_journey()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  secret text;
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
     and old.discount_total is not distinct from new.discount_total then
    return new;
  end if;

  select decrypted_secret into secret from vault.decrypted_secrets where name = 'journey_sync_secret';
  if secret is null then return new; end if;

  perform net.http_post(
    url := 'https://dxorkakfzxxlumvyacdd.supabase.co/rest/v1/rpc/nexto_upsert_order_journey',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_0MjVjXRPnYQU_aaBhQyp6g_h-ZbIox5'),
    body := jsonb_build_object(
      'p_secret', secret,
      'p_source_ref', new.id::text,
      'p_title', new.name,
      'p_customer', coalesce(nullif(new.memo->>'customer', ''), new.name),
      'p_nilai', coalesce(new.deal_value, 0),
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
$$;

drop trigger if exists leads_sync_journey on public.leads;
create trigger leads_sync_journey
  after insert or update on public.leads
  for each row execute function public.sync_proyek_deal_to_journey();
