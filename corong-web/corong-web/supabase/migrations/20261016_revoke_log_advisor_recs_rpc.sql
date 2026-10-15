-- Audit keamanan (16 Okt 2026): log_advisor_recs() hanya dipakai sebagai trigger pada advisor_runs.
-- Hak eksekusi RPC dicabut dari anon dan authenticated supaya tidak bisa dipanggil langsung lewat API.
revoke execute on function public.log_advisor_recs() from anon, authenticated, public;
