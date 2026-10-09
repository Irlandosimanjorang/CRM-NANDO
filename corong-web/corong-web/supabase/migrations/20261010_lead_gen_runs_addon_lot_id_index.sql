-- 10 Okt 2026 (permintaan Nando): index untuk foreign key lead_gen_runs.addon_lot_id.
-- ATOM (health-check) melaporkan kolom foreign key ini belum punya index; tanpa index, JOIN/delete cascade lewat kolom ini
-- akan sequential scan begitu tabelnya besar. Menambah index murah, aman, dan tanpa downtime.
create index if not exists lead_gen_runs_addon_lot_id_idx on public.lead_gen_runs (addon_lot_id);
