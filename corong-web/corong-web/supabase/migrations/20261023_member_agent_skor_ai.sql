-- 23 Okt 2026: skor AI berdampingan dengan skor rumus. Disimpan di member_agent_context, belum ditampilkan ke user.
-- Skor rumus (member_memory_health) tidak diubah.
alter table public.member_agent_context add column if not exists ai_score integer;
alter table public.member_agent_context add column if not exists ai_reason text not null default '';
