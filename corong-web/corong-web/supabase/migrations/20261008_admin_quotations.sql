-- Quotation (penawaran harga) langganan Nexto yang dibuat admin dari Command
-- Center (8 Okt 2026). Strukturnya mengikuti admin_invoices; kolom
-- invoice_date = tanggal penawaran, due_date = berlaku sampai. Akses hanya lewat
-- edge function admin-invoices (service role + cek ADMIN_EMAIL), jadi tanpa
-- policy RLS. Tidak ada pengingat otomatis untuk quotation.
create table if not exists public.admin_quotations (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  year int not null,
  seq int not null,
  company text not null,
  invoice_date date not null,
  due_date date not null,
  total numeric not null default 0,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'void')),
  paid_at timestamptz,
  data jsonb not null,
  public_token uuid not null default gen_random_uuid(),
  email_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (year, seq)
);
create unique index if not exists admin_quotations_public_token_uidx on public.admin_quotations (public_token);
alter table public.admin_quotations enable row level security;

create or replace function public.create_admin_quotation(p_company text, p_date date, p_valid_until date, p_total numeric, p_data jsonb)
returns public.admin_quotations
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_year int := extract(year from p_date)::int;
  v_seq int;
  r public.admin_quotations;
begin
  perform pg_advisory_xact_lock(hashtext('admin_quotations_seq'));
  select coalesce(max(seq), 0) + 1 into v_seq from public.admin_quotations where year = v_year;
  insert into public.admin_quotations (number, year, seq, company, invoice_date, due_date, total, data)
  values (format('QUO/NXT/%s/%s/%s', v_year, to_char(p_date, 'MM'), lpad(v_seq::text, 4, '0')),
          v_year, v_seq, p_company, p_date, p_valid_until, p_total, p_data)
  returning * into r;
  return r;
end;
$$;
revoke all on function public.create_admin_quotation(text, date, date, numeric, jsonb) from public, anon, authenticated;
