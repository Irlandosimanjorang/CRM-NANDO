-- Perubahan konfigurasi organisasi oleh owner (tahap pipeline, nama/industri, profil perusahaan) dikirim realtime
-- ke akun tim, sehingga langsung terlihat tanpa menunggu tab dibuka lagi (13 Okt 2026). Akses baca tetap lewat RLS.
alter publication supabase_realtime add table public.stages, public.organizations, public.org_product_catalog;
