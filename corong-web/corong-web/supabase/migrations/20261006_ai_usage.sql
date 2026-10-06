-- Pencatatan pemakaian AI per panggilan (6 Okt 2026, permintaan Nando: "dari
-- setiap akun ... bisa lihat jumlah pemakaian token termasuk biayanya").
-- Diisi otomatis oleh pencatat di setiap edge function AI (fetch ke Anthropic/
-- OpenAI dicegat, usage dari respons disimpan). Hanya service role yang
-- menulis & membaca; laporan dibaca Command Center lewat admin-status.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  org_id uuid,
  feature text not null,
  provider text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  web_searches integer not null default 0,
  web_fetches integer not null default 0,
  audio_seconds integer not null default 0,
  tts_chars integer not null default 0,
  cost_usd numeric(12, 6) not null default 0
);
create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at);
create index if not exists ai_usage_created_idx on public.ai_usage (created_at);
alter table public.ai_usage enable row level security;
