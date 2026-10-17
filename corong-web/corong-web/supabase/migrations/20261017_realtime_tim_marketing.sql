-- 17 Okt 2026: data tim marketing (check-in kunjungan, iklan, budget, target) ikut realtime ke dashboard manager.
-- rencana, deal_transactions, leads, dan progress_notes sudah ada di publikasi sebelumnya.
-- Sudah diterapkan ke database lewat MCP.

alter publication supabase_realtime add table public.visit_checkins;
alter publication supabase_realtime add table public.ad_expenses;
alter publication supabase_realtime add table public.ad_budgets;
alter publication supabase_realtime add table public.sales_targets;
