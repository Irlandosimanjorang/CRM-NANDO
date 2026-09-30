-- Tab "Tim" lanjutan (30 Sep 2026, permintaan Nando):
-- 1. team_activity_log + trigger: hapus/pulihin lead, edit data lead (No HP,
--    email, PIC, dst - dari -> ke), jadwal/batal visit, input deal, draft AI,
--    Ringkasan Kebutuhan. Email terkirim kebaca dari progress note "📧 Email
--    terkirim ...".
-- 2. team_activity_events(org, from, to): semua event tim dalam 1 bentuk.
-- 3. get_team_feed(from, to, limit) & get_team_activity_days(days): timeline
--    7 hari yang bisa diklik per tanggal (kalender WIB).
-- Akses dicek team_activity_org(): cuma owner/manager org Enterprise.
--
-- Sudah diterapkan ke project cewggulyfshnbebcpyui via migration
-- "team_activity_log_and_days". Dokumentasi lokal - definisi lengkap fungsi &
-- trigger ada di database (pg_get_functiondef).
create table public.team_activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid,
  kind text not null,
  lead_id uuid,
  lead_name text not null default '',
  detail text,
  at timestamptz not null default now()
);
-- + index (org_id, at), user_id; RLS select owner/manager;
-- trigger trg_log_lead_activity (after update or delete on leads),
-- trg_log_deal_activity, trg_log_ai_draft_activity, trg_log_needs_summary_activity.
