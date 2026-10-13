-- Repeat order (13 Okt 2026): lead yang kembali masuk tahap Menang setelah sempat aktif tidak lagi menimpa transaksi otomatis
-- project sebelumnya. Transaksi baru dibuat sebagai baris tersendiri. Edit nilai saat sudah Menang tetap memperbarui
-- transaksi otomatis terakhir. Transaksi manual (tab Deal) tetap melindungi lead seperti sebelumnya.
create or replace function public.sync_auto_deal_transaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_on boolean;
  v_was_won boolean := false;
  v_last uuid;
begin
  select (o.features @> '{"monthly_report": true}'::jsonb) into v_on from public.organizations o where o.id = new.org_id;
  if not coalesce(v_on, false) then return new; end if;
  if not exists (select 1 from public.stages s where s.org_id = new.org_id and s.key = new.stage_key and s.type = 'won') then return new; end if;
  if coalesce(new.deal_value, 0) <= 0 then return new; end if;

  if exists (select 1 from public.deal_transactions t where t.lead_id = new.id and t.auto = false) then return new; end if;

  if tg_op = 'UPDATE' then
    v_was_won := exists (select 1 from public.stages s where s.org_id = old.org_id and s.key = old.stage_key and s.type = 'won');
  end if;

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
$$;
revoke all on function public.sync_auto_deal_transaction() from public, anon, authenticated;
