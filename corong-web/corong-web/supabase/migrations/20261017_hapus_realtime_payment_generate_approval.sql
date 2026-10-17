-- 17 Okt 2026: payment_terms, generated_leads, dan approval_requests dikeluarkan lagi dari publikasi realtime.
-- Yang tetap realtime: competitors dan competitor_usages (lihat 20261017_realtime_tim_marketing_lanjutan.sql).
-- Sudah diterapkan ke database lewat MCP.

alter publication supabase_realtime drop table public.payment_terms;
alter publication supabase_realtime drop table public.generated_leads;
alter publication supabase_realtime drop table public.approval_requests;
