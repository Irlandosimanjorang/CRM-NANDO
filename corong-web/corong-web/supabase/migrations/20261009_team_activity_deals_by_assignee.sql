-- Rekap aktivitas Team disamakan dengan Report dan Target & forecast (9 Okt 2026):
--  (1) "deals" dihitung per PENANGGUNG JAWAB lead (bukan siapa yang memindahkan kartu), sama dengan omzet;
--  (2) "deal_value" memakai tanggal deal transaksi (bukan tanggal transaksi dibuat), sama dengan get_team_targets.
-- Diterapkan dengan mengganti dua ekspresi di definisi get_team_activity yang sedang aktif.
do $$
declare
  v text := pg_get_functiondef('public.get_team_activity(timestamp with time zone, timestamp with time zone)'::regprocedure);
  v2 text;
  old_deals text := $a$'deals', (select count(*) from lead_stage_changes sc where sc.org_id = v_org and sc.changed_by = mem.user_id and sc.changed_at >= p_from and sc.changed_at < p_to and sc.to_stage = any(v_won) and not (coalesce(sc.from_stage, '') = any(v_won))),$a$;
  new_deals text := $a$'deals', (select count(*) from lead_stage_changes sc join leads dl on dl.id = sc.lead_id where sc.org_id = v_org and coalesce(dl.assigned_to, dl.user_id) = mem.user_id and sc.changed_at >= p_from and sc.changed_at < p_to and sc.to_stage = any(v_won) and not (coalesce(sc.from_stage, '') = any(v_won))),$a$;
  old_val text := $a$'deal_value', (select coalesce(sum(d.deal_value), 0) from deal_transactions d where d.org_id = v_org and d.user_id = mem.user_id and d.created_at >= p_from and d.created_at < p_to),$a$;
  new_val text := $a$'deal_value', (select coalesce(sum(d.deal_value), 0) from deal_transactions d where d.org_id = v_org and d.user_id = mem.user_id and coalesce(d.deal_date, (d.created_at at time zone 'Asia/Jakarta')::date) >= (p_from at time zone 'Asia/Jakarta')::date and coalesce(d.deal_date, (d.created_at at time zone 'Asia/Jakarta')::date) <= (p_to at time zone 'Asia/Jakarta')::date),$a$;
begin
  if position(old_deals in v) = 0 then raise exception 'ekspresi deals tidak ditemukan'; end if;
  if position(old_val in v) = 0 then raise exception 'ekspresi deal_value tidak ditemukan'; end if;
  v2 := replace(replace(v, old_deals, new_deals), old_val, new_val);
  execute v2;
end $$;
