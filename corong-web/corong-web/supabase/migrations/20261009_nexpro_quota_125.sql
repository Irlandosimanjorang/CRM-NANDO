-- Batas NEX Pro untuk paket Professional dan Enterprise turun dari 150 ke 125 per bulan (9 Okt 2026, permintaan Nando).
-- Batas yang sebenarnya dipaksa edge function quick-progress-note (QUOTA_PROFESSIONAL = 125). Migrasi ini hanya menyamakan
-- angka di laporan pemakaian admin (admin_ai_usage_report), yang menyimpan batas per paket di dalam fungsinya.
do $$
declare
  def text;
  patched text;
begin
  def := pg_get_functiondef('public.admin_ai_usage_report()'::regprocedure);
  patched := replace(def, '(''quick-progress-note'', ''NEX Pro'', 25, 150, 150, 275,', '(''quick-progress-note'', ''NEX Pro'', 25, 125, 125, 275,');
  if patched = def then
    raise notice 'admin_ai_usage_report sudah memakai 125 atau barisnya berubah; tidak ada yang diganti';
  else
    execute patched;
  end if;
end $$;
