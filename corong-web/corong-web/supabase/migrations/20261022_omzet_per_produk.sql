-- 22 Okt 2026: omzet per produk untuk tab Report. Produk dikelompokkan tanpa memperhatikan huruf besar-kecil dan spasi.
-- Tampilan nama memakai penulisan yang paling sering dipakai. Kategori organisasi (org_product_categories) tidak dipakai.
-- Lead tanpa produk masuk "Belum diisi".

create or replace function public.get_product_breakdown(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role text;
begin
  select m.org_id, m.role into v_org, v_role from organization_members m where m.user_id = v_uid limit 1;
  if v_org is null then raise exception 'Organisasi tidak ditemukan'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('produk', x.produk, 'deals', x.deals, 'omzet', x.omzet) order by x.omzet desc)
    from (
      select
        case when nullif(btrim(l.product), '') is null then 'Belum diisi'
             else mode() within group (order by btrim(l.product)) end as produk,
        count(*) as deals,
        sum(e.deal_value) as omzet
      from org_deal_entries(v_org) e
      join leads l on l.id = e.lead_id
      where e.deal_date >= p_from and e.deal_date <= p_to
        and (v_role in ('owner', 'manager') or e.pic = v_uid)
      group by lower(coalesce(nullif(btrim(l.product), ''), 'belum diisi'))
    ) x
  ), '[]'::jsonb);
end;
$function$;

revoke execute on function public.get_product_breakdown(date, date) from public, anon;
grant execute on function public.get_product_breakdown(date, date) to authenticated;
