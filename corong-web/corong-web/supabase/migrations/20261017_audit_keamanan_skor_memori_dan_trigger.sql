-- 17 Okt 2026 (hasil audit): dua perbaikan keamanan.
-- 1. memory_quality_score(org) hanya bisa dibaca anggota org itu. Cron (tanpa user login) tetap boleh.
--    Isi perhitungannya dipindah ke memory_quality_score_core, yang tidak bisa dipanggil user login.
-- 2. deal_manual_isi_nilai_lead adalah fungsi trigger, tidak perlu dan tidak boleh dipanggil lewat RPC.
-- Sudah diterapkan ke database lewat MCP dan diuji (anggota org sendiri OK, org lain ditolak, cron OK, trigger OK).

alter function public.memory_quality_score(uuid) rename to memory_quality_score_core;
revoke execute on function public.memory_quality_score_core(uuid) from public, anon, authenticated;

create or replace function public.memory_quality_score(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is not null and not exists (select 1 from organization_members m where m.user_id = auth.uid() and m.org_id = p_org) then
    raise exception 'Akses ditolak';
  end if;
  return public.memory_quality_score_core(p_org);
end;
$function$;

revoke execute on function public.memory_quality_score(uuid) from public, anon;
grant execute on function public.memory_quality_score(uuid) to authenticated;

revoke execute on function public.deal_manual_isi_nilai_lead() from public, anon, authenticated;
