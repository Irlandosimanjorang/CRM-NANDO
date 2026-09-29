-- Katalog produk/layanan perusahaan (1 baris per org) - dibaca AI Ringkasan
-- Kebutuhan (summarize-lead-needs) buat rekomendasiin produk yang cocok ke
-- tiap prospek. Semua anggota org bisa baca, cuma owner/manager yang ubah.
--
-- Sudah diterapkan ke project cewggulyfshnbebcpyui via migration
-- "create_org_product_catalog" (30 Sep 2026). Dokumentasi lokal.

create table public.org_product_catalog (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  company_profile text not null default '',
  products jsonb not null default '[]'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint products_is_array check (jsonb_typeof(products) = 'array' and jsonb_array_length(products) <= 20),
  constraint company_profile_len check (char_length(company_profile) <= 1000)
);
alter table public.org_product_catalog enable row level security;

create policy org_product_catalog_select on public.org_product_catalog
  for select using (org_id in (select my_org_ids()));
create policy org_product_catalog_write on public.org_product_catalog
  for all using ((org_id in (select my_org_ids())) and (my_role() = any (array['owner','manager'])))
  with check ((org_id in (select my_org_ids())) and (my_role() = any (array['owner','manager'])));

alter table public.lead_needs_summaries add column product_recommendations jsonb not null default '[]'::jsonb;
