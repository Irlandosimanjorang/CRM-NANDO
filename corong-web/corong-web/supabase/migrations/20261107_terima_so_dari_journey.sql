-- Menerima No. SO dari journey-order (7 Nov 2026).
-- Dipanggil oleh edge function kirim-so-ke-nexto (journey) setelah finance membuat No. SO.
-- Secret dibaca dari vault: journey_so_secret (harus sama dengan JOURNEY_SO_SECRET di journey).

create or replace function public.journey_terima_so(p_secret text, p_lead_id uuid, p_so text, p_tipe text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  expected text;
  cur jsonb;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'journey_so_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'unauthorized';
  end if;
  if coalesce(p_so, '') = '' or p_tipe not in ('selaras', 'sejahtera') then
    raise exception 'data_tidak_valid';
  end if;
  select memo into cur from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'lead_tidak_ditemukan';
  end if;
  -- No. SO yang sudah ada tidak boleh diganti (sesuai aturan: sekali terbentuk, tidak bisa diubah).
  if coalesce(cur->>'so_number', '') <> '' and cur->>'so_number' <> p_so then
    raise exception 'so_sudah_ada';
  end if;
  update public.leads
  set memo = coalesce(memo, '{}'::jsonb) || jsonb_build_object(
    'so_number', p_so,
    'tipe_proyek', p_tipe,
    'payment_aktif', true
  )
  where id = p_lead_id;
  return true;
end;
$$;

revoke all on function public.journey_terima_so(text, uuid, text, text) from public;
grant execute on function public.journey_terima_so(text, uuid, text, text) to anon, authenticated;

-- Form lead yang sudah terbuka bisa menulis ulang memo lama. Setelah No. SO terbentuk, nilai ini
-- dikembalikan dari data lama, jadi tidak pernah hilang atau berubah lewat jalur apa pun.
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
  return new;
end;
$$;

drop trigger if exists kunci_so_di_memo on public.leads;
create trigger kunci_so_di_memo
before update on public.leads
for each row execute function public.kunci_so_di_memo();
