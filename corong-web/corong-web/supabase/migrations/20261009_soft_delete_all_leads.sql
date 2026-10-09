-- Tombol "Hapus semua lead" di tab Leads (9 Okt 2026, permintaan Nando; berlaku untuk semua pengguna Nexto yang owner atau manager).
-- Hanya owner dan manager; wajib kata konfirmasi 'HAPUS SEMUA'; lead masuk Recycle Bin (soft delete, bisa dipulihkan).
-- Memakai penanda nexto.bulk_move agar log aktivitas tidak banjir; satu baris ringkasan dicatat di team_activity_log.
create or replace function public.soft_delete_all_leads(p_confirm text)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_org uuid;
  v_n int;
begin
  if auth.uid() is null then raise exception 'Anda harus login.'; end if;
  if coalesce(p_confirm, '') <> 'HAPUS SEMUA' then raise exception 'Kata konfirmasi tidak cocok.'; end if;
  select m.org_id into v_org from public.organization_members m
   where m.user_id = auth.uid() and m.role in ('owner', 'manager')
   order by case m.role when 'owner' then 0 else 1 end limit 1;
  if v_org is null then raise exception 'Hanya owner atau manager yang dapat menghapus semua lead.'; end if;
  perform set_config('nexto.bulk_move', 'on', true);
  update public.leads set deleted_at = now() where org_id = v_org and deleted_at is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into public.team_activity_log (org_id, user_id, kind, lead_id, lead_name, detail)
    values (v_org, auth.uid(), 'lead_deleted', null, '', v_n || ' lead dihapus sekaligus (masuk Recycle Bin)');
  end if;
  return v_n;
end;
$$;
revoke all on function public.soft_delete_all_leads(text) from public, anon;
grant execute on function public.soft_delete_all_leads(text) to authenticated;
