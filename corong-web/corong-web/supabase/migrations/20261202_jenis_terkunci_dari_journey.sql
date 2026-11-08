-- Dipanggil Journey (proyek journey-order) saat DP tersimpan. Jenis penjualan di form Proyek Deal jadi baca-saja.
-- Sudah diterapkan ke produksi (proyek CRM Nexto) sebagai jenis_terkunci_dari_journey_dp.
-- Secret p_secret harus sama dengan vault journey_sync_secret (nilainya sama dengan nexto_sync_secret di Journey).

create or replace function public.journey_tandai_dp(p_secret text, p_source_ref text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  expected text;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'journey_sync_secret';
  if expected is null or p_secret is distinct from expected then raise exception 'unauthorized'; end if;
  update public.leads
     set memo = coalesce(memo, '{}'::jsonb) || '{"jenis_terkunci": true}'::jsonb
   where id::text = p_source_ref;
end;
$$;

revoke all on function public.journey_tandai_dp(text, text) from public;
grant execute on function public.journey_tandai_dp(text, text) to anon, authenticated;
