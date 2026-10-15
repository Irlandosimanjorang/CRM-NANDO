-- Pembersihan (16 Okt 2026): hapus dua tabel backup lama dan index yang tidak terpakai.
-- Index yang menopang foreign key atau constraint dilewati (tidak dihapus).
drop table if exists public._backup_consultant_cleanup_20261001;
drop table if exists public._backup_industry_switch_20260929;
-- Daftar index yang dihapus: documents_user_idx, sales_targets_user_idx, lead_gen_runs_user_month_idx, dan index tidak terpakai lainnya
-- yang tidak menopang foreign key. Lihat migrasi drop_old_backup_tables_and_unused_indexes di database.
