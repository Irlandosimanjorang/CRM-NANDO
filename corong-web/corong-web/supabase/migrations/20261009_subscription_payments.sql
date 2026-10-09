-- Buku pembayaran langganan Standard/Professional/Enterprise yang masuk lewat Mayar (9 Okt 2026,
-- permintaan Nando: "lu tau siapa yang bayar ... harus bisa hitung dan catat dengan baik").
-- Sebelumnya pembayaran Mayar hanya mengubah settings.plan + plan_expires_at, nominal dan tanggal
-- bayarnya tidak tersimpan. Mulai sekarang mayar-webhook mencatat satu baris per pembayaran sukses.
-- Tanpa policy RLS: hanya service role (mayar-webhook, admin-cashflow) yang bisa membaca/menulis.
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,                 -- id event Mayar (mencegah catat ganda saat Mayar retry)
  email text not null,
  user_id uuid,                         -- null bila akun belum ada saat bayar (pembayaran pending)
  tier text not null check (tier in ('standard', 'premium', 'enterprise')),
  amount numeric not null,              -- nominal yang dibayar (Rp)
  months int not null default 1,        -- durasi yang dibeli
  paid_at timestamptz not null default now(),
  source text not null default 'mayar', -- mayar | backfill (perkiraan untuk pembayaran sebelum pencatatan ada)
  note text,
  created_at timestamptz not null default now()
);
create index if not exists subscription_payments_paid_at_idx on public.subscription_payments (paid_at desc);
create index if not exists subscription_payments_user_idx on public.subscription_payments (user_id);
alter table public.subscription_payments enable row level security;
revoke all on public.subscription_payments from anon, authenticated;
