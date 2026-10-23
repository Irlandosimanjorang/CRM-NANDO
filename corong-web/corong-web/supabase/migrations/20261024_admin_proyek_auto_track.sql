-- 24 Okt 2026: lead yang diinput admin proyek otomatis berjalur 'proyek', tanpa perlu mengubah form.
create or replace function public.leads_track_admin_proyek()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if public.my_role() = 'admin_proyek' then
    new.track := 'proyek';
  end if;
  return new;
end;
$$;

drop trigger if exists leads_track_admin_proyek on public.leads;
create trigger leads_track_admin_proyek before insert on public.leads
  for each row execute function public.leads_track_admin_proyek();
