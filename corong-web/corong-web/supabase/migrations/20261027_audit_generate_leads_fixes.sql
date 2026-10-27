-- Audit Generate Leads (27 Okt 2026). Sudah diterapkan ke project cewggulyfshnbebcpyui lewat apply_migration.

-- 1) Pemicu enrichment hanya untuk cron (postgres). Sebelumnya bisa dipanggil anon/authenticated lewat RPC.
revoke execute on function public.dispatch_pending_enrichment() from public, anon, authenticated;

-- 2) Penaut slot kuota ke job, supaya slot bisa dikembalikan kalau proses mati di tengah jalan.
alter table public.lead_gen_jobs add column if not exists reserved_run_id uuid;

-- 3) Sapu job yang macet (running > 10 menit: kena batas 150 detik) dan lead enrich yang nyangkut pending > 30 menit.
create or replace function public.sweep_stuck_lead_gen()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select id, reserved_run_id from public.lead_gen_jobs
    where status = 'running' and created_at < now() - interval '10 minutes'
  loop
    if r.reserved_run_id is not null then
      perform public.release_lead_gen_slot(r.reserved_run_id);
    end if;
    update public.lead_gen_jobs
       set status = 'failed',
           error_message = 'Proses berhenti di server sebelum selesai. Kuota dikembalikan, silakan coba lagi.',
           updated_at = now()
     where id = r.id and status = 'running';
    v_n := v_n + 1;
  end loop;

  update public.generated_leads
     set enrich_status = 'failed'
   where enrich_status = 'pending'
     and coalesce(enrich_started_at, created_at) < now() - interval '30 minutes';

  return v_n;
end;
$$;

revoke execute on function public.sweep_stuck_lead_gen() from public, anon, authenticated;

select cron.schedule('nexto-lead-gen-sweep', '*/5 * * * *', $$select public.sweep_stuck_lead_gen()$$);

-- 4) Satu pencarian berjalan per pengguna. Klik Generate dobel tidak lagi membuat job & kuota kedua.
create unique index if not exists lead_gen_jobs_one_running_per_user
  on public.lead_gen_jobs (created_by)
  where status = 'running';
