-- Cadangan konfigurasi organisasi (8 Okt 2026, permintaan Nando): pipeline (stages)
-- dan pengaturan (industri, label field kustom, saklar fitur) disalin ke tabel
-- cadangan sebelum perubahan besar, supaya bisa dipulihkan dengan satu perintah.
-- Yang dicadangkan: KONFIGURASI saja, bukan lead. Paket/batas anggota/masa aktif
-- ikut dicatat sebagai informasi tetapi TIDAK ikut dipulihkan (urusan tagihan).
-- Tanpa policy RLS: hanya service role (edge function admin-org-features) dan
-- postgres yang bisa memakainya. Fungsi tidak bisa dipanggil klien.
create table if not exists public.org_config_backups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null default '',
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists org_config_backups_org_idx on public.org_config_backups (org_id, created_at desc);
alter table public.org_config_backups enable row level security;

create or replace function public.snapshot_org_config(p_org_id uuid, p_label text default '')
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
begin
  insert into public.org_config_backups (org_id, label, data)
  select o.id, left(coalesce(p_label, ''), 200), jsonb_build_object(
    'org', jsonb_build_object(
      'name', o.name, 'industry', o.industry, 'custom_field_labels', o.custom_field_labels, 'features', o.features,
      'plan', o.plan, 'member_limit', o.member_limit, 'plan_expires_at', o.plan_expires_at),
    'stages', (select coalesce(jsonb_agg(jsonb_build_object('key', s.key, 'label', s.label, 'hex', s.hex, 'type', s.type, 'position', s.position) order by s.position), '[]'::jsonb)
               from public.stages s where s.org_id = o.id),
    'leads_total', (select count(*) from public.leads l where l.org_id = o.id))
  from public.organizations o where o.id = p_org_id
  returning id into v_id;
  if v_id is null then raise exception 'Organisasi tidak ditemukan'; end if;
  -- simpan 30 cadangan terbaru per organisasi
  delete from public.org_config_backups b
   where b.org_id = p_org_id
     and b.id not in (select id from public.org_config_backups where org_id = p_org_id order by created_at desc limit 30);
  return v_id;
end;
$$;

create or replace function public.restore_org_config(p_backup_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  b public.org_config_backups;
  v_owner uuid;
  v_orphans text;
  v_pre uuid;
begin
  select * into b from public.org_config_backups where id = p_backup_id;
  if b.id is null then raise exception 'Cadangan tidak ditemukan'; end if;
  select owner_user_id into v_owner from public.organizations where id = b.org_id;
  if v_owner is null then raise exception 'Organisasi tidak ditemukan'; end if;

  -- Lead tidak boleh kehilangan tahapnya: semua stage_key yang dipakai lead harus ada di cadangan.
  select string_agg(distinct l.stage_key, ', ') into v_orphans
    from public.leads l
   where l.org_id = b.org_id
     and l.stage_key is not null
     and not exists (select 1 from jsonb_array_elements(b.data->'stages') s where s->>'key' = l.stage_key);
  if v_orphans is not null then
    raise exception 'Tidak bisa dipulihkan: lead masih memakai tahap % yang tidak ada di cadangan', v_orphans;
  end if;

  -- Cadangan dari kondisi sekarang, supaya pemulihan ini sendiri bisa dibatalkan.
  v_pre := public.snapshot_org_config(b.org_id, 'otomatis sebelum pemulihan');

  delete from public.stages where org_id = b.org_id;
  insert into public.stages (user_id, org_id, key, label, hex, type, position)
  select v_owner, b.org_id, s->>'key', s->>'label', s->>'hex', s->>'type', (s->>'position')::int
    from jsonb_array_elements(b.data->'stages') s;

  update public.organizations
     set industry = b.data->'org'->>'industry',
         custom_field_labels = coalesce(b.data->'org'->'custom_field_labels', '{}'::jsonb),
         features = coalesce(b.data->'org'->'features', '{}'::jsonb)
   where id = b.org_id;

  return jsonb_build_object('org_id', b.org_id, 'restored_from', b.id, 'safety_backup', v_pre,
                            'stages', jsonb_array_length(b.data->'stages'));
end;
$$;

revoke all on function public.snapshot_org_config(uuid, text) from public, anon, authenticated;
revoke all on function public.restore_org_config(uuid) from public, anon, authenticated;
