-- Nominal Rupiah yang dibayar untuk sebuah lot token add-on Generate Leads (27 Okt 2026).
-- Diisi admin saat "Beri token" (default Rp 15.000 x jumlah token). Dipakai kartu CASH FLOW sebagai
-- penerimaan kas dan pendapatan pada bulan lot diberikan. Null = nominal belum dicatat.
alter table public.addon_token_lots add column if not exists amount_idr int check (amount_idr is null or amount_idr >= 0);
