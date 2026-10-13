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
