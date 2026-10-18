-- 18 Okt 2026: get_deals_range hanya untuk pengguna yang sudah login (advisor: bisa dipanggil anon).
revoke execute on function public.get_deals_range(date, date) from anon, public;
grant execute on function public.get_deals_range(date, date) to authenticated;
