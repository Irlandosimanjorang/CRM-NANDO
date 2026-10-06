-- Quotation & Invoice untuk client Nexto (7 Okt 2026, permintaan Nando).
-- Khusus Professional dan Enterprise (docs_plan_ok). Dokumen yang sudah
-- diterbitkan tidak bisa diubah isinya (trigger); status, pembayaran, dan
-- konversi hanya lewat fungsi di bawah (bendera sesi nexto.doc_rpc).

-- ---------------------------------------------------------------- helper --
create or replace function public.docs_plan_ok(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizations o where o.id = p_org and o.plan = 'enterprise')
      or exists (select 1 from settings s where s.user_id = auth.uid() and s.plan = 'premium');
$$;

create or replace function public.is_org_manager(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members m
                 where m.org_id = p_org and m.user_id = auth.uid() and m.role in ('owner', 'manager'));
$$;

create or replace function public.docs_rpc_flag()
returns boolean
language sql stable set search_path = public as $$
  select coalesce(current_setting('nexto.doc_rpc', true), '') = '1';
$$;

-- Hitung total di server (sumber kebenaran). Harus identik dengan
-- computeDocTotals di src/lib/documents.js.
create or replace function public.docs_compute_totals(
  p_items jsonb, p_disc_type text, p_disc_value numeric, p_tax_on boolean, p_tax_rate numeric
) returns table (subtotal numeric, discount numeric, tax numeric, total numeric)
language plpgsql immutable set search_path = public as $$
declare
  v_sub numeric := 0; v_disc numeric := 0; v_tax numeric := 0;
  it jsonb; v_qty numeric; v_price numeric; v_dpct numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Daftar item tidak valid.';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce(nullif(it->>'qty', '')::numeric, 0);
    v_price := coalesce(nullif(it->>'price', '')::numeric, 0);
    v_dpct := coalesce(nullif(it->>'discount_pct', '')::numeric, 0);
    if v_qty < 0 or v_qty > 1000000000 or v_price < 0 or v_price > 10000000000000 then
      raise exception 'Jumlah atau harga item di luar batas.';
    end if;
    v_sub := v_sub + round(v_qty * v_price * (1 - least(greatest(v_dpct, 0), 100) / 100));
  end loop;
  if p_disc_type = 'percent' then
    v_disc := round(v_sub * least(greatest(coalesce(p_disc_value, 0), 0), 100) / 100);
  else
    v_disc := least(greatest(coalesce(p_disc_value, 0), 0), v_sub);
  end if;
  v_disc := least(v_disc, v_sub);
  if p_tax_on then
    v_tax := round((v_sub - v_disc) * least(greatest(coalesce(p_tax_rate, 0), 0), 100) / 100);
  end if;
  return query select v_sub, v_disc, v_tax, v_sub - v_disc + v_tax;
end;
$$;

-- --------------------------------------------------------------- settings --
create table if not exists public.doc_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  seller jsonb not null default '{}'::jsonb,
  accent text not null default '#c2410c',
  quotation_prefix text not null default 'QT',
  invoice_prefix text not null default 'INV',
  quotation_terms text not null default '',
  invoice_terms text not null default '',
  footer_text text not null default '',
  tax_label text not null default 'PPN',
  default_tax_rate numeric(5,2) not null default 11,
  default_tax_on boolean not null default false,
  default_validity_days int not null default 14,
  default_due_days int not null default 14,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint doc_settings_seller_size check (octet_length(seller::text) <= 450000),
  constraint doc_settings_accent_fmt check (accent ~ '^#[0-9a-fA-F]{6}$'),
  constraint doc_settings_prefix_fmt check (quotation_prefix ~ '^[A-Za-z0-9/-]{1,12}$' and invoice_prefix ~ '^[A-Za-z0-9/-]{1,12}$'),
  constraint doc_settings_text_len check (char_length(quotation_terms) <= 5000 and char_length(invoice_terms) <= 5000 and char_length(footer_text) <= 500 and char_length(tax_label) <= 20),
  constraint doc_settings_days check (default_validity_days between 1 and 365 and default_due_days between 0 and 365)
);
alter table public.doc_settings enable row level security;

drop policy if exists doc_settings_select on public.doc_settings;
create policy doc_settings_select on public.doc_settings for select to authenticated
  using (org_id in (select my_member_org_ids()) and docs_plan_ok(org_id));
