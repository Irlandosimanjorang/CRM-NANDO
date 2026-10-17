-- 17 Okt 2026: daftar izin masuk (untuk tombol "Tim <org>" di tab Team org penerima).
-- Mengembalikan nama org pemberi, hanya untuk owner/manager org penerima.
-- Sudah diterapkan ke database lewat MCP.

create or replace function public.get_incoming_share_grants()
returns table (grantor_org_id uuid, grantor_name text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select g.grantor_org_id, o.name
  from share_grants g
  join organizations o on o.id = g.grantor_org_id
  where g.grantee_org_id in (select my_org_ids()) and g.enabled and my_role() in ('owner', 'manager')
$function$;

revoke execute on function public.get_incoming_share_grants() from public, anon;
grant execute on function public.get_incoming_share_grants() to authenticated;
