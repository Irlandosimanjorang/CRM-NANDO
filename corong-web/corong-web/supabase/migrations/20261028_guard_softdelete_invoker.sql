-- 28 Okt 2026: guard hapus lead Enterprise (protect_leads_softdelete_enterprise) dibuat SECURITY INVOKER.
-- Sebelumnya SECURITY DEFINER: di dalam fungsi, current_user = pemilik fungsi (postgres), jadi cek
-- "current_user <> 'postgres'" selalu gagal dan seluruh guard dilewati. Sales rep Enterprise bisa
-- soft-delete lead miliknya tanpa persetujuan owner/manager.
-- Dengan INVOKER, current_user = role pemanggil (authenticated), guard aktif lagi. service_role dan
-- postgres tetap dilewati seperti sebelumnya. my_role() memakai auth.uid() jadi tetap berfungsi.

alter function public.protect_leads_softdelete_enterprise() security invoker;
