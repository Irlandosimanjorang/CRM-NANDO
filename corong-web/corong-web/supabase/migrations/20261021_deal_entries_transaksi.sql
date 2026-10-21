-- 21 Okt 2026: Team dan Report dihitung per transaksi (bukan per lead).
-- Setiap transaksi deal masuk ke bulan tanggal transaksinya sendiri, jadi repeat order
-- tercatat di bulan repeat order-nya. Lead menang tanpa transaksi (deal lama) tetap
-- dihitung sekali pakai deal_value dan deal_date lead.
-- Total keseluruhan tetap sama dengan jumlah deal_value lead menang.

-- Daftar "entri deal" untuk satu organisasi (internal, dipanggil fungsi lain).
create or replace function public.org_deal_entries(p_org uuid)
returns table(tx_id uuid, lead_id uuid, pic uuid, deal_date date, deal_value numeric)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select t.id, t.lead_id, coalesce(l.assigned_to, l.user_id), t.deal_date, t.deal_value
  from deal_transactions t
  join leads l on l.id = t.lead_id and l.deleted_at is null
  join stages s on s.org_id = l.org_id and s.key = l.stage_key and s.type = 'won'
  where l.org_id = p_org and t.org_id = p_org
  union all
  select null::uuid, l.id, coalesce(l.assigned_to, l.user_id), l.deal_date, l.deal_value
  from leads l
  join stages s on s.org_id = l.org_id and s.key = l.stage_key and s.type = 'won'
  where l.org_id = p_org and l.deleted_at is null
    and not exists (select 1 from deal_transactions t where t.lead_id = l.id)
$function$;

revoke execute on function public.org_deal_entries(uuid) from public, anon, authenticated;

-- Entri deal untuk rentang tanggal, sesuai peran: owner/manager melihat semua, sales hanya miliknya.
create or replace function public.get_deal_entries(p_from date, p_to date)
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
    select jsonb_agg(jsonb_build_object('tx_id', e.tx_id, 'lead_id', e.lead_id, 'pic', e.pic, 'deal_date', e.deal_date, 'deal_value', e.deal_value) order by e.deal_date)
    from org_deal_entries(v_org) e
    where e.deal_date >= p_from and e.deal_date <= p_to
      and (v_role in ('owner', 'manager') or e.pic = v_uid)
  ), '[]'::jsonb);
end;
$function$;

revoke execute on function public.get_deal_entries(date, date) from public, anon;
grant execute on function public.get_deal_entries(date, date) to authenticated;
