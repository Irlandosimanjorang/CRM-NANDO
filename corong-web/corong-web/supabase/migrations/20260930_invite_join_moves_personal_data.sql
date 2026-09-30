-- SUDAH DIJALANKAN manual oleh Nando di Supabase SQL Editor (30 Sep 2026).
-- Penerapan otomatis diblokir sistem keamanan; review dulu, lalu jalankan
-- manual di Supabase SQL Editor kalau setuju.
--
-- Tujuan (permintaan Nando): user yang gabung ke team Enterprise lewat kode
-- undangan -> data di organisasi pribadinya (lead, catatan, deal, kunjungan,
-- termin, kompetitor, dst) IKUT PINDAH ke team baru, bukan ketinggalan di
-- org lama tanpa pemilik. Owner org yang masih punya anggota lain ditolak
-- dengan pesan jelas. Sales yang pindah dari team lain: datanya tetap milik
-- team lama (tidak dipindah).
--
-- Yang diubah:
--  1) 5 fungsi trigger dapat 1 baris tambahan di awal: kalau flag transaksi
--     'nexto.bulk_move' = 'on', trigger langsung selesai (gak nulis ratusan
--     log aktivitas, gak re-embed catatan = gak ada biaya AI, gak manggil AI
--     tebak alasan closing). Di luar proses pindah, perilaku trigger SAMA.
--  2) Fungsi baru move_personal_org_data (tidak bisa dipanggil user).
--  3) redeem_invite_code diganti versi baru (pesan pakai bahasa baku,
--     ada kunci baris biar batas 4 anggota gak kelewat kalau 2 orang join
--     bersamaan, dan balikin jumlah lead yang dipindah).

-- 1) Flag pemindahan pada trigger efek-samping.
do $$
declare f text; def text; flag text := E'\nbegin\n  if coalesce(current_setting(''nexto.bulk_move'', true), '''') = ''on'' then return coalesce(new, old); end if;\n';
begin
  foreach f in array array['log_lead_activity','log_lead_stage_change','log_related_activity','trigger_embed_progress_note','trigger_guess_outcome_reason'] loop
    def := pg_get_functiondef(('public.' || f)::regproc);
    if position('nexto.bulk_move' in def) = 0 then
      def := regexp_replace(def, E'\nbegin\n', flag);
      execute def;
    end if;
  end loop;
end $$;

-- 2) Pindahkan data org pribadi -> org team.
create or replace function public.move_personal_org_data(p_old uuid, p_new uuid, p_uid uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_leads int;
begin
  perform set_config('nexto.bulk_move', 'on', true);

  -- Lead: pindah org, dipegang user ini, tahap dipetakan ke pipeline team
  -- (key sama -> label sama -> tipe sama -> tahap normal pertama).
  update leads l set
    org_id = p_new,
    assigned_to = p_uid,
    stage_key = coalesce(
      (select n.key from stages n where n.org_id = p_new and n.key = l.stage_key limit 1),
      (select n.key from stages n join stages o on o.org_id = p_old and o.key = l.stage_key
         where n.org_id = p_new and lower(n.label) = lower(o.label) order by n.position limit 1),
      (select n.key from stages n join stages o on o.org_id = p_old and o.key = l.stage_key
         where n.org_id = p_new and n.type = o.type order by n.position limit 1),
      (select n.key from stages n where n.org_id = p_new and n.type = 'normal' order by n.position limit 1),
      l.stage_key)
  where l.org_id = p_old;
  get diagnostics v_leads = row_count;

  update progress_notes set org_id = p_new where org_id = p_old;
  update deal_transactions set org_id = p_new where org_id = p_old;
  update visit_checkins set org_id = p_new where org_id = p_old;
  update payment_terms set org_id = p_new where org_id = p_old;
  update ai_drafts set org_id = p_new where org_id = p_old;
  update lead_needs_summaries set org_id = p_new where org_id = p_old;
  update competitors set org_id = p_new where org_id = p_old;
  update competitor_usages set org_id = p_new where org_id = p_old;
  update generated_leads set org_id = p_new where org_id = p_old;
  update lead_gen_jobs set org_id = p_new where org_id = p_old;
  update pipeline_reviews set org_id = p_new where org_id = p_old;
  update mcp_api_keys set org_id = p_new where org_id = p_old;
  update notifications set org_id = p_new where org_id = p_old and user_id = p_uid;
  update settings set org_id = p_new where user_id = p_uid;
  -- Sengaja tidak dipindah (ikut terhapus bersama org lama): kuota
  -- lead_gen_runs, log aktivitas & perubahan tahap lama (statistik tab Team
  -- mulai dari saat bergabung), org_memory, katalog, target, komisi,
  -- approval, kode undangan.

  perform set_config('nexto.bulk_move', 'off', true);
  return v_leads;
end;
$$;
revoke all on function public.move_personal_org_data(uuid, uuid, uuid) from public, anon, authenticated;

-- 3) redeem_invite_code versi baru.
create or replace function public.redeem_invite_code(p_code text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
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

  select * into v_invite from org_invite_codes where code = upper(p_code);
  if not found then
    return json_build_object('error', 'Kode tidak ditemukan. Periksa kembali penulisannya.');
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

  if v_old_org_id is not null and v_old_org_id <> v_org.id and v_old_others = 0 then
    v_moved := move_personal_org_data(v_old_org_id, v_org.id, v_uid);
  end if;

  if v_old_org_id is not null and v_old_org_id <> v_org.id then
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
$$;