drop policy if exists doc_settings_insert on public.doc_settings;
create policy doc_settings_insert on public.doc_settings for insert to authenticated
  with check (is_org_manager(org_id) and docs_plan_ok(org_id));
drop policy if exists doc_settings_update on public.doc_settings;
create policy doc_settings_update on public.doc_settings for update to authenticated
  using (is_org_manager(org_id) and docs_plan_ok(org_id))
  with check (is_org_manager(org_id) and docs_plan_ok(org_id));

-- -------------------------------------------------------------- documents --
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  lead_id uuid references public.leads(id) on delete set null,
  kind text not null check (kind in ('quotation', 'invoice')),
  number text,
  year int,
  seq int,
  status text not null default 'draft',
  customer jsonb not null default '{}'::jsonb,
  issue_date date not null default ((now() at time zone 'Asia/Jakarta')::date),
  due_date date,
  items jsonb not null default '[]'::jsonb,
  discount_type text not null default 'amount' check (discount_type in ('amount', 'percent')),
  discount_value numeric not null default 0 check (discount_value >= 0),
  tax_on boolean not null default false,
  tax_rate numeric(5,2) not null default 11 check (tax_rate between 0 and 100),
  tax_label text not null default 'PPN',
  notes text not null default '',
  terms text not null default '',
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  amount_paid numeric not null default 0,
  paid_at timestamptz,
  source_quotation_id uuid,
  converted_invoice_id uuid,
  public_token uuid not null default gen_random_uuid(),
  snapshot jsonb,
  issued_at timestamptz,
  email_log jsonb not null default '[]'::jsonb,
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_status_ok check (
    (kind = 'quotation' and status in ('draft', 'issued', 'accepted', 'rejected'))
    or (kind = 'invoice' and status in ('draft', 'unpaid', 'partial', 'paid', 'void'))
  ),
  constraint documents_items_shape check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 100),
  constraint documents_customer_size check (octet_length(customer::text) <= 5000),
  constraint documents_text_len check (char_length(notes) <= 5000 and char_length(terms) <= 5000 and char_length(tax_label) <= 20),
  constraint documents_paid_nonneg check (amount_paid >= 0)
);
create unique index if not exists documents_number_uidx on public.documents (org_id, kind, number) where number is not null;
create unique index if not exists documents_public_token_uidx on public.documents (public_token);
create index if not exists documents_org_kind_idx on public.documents (org_id, kind, created_at desc);
create index if not exists documents_user_idx on public.documents (user_id);
create index if not exists documents_lead_idx on public.documents (lead_id) where lead_id is not null;
create index if not exists documents_due_idx on public.documents (due_date) where kind = 'invoice' and status in ('unpaid', 'partial');
alter table public.documents enable row level security;

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated
  using (org_id in (select my_member_org_ids()) and docs_plan_ok(org_id) and (is_org_manager(org_id) or user_id = auth.uid()));
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated
  with check (org_id in (select my_member_org_ids()) and docs_plan_ok(org_id) and user_id = auth.uid());
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated
  using (org_id in (select my_member_org_ids()) and docs_plan_ok(org_id) and (is_org_manager(org_id) or user_id = auth.uid()))
  with check (org_id in (select my_member_org_ids()) and docs_plan_ok(org_id) and (is_org_manager(org_id) or user_id = auth.uid()));
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete to authenticated
  using (issued_at is null and org_id in (select my_member_org_ids()) and docs_plan_ok(org_id) and (is_org_manager(org_id) or user_id = auth.uid()));

-- Trigger penjaga: total dihitung server, dokumen terbit tidak bisa diubah.
create or replace function public.documents_before_write()
returns trigger
language plpgsql set search_path = public as $$
declare
  t record;
  v_allowed text[] := array['status', 'amount_paid', 'paid_at', 'email_log', 'reminders_enabled', 'converted_invoice_id', 'updated_at'];
