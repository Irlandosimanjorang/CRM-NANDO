-- Perbaikan (9 Okt 2026): notifikasi permintaan/keputusan approval sudah ditangani trigger yang ada
-- (notify_on_approval_request dan notify_on_approval_decision). Trigger itu menganggap semua jenis selain
-- delete_lead sebagai "export data", jadi ditambah cabang untuk delete_all_my_leads dan delete_competitor.
-- Fungsi request/approve_delete_all_my_leads tidak lagi menulis notifikasi sendiri (supaya tidak dobel).

create or replace function public.notify_on_approval_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_requester_name text;
  v_title text;
  v_body text;
begin
  select coalesce(s.community_display_name, 'Anggota tim') into v_requester_name
  from settings s where s.user_id = new.requested_by;
  v_requester_name := coalesce(v_requester_name, 'Anggota tim');

  if new.action_type = 'delete_lead' then
    v_title := 'Permintaan hapus lead';
    v_body := v_requester_name || ' minta approve buat hapus lead "' || coalesce(new.payload->>'lead_name', 'ini') || '"';
  elsif new.action_type = 'delete_all_my_leads' then
    v_title := v_requester_name || ' meminta hapus semua lead miliknya';
    v_body := coalesce(new.payload->>'count', '0') || ' lead menunggu persetujuan Anda di Pengaturan, bagian Permintaan Approval.';
  elsif new.action_type = 'delete_competitor' then
    v_title := 'Permintaan hapus kompetitor';
    v_body := v_requester_name || ' minta approve buat hapus kompetitor "' || coalesce(new.payload->>'competitor_name', 'ini') || '"';
  else
    v_title := 'Permintaan export data';
    v_body := v_requester_name || ' minta approve buat export data leads';
  end if;

  insert into notifications (user_id, org_id, type, title, body, link_tab)
  select om.user_id, new.org_id, 'approval_request', v_title, v_body, 'settings'
  from organization_members om
  where om.org_id = new.org_id and om.role in ('owner', 'manager');

  return new;
end;
$$;

create or replace function public.notify_on_approval_decision()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_title text;
  v_body text;
begin
  if old.status = 'pending' and new.status in ('approved', 'denied') then
    if new.action_type = 'delete_lead' then
      if new.status = 'approved' then
        v_title := 'Permintaan hapus lead disetujui';
        v_body := 'Lead "' || coalesce(new.payload->>'lead_name', 'ini') || '" udah dihapus (masuk recycle bin).';
      else
        v_title := 'Permintaan hapus lead ditolak';
        v_body := 'Permintaan hapus lead "' || coalesce(new.payload->>'lead_name', 'ini') || '" ditolak owner/manager.';
      end if;
    elsif new.action_type = 'delete_all_my_leads' then
      if new.status = 'approved' then
        v_title := 'Permintaan hapus semua lead disetujui';
        v_body := 'Semua lead Anda sudah dipindahkan ke Recycle Bin.';
      else
        v_title := 'Permintaan hapus semua lead ditolak';
        v_body := 'Permintaan hapus semua lead Anda ditolak owner atau manager.';
      end if;
    elsif new.action_type = 'delete_competitor' then
      v_title := case when new.status = 'approved' then 'Permintaan hapus kompetitor disetujui' else 'Permintaan hapus kompetitor ditolak' end;
      v_body := 'Kompetitor "' || coalesce(new.payload->>'competitor_name', 'ini') || '" ' || case when new.status = 'approved' then 'sudah dihapus.' else 'tidak jadi dihapus.' end;
    else
      if new.status = 'approved' then
        v_title := 'Permintaan export disetujui';
        v_body := 'Export data leads udah di-approve - silakan export lagi dari tab Leads.';
      else
        v_title := 'Permintaan export ditolak';
        v_body := 'Permintaan export data leads ditolak owner/manager.';
      end if;
    end if;

    insert into notifications (user_id, org_id, type, title, body, link_tab)
    values (new.requested_by, new.org_id, 'approval_decision', v_title, v_body, 'leads');
  end if;
  return new;
end;
$$;

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
  return v_n;
end;
$$;
