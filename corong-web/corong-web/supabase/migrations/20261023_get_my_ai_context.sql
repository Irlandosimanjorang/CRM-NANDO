-- 23 Okt 2026: panel "Konteks AI" di dashboard. Menampilkan komposisi konteks AI untuk user yang login:
-- profil perusahaan, pola organisasi, memori pribadi, dan fakta pipeline, lengkap dengan ukurannya.
-- Ukuran dalam karakter. Batas yang benar-benar dipakai build_memory_context() adalah 2400 karakter.

create or replace function public.get_my_ai_context(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  uid uuid := auth.uid();
  prof text := '';
  org_mem text := '';
  mem text := '';
  mem_src text := 'belum ada';
  facts_txt text;
  stored record;
  berubah int;
begin
  if uid is null or not exists (select 1 from organization_members where org_id = p_org and user_id = uid) then
    raise exception 'tidak berhak';
  end if;

  select coalesce(company_profile, '') || ' ' || coalesce(products::text, '') into prof
  from org_product_catalog where org_id = p_org;

  select coalesce(ideal_customer_profile, '') || ' ' || coalesce(common_objections::text, '') || ' ' || coalesce(winning_playbook::text, '') into org_mem
  from org_memory where org_id = p_org;

  select summary, updated_at into stored from member_agent_context where org_id = p_org and user_id = uid;
  if stored.summary is not null and stored.summary <> '' then
    mem := stored.summary;
    mem_src := 'agen';
  else
    select summary into mem from member_memory where org_id = p_org and user_id = uid;
    if mem is not null and mem <> '' then mem_src := 'aturan'; else mem := ''; end if;
  end if;

  facts_txt := public.member_facts(p_org, uid)::text;

  -- Perubahan sejak update terakhir agen: catatan baru atau lead yang diubah.
  select (select count(*) from progress_notes n where n.org_id = p_org and n.user_id = uid and n.created_at > coalesce(stored.updated_at, 'epoch'))
       + (select count(*) from leads l where l.org_id = p_org and l.assigned_to = uid and l.deleted_at is null and l.updated_at > coalesce(stored.updated_at, 'epoch'))
  into berubah;

  return jsonb_build_object(
    'bagian', jsonb_build_array(
      jsonb_build_object('nama', 'Profil perusahaan', 'karakter', length(prof), 'sumber', 'org_product_catalog'),
      jsonb_build_object('nama', 'Pola organisasi', 'karakter', length(org_mem), 'sumber', 'org_memory'),
      jsonb_build_object('nama', 'Memori pribadi', 'karakter', length(mem), 'sumber', mem_src),
      jsonb_build_object('nama', 'Fakta pipeline (dipakai agen)', 'karakter', length(facts_txt), 'sumber', 'member_facts')
    ),
    'batas_karakter', 2400,
    'terakhir_diperbarui', stored.updated_at,
    'perubahan_sejak_update', berubah
  );
end;
$$;

revoke execute on function public.get_my_ai_context(uuid) from public, anon;
grant execute on function public.get_my_ai_context(uuid) to authenticated;
