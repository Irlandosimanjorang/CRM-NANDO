-- 13 Nov 2026 - pisahkan secret SPK dari secret SO.
-- Sebelumnya journey_set_spk_diterima memakai vault journey_so_secret (sama dengan journey_terima_so),
-- sehingga satu secret membuka dua fungsi. Sekarang memakai vault journey_spk_secret.
--
-- PENTING sebelum migrasi ini diterapkan ke produksi:
-- 1. Buat secret baru di Vault produksi: name = 'journey_spk_secret'.
-- 2. Di Journey, panggilan SPK harus mengirim nilai secret baru itu (bukan SO secret).
-- Kalau migrasi diterapkan sebelum Journey diubah, centang SPK dari Journey akan ditolak (unauthorized).

create or replace function public.journey_set_spk_diterima(p_secret text, p_lead_id uuid, p_diterima boolean)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  expected text;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'journey_spk_secret';
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
