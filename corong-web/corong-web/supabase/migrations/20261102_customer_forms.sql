-- Form data customer (2 Nov 2026): marketing membuat QR dari proyek deal, customer scan dan mengisi
-- data serta upload KTP tanpa login. Hanya hash token yang disimpan; token asli hanya ada di QR.
-- Akses publik lewat edge function customer-form (service role), jadi tabel ini tidak dibuka untuk anon.

create table if not exists public.customer_forms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'menunggu' check (status in ('menunggu', 'terisi', 'dibatalkan')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index if not exists customer_forms_lead_idx on public.customer_forms (lead_id, created_at desc);

create table if not exists public.customer_form_answers (
  form_id uuid primary key references public.customer_forms(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  nama_lengkap text not null,
  nik text not null,
  alamat text,
  no_hp text,
  email text,
  nama_perusahaan text,
  catatan text,
  consent_at timestamptz not null,
  consent_version text not null,
  submitted_at timestamptz not null default now()
);

create table if not exists public.customer_form_files (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.customer_forms(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('ktp')),
  storage_path text not null,
  mime text,
  size_bytes integer,
  uploaded_at timestamptz not null default now()
);
create index if not exists customer_form_files_form_idx on public.customer_form_files (form_id);

alter table public.customer_forms enable row level security;
alter table public.customer_form_answers enable row level security;
alter table public.customer_form_files enable row level security;

-- Form dibuat dan dilihat oleh anggota org. Hapus hanya owner/manager.
create policy customer_forms_select on public.customer_forms for select to authenticated
  using (org_id in (select my_org_ids()));
create policy customer_forms_insert on public.customer_forms for insert to authenticated
  with check (org_id in (select my_org_ids()) and created_by = (select auth.uid()));
create policy customer_forms_update on public.customer_forms for update to authenticated
  using (org_id in (select my_org_ids()) and (my_role() in ('owner', 'manager') or created_by = (select auth.uid())))
  with check (org_id in (select my_org_ids()));
create policy customer_forms_delete on public.customer_forms for delete to authenticated
  using (org_id in (select my_org_ids()) and my_role() in ('owner', 'manager'));

-- Jawaban customer: data pribadi, hanya owner/manager dan pembuat form.
create policy customer_form_answers_select on public.customer_form_answers for select to authenticated
  using (
    org_id in (select my_org_ids())
    and exists (
      select 1 from public.customer_forms f
      where f.id = customer_form_answers.form_id
        and (my_role() in ('owner', 'manager') or f.created_by = (select auth.uid()))
    )
  );
create policy customer_form_answers_delete on public.customer_form_answers for delete to authenticated
  using (org_id in (select my_org_ids()) and my_role() in ('owner', 'manager'));

create policy customer_form_files_select on public.customer_form_files for select to authenticated
  using (
    org_id in (select my_org_ids())
    and exists (
      select 1 from public.customer_forms f
      where f.id = customer_form_files.form_id
        and (my_role() in ('owner', 'manager') or f.created_by = (select auth.uid()))
    )
  );
create policy customer_form_files_delete on public.customer_form_files for delete to authenticated
  using (org_id in (select my_org_ids()) and my_role() in ('owner', 'manager'));

-- Bucket privat untuk foto KTP. Path: <org_id>/<form_id>/<nama-file>. Baca hanya owner/manager
-- atau pembuat form. Tulis dilakukan edge function customer-form (service role).
insert into storage.buckets (id, name, public)
values ('customer-documents', 'customer-documents', false)
on conflict (id) do update set public = false;

create policy customer_documents_read on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-documents'
    and exists (
      select 1 from public.customer_forms f
      where f.id::text = (storage.foldername(name))[2]
        and f.org_id::text = (storage.foldername(name))[1]
        and f.org_id in (select my_org_ids())
        and (my_role() in ('owner', 'manager') or f.created_by = (select auth.uid()))
    )
  );
