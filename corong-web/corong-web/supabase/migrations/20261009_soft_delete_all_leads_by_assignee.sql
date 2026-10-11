-- Hapus semua lead dengan filter sales rep (9 Okt 2026): owner/manager dapat menghapus semua lead organisasi, atau hanya milik
-- satu anggota (p_assignee). Lead masuk Recycle Bin (soft delete). Menggantikan versi satu argumen.

drop function if exists public.soft_delete_all_leads(text);

create or replace function public.soft_delete_all_leads(p_confirm text, p_assignee uuid default null)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_org uuid;
  v_n int;
  v_who text := '';
begin
  if auth.uid() is null then raise exception 'Anda harus login.'; end if;
  if coalesce(p_confirm, '') <> 'HAPUS SEMUA' then raise exception 'Kata konfirmasi tidak cocok.'; end if;
  select m.org_id into v_org from public.organization_members m
   where m.user_id = auth.uid() and m.role in ('owner', 'manager')
   order by case m.role when 'owner' then 0 else 1 end limit 1;
  if v_org is null then raise exception 'Hanya owner atau manager yang dapat menghapus semua lead.'; end if;
  if p_assignee is not null then
    if not exists (select 1 from public.organization_members m where m.org_id = v_org and m.user_id = p_assignee) then
      raise exception 'Anggota tersebut bukan bagian dari organisasi Anda.';
    end if;
    select ' milik ' || coalesce(nullif(s.community_display_name, ''), 'satu anggota') into v_who from public.settings s where s.user_id = p_assignee;
  end if;
  perform set_config('nexto.bulk_move', 'on', true);
  update public.leads set deleted_at = now()
   where org_id = v_org and deleted_at is null and (p_assignee is null or assigned_to = p_assignee);
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into public.team_activity_log (org_id, user_id, kind, lead_id, lead_name, detail)
    values (v_org, auth.uid(), 'lead_deleted', null, '', v_n || ' lead' || coalesce(v_who, '') || ' dihapus sekaligus (masuk Recycle Bin)');
  end if;
  return v_n;
end;
$$;

revoke all on function public.soft_delete_all_leads(text, uuid) from public, anon;
grant execute on function public.soft_delete_all_leads(text, uuid) to authenticated;
