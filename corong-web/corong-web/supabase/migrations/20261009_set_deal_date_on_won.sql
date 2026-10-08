-- Tanggal deal otomatis (9 Okt 2026): untuk organisasi dengan saklar monthly_report (laporan bulanan sales),
-- lead yang masuk ke tahap bertipe "menang" tanpa tanggal deal diberi tanggal hari ini (WIB), supaya kalender
-- dan omzet di tab Laporan terisi dari kerja tim tanpa perlu mengisi tanggal manual. Hanya saat lead
-- dibuat atau tahapnya berubah; lead lama yang sekadar diedit tidak disentuh.
create or replace function public.set_deal_date_on_won()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.deal_date is null and (tg_op = 'INSERT' or new.stage_key is distinct from old.stage_key) then
    if exists (select 1 from public.organizations o where o.id = new.org_id and o.features @> '{"monthly_report": true}'::jsonb)
       and exists (select 1 from public.stages s where s.org_id = new.org_id and s.key = new.stage_key and s.type = 'won') then
      new.deal_date := (now() at time zone 'Asia/Jakarta')::date;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.set_deal_date_on_won() from public, anon, authenticated;
drop trigger if exists trg_set_deal_date_on_won on public.leads;
create trigger trg_set_deal_date_on_won before insert or update of stage_key on public.leads
  for each row execute function public.set_deal_date_on_won();