begin
  if tg_op = 'UPDATE' and old.issued_at is not null then
    -- Dokumen sudah terbit: hanya kolom status/pembayaran/log yang boleh berubah.
    if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
      raise exception 'Dokumen yang sudah terbit tidak bisa diubah. Buat dokumen baru untuk koreksi.';
    end if;
    if not docs_rpc_flag() and (
      new.status is distinct from old.status or new.amount_paid is distinct from old.amount_paid
      or new.paid_at is distinct from old.paid_at or new.converted_invoice_id is distinct from old.converted_invoice_id
    ) then
      raise exception 'Status dan pembayaran hanya bisa diubah lewat tombol aksi dokumen.';
    end if;
    new.updated_at := now();
    return new;
  end if;

  -- Draf (atau dokumen baru): kolom turunan server tidak boleh diisi klien.
  if not docs_rpc_flag() then
    new.status := 'draft';
    new.number := null; new.year := null; new.seq := null;
    new.issued_at := null; new.snapshot := null;
    new.amount_paid := 0; new.paid_at := null;
    new.converted_invoice_id := null;
    if tg_op = 'INSERT' then
      new.source_quotation_id := null;
      new.public_token := gen_random_uuid();
      new.email_log := '[]'::jsonb;
    else
      new.source_quotation_id := old.source_quotation_id;
      new.public_token := old.public_token;
      new.email_log := old.email_log;
      new.org_id := old.org_id; new.user_id := old.user_id; new.kind := old.kind;
    end if;
  end if;

  select * into t from docs_compute_totals(new.items, new.discount_type, new.discount_value, new.tax_on, new.tax_rate);
  new.subtotal := t.subtotal; new.discount_amount := t.discount; new.tax_amount := t.tax; new.total := t.total;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists documents_before_write_trg on public.documents;
create trigger documents_before_write_trg before insert or update on public.documents
  for each row execute function public.documents_before_write();

-- ------------------------------------------------------- pembayaran/counter --
create table if not exists public.document_payments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  org_id uuid not null,
  amount numeric not null check (amount > 0),
  paid_on date not null,
  method text not null default '',
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint document_payments_text_len check (char_length(method) <= 60 and char_length(note) <= 500)
);
create index if not exists document_payments_doc_idx on public.document_payments (document_id);
alter table public.document_payments enable row level security;
drop policy if exists document_payments_select on public.document_payments;
create policy document_payments_select on public.document_payments for select to authenticated
  using (document_id in (select id from public.documents));

create table if not exists public.doc_counters (
  org_id uuid not null,
  kind text not null,
  year int not null,
  last_seq int not null default 0,
  primary key (org_id, kind, year)
);
alter table public.doc_counters enable row level security;

-- ----------------------------------------------------------------- fungsi --
create or replace function public.docs_assert_access(p_doc public.documents)
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Belum login.'; end if;
  if p_doc.org_id not in (select my_member_org_ids()) or not docs_plan_ok(p_doc.org_id) then
    raise exception 'Fitur dokumen tersedia untuk paket Professional dan Enterprise.';
  end if;
  if not (is_org_manager(p_doc.org_id) or p_doc.user_id = auth.uid()) then
    raise exception 'Anda tidak memiliki akses ke dokumen ini.';
  end if;
end;
$$;

create or replace function public.issue_document(p_id uuid)
returns public.documents
language plpgsql security definer set search_path = public as $$
declare
  d public.documents; ds public.doc_settings;
  v_year int; v_seq int; v_prefix text; v_num text;
begin
  select * into d from documents where id = p_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  perform docs_assert_access(d);
  if d.issued_at is not null then raise exception 'Dokumen ini sudah diterbitkan.'; end if;
  if coalesce(btrim(d.customer->>'name'), '') = '' then raise exception 'Nama customer wajib diisi.'; end if;
  if jsonb_array_length(d.items) = 0 then raise exception 'Tambahkan minimal satu item.'; end if;
  if d.kind = 'invoice' and d.total <= 0 then raise exception 'Total invoice harus lebih dari nol.'; end if;
  if d.due_date is null then raise exception 'Tanggal jatuh tempo / berlaku sampai wajib diisi.'; end if;
  if d.due_date < d.issue_date then raise exception 'Tanggal jatuh tempo tidak boleh sebelum tanggal dokumen.'; end if;

  select * into ds from doc_settings where org_id = d.org_id;
  v_prefix := case when d.kind = 'quotation' then coalesce(ds.quotation_prefix, 'QT') else coalesce(ds.invoice_prefix, 'INV') end;
  v_year := extract(year from d.issue_date)::int;
  insert into doc_counters (org_id, kind, year, last_seq) values (d.org_id, d.kind, v_year, 1)
    on conflict (org_id, kind, year) do update set last_seq = doc_counters.last_seq + 1
    returning last_seq into v_seq;
  v_num := upper(v_prefix) || '/' || v_year || '/' || lpad(extract(month from d.issue_date)::int::text, 2, '0') || '/' || lpad(v_seq::text, 4, '0');

  perform set_config('nexto.doc_rpc', '1', true);
  update documents set
    number = v_num, year = v_year, seq = v_seq, issued_at = now(),
    status = case when d.kind = 'quotation' then 'issued' else 'unpaid' end,
    tax_label = coalesce(ds.tax_label, d.tax_label),
    snapshot = jsonb_build_object(
      'seller', coalesce(ds.seller, '{}'::jsonb),
      'accent', coalesce(ds.accent, '#c2410c'),
      'footer', coalesce(ds.footer_text, '')
    )
  where id = p_id returning * into d;
  perform set_config('nexto.doc_rpc', '', true);
  return d;
