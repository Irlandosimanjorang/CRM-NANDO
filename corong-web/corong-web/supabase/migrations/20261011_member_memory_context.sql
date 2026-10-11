-- Memory Engine di belakang layar (11 Okt 2026, permintaan Nando): semua fitur AI (daily digest, generate leads,
-- draft follow-up, poin diskusi) memakai satu konteks memori yang sama: profil perusahaan + produk yang diinput,
-- pola organisasi (org_memory), memori pribadi tiap sales/marketing (member_memory), dan kasus serupa yang sudah tertutup.
-- Tidak ada tampilan di depan. member_memory dihitung dengan aturan (tanpa AI, tanpa biaya) tiap Senin.

create table if not exists public.member_memory (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  stats jsonb not null default '{}'::jsonb,
  summary text not null default '',
  based_on_closed int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
alter table public.member_memory enable row level security;
drop policy if exists member_memory_select on public.member_memory;
create policy member_memory_select on public.member_memory for select to authenticated
  using (user_id = (select auth.uid()) or (org_id in (select public.my_org_ids()) and public.my_role() in ('owner', 'manager')));

-- Hitung ulang memori pribadi dari deal tertutup tiap anggota (p_org kosong = semua organisasi).
create or replace function public.refresh_member_memory(p_org uuid default null)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  n int := 0;
  v_won int; v_lost int; v_avg numeric; v_days numeric;
  v_prod text; v_win text; v_loss text; v_sum text;
begin
  for r in
    select m.org_id, m.user_id, coalesce(nullif(s.community_display_name, ''), 'Anggota') as nama
    from public.organization_members m left join public.settings s on s.user_id = m.user_id
    where (p_org is null or m.org_id = p_org)
  loop
    with cl as (
      select l.deal_value, l.deal_date, l.created_at, l.product, l.category, l.outcome, st.type as result
      from public.leads l join public.stages st on st.org_id = l.org_id and st.key = l.stage_key and st.type in ('won', 'lost')
      where l.org_id = r.org_id and l.assigned_to = r.user_id and l.deleted_at is null
    )
    select count(*) filter (where result = 'won'), count(*) filter (where result = 'lost'),
           coalesce(avg(deal_value) filter (where result = 'won' and deal_value > 0), 0),
           avg(deal_date - created_at::date) filter (where result = 'won' and deal_date is not null and deal_date >= created_at::date)
      into v_won, v_lost, v_avg, v_days from cl;

    if coalesce(v_won, 0) + coalesce(v_lost, 0) = 0 then
      delete from public.member_memory where org_id = r.org_id and user_id = r.user_id;
      continue;
    end if;

    select string_agg(p || ' (' || c || ')', ', ') into v_prod from (
      select coalesce(nullif(trim(l.product), ''), nullif(trim(l.category), '')) p, count(*) c
      from public.leads l join public.stages st on st.org_id = l.org_id and st.key = l.stage_key and st.type = 'won'
      where l.org_id = r.org_id and l.assigned_to = r.user_id and l.deleted_at is null
      group by 1 having coalesce(nullif(trim(l.product), ''), nullif(trim(l.category), '')) is not null order by 2 desc limit 3) x;
    select string_agg(rs || ' (' || c || ')', ', ') into v_win from (
      select l.outcome->>'reason_category' rs, count(*) c
      from public.leads l join public.stages st on st.org_id = l.org_id and st.key = l.stage_key and st.type = 'won'
      where l.org_id = r.org_id and l.assigned_to = r.user_id and l.deleted_at is null and coalesce(l.outcome->>'reason_category', '') <> ''
      group by 1 order by 2 desc limit 3) x;
    select string_agg(rs || ' (' || c || ')', ', ') into v_loss from (
      select l.outcome->>'reason_category' rs, count(*) c
      from public.leads l join public.stages st on st.org_id = l.org_id and st.key = l.stage_key and st.type = 'lost'
      where l.org_id = r.org_id and l.assigned_to = r.user_id and l.deleted_at is null and coalesce(l.outcome->>'reason_category', '') <> ''
      group by 1 order by 2 desc limit 3) x;

    v_sum := r.nama || ': ' || v_won || ' menang dan ' || v_lost || ' kalah dari deal tertutup'
      || ' (menang ' || round(100.0 * v_won / (v_won + v_lost)) || '%)'
      || case when v_won + v_lost < 5 then ', sampel masih kecil' else '' end || '.'
      || case when v_avg > 0 then ' Rata-rata nilai deal menang Rp' || replace(to_char(round(v_avg), 'FM999,999,999,999,999'), ',', '.') || '.' else '' end
      || case when v_days is not null then ' Rata-rata ' || round(v_days) || ' hari dari lead masuk sampai deal.' else '' end
      || case when v_prod is not null then ' Paling sering menang di: ' || v_prod || '.' else '' end
      || case when v_win is not null then ' Alasan menang tersering: ' || v_win || '.' else '' end
      || case when v_loss is not null then ' Alasan kalah tersering: ' || v_loss || '.' else '' end;

    insert into public.member_memory (org_id, user_id, stats, summary, based_on_closed, updated_at)
    values (r.org_id, r.user_id,
            jsonb_build_object('won', v_won, 'lost', v_lost, 'avg_won_value', round(v_avg), 'avg_days_to_deal', round(v_days), 'top_products', v_prod, 'win_reasons', v_win, 'loss_reasons', v_loss),
            v_sum, v_won + v_lost, now())
    on conflict (org_id, user_id) do update set stats = excluded.stats, summary = excluded.summary, based_on_closed = excluded.based_on_closed, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Konteks memori siap pakai untuk prompt AI (hanya dipanggil fungsi edge dengan service role).
-- p_lead (opsional) menambahkan kasus serupa yang sudah tertutup di organisasi yang sama.
create or replace function public.build_memory_context(p_org uuid, p_user uuid default null, p_lead uuid default null)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  parts text[] := array[]::text[];
  cat record;
  om record;
  mm text;
  lead_row record;
  sim text;
  prods text;
  objs text;
begin
  select company_profile, products into cat from public.org_product_catalog where org_id = p_org;
  if found then
    select string_agg(coalesce(p->>'name', '') || case when coalesce(p->>'fit_for', '') <> '' then ' (cocok untuk: ' || (p->>'fit_for') || ')' else '' end, '; ')
      into prods from (select p from jsonb_array_elements(case when jsonb_typeof(cat.products) = 'array' then cat.products else '[]'::jsonb end) p limit 8) q
      where coalesce(p->>'name', '') <> '';
    if coalesce(cat.company_profile, '') <> '' or prods is not null then
      parts := parts || ('PROFIL PERUSAHAAN KITA: ' || coalesce(left(cat.company_profile, 500), '') || case when prods is not null then ' Produk: ' || prods || '.' else '' end);
    end if;
  end if;

  select ideal_customer_profile, common_objections, winning_playbook into om from public.org_memory where org_id = p_org;
  if found then
    select string_agg('"' || coalesce(o->>'objection', '') || '" -> ' || coalesce(o->>'how_to_handle', ''), '; ') into objs
      from jsonb_array_elements(case when jsonb_typeof(om.common_objections) = 'array' then om.common_objections else '[]'::jsonb end) o;
    parts := parts || ('POLA ORGANISASI: ' || coalesce(left(om.ideal_customer_profile, 300), '')
      || case when objs is not null then ' Keberatan yang sering muncul dan cara menanganinya: ' || left(objs, 500) || '.' else '' end
      || case when jsonb_typeof(om.winning_playbook) = 'array' and jsonb_array_length(om.winning_playbook) > 0 then ' Taktik yang terbukti berhasil: ' || left((select string_agg(x, '; ') from jsonb_array_elements_text(om.winning_playbook) x), 500) || '.' else '' end);
  end if;

  if p_user is not null then
    select summary into mm from public.member_memory where org_id = p_org and user_id = p_user;
    if mm is not null and mm <> '' then parts := parts || ('MEMORI PRIBADI SALES INI: ' || mm); end if;
  end if;

  if p_lead is not null then
    select product, category into lead_row from public.leads where id = p_lead and org_id = p_org;
    if found then
      select string_agg(t, E'\n') into sim from (
        select '- ' || l.name || ' (' || case when st.type = 'won' then 'menang' else 'kalah' end || ')'
               || coalesce(' alasan: ' || nullif(left(coalesce(l.outcome->>'reason', ''), 160), ''), coalesce(' alasan: ' || nullif(l.outcome->>'reason_category', ''), '')) as t
        from public.leads l join public.stages st on st.org_id = l.org_id and st.key = l.stage_key and st.type in ('won', 'lost')
        where l.org_id = p_org and l.id <> p_lead and l.deleted_at is null
          and l.outcome is not null
          and ((coalesce(trim(lead_row.product), '') <> '' and lower(l.product) = lower(lead_row.product))
            or (coalesce(trim(lead_row.category), '') <> '' and lower(l.category) = lower(lead_row.category)))
        order by (lower(l.product) = lower(coalesce(lead_row.product, '#'))) desc, l.updated_at desc limit 3) z;
      if sim is not null then parts := parts || ('KASUS SERUPA YANG SUDAH TERTUTUP DI ORGANISASI INI:' || E'\n' || sim); end if;
    end if;
  end if;

  if array_length(parts, 1) is null then return ''; end if;
  return left(array_to_string(parts, E'\n'), 2400);
end;
$$;

revoke all on function public.refresh_member_memory(uuid) from public, anon, authenticated;
revoke all on function public.build_memory_context(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.refresh_member_memory(uuid) to service_role;
grant execute on function public.build_memory_context(uuid, uuid, uuid) to service_role;
