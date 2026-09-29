-- Tabel penyimpan hasil "Ringkasan Kebutuhan (AI)" per lead - AI baca semua
-- catatan progress/notulen 1 lead, nyimpulin kebutuhan klien konkret + sinyal
-- budget/urgency. Diisi dari edge function summarize-lead-needs.
--
-- Sudah diterapkan langsung ke project Supabase (cewggulyfshnbebcpyui) via
-- migration "create_lead_needs_summaries" pada 29 Sep 2026. File ini
-- dokumentasi lokal aja (lihat catatan di 20260929_add_org_dashboard_stats_rpc.sql).

create table if not exists public.lead_needs_summaries (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  summary text not null,
  needs jsonb not null default '[]'::jsonb,
  budget_signal text,
  urgency text,
  based_on_notes_count int not null default 0,
  generated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (lead_id)
);

alter table public.lead_needs_summaries enable row level security;

create policy lead_needs_summaries_org_access on public.lead_needs_summaries
  for all
  using (org_id in (select organization_members.org_id from organization_members where organization_members.user_id = (select auth.uid())));
