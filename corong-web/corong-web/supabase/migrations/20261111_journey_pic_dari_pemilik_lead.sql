-- Marketing di journey: kalau memo.marketing kosong (form Proyek Deal tidak lagi mengisi memo),
-- pakai nama pemilik lead (assigned_to). Sudah diterapkan ke database CRM (11 Nov 2026).
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
    'invoice_proforma', coalesce(r.proyek_checklist ? 'invoice_performa', false)
  );
$$;
