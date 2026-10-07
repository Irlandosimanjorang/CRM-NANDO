-- Saklar fitur per organisasi (8 Okt 2026, permintaan Nando). Kolom features
-- berisi {"nama_fitur": true}; fitur yang tidak tercantum dianggap mati.
-- Hanya admin platform (service_role/postgres) yang boleh mengubahnya: owner
-- organisasi punya hak UPDATE pada barisnya (org_update_owner), jadi kolom ini
-- WAJIB masuk daftar yang dijaga trigger di bawah. Trigger tetap SECURITY
-- INVOKER (current_user harus peran pemanggil, lihat catatan 6 Okt 2026).
-- Nilai bawaan konstan: metadata saja, tidak menulis ulang baris.
alter table public.organizations
  add column if not exists features jsonb not null default '{}'::jsonb;

create or replace function public.protect_organizations_privileged_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if current_user <> 'service_role' and current_user <> 'postgres' then
    if new.plan is distinct from old.plan then
      new.plan := old.plan;
    end if;
    if new.member_limit is distinct from old.member_limit then
      new.member_limit := old.member_limit;
    end if;
    if new.plan_expires_at is distinct from old.plan_expires_at then
      new.plan_expires_at := old.plan_expires_at;
    end if;
    if new.plan_expiry_reminder_sent_at is distinct from old.plan_expiry_reminder_sent_at then
      new.plan_expiry_reminder_sent_at := old.plan_expiry_reminder_sent_at;
    end if;
    if new.features is distinct from old.features then
      new.features := old.features;
    end if;
  end if;
  return new;
end;
$function$;
