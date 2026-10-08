-- Transaksi deal otomatis mengikuti lead (9 Okt 2026): (1) bila lead keluar dari tahap menang, transaksi otomatisnya
-- dibatalkan supaya omzet tidak tertinggal; (2) bila penanggung jawab lead berganti, transaksi otomatis pindah ke
-- penanggung jawab baru. Transaksi yang dicatat manual di tab Deal tidak pernah disentuh.
create or replace function public.sync_auto_deal_transaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_on boolean;
  v_won boolean;
begin
  select (o.features @> '{"monthly_report": true}'::jsonb) into v_on from public.organizations o where o.id = new.org_id;
  if not coalesce(v_on, false) then return new; end if;
  select exists (select 1 from public.stages s where s.org_id = new.org_id and s.key = new.stage_key and s.type = 'won') into v_won;

  if not v_won then
    delete from public.deal_transactions where lead_id = new.id and auto = true;
    return new;
  end if;
  if coalesce(new.deal_value, 0) <= 0 then return new; end if;

  if exists (select 1 from public.deal_transactions t where t.lead_id = new.id and t.auto = false) then return new; end if;

  if exists (select 1 from public.deal_transactions t where t.lead_id = new.id and t.auto = true) then
    update public.deal_transactions set deal_value = new.deal_value, lead_name = new.name, user_id = coalesce(new.assigned_to, new.user_id)
    where lead_id = new.id and auto = true;
  else
    insert into public.deal_transactions (user_id, org_id, lead_id, lead_name, deal_date, deal_value, auto)
    values (coalesce(new.assigned_to, new.user_id), new.org_id, new.id, new.name, coalesce(new.deal_date, (now() at time zone 'Asia/Jakarta')::date), new.deal_value, true);
  end if;
  return new;
end;
$$;
revoke all on function public.sync_auto_deal_transaction() from public, anon, authenticated;
drop trigger if exists trg_sync_auto_deal_transaction on public.leads;
create trigger trg_sync_auto_deal_transaction after insert or update of stage_key, deal_value, assigned_to on public.leads
  for each row execute function public.sync_auto_deal_transaction();
