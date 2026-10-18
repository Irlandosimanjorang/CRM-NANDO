-- 18 Okt 2026: Report memuat deal langsung dari server (sumber yang sama dengan Team dan Rekap),
-- supaya angka tidak tergantung daftar lead yang ada di aplikasi.
-- Isi: lead menang (tahap type = 'won') dengan tanggal deal di rentang p_from..p_to.
-- Owner/manager melihat semua lead org; anggota lain hanya lead miliknya.
create or replace function public.get_deals_range(p_from date, p_to date)
 returns jsonb
 language plpgsql
 stable security definer
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
    select jsonb_agg(to_jsonb(l) order by l.deal_date)
    from leads l
    join stages s on s.org_id = l.org_id and s.key = l.stage_key and s.type = 'won'
    where l.org_id = v_org
      and l.deleted_at is null
      and l.deal_date >= p_from and l.deal_date <= p_to
      and (v_role in ('owner', 'manager') or coalesce(l.assigned_to, l.user_id) = v_uid)
  ), '[]'::jsonb);
end;
$function$;
