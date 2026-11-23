-- Jenis penjualan ikut dikirim ke Journey (24 Nov 2026): Proyek, Product only, Jasa, atau Profil.
-- Sebelumnya payload tidak membawa jenis, jadi pilihan di Proyek Deal tidak pernah sampai ke Journey.
-- Isi payload lain tidak berubah. Nilai di luar daftar dikirim sebagai "proyek".
create or replace function public.journey_deal_payload(r public.leads)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'nexto_lead_id', r.id,
    'detail_proyek', r.detail_proyek,
    'sph_number', r.sph_number,
    'deal_date', r.deal_date,
    'tanggal_deal', r.deal_date,
    'nilai_deal', coalesce(r.deal_value, 0),
    'discount_pct', r.discount_pct,
    'discount_total', r.discount_total,
    'pic', coalesce(
      nullif(r.memo->>'marketing', ''),
      (select nullif(btrim(u.raw_user_meta_data->>'full_name'), '') from auth.users u where u.id = r.assigned_to),
      ''
    ),
    'estimator', coalesce(nullif(r.memo->>'estimator', ''), ''),
    'sph_ttd', coalesce(r.proyek_checklist ? 'sph_ttd', false),
    'berkas_qr', coalesce(r.proyek_checklist ? 'qr_berkas', false),
    'invoice_proforma', coalesce(r.proyek_checklist ? 'invoice_performa', false),
    'jenis_penjualan', case when r.memo->>'jenis_penjualan' in ('proyek', 'product_only', 'jasa', 'profil') then r.memo->>'jenis_penjualan' else 'proyek' end
  );
$$;
