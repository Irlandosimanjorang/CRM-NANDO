-- 17 Okt 2026: tambahan realtime untuk perubahan tim marketing ke dashboard manager.
-- payment_terms (termin kontrak), generated_leads (hasil generate leads), approval_requests (permintaan approval),
-- competitors dan competitor_usages (data kompetitor).
-- Sudah diterapkan ke database lewat MCP.

alter publication supabase_realtime add table public.payment_terms;
alter publication supabase_realtime add table public.generated_leads;
alter publication supabase_realtime add table public.approval_requests;
alter publication supabase_realtime add table public.competitors;
alter publication supabase_realtime add table public.competitor_usages;
