-- 21 Okt 2026: transaksi deal tetap dihitung walau lead sudah dibuka lagi (repeat order).
-- Sebelumnya org_deal_entries hanya mengambil transaksi milik lead yang sekarang di tahap menang,
-- jadi deal sebelumnya hilang dari Team, Report, dan Dashboard setelah repeat order.
-- Lead menang tanpa transaksi tetap dihitung dengan deal_value lead.

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
  where l.org_id = p_org and t.org_id = p_org
  union all
  select null::uuid, l.id, coalesce(l.assigned_to, l.user_id), l.deal_date, l.deal_value
  from leads l
  join stages s on s.org_id = l.org_id and s.key = l.stage_key and s.type = 'won'
  where l.org_id = p_org and l.deleted_at is null
    and not exists (select 1 from deal_transactions t where t.lead_id = l.id)
$function$;

revoke execute on function public.org_deal_entries(uuid) from public, anon, authenticated;
