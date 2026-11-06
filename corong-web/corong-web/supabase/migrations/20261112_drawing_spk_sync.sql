-- Drawing dan persetujuan SPK (12 Nov 2026).
-- 1. Journey mengirim status SPK diterima GM ke Nexto (memo.spk_diterima). Kotak Drawing baru bisa dicentang setelah itu.
-- 2. Centang Drawing di Nexto dikirim ke journey (item drawing di tahap SPK).
-- Status spk_diterima hanya naik (true), tidak bisa turun lewat form yang sudah terbuka.

create or replace function public.journey_set_spk_diterima(p_secret text, p_lead_id uuid, p_diterima boolean)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  expected text;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'journey_so_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'unauthorized';
  end if;
  update public.leads
  set memo = coalesce(memo, '{}'::jsonb) || jsonb_build_object('spk_diterima', coalesce(p_diterima, false))
  where id = p_lead_id;
  if not found then raise exception 'lead_tidak_ditemukan'; end if;
  return true;
end;
$$;

revoke all on function public.journey_set_spk_diterima(text, uuid, boolean) from public;
grant execute on function public.journey_set_spk_diterima(text, uuid, boolean) to anon, authenticated;

-- Penjagaan memo: spk_diterima tidak pernah turun dari true lewat form yang sudah lama terbuka.
create or replace function public.kunci_so_di_memo()
returns trigger
language plpgsql
as $$
begin
  if old.memo ? 'so_number' and coalesce(old.memo->>'so_number', '') <> '' then
    new.memo := coalesce(new.memo, '{}'::jsonb) || jsonb_build_object(
      'so_number', old.memo->'so_number',
      'tipe_proyek', old.memo->'tipe_proyek',
      'payment_aktif', coalesce(old.memo->'payment_aktif', 'true'::jsonb)
    );
  end if;
  if coalesce(old.memo->>'spk_diterima', '') = 'true' then
    new.memo := coalesce(new.memo, '{}'::jsonb) || jsonb_build_object('spk_diterima', true);
  end if;
  return new;
end;
$$;

-- Centang Drawing (atau hapusnya) dikirim ke journey.
create or replace function public.sync_drawing_ke_journey()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $$
declare
  secret text;
  pub_key text;
begin
  if new.stage_key is distinct from 'proyek_deal' then
    return new;
  end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'journey_sync_secret';
  if secret is null then return new; end if;
  select decrypted_secret into pub_key from vault.decrypted_secrets where name = 'journey_publishable_key';
  if pub_key is null then return new; end if;

  perform net.http_post(
    url := 'https://dxorkakfzxxlumvyacdd.supabase.co/rest/v1/rpc/nexto_set_drawing',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', pub_key),
    body := jsonb_build_object(
      'p_secret', secret,
      'p_source_ref', new.id::text,
      'p_drawing', coalesce((new.proyek_checklist ? 'drawing'), false)
    )
  );
  return new;
end;
$$;

drop trigger if exists leads_sync_drawing on public.leads;
create trigger leads_sync_drawing
after update of proyek_checklist on public.leads
for each row
when (old.proyek_checklist is distinct from new.proyek_checklist)
execute function public.sync_drawing_ke_journey();
