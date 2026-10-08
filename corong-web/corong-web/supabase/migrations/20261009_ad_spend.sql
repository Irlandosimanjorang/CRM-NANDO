-- Data biaya iklan per platform (9 Okt 2026, permintaan BSB): diimpor dari ekspor Meta / TikTok /
-- Google Ads Manager (Excel atau CSV) lalu dianalisis di tab Laporan bersama lead per sumber.
-- Satu baris = satu platform + kampanye + tanggal. Impor ulang file yang sama memperbarui baris
-- yang sama (unique), jadi tidak menggandakan angka.
-- Anggota organisasi boleh membaca; hanya owner dan manager yang boleh mengimpor atau menghapus.
create table if not exists public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null check (char_length(platform) between 1 and 40),
  campaign text not null default '' check (char_length(campaign) <= 200),
  day date not null,
  spend numeric(16, 2) not null default 0 check (spend >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  results bigint not null default 0 check (results >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, platform, campaign, day)
);
create index if not exists ad_spend_org_day_idx on public.ad_spend (org_id, day);
alter table public.ad_spend enable row level security;

drop policy if exists ad_spend_select on public.ad_spend;
create policy ad_spend_select on public.ad_spend for select to authenticated
  using (org_id in (select public.my_member_org_ids()));

drop policy if exists ad_spend_write on public.ad_spend;
create policy ad_spend_write on public.ad_spend for all to authenticated
  using (
    exists (select 1 from public.organizations o where o.id = ad_spend.org_id and o.owner_user_id = (select auth.uid()))
    or exists (select 1 from public.organization_members m where m.org_id = ad_spend.org_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager'))
  )
  with check (
    exists (select 1 from public.organizations o where o.id = ad_spend.org_id and o.owner_user_id = (select auth.uid()))
    or exists (select 1 from public.organization_members m where m.org_id = ad_spend.org_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager'))
  );
