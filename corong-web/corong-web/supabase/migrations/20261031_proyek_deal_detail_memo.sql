-- Detil proyek dan memo proyek (31 Okt 2026, permintaan Nando).
-- Diisi di pop-up Proyek Deal (BSB): memo berisi field dari formulir pengajuan sales order
-- (customer, tanggal, telp, alamat, no. penawaran, no. PO, deal kontrak, keterangan, marketing, estimator).
alter table public.leads add column if not exists detail_proyek text;
alter table public.leads add column if not exists memo jsonb;
