-- 25 Okt 2026: ekspor lead ke Google Sheet (Enterprise, peran sales rep). Scope drive.file.
-- Token disimpan tanpa policy: hanya service role (edge function) yang bisa membacanya, client tidak.
create table if not exists public.google_sheets_links (
  user_id uuid primary key,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.google_sheets_links enable row level security;

create table if not exists public.google_sheets_oauth_states (
  state text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.google_sheets_oauth_states enable row level security;