end;
$$;

create or replace function public.set_quotation_status(p_id uuid, p_status text)
returns public.documents
language plpgsql security definer set search_path = public as $$
declare d public.documents;
begin
  select * into d from documents where id = p_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  perform docs_assert_access(d);
  if d.kind <> 'quotation' or d.issued_at is null then raise exception 'Hanya quotation yang sudah terbit yang bisa diubah statusnya.'; end if;
  if p_status not in ('issued', 'accepted', 'rejected') then raise exception 'Status tidak valid.'; end if;
  if d.converted_invoice_id is not null and p_status <> 'accepted' then
    raise exception 'Quotation ini sudah dijadikan invoice.';
  end if;
  perform set_config('nexto.doc_rpc', '1', true);
  update documents set status = p_status where id = p_id returning * into d;
  perform set_config('nexto.doc_rpc', '', true);
  return d;
end;
$$;

create or replace function public.convert_quotation_to_invoice(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  q public.documents; ds public.doc_settings; v_new uuid; v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into q from documents where id = p_id for update;
  if not found then raise exception 'Quotation tidak ditemukan.'; end if;
  perform docs_assert_access(q);
  if q.kind <> 'quotation' or q.issued_at is null then raise exception 'Pilih quotation yang sudah terbit.'; end if;
  if q.status = 'rejected' then raise exception 'Quotation yang ditolak tidak bisa dijadikan invoice.'; end if;
  if q.converted_invoice_id is not null then raise exception 'Quotation ini sudah dijadikan invoice.'; end if;
  select * into ds from doc_settings where org_id = q.org_id;

  perform set_config('nexto.doc_rpc', '1', true);
  insert into documents (
    org_id, user_id, lead_id, kind, status, customer, issue_date, due_date, items,
    discount_type, discount_value, tax_on, tax_rate, tax_label, notes, terms, source_quotation_id
  ) values (
    q.org_id, auth.uid(), q.lead_id, 'invoice', 'draft', q.customer, v_today,
    v_today + coalesce(ds.default_due_days, 14), q.items,
    q.discount_type, q.discount_value, q.tax_on, q.tax_rate, q.tax_label,
    '', coalesce(ds.invoice_terms, ''), q.id
  ) returning id into v_new;
  update documents set status = 'accepted', converted_invoice_id = v_new where id = q.id;
  perform set_config('nexto.doc_rpc', '', true);
  return v_new;
end;
$$;

create or replace function public.record_document_payment(
  p_id uuid, p_amount numeric, p_paid_on date, p_method text default '', p_note text default ''
) returns public.documents
language plpgsql security definer set search_path = public as $$
declare d public.documents; v_remaining numeric;
begin
  select * into d from documents where id = p_id for update;
  if not found then raise exception 'Invoice tidak ditemukan.'; end if;
  perform docs_assert_access(d);
  if d.kind <> 'invoice' or d.status not in ('unpaid', 'partial') then
    raise exception 'Pembayaran hanya bisa dicatat untuk invoice yang belum lunas.';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Jumlah pembayaran harus lebih dari nol.'; end if;
  v_remaining := d.total - d.amount_paid;
  if p_amount > v_remaining then
    raise exception 'Jumlah melebihi sisa tagihan (Rp%).', to_char(v_remaining, 'FM999G999G999G999G990');
  end if;
  if p_paid_on is null or p_paid_on > (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal pembayaran tidak boleh di masa depan.';
  end if;
  insert into document_payments (document_id, org_id, amount, paid_on, method, note, created_by)
    values (d.id, d.org_id, p_amount, p_paid_on, coalesce(btrim(p_method), ''), coalesce(btrim(p_note), ''), auth.uid());
  perform set_config('nexto.doc_rpc', '1', true);
  update documents set
    amount_paid = d.amount_paid + p_amount,
    status = case when d.amount_paid + p_amount >= d.total then 'paid' else 'partial' end,
    paid_at = case when d.amount_paid + p_amount >= d.total then now() else null end
  where id = d.id returning * into d;
  perform set_config('nexto.doc_rpc', '', true);
  return d;
end;
$$;

create or replace function public.delete_document_payment(p_payment uuid)
returns public.documents
language plpgsql security definer set search_path = public as $$
declare pay public.document_payments; d public.documents; v_paid numeric;
begin
  select * into pay from document_payments where id = p_payment;
  if not found then raise exception 'Pembayaran tidak ditemukan.'; end if;
  select * into d from documents where id = pay.document_id for update;
  perform docs_assert_access(d);
  if d.status = 'void' then raise exception 'Invoice sudah dibatalkan.'; end if;
  delete from document_payments where id = p_payment;
  select coalesce(sum(amount), 0) into v_paid from document_payments where document_id = d.id;
  perform set_config('nexto.doc_rpc', '1', true);
  update documents set
    amount_paid = v_paid,
    status = case when v_paid >= d.total then 'paid' when v_paid > 0 then 'partial' else 'unpaid' end,
    paid_at = case when v_paid >= d.total then paid_at else null end
  where id = d.id returning * into d;
  perform set_config('nexto.doc_rpc', '', true);
  return d;
end;
$$;

create or replace function public.void_document(p_id uuid)
returns public.documents
language plpgsql security definer set search_path = public as $$
declare d public.documents;
begin
  select * into d from documents where id = p_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  perform docs_assert_access(d);
  if d.kind <> 'invoice' or d.issued_at is null then raise exception 'Hanya invoice yang sudah terbit yang bisa dibatalkan.'; end if;
  if d.status not in ('unpaid', 'partial') then raise exception 'Invoice ini tidak bisa dibatalkan.'; end if;
  if d.amount_paid > 0 then raise exception 'Hapus catatan pembayaran terlebih dahulu sebelum membatalkan invoice.'; end if;
  perform set_config('nexto.doc_rpc', '1', true);
  update documents set status = 'void' where id = p_id returning * into d;
  perform set_config('nexto.doc_rpc', '', true);
  return d;
end;
$$;

-- Hak akses: hanya pengguna login yang boleh memanggil fungsi publik; fungsi
-- helper internal tidak dibuka.
revoke all on function public.issue_document(uuid) from public, anon;
revoke all on function public.set_quotation_status(uuid, text) from public, anon;
revoke all on function public.convert_quotation_to_invoice(uuid) from public, anon;
revoke all on function public.record_document_payment(uuid, numeric, date, text, text) from public, anon;
revoke all on function public.delete_document_payment(uuid) from public, anon;
revoke all on function public.void_document(uuid) from public, anon;
revoke all on function public.docs_assert_access(public.documents) from public, anon, authenticated;
revoke all on function public.docs_compute_totals(jsonb, text, numeric, boolean, numeric) from public, anon;
grant execute on function public.issue_document(uuid) to authenticated;
grant execute on function public.set_quotation_status(uuid, text) to authenticated;
grant execute on function public.convert_quotation_to_invoice(uuid) to authenticated;
grant execute on function public.record_document_payment(uuid, numeric, date, text, text) to authenticated;
grant execute on function public.delete_document_payment(uuid) to authenticated;
grant execute on function public.void_document(uuid) to authenticated;
grant execute on function public.docs_compute_totals(jsonb, text, numeric, boolean, numeric) to authenticated;
revoke all on function public.documents_before_write() from public, anon, authenticated;
revoke all on function public.docs_plan_ok(uuid) from public, anon;
revoke all on function public.is_org_manager(uuid) from public, anon;
revoke all on function public.docs_rpc_flag() from public, anon;
grant execute on function public.docs_plan_ok(uuid) to authenticated;
grant execute on function public.is_org_manager(uuid) to authenticated;
grant execute on function public.docs_rpc_flag() to authenticated;
