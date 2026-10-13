-- Pencatat email outreach (13 Okt 2026): satu baris per alamat yang pernah dikirimi, dipakai fungsi send-outreach
-- (hanya admin platform lewat Command Center) agar tidak mengirim dua kali dan menghormati daftar berhenti.
create table if not exists public.outreach_log (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nama text not null default '',
  perusahaan text not null default '',
  status text not null check (status in ('sent', 'failed', 'unsubscribed')),
  error text,
  resend_id text,
  created_at timestamptz not null default now(),
  constraint outreach_log_email_lower check (email = lower(email)),
  constraint outreach_log_email_key unique (email)
);
create index if not exists outreach_log_created_idx on public.outreach_log (created_at desc);
alter table public.outreach_log enable row level security;
revoke all on public.outreach_log from anon, authenticated;

-- Antrean prospek outreach (13 Okt 2026): perusahaan hasil riset yang akan dikirimi email perkenalan lewat kartu EMAIL OUTREACH.
create table if not exists public.outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  perusahaan text not null,
  segmen text not null check (segmen in ('kecil', 'menengah', 'besar')),
  industri text not null default '',
  kota text not null default '',
  nama_kontak text not null default '',
  email text not null,
  sumber_url text not null default '',
  status text not null default 'queued' check (status in ('queued', 'sent', 'removed', 'failed')),
  catatan text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint outreach_prospects_email_lower check (email = lower(email)),
  constraint outreach_prospects_email_key unique (email)
);
create index if not exists outreach_prospects_status_idx on public.outreach_prospects (status, created_at);
alter table public.outreach_prospects enable row level security;
revoke all on public.outreach_prospects from anon, authenticated;
