-- 11 Nov 2026 - audit security nomor 2 (fungsi SECURITY DEFINER untuk user login).
--
-- 1) merge_leads:
--    - Sebelumnya anggota role sales bisa menggabungkan (dan menghapus permanen) lead siapa saja di org.
--      Sekarang: owner/manager bebas; sales hanya kalau kedua lead ditugaskan ke dirinya.
--    - p_fill tidak lagi bisa menimpa kolom identitas/kepemilikan (org_id, user_id, assigned_to, dll).
--    - Lead yang digabung di-soft delete (masuk Recycle Bin), bukan dihapus permanen.
--
-- 2) redeem_invite_code:
--    - Sebelumnya org lama dihapus beserta SEMUA anggotanya kalau tidak punya lead/deal/kunjungan/kompetitor,
--      walaupun masih ada anggota lain. Sekarang org hanya dihapus kalau tidak ada anggota lain.

create or replace function public.merge_leads(p_keep uuid, p_drop uuid, p_fill jsonb default null::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_keep_org uuid;
  v_role text;
  v_keep_owner uuid;
  v_drop_owner uuid;
begin
  if v_uid is null then raise exception 'Belum login'; end if;
  if p_keep is null or p_drop is null or p_keep = p_drop then raise exception 'Pilih dua lead yang berbeda.'; end if;

  select org_id, coalesce(assigned_to, user_id) into v_org, v_drop_owner from leads where id = p_drop and deleted_at is null;
  select org_id, coalesce(assigned_to, user_id) into v_keep_org, v_keep_owner from leads where id = p_keep and deleted_at is null;
  if v_org is null or v_keep_org is null or v_org <> v_keep_org then raise exception 'Lead tidak ditemukan atau beda organisasi.'; end if;

  select m.role into v_role from organization_members m where m.user_id = v_uid and m.org_id = v_org;
  if v_role is null then raise exception 'Anda bukan anggota organisasi ini.'; end if;
  if v_role not in ('owner', 'manager') and not (v_keep_owner = v_uid and v_drop_owner = v_uid) then
    raise exception 'Anda hanya bisa menggabungkan lead yang ditugaskan ke Anda.';
  end if;

  if p_fill is not null and p_fill <> '{}'::jsonb then
    if exists (
      select 1 from jsonb_object_keys(p_fill) k
      where k in ('id', 'org_id', 'user_id', 'assigned_to', 'deleted_at', 'created_at', 'updated_at', 'tracking_token')
    ) then
      raise exception 'Kolom ini tidak boleh diubah lewat penggabungan.';
    end if;
    execute 'update leads t set ' || (select string_agg(format('%I = r.%I', k, k), ', ') from jsonb_object_keys(p_fill) k)
            || ' from (select * from jsonb_populate_record(null::leads, $1)) r where t.id = $2'
      using p_fill, p_keep;
  end if;

  update progress_notes set lead_id = p_keep where lead_id = p_drop;
  update visit_checkins set lead_id = p_keep where lead_id = p_drop;
  update deal_transactions set lead_id = p_keep where lead_id = p_drop;
  update lead_stage_changes set lead_id = p_keep where lead_id = p_drop;
  update lead_messages set lead_id = p_keep where lead_id = p_drop;
  update payment_terms set lead_id = p_keep where lead_id = p_drop;
  update ai_drafts set lead_id = p_keep where lead_id = p_drop;
  update lead_needs_summaries set lead_id = p_keep where lead_id = p_drop;
  update recommendation_log set lead_id = p_keep where lead_id = p_drop;
  update notifications set lead_id = p_keep where lead_id = p_drop;
  update documents set lead_id = p_keep where lead_id = p_drop;
  update leads set deleted_at = now() where id = p_drop;
end;
$function$;

create or replace function public.redeem_invite_code(p_code text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invite org_invite_codes%rowtype;
  v_org organizations%rowtype;
  v_member_count int;
  v_uid uuid := auth.uid();
  v_old_org_id uuid;
  v_old_role text;
  v_old_others int := 0;
  v_moved int := 0;
  v_old_org_empty boolean;
begin
  if v_uid is null then
    return json_build_object('error', 'Belum login');
  end if;

  select * into v_invite from org_invite_codes where code = upper(p_code) for update;
  if not found then
    return json_build_object('error', 'Kode tidak ditemukan. Periksa kembali penulisannya.');
  end if;
  if v_invite.used_by is not null then
    return json_build_object('error', 'Kode ini sudah dipakai. Minta kode baru ke owner team.');
  end if;
  if v_invite.expires_at < now() then
    return json_build_object('error', 'Kode sudah kedaluwarsa. Minta kode baru ke owner team.');
  end if;

  select * into v_org from organizations where id = v_invite.org_id for update;

  select count(*) into v_member_count from organization_members where org_id = v_org.id;
  if v_member_count >= v_org.member_limit then
    return json_build_object('error', 'Anggota organisasi ini sudah penuh.');
  end if;

  if exists (select 1 from organization_members where org_id = v_org.id and user_id = v_uid) then
    return json_build_object('error', 'Anda sudah menjadi anggota organisasi ini.');
  end if;

  select org_id, role into v_old_org_id, v_old_role from organization_members where user_id = v_uid limit 1;
  if v_old_org_id is not null and v_old_org_id <> v_org.id then
    select count(*) into v_old_others from organization_members where org_id = v_old_org_id and user_id <> v_uid;
    if v_old_others > 0 and v_old_role = 'owner' then
      return json_build_object('error', 'Anda masih menjadi owner organisasi yang memiliki anggota lain. Keluarkan semua anggota terlebih dahulu (Pengaturan > Team) sebelum bergabung ke team lain.');
    end if;
  end if;

  delete from organization_members where user_id = v_uid;
  insert into organization_members (org_id, user_id, role) values (v_org.id, v_uid, v_invite.role);
  update org_invite_codes set used_by = v_uid, used_at = now() where code = v_invite.code;

  if v_old_org_id is not null and v_old_org_id <> v_org.id and v_old_others = 0 then
    v_moved := move_personal_org_data(v_old_org_id, v_org.id, v_uid);
  end if;

  -- Org lama dihapus hanya jika sudah tidak ada anggota lain DAN tidak punya data.
  if v_old_org_id is not null and v_old_org_id <> v_org.id and v_old_others = 0 then
    select not exists (
      select 1 from leads where org_id = v_old_org_id
      union all select 1 from deal_transactions where org_id = v_old_org_id
      union all select 1 from visit_checkins where org_id = v_old_org_id
      union all select 1 from competitors where org_id = v_old_org_id
    ) into v_old_org_empty;

    if v_old_org_empty then
      delete from stages where org_id = v_old_org_id;
      delete from lead_gen_runs where org_id = v_old_org_id;
      delete from generated_leads where org_id = v_old_org_id;
      delete from progress_notes where org_id = v_old_org_id;
      delete from organization_members where org_id = v_old_org_id;
      delete from organizations where id = v_old_org_id;
    end if;
  end if;

  return json_build_object('ok', true, 'org_name', v_org.name, 'moved_leads', v_moved);
end;
$function$;
