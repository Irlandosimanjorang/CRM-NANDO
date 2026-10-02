-- Invoice langganan Nexto yang dibuat admin dari Command Center (2 Okt 2026).
-- Diterapkan lewat migration "admin_invoices". Akses hanya lewat edge
-- function admin-invoices (service role + cek ADMIN_EMAIL).
create table if not exists public.admin_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  year int not null,
  seq int not null,
  company text not null,
  invoice_date date not null,
  due_date date not null,
  total numeric not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  paid_at timestamptz,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (year, seq)
);
alter table public.admin_invoices enable row level security;

create or replace function public.create_admin_invoice(p_company text, p_invoice_date date, p_due_date date, p_total numeric, p_data jsonb)
returns public.admin_invoices
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_year int := extract(year from p_invoice_date)::int;
  v_seq int;
  r public.admin_invoices;
begin
  perform pg_advisory_xact_lock(hashtext('admin_invoices_seq'));
  select coalesce(max(seq), 0) + 1 into v_seq from public.admin_invoices where year = v_year;
  insert into public.admin_invoices (number, year, seq, company, invoice_date, due_date, total, data)
  values (format('INV/NXT/%s/%s/%s', v_year, to_char(p_invoice_date, 'MM'), lpad(v_seq::text, 4, '0')),
          v_year, v_seq, p_company, p_invoice_date, p_due_date, p_total, p_data)
  returning * into r;
  return r;
end;
$$;
revoke all on function public.create_admin_invoice(text, date, date, numeric, jsonb) from public, anon, authenticated;
