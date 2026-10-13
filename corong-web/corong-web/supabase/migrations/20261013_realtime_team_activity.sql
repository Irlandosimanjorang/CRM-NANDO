-- Aktivitas tim (lead, pindah tahap, deal, catatan progres) dikirim realtime ke owner dan manager (13 Okt 2026),
-- supaya Dashboard, Report, dan Team ikut berubah begitu sales rep menyimpan perubahan. Akses baca tetap lewat RLS.
alter publication supabase_realtime add table public.leads, public.lead_stage_changes, public.deal_transactions, public.progress_notes;
