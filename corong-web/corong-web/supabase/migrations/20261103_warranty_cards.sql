-- Kartu garansi QR per proyek (3 Nov 2026). QR publik bersifat permanen dan dicetak pada unit:
-- scan menampilkan info pemasangan, nomor WhatsApp, dan riwayat servis. Teknisi menambah riwayat
-- lewat link khusus (token servis). Riwayat hanya bertambah; tidak ada edit atau hapus dari sisi klien.
-- Akses publik lewat edge function warranty-card (service role), jadi tabel ini tidak dibuka untuk anon.

create table if not exists public.warranty_cards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  -- Token publik disimpan apa adanya supaya QR bisa dicetak ulang. Hanya bisa membaca riwayat.
  public_token text not null unique,
  -- Token servis hanya disimpan hash-nya. Bisa diganti lewat "Buat ulang link teknisi".
  service_token_hash text not null unique,
  product text,
  installed_at date not null,
  warranty_months integer not null default 60 check (warranty_months > 0),
  contact_wa text not null check (contact_wa ~ '^62[0-9]{8,13}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists warranty_cards_one_per_lead on public.warranty_cards (lead_id);

create table if not exists public.warranty_service_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.warranty_cards(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  service_date date not null,
  problem text not null,
  action text not null,
  technician_name text not null,
  photo_paths text[] not null default '{}',
  submitter_ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists warranty_service_logs_card_idx on public.warranty_service_logs (card_id, service_date desc);

alter table public.warranty_cards enable row level security;
alter table public.warranty_service_logs enable row level security;

-- Staf org membaca dan membuat kartu. Ganti link teknisi dilakukan lewat update, dibatasi owner/manager.
create policy warranty_cards_select on public.warranty_cards for select to authenticated
  using (org_id in (select my_org_ids()));
create policy warranty_cards_insert on public.warranty_cards for insert to authenticated
  with check (org_id in (select my_org_ids()) and created_by = (select auth.uid()));
create policy warranty_cards_update on public.warranty_cards for update to authenticated
  using (org_id in (select my_org_ids()) and my_role() in ('owner', 'manager'))
  with check (org_id in (select my_org_ids()) and my_role() in ('owner', 'manager'));

-- Riwayat servis: staf hanya membaca. Penulisan hanya lewat edge function (service role).
create policy warranty_service_logs_select on public.warranty_service_logs for select to authenticated
  using (org_id in (select my_org_ids()));

-- Bucket privat untuk foto servis. Path: <org_id>/<card_id>/<nama-file>. Baca lewat signed URL dari edge function.
insert into storage.buckets (id, name, public)
values ('warranty-photos', 'warranty-photos', false)
on conflict (id) do update set public = false;

create policy warranty_photos_read on storage.objects for select to authenticated
  using (
    bucket_id = 'warranty-photos'
    and (storage.foldername(name))[1] in (select my_org_ids()::text)
  );
