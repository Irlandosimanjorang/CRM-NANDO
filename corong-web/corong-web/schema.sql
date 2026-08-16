-- ============================================================
-- Corong CRM — Supabase schema
-- Jalankan seluruh file ini di Supabase → SQL Editor → New query → Run.
-- Aman dijalankan ulang (pakai IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- ---------- helper: auto update updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- LEADS (perusahaan / prospek)
-- ============================================================
create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  category          text,
  stage_key         text,                         -- referensi ke stages.key (editable, jadi disimpan sbg text)
  company_type      text default '',              -- '', 'Manufacturer', 'Trader', 'Both'
  email             text default '',
  phone             text default '',
  key_person        text default '',
  key_person_title  text default '',
  product           text default '',
  city              text default '',
  province          text default '',
  website           text default '',
  sales_owner       text default '',
  background        text default '',
  chemical          text default '',
  priority          text default '',              -- '', 'high', 'medium', 'low'
  next_action       text default '',
  visit_date        date,
  visit_meet        text default '',
  visit_agenda      text default '',
  deal_date         date,
  deal_value        numeric default 0,
  tonnage           numeric default 0,
  last_contact      date,
  verified          boolean default false,
  source            text default 'manual',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index if not exists leads_user_idx        on public.leads(user_id);
create index if not exists leads_user_stage_idx  on public.leads(user_id, stage_key);
create index if not exists leads_user_created_idx on public.leads(user_id, created_at desc);

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

-- ============================================================
-- PROGRESS NOTES (progress harian per lead)
-- ============================================================
create table if not exists public.progress_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  lead_id    uuid not null references public.leads(id) on delete cascade,
  note_date  date not null default current_date,
  text       text not null,
  created_at timestamptz default now()
);
create index if not exists progress_lead_idx on public.progress_notes(lead_id, note_date desc);

-- ============================================================
-- COMPETITORS + pemakainya
-- ============================================================
create table if not exists public.competitors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  background text default '',
  product    text default '',
  notes      text default '',
  created_at timestamptz default now()
);
create index if not exists competitors_user_idx on public.competitors(user_id);

create table if not exists public.competitor_usages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  company       text default '',   -- company pemakai
  product       text default '',   -- produk dipakai
  price         text default '',
  quantity      text default ''
);
create index if not exists usages_comp_idx on public.competitor_usages(competitor_id);

-- ============================================================
-- PIPELINE STAGES (bisa di-edit user)
-- ============================================================
create table if not exists public.stages (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  key      text not null,
  label    text not null,
  hex      text not null default '#94a3b8',
  type     text not null default 'normal',  -- normal | won | lost
  position int  not null default 0
);
create index if not exists stages_user_idx on public.stages(user_id, position);

-- ============================================================
-- SETTINGS (1 baris per user) + ADVISOR (hasil analisis AI tersimpan)
-- ============================================================
create table if not exists public.settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  sales_names text[] default '{}',
  updated_at  timestamptz default now()
);

create table if not exists public.advisor_runs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  ran_at     text default '',
  recs       jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — tiap user cuma bisa lihat datanya sendiri
-- ============================================================
alter table public.leads             enable row level security;
alter table public.progress_notes    enable row level security;
alter table public.competitors       enable row level security;
alter table public.competitor_usages enable row level security;
alter table public.stages            enable row level security;
alter table public.settings          enable row level security;
alter table public.advisor_runs      enable row level security;

-- policy generik: user_id = auth.uid()
do $$
declare t text;
begin
  foreach t in array array['leads','progress_notes','competitors','competitor_usages','stages','settings','advisor_runs']
  loop
    execute format('drop policy if exists "own_%1$s" on public.%1$s;', t);
    execute format(
      'create policy "own_%1$s" on public.%1$s
         for all using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;

-- ============================================================
-- SEEDING: saat user baru daftar, isi stages default + settings kosong
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.settings(user_id, sales_names) values (new.id, '{}');
  insert into public.advisor_runs(user_id) values (new.id);
  insert into public.stages(user_id, key, label, hex, type, position) values
    (new.id, 'prospek', 'Prospek', '#94a3b8', 'normal', 0),
    (new.id, 'kontak',  'Kontak',  '#38bdf8', 'normal', 1),
    (new.id, 'nego',    'Nego',    '#f59e0b', 'normal', 2),
    (new.id, 'deal',    'Deal',    '#10b981', 'won',    3),
    (new.id, 'lost',    'Lost',    '#f43f5e', 'lost',   4);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Selesai. Kalau user sudah pernah dibuat sebelum trigger ini ada,
-- jalankan handle_new_user() manual atau tambahkan stages lewat app.
