-- 20 Okt 2026: repeat order tidak boleh hilang dari omzet.
-- Kalau sebuah lead punya transaksi deal, nilai lead (deal_value) = jumlah semua transaksinya.
-- Dengan begitu aturan "deal = lead menang, nilai dari lead" tetap berlaku di semua tab,
-- dan setiap repeat order ikut terhitung. Lead tanpa transaksi tidak berubah.

create or replace function public.sync_lead_value_from_tx()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_lead uuid := coalesce(new.lead_id, old.lead_id);
  v_n int;
  v_sum numeric;
begin
  if v_lead is null then return coalesce(new, old); end if;
  select count(*), coalesce(sum(deal_value), 0) into v_n, v_sum from deal_transactions where lead_id = v_lead;
  if v_n > 0 then
    update leads set deal_value = v_sum where id = v_lead and deal_value is distinct from v_sum;
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_sync_lead_value_from_tx on public.deal_transactions;
create trigger trg_sync_lead_value_from_tx
  after insert or update or delete on public.deal_transactions
  for each row execute function public.sync_lead_value_from_tx();

-- Sekali jalan: samakan nilai lead yang sudah punya transaksi (mis. repeat order di MAP).
update leads l
set deal_value = s.total
from (select lead_id, sum(deal_value) as total from deal_transactions where lead_id is not null group by lead_id) s
where l.id = s.lead_id and l.deal_value is distinct from s.total;
