-- Dokumen katalog produk (16 Okt 2026): file PDF/Word yang diupload owner. Teksnya diekstrak saat upload dan dibaca AI
-- (draft follow-up, ringkasan kebutuhan, generate leads, daily digest). File disimpan di bucket privat "product-docs"
-- tanpa policy: hanya edge function (service role) yang membaca dan menulis.
alter table public.org_product_catalog
  add column if not exists doc_name text not null default '',
  add column if not exists doc_path text not null default '',
  add column if not exists doc_text text not null default '';

insert into storage.buckets (id, name, public) values ('product-docs', 'product-docs', false) on conflict (id) do nothing;
