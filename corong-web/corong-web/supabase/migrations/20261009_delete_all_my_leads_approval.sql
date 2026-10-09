-- "Hapus semua lead saya" untuk marketing (sales_rep) Enterprise lewat persetujuan owner/manager (9 Okt 2026, permintaan Nando).
-- Marketing tidak menghapus langsung: ia mengirim permintaan (request_delete_all_my_leads), owner/manager menerima notifikasi dan
-- menyetujui di Pengaturan (approve_delete_all_my_leads). Saat disetujui, hanya lead yang dipegang pemohon yang masuk Recycle Bin.

alter table public.approval_requests drop constraint if exists approval_requests_action_type_check;
alter table public.approval_requests add constraint approval_requests_action_type_check
  check (action_type = any (array['delete_lead', 'export_leads', 'delete_competitor', 'delete_all_my_leads']));

create or replace function public.request_delete_all_my_leads()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_n int;
  v_id uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'Anda harus login.'; end if;
  select m.org_id, m.role into v_org, v_role from public.organization_members m where m.user_id = v_uid limit 1;
  if v_org is null then raise exception 'Anda belum tergabung di organisasi.'; end if;
  if v_role in ('owner', 'manager') then raise exception 'Owner dan manager dapat menghapus langsung lewat tombol Hapus semua lead.'; end if;
  select count(*) into v_n from public.leads where org_id = v_org and assigned_to = v_uid and deleted_at is null;
  if v_n = 0 then raise exception 'Tidak ada lead milik Anda untuk dihapus.'; end if;
  if exists (select 1 from public.approval_requests where org_id = v_org and requested_by = v_uid and action_type = 'delete_all_my_leads' and status = 'pending') then
    raise exception 'Permintaan sebelumnya masih menunggu persetujuan owner atau manager.';
  end if;
  insert into public.approval_requests (org_id, requested_by, action_type, payload)
  values (v_org, v_uid, 'delete_all_my_leads', jsonb_build_object('count', v_n)) returning id into v_id;
  select coalesce(nullif(s.community_display_name, ''), 'Anggota tim') into v_name from public.settings s where s.user_id = v_uid;
  insert into public.notifications (user_id, org_id, type, title, body, link_tab)
  select m.user_id, v_org, 'approval_request', coalesce(v_name, 'Anggota tim') || ' meminta hapus semua lead miliknya',
         v_n || ' lead menunggu persetujuan Anda di Pengaturan, bagian Permintaan Approval.', 'settings'
  from public.organization_members m where m.org_id = v_org and m.role in ('owner', 'manager');
  return jsonb_build_object('id', v_id, 'count', v_n);
end;
$$;

create or replace function public.approve_delete_all_my_leads(p_request uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r public.approval_requests%rowtype;
  v_n int;
begin
  select * into r from public.approval_requests where id = p_request;
  if not found then raise exception 'Permintaan tidak ditemukan.'; end if;
  if r.action_type <> 'delete_all_my_leads' then raise exception 'Jenis permintaan tidak sesuai.'; end if;
  if r.status <> 'pending' then raise exception 'Permintaan ini sudah diputuskan.'; end if;
  if not exists (select 1 from public.organization_members m where m.user_id = auth.uid() and m.org_id = r.org_id and m.role in ('owner', 'manager')) then
    raise exception 'Hanya owner atau manager yang dapat menyetujui.';
  end if;
  perform set_config('nexto.bulk_move', 'on', true);
  update public.leads set deleted_at = now() where org_id = r.org_id and assigned_to = r.requested_by and deleted_at is null;
  get diagnostics v_n = row_count;
  update public.approval_requests set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = p_request;
  if v_n > 0 then
    insert into public.team_activity_log (org_id, user_id, kind, lead_id, lead_name, detail)
    values (r.org_id, auth.uid(), 'lead_deleted', null, '', v_n || ' lead milik satu anggota dihapus sekaligus atas persetujuan (masuk Recycle Bin)');
  end if;
  insert into public.notifications (user_id, org_id, type, title, body, link_tab)
  values (r.requested_by, r.org_id, 'approval_request', 'Permintaan hapus semua lead disetujui', v_n || ' lead Anda dipindahkan ke Recycle Bin.', 'leads');
  return v_n;
end;
$$;

revoke all on function public.request_delete_all_my_leads() from public, anon;
revoke all on function public.approve_delete_all_my_leads(uuid) from public, anon;
grant execute on function public.request_delete_all_my_leads() to authenticated;
grant execute on function public.approve_delete_all_my_leads(uuid) to authenticated;
