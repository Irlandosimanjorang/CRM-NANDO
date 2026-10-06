-- Trigger pelindung kolom hak istimewa (plan, member_limit, plan_expires_at,
-- is_platform_admin) dulu SECURITY DEFINER, sehingga current_user di dalamnya
-- selalu pemilik fungsi (postgres) dan pengecekan "bukan service_role/postgres"
-- tidak pernah berlaku: pengguna login bisa mengubah paket sendiri lewat API
-- (terbukti 6 Okt 2026 lewat uji transaksi yang di-rollback).
--
-- Dengan SECURITY INVOKER, current_user = peran pemanggil:
--   authenticated        -> permintaan langsung dari aplikasi (diblokir)
--   postgres             -> di dalam RPC SECURITY DEFINER (ensure_my_org: upgrade Mayar tertunda) (diizinkan)
--   service_role         -> edge function admin (admin-invoices, mayar-webhook) (diizinkan)
alter function public.protect_organizations_privileged_columns() security invoker;
alter function public.protect_settings_privileged_columns() security invoker;
