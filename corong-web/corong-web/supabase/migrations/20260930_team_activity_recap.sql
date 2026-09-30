-- Tab "Tim" (30 Sep 2026): riwayat perpindahan tahap lead + RPC rekap
-- aktivitas tim khusus owner/manager Enterprise.
-- Sudah diterapkan ke project cewggulyfshnbebcpyui via migration
-- "team_activity_recap". Dokumentasi lokal - definisi lengkap fungsi
-- get_team_activity ada di database (pg_get_functiondef).
create table public.lead_stage_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  lead_name text not null default '',
  from_stage text,
  to_stage text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
-- + index (org_id, changed_at), lead_id, changed_by; RLS select owner/manager;
-- trigger trg_log_lead_stage_change (after update of stage_key on leads);
-- function get_team_activity(p_from, p_to) security definer, cek role &
-- plan enterprise, balikin { members, feed }.
