-- Kuota bulanan mengikuti SIKLUS LANGGANAN (6 Okt 2026, permintaan Nando:
-- opsi 3 - "dihitung sejak pertama kali aktifkan pembayaran"). Satu tanggal
-- reset untuk semua fitur, sama dengan tanggal perpanjangan paket: bayar
-- tanggal 28 -> semua kuota terisi kembali tiap tanggal 28. Paket 3 bulan
-- dibagi 3 periode bulanan.
--
-- Siklus dihitung mundur dari plan_expires_at (Enterprise: milik organisasi;
-- Standard/Professional: milik pengguna). Akun berbayar tanpa tanggal
-- berakhir memakai cadangan lama: 1 bulan sejak pemakaian pertama per fitur
-- (quota_periods).

-- Siklus bulanan yang memuat p_now, dihitung dari tanggal berakhir paket.
-- Paket dari invoice berakhir 23:59:59 WIB (periode inklusif), jadi
-- batasnya dibulatkan ke 00:00 WIB hari berikutnya; paket Mayar berakhir di
-- jam pembayaran dan dipakai apa adanya.
create or replace function public.quota_cycle_from_expiry(p_expires_at timestamptz, p_now timestamptz default now())
returns tstzrange
language plpgsql
stable
as $$
declare
  v_local timestamp := p_expires_at at time zone 'Asia/Jakarta';
  v_now timestamp := p_now at time zone 'Asia/Jakarta';
  v_anchor timestamp;
  k int;
begin
  if p_expires_at is null then
    return null;
  end if;
  -- Hitungan bulan dilakukan dalam jam WIB supaya tanggalnya konsisten; tiap
  -- batas dihitung langsung dari anchor supaya tanggal 31 / Februari tidak
  -- bergeser.
  v_anchor := case when v_local::time >= time '23:59:00' then date_trunc('day', v_local) + interval '1 day' else v_local end;
  if v_now < v_anchor then
    for k in 1..240 loop
      if v_anchor - make_interval(months => k) <= v_now then
        return tstzrange((v_anchor - make_interval(months => k)) at time zone 'Asia/Jakarta', (v_anchor - make_interval(months => k - 1)) at time zone 'Asia/Jakarta');
      end if;
    end loop;
  else
    -- Paket sudah lewat tanggal berakhir tapi belum diturunkan: lanjutkan
    -- siklus dengan tanggal yang sama.
    for k in 0..240 loop
      if v_now < v_anchor + make_interval(months => k + 1) then
        return tstzrange((v_anchor + make_interval(months => k)) at time zone 'Asia/Jakarta', (v_anchor + make_interval(months => k + 1)) at time zone 'Asia/Jakarta');
      end if;
    end loop;
  end if;
  return null;
end;
$$;

-- Siklus langganan pengguna saat ini (null = tidak ada tanggal berakhir).
create or replace function public.quota_plan_cycle(p_user_id uuid)
returns tstzrange
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_exp timestamptz;
begin
  select o.plan_expires_at into v_exp
  from organization_members m join organizations o on o.id = m.org_id
  where m.user_id = p_user_id and o.plan = 'enterprise' and o.plan_expires_at is not null
  order by o.plan_expires_at desc
  limit 1;
  if v_exp is null then
    select s.plan_expires_at into v_exp
    from settings s
    where s.user_id = p_user_id and s.plan in ('standard', 'premium') and s.plan_expires_at is not null;
  end if;
  return quota_cycle_from_expiry(v_exp, now());
end;
$$;

create or replace function public.quota_current_start(p_user_id uuid, p_feature text, p_claim boolean default false)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cycle tstzrange := quota_plan_cycle(p_user_id);
  v_start timestamptz;
begin
  if v_cycle is not null then
    return lower(v_cycle);
  end if;
  -- Cadangan: 1 bulan sejak pemakaian pertama per fitur.
  select period_start into v_start from quota_periods where user_id = p_user_id and feature = p_feature;
  if v_start is not null and now() < v_start + interval '1 month' then
    return v_start;
  end if;
  if not p_claim then
    return null;
  end if;
  insert into quota_periods (user_id, feature, period_start) values (p_user_id, p_feature, now())
  on conflict (user_id, feature) do update set period_start = excluded.period_start;
  return now();
end;
$$;

create or replace function public.quota_usage(p_user_id uuid, p_feature text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cycle tstzrange := quota_plan_cycle(p_user_id);
  v_start timestamptz;
  v_reset timestamptz;
  v_used int := 0;
begin
  if v_cycle is not null then
    v_start := lower(v_cycle);
    v_reset := upper(v_cycle);
  else
    v_start := quota_current_start(p_user_id, p_feature, false);
    v_reset := v_start + interval '1 month';
  end if;
  if v_start is not null then
    if p_feature = 'generate-leads' then
      select count(*) into v_used from lead_gen_runs where user_id = p_user_id and generated_at >= v_start;
    elsif p_feature = 'checkin' then
      select count(*) into v_used from visit_checkins where user_id = p_user_id and checked_in_at >= v_start;
    else
      select count(*) into v_used from edge_function_calls where user_id = p_user_id and function_name = p_feature and called_at >= v_start;
    end if;
  end if;
  return jsonb_build_object('used', v_used, 'period_start', v_start, 'reset_at', v_reset, 'source', case when v_cycle is not null then 'plan' else 'first_use' end);
end;
$$;

revoke all on function public.quota_cycle_from_expiry(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.quota_plan_cycle(uuid) from public, anon, authenticated;
revoke all on function public.quota_current_start(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.quota_usage(uuid, text) from public, anon, authenticated;
