-- No. SPH dan no. faktur ikut tersimpan di catatan transaksi deal (26 Okt 2026, permintaan Nando).
-- Supaya tab Deal dan laporan bisa menampilkan dokumen deal tanpa harus membuka lead.
alter table public.deal_transactions add column if not exists sph_number text;
alter table public.deal_transactions add column if not exists invoice_number text;

-- Perubahan no. SPH / faktur di lead ikut disalin ke semua transaksi deal lead itu.
create or replace function public.sync_deal_tx_docs_from_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sph_number is distinct from old.sph_number or new.invoice_number is distinct from old.invoice_number then
    update public.deal_transactions
       set sph_number = new.sph_number, invoice_number = new.invoice_number
     where lead_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_sync_deal_tx_docs on public.leads;
create trigger leads_sync_deal_tx_docs
  after update of sph_number, invoice_number on public.leads
  for each row execute function public.sync_deal_tx_docs_from_lead();
