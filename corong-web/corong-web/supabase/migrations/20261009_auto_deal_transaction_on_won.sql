-- Transaksi deal otomatis (9 Okt 2026): untuk organisasi dengan saklar monthly_report, lead yang masuk ke
-- tahap bertipe "menang" dan punya nilai dibuatkan transaksi deal (atas nama penanggung jawab lead) bila
-- belum punya transaksi. Dengan begitu Laporan, Team, Dashboard, dan Leaderboard memakai angka omzet yang sama
-- tanpa sales mengisi dua tempat. Transaksi otomatis ditandai auto = true; nilainya ikut diperbarui saat nilai
-- lead diedit, sedangkan transaksi yang dicatat manual di tab Deal tidak pernah disentuh.
alter table public.deal_transactions add column if not exists auto boolean not null default false;

create or replace function public.sync_auto_deal_transaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_on boolean;
begin
  select (o.features @> '{"monthly_report": true}'::jsonb) into v_on from public.organizations o where o.id = new.org_id;
  if not coalesce(v_on, false) then return new; end if;
  if not exists (select 1 from public.stages s where s.org_id = new.org_id and s.key = new.stage_key and s.type = 'won') then return new; end if;
  if coalesce(new.deal_value, 0) <= 0 then return new; end if;

  if exists (select 1 from public.deal_transactions t where t.lead_id = new.id and t.auto = false) then return new; end if;

  if exists (select 1 from public.deal_transactions t where t.lead_id = new.id and t.auto = true) then
    update public.deal_transactions set deal_value = new.deal_value, lead_name = new.name where lead_id = new.id and auto = true;
  else
    insert into public.deal_transactions (user_id, org_id, lead_id, lead_name, deal_date, deal_value, auto)
    values (coalesce(new.assigned_to, new.user_id), new.org_id, new.id, new.name, coalesce(new.deal_date, (now() at time zone 'Asia/Jakarta')::date), new.deal_value, true);
  end if;
  return new;
end;
$$;
revoke all on function public.sync_auto_deal_transaction() from public, anon, authenticated;
drop trigger if exists trg_sync_auto_deal_transaction on public.leads;
create trigger trg_sync_auto_deal_transaction after insert or update of stage_key, deal_value on public.leads
  for each row execute function public.sync_auto_deal_transaction();
