-- Tanggal deal lead proyek diisi dari riwayat transaksi deal kalau kosong (18 Nov 2026).
-- Hanya lead di Proyek Deal, Berjalan, dan Selesai. Tanggal yang sudah terisi tidak pernah ditimpa.
-- Tanpa transaksi, tanggal tetap kosong dan diisi manual dari form lead.

create or replace function public.sync_deal_date_dari_transaksi()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.lead_id is not null and new.deal_date is not null then
    update public.leads l
       set deal_date = (select min(t.deal_date) from public.deal_transactions t where t.lead_id = new.lead_id and t.deal_date is not null)
     where l.id = new.lead_id
       and l.deal_date is null
       and l.stage_key in ('proyek_deal', 'proyek_berjalan', 'proyek_selesai');
  end if;
  return new;
end;
$$;

drop trigger if exists deal_tx_isi_tanggal_lead on public.deal_transactions;
create trigger deal_tx_isi_tanggal_lead
  after insert or update of deal_date, lead_id on public.deal_transactions
  for each row execute function public.sync_deal_date_dari_transaksi();

-- Backfill lead yang sudah ada.
update public.leads l
   set deal_date = t.tgl
  from (select lead_id, min(deal_date) as tgl from public.deal_transactions where deal_date is not null group by lead_id) t
 where l.id = t.lead_id
   and l.deal_date is null
   and l.stage_key in ('proyek_deal', 'proyek_berjalan', 'proyek_selesai');
