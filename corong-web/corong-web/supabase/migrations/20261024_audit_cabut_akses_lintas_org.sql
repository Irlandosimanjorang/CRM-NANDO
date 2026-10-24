-- 24 Okt 2026 (audit): fungsi skor org tidak boleh dipanggil user biasa dengan org sembarang.
revoke execute on function public.memory_quality_score(uuid) from public, anon, authenticated;
-- fungsi trigger tidak perlu dipanggil langsung.
revoke execute on function public.leads_track_admin_proyek() from public, anon, authenticated;
