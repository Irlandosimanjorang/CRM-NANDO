-- 20 Okt 2026: gabung duplikat lewat fungsi database (bukan tiga panggilan terpisah dari aplikasi).
-- Sebelumnya: aturan hapus lead di Enterprise hanya membolehkan owner/manager, jadi sales yang menekan
-- "Gabungkan" tidak kena error (RLS diam-diam menghapus 0 baris), catatan lead dipindah tapi duplikatnya tetap ada.
-- Sekarang: semua data anak (catatan, kunjungan, deal, riwayat tahap, dll.) pindah ke lead yang dipertahankan,
-- lalu lead duplikat dihapus. Kalau tidak diizinkan, fungsi melempar error dan tidak mengubah apa pun.

create or replace function public.merge_leads(p_keep uuid, p_drop uuid, p_fill jsonb default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_keep_org uuid;
  v_drop_pic uuid;
  v_role text;
  v_plan text;
begin
  if v_uid is null then raise exception 'Belum login'; end if;
  if p_keep is null or p_drop is null or p_keep = p_drop then raise exception 'Pilih dua lead yang berbeda.'; end if;

  select org_id, coalesce(assigned_to, user_id) into v_org, v_drop_pic from leads where id = p_drop and deleted_at is null;
  select org_id into v_keep_org from leads where id = p_keep and deleted_at is null;
  if v_org is null or v_keep_org is null or v_org <> v_keep_org then raise exception 'Lead tidak ditemukan atau beda organisasi.'; end if;

  select m.role into v_role from organization_members m where m.user_id = v_uid and m.org_id = v_org;
  if v_role is null then raise exception 'Anda bukan anggota organisasi ini.'; end if;
  select o.plan into v_plan from organizations o where o.id = v_org;
  if not (v_role in ('owner', 'manager') or (v_drop_pic = v_uid and v_plan is distinct from 'enterprise')) then
    raise exception 'Menggabungkan lead butuh persetujuan owner/manager (paket Enterprise).';
  end if;

  -- 1. isian yang diambil dari lead duplikat
  if p_fill is not null and p_fill <> '{}'::jsonb then
    execute 'update leads t set ' || (select string_agg(format('%I = r.%I', k, k), ', ') from jsonb_object_keys(p_fill) k)
            || ' from (select * from jsonb_populate_record(null::leads, $1)) r where t.id = $2'
      using p_fill, p_keep;
  end if;

  -- 2. pindahkan semua data anak ke lead yang dipertahankan
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

  -- 3. hapus lead duplikat (dijamin berhasil, karena fungsi ini sudah memeriksa izinnya)
  delete from leads where id = p_drop;
end;
$function$;

revoke execute on function public.merge_leads(uuid, uuid, jsonb) from anon, public;
grant execute on function public.merge_leads(uuid, uuid, jsonb) to authenticated;
