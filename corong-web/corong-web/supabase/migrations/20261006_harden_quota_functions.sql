-- Temuan advisor keamanan Supabase setelah audit 6 Okt 2026 (belum diterapkan).
-- 1) Dua fungsi kuota baru tanpa search_path terkunci.
alter function public.is_monthly_quota_feature(text) set search_path = public;
alter function public.quota_cycle_from_expiry(timestamptz, timestamptz) set search_path = public;

-- 2) Fungsi trigger check-in tidak perlu bisa dipanggil lewat /rest/v1/rpc
--    (pola yang sama dengan trigger lain: revoke_public_exec_on_trigger_functions).
revoke execute on function public.visit_checkins_claim_quota() from public, anon, authenticated;
