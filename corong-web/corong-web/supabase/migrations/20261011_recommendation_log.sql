-- Pencatatan rekomendasi AI dan pengukuran efeknya (11 Okt 2026, langkah 1 "tutup lingkaran ukur" Memory Engine).
-- Tiap rekomendasi harian (advisor_runs.recs) dicatat sebagai satu baris recommendation_log lewat trigger, lengkap dengan
-- posisi tahap lead saat itu. Efeknya dihitung belakangan (get_recommendation_effect): apakah rekomendasi ditindaklanjuti
-- (ada catatan atau perpindahan tahap oleh penerima dalam 3 hari), apakah lead maju tahap, dan hasil akhirnya.
-- Akun uji (@example.com) ditandai is_test dan tidak ikut hitungan. Tidak ada perubahan pada fungsi edge.

create table if not exists public.recommendation_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  run_date date not null,
  logged_at timestamptz not null default now(),
  action_type text,
  action text,
  urgency text,
  stage_key_at text,
  stage_pos_at int,
  deal_value_at numeric,
  is_test boolean not null default false,
  feedback text check (feedback in ('used', 'not_useful')),
  feedback_at timestamptz,
  unique (user_id, run_date, lead_id)
);
create index if not exists recommendation_log_org_idx on public.recommendation_log (org_id, logged_at desc);
create index if not exists recommendation_log_lead_idx on public.recommendation_log (lead_id);

alter table public.recommendation_log enable row level security;
drop policy if exists recommendation_log_select on public.recommendation_log;
create policy recommendation_log_select on public.recommendation_log for select to authenticated
  using (user_id = (select auth.uid()) or (org_id in (select public.my_org_ids()) and public.my_role() in ('owner', 'manager')));

-- Trigger: pecah advisor_runs.recs menjadi baris log (sekali per pengguna, hari, dan lead).
create or replace function public.log_advisor_recs()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rec jsonb;
  v_lead uuid;
  v_test boolean;
begin
  if new.recs is null or jsonb_typeof(new.recs) <> 'array' or jsonb_array_length(new.recs) = 0 then return new; end if;
  select coalesce(u.email, '') ilike '%@example.com' into v_test from auth.users u where u.id = new.user_id;
  for rec in select * from jsonb_array_elements(new.recs) loop
    begin
      v_lead := (rec->>'id')::uuid;
    exception when others then
      continue;
    end;
    insert into public.recommendation_log (org_id, user_id, lead_id, run_date, action_type, action, urgency, stage_key_at, stage_pos_at, deal_value_at, is_test)
    select l.org_id, new.user_id, l.id, new.run_date, rec->>'action_type', left(coalesce(rec->>'action', ''), 400), rec->>'urgency',
           l.stage_key, st.position, l.deal_value, coalesce(v_test, false)
    from public.leads l left join public.stages st on st.org_id = l.org_id and st.key = l.stage_key
    where l.id = v_lead and l.org_id is not null
    on conflict (user_id, run_date, lead_id) do nothing;
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_log_advisor_recs on public.advisor_runs;
create trigger trg_log_advisor_recs after insert or update of recs on public.advisor_runs
  for each row execute function public.log_advisor_recs();

-- Isi awal dari advisor_runs yang masih tersimpan (hanya beberapa hari terakhir).
insert into public.recommendation_log (org_id, user_id, lead_id, run_date, logged_at, action_type, action, urgency, stage_key_at, stage_pos_at, deal_value_at, is_test)
select l.org_id, a.user_id, l.id, a.run_date, coalesce(a.updated_at, now()), rec->>'action_type', left(coalesce(rec->>'action', ''), 400), rec->>'urgency',
       l.stage_key, st.position, l.deal_value, coalesce(u.email, '') ilike '%@example.com'
from public.advisor_runs a
cross join lateral jsonb_array_elements(case when jsonb_typeof(a.recs) = 'array' then a.recs else '[]'::jsonb end) rec
join public.leads l on l.id = case when (rec->>'id') ~* '^[0-9a-f-]{36}$' then (rec->>'id')::uuid else null end
left join public.stages st on st.org_id = l.org_id and st.key = l.stage_key
left join auth.users u on u.id = a.user_id
where l.org_id is not null
on conflict (user_id, run_date, lead_id) do nothing;

-- Umpan balik eksplisit penerima (opsional): dipakai atau tidak berguna.
create or replace function public.rate_recommendation(p_id uuid, p_feedback text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if p_feedback not in ('used', 'not_useful') then raise exception 'Nilai umpan balik tidak valid.'; end if;
  update public.recommendation_log set feedback = p_feedback, feedback_at = now() where id = p_id and user_id = auth.uid();
  if not found then raise exception 'Rekomendasi tidak ditemukan.'; end if;
end;
$$;

-- Efek rekomendasi untuk organisasi pemanggil (owner/manager), p_days hari terakhir.
create or replace function public.get_recommendation_effect(p_days int default 90)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_org uuid;
  v jsonb;
begin
  select m.org_id into v_org from public.organization_members m where m.user_id = auth.uid() and m.role in ('owner', 'manager') limit 1;
  if v_org is null then raise exception 'Hanya owner atau manager yang dapat melihat efek rekomendasi.'; end if;
  with base as (
    select r.id, r.action_type, r.stage_pos_at, r.feedback, st.type as now_type, st.position as now_pos,
      (
        exists (select 1 from public.progress_notes p where p.lead_id = r.lead_id and p.user_id = r.user_id
                and p.created_at >= r.logged_at and p.created_at < r.logged_at + interval '3 days')
        or exists (select 1 from public.lead_stage_changes c where c.lead_id = r.lead_id and c.changed_by = r.user_id
                and c.changed_at >= r.logged_at and c.changed_at < r.logged_at + interval '3 days')
      ) as followed
    from public.recommendation_log r
    join public.leads l on l.id = r.lead_id and l.deleted_at is null
    left join public.stages st on st.org_id = l.org_id and st.key = l.stage_key
    where r.org_id = v_org and not r.is_test and r.logged_at >= now() - make_interval(days => greatest(p_days, 1))
  ), agg as (
    select followed,
           count(*) n,
           count(*) filter (where now_pos is not null and stage_pos_at is not null and now_pos > stage_pos_at) maju,
           count(*) filter (where now_type = 'won') menang,
           count(*) filter (where now_type = 'lost') kalah
    from base group by followed
  )
  select jsonb_build_object(
    'hari', greatest(p_days, 1),
    'total', (select count(*) from base),
    'dipakai_eksplisit', (select count(*) from base where feedback = 'used'),
    'tidak_berguna_eksplisit', (select count(*) from base where feedback = 'not_useful'),
    'ditindaklanjuti', coalesce((select to_jsonb(a) - 'followed' from agg a where followed), jsonb_build_object('n', 0, 'maju', 0, 'menang', 0, 'kalah', 0)),
    'tidak_ditindaklanjuti', coalesce((select to_jsonb(a) - 'followed' from agg a where not followed), jsonb_build_object('n', 0, 'maju', 0, 'menang', 0, 'kalah', 0)),
    'per_jenis', coalesce((select jsonb_agg(jsonb_build_object('jenis', coalesce(action_type, '-'), 'n', n, 'ditindaklanjuti', f)) from (
        select action_type, count(*) n, count(*) filter (where followed) f from base group by action_type order by count(*) desc) t), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.rate_recommendation(uuid, text) from public, anon;
revoke all on function public.get_recommendation_effect(int) from public, anon;
grant execute on function public.rate_recommendation(uuid, text) to authenticated;
grant execute on function public.get_recommendation_effect(int) to authenticated;
