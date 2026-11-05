-- No. faktur per transaksi (5 Nov 2026).
-- Sebelumnya trigger ini menyalin faktur lead ke SEMUA transaksi lead, sehingga repeat order
-- kehilangan no. faktur per transaksi. Sekarang faktur lead hanya disalin kalau lead punya satu transaksi.
create or replace function public.sync_deal_tx_docs_from_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.sph_number is distinct from old.sph_number then
    update public.deal_transactions
       set sph_number = new.sph_number
     where lead_id = new.id;
  end if;
  -- No. faktur hanya disalin ke transaksi kalau lead punya satu transaksi.
  -- Lead dengan banyak transaksi (repeat order) menyimpan faktur tiap transaksi sendiri.
  if new.invoice_number is distinct from old.invoice_number
     and (select count(*) from public.deal_transactions t where t.lead_id = new.id) = 1 then
    update public.deal_transactions
       set invoice_number = new.invoice_number
     where lead_id = new.id;
  end if;
  return new;
end;
$function$;
