-- 17 Okt 2026: batas biaya AI per org/fitur dibatalkan. Tabel ai_budgets dan semua fungsinya dihapus.
-- Biaya AI tetap tercatat di ai_usage untuk perhitungan HPP.
-- Sudah diterapkan ke database lewat MCP.

drop function if exists public.admin_list_ai_budgets();
drop function if exists public.admin_set_ai_budget(uuid, text, numeric);
drop function if exists public.ai_within_budget(uuid, text);
drop function if exists public.ai_feature_spend_month(uuid, text);
drop table if exists public.ai_budgets;
