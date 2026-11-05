-- Tipe pembayaran per transaksi (5 Nov 2026).
-- Sebelumnya tipe pembayaran hanya ada di lead, sehingga tiap transaksi menampilkan tipe yang terakhir dipilih.
alter table public.deal_transactions add column if not exists payment_type text;

-- Isi transaksi terakhir tiap lead dengan tipe pembayaran lead (hanya yang masih kosong).
with last_tx as (
  select distinct on (t.lead_id) t.id, t.lead_id
  from deal_transactions t
  order by t.lead_id, t.deal_date desc nulls last, t.created_at desc
)
update deal_transactions t set payment_type = l.payment_type
from last_tx lt join leads l on l.id = lt.lead_id and l.payment_type is not null
where t.id = lt.id and t.payment_type is null;
