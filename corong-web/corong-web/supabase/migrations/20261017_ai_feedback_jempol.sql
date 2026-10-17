-- 17 Okt 2026: penilaian jempol like/dislike per user untuk hasil AI (digest Advisor, draft follow-up, ringkasan kebutuhan).
-- Tiap user hanya bisa menulis dan membaca penilaiannya sendiri. Owner/manager org bisa membaca semua penilaian di org-nya.
-- Sudah diterapkan ke database lewat MCP.

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  ref_key text not null,
  rating smallint not null check (rating in (1, -1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature, ref_key)
);

create index if not exists ai_feedback_org_feature_idx on public.ai_feedback (org_id, feature);

alter table public.ai_feedback enable row level security;

create policy ai_feedback_select on public.ai_feedback for select
  using (user_id = (select auth.uid()) or (org_id in (select my_org_ids()) and my_role() in ('owner', 'manager')));

create policy ai_feedback_insert on public.ai_feedback for insert
  with check (user_id = (select auth.uid()) and org_id in (select my_org_ids()));

create policy ai_feedback_update on public.ai_feedback for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy ai_feedback_delete on public.ai_feedback for delete
  using (user_id = (select auth.uid()));
