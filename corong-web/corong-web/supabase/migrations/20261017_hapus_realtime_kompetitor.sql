-- 17 Okt 2026: competitors dan competitor_usages dikeluarkan dari publikasi realtime.
-- Sudah diterapkan ke database lewat MCP.

alter publication supabase_realtime drop table public.competitors;
alter publication supabase_realtime drop table public.competitor_usages;
