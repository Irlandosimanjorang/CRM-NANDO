-- 17 Okt 2026: transaksi otomatis ikut dihapus saat lead keluar dari tahap menang
-- (misal Faktur -> Retur). Sebelumnya transaksi tertinggal dan tetap masuk omzet/jumlah deal.
-- Transaksi manual (auto = false) tidak disentuh. Sudah diterapkan ke database lewat MCP.

create or replace function public.sync_auto_deal_transaction()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_on boolean;
  v_was_won boolean := false;
  v_last uuid;
begin
  select (o.features @> '{"monthly_report": true}'::jsonb) into v_on from public.organizations o where o.id = new.org_id;
  if not coalesce(v_on, false) then return new; end if;

  -- Lead keluar dari tahap Menang (misal Faktur -> Retur): hapus transaksi otomatis miliknya.
  -- Transaksi manual (auto = false) tidak disentuh.
  if tg_op = 'UPDATE' then
    v_was_won := exists (select 1 from public.stages s where s.org_id = old.org_id and s.key = old.stage_key and s.type = 'won');
    if v_was_won and not exists (select 1 from public.stages s where s.org_id = new.org_id and s.key = new.stage_key and s.type = 'won') then
      delete from public.deal_transactions where lead_id = new.id and auto = true;
      return new;
    end if;
  end if;

  if not exists (select 1 from public.stages s where s.org_id = new.org_id and s.key = new.stage_key and s.type = 'won') then return new; end if;
  if coalesce(new.deal_value, 0) <= 0 then return new; end if;

  if exists (select 1 from public.deal_transactions t where t.lead_id = new.id and t.auto = false) then return new; end if;

  -- Lead yang baru masuk Menang lagi (repeat order): catat sebagai transaksi baru kalau nilainya belum tercatat.
  if not v_was_won and exists (select 1 from public.deal_transactions t where t.lead_id = new.id and t.auto = true) then
    if not exists (select 1 from public.deal_transactions t where t.lead_id = new.id and t.auto = true and t.deal_value = new.deal_value and t.deal_date = coalesce(new.deal_date, (now() at time zone 'Asia/Jakarta')::date)) then
      insert into public.deal_transactions (user_id, org_id, lead_id, lead_name, deal_date, deal_value, auto)
      values (coalesce(new.assigned_to, new.user_id), new.org_id, new.id, new.name, coalesce(new.deal_date, (now() at time zone 'Asia/Jakarta')::date), new.deal_value, true);
    end if;
    return new;
  end if;

  -- Edit nilai saat sudah Menang: perbarui transaksi otomatis terakhir saja.
  select t.id into v_last from public.deal_transactions t where t.lead_id = new.id and t.auto = true order by t.deal_date desc, t.id desc limit 1;
  if v_last is not null then
    update public.deal_transactions set deal_value = new.deal_value, lead_name = new.name where id = v_last;
  else
    insert into public.deal_transactions (user_id, org_id, lead_id, lead_name, deal_date, deal_value, auto)
    values (coalesce(new.assigned_to, new.user_id), new.org_id, new.id, new.name, coalesce(new.deal_date, (now() at time zone 'Asia/Jakarta')::date), new.deal_value, true);
  end if;
  return new;
end;
$function$;
