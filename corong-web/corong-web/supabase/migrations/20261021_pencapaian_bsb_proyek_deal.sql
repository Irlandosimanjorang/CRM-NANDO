-- 21 Okt 2026: org project_deal (BSB) menghitung omzet dari tahap Proyek Deal, bukan Proyek Selesai.
-- Proyek bisa berbulan-bulan, jadi omzet dicatat di bulan proyek deal (deal_date).
-- Lead yang sudah dipindah ke Proyek Berjalan atau Proyek Selesai tetap dihitung di bulan deal-nya.
-- Kalau deal_date kosong, dipakai tanggal lead pertama kali masuk Proyek Deal (riwayat tahap).
-- Org lain tidak berubah: deal = transaksi deal, sama seperti sebelumnya.

create or replace function public.org_deal_entries(p_org uuid)
returns table(tx_id uuid, lead_id uuid, pic uuid, deal_date date, deal_value numeric)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_project boolean;
begin
  select coalesce(o.features->>'project_deal', 'false') = 'true' into v_project from organizations o where o.id = p_org;
  if coalesce(v_project, false) then
    return query
      select * from (
        select null::uuid as tx_id, l.id as lead_id, coalesce(l.assigned_to, l.user_id) as pic,
          coalesce(l.deal_date, (select (min(sc.changed_at) at time zone 'Asia/Jakarta')::date from lead_stage_changes sc where sc.lead_id = l.id and sc.to_stage = 'proyek_deal')) as d,
          l.deal_value as v
        from leads l
        where l.org_id = p_org and l.deleted_at is null
          and l.stage_key in ('proyek_deal', 'proyek_berjalan', 'proyek_selesai')
      ) x where x.d is not null;
  else
    return query
      select t.id, t.lead_id, coalesce(l.assigned_to, l.user_id), t.deal_date, t.deal_value
      from deal_transactions t
      join leads l on l.id = t.lead_id and l.deleted_at is null
      where l.org_id = p_org and t.org_id = p_org
      union all
      select null::uuid, l.id, coalesce(l.assigned_to, l.user_id), l.deal_date, l.deal_value
      from leads l
      join stages s on s.org_id = l.org_id and s.key = l.stage_key and s.type = 'won'
      where l.org_id = p_org and l.deleted_at is null
        and not exists (select 1 from deal_transactions t where t.lead_id = l.id);
  end if;
end;
$function$;

revoke execute on function public.org_deal_entries(uuid) from public, anon, authenticated;
