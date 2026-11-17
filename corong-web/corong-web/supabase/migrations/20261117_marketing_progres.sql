-- Progres deal untuk marketing (17 Nov 2026). Sudah diterapkan ke produksi lewat apply_migration.
-- Journey mengirim progres (tahap, termin, pembayaran) ke sini setiap ada perubahan, lewat journey_progres_upsert.
-- Marketing melihat deal miliknya (assigned_to), owner dan manager melihat semua, lewat RLS.
-- Secret pengirim: vault "journey_progres_secret" (nilainya sama dengan vault journey, tidak disimpan di repo).

create table if not exists public.marketing_progres (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  org_id uuid,
  assigned_to uuid,
  payload jsonb not null default '{}'::jsonb,
  sumber_waktu timestamptz not null,
  diterima_at timestamptz not null default now()
);

alter table public.marketing_progres enable row level security;
revoke all on public.marketing_progres from anon, authenticated;
grant select on public.marketing_progres to authenticated;

-- Dibuka untuk organisasi BSB saja (PT. Bangun Selaras Bersama). Marketing melihat deal miliknya, owner dan manager melihat semua.
drop policy if exists marketing_progres_select on public.marketing_progres;
create policy marketing_progres_select on public.marketing_progres for select to authenticated
  using (
    org_id = '43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0'::uuid
    and org_id in (select my_org_ids())
    and (assigned_to = auth.uid() or my_role() in ('owner', 'manager'))
  );

create or replace function public.journey_progres_upsert(p_secret text, p_lead_id uuid, p_payload jsonb, p_waktu timestamptz)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  expected text;
  v_lead public.leads%rowtype;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'journey_progres_secret';
  if expected is null or p_secret is distinct from expected then raise exception 'unauthorized'; end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found or v_lead.deleted_at is not null or coalesce(p_payload->>'dihapus', 'false') = 'true' then
    delete from public.marketing_progres where lead_id = p_lead_id and sumber_waktu <= p_waktu;
    return;
  end if;

  insert into public.marketing_progres (lead_id, org_id, assigned_to, payload, sumber_waktu, diterima_at)
  values (v_lead.id, v_lead.org_id, v_lead.assigned_to, p_payload, p_waktu, now())
  on conflict (lead_id) do update
    set payload = excluded.payload,
        sumber_waktu = excluded.sumber_waktu,
        assigned_to = excluded.assigned_to,
        org_id = excluded.org_id,
        diterima_at = now()
    where public.marketing_progres.sumber_waktu <= excluded.sumber_waktu;
end;
$$;

revoke all on function public.journey_progres_upsert(text, uuid, jsonb, timestamptz) from public;
grant execute on function public.journey_progres_upsert(text, uuid, jsonb, timestamptz) to anon, service_role;
