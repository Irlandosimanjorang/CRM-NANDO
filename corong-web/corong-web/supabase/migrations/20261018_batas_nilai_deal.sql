-- 18 Okt 2026: batas wajar nilai deal (0 sampai 10 miliar) supaya salah input tidak masuk omzet.
-- Data yang ada sudah dicek: nilai terbesar 647 jt, tidak ada yang negatif.
alter table public.leads drop constraint if exists leads_deal_value_wajar;
alter table public.leads add constraint leads_deal_value_wajar check (deal_value is null or (deal_value >= 0 and deal_value <= 10000000000));
alter table public.deal_transactions drop constraint if exists deal_transactions_deal_value_wajar;
alter table public.deal_transactions add constraint deal_transactions_deal_value_wajar check (deal_value is null or (deal_value >= 0 and deal_value <= 10000000000));
