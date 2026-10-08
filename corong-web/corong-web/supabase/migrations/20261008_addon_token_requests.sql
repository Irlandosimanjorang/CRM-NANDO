-- Permintaan token add-on dari pengguna (8 Okt 2026): tombol "Tambah pencarian" di tab Generate Leads.
-- Permintaan masuk ke panel admin (Command Center, kartu TOKEN ADD-ON); admin menyetujui dengan
-- memberi token (status done) atau mengabaikan (dismissed). Satu permintaan menunggu per pengguna.
-- Pengguna hanya bisa membaca permintaannya sendiri dan membuatnya lewat request_addon_tokens.
create table if not exists public.addon_token_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null default 'generate-leads' check (feature in ('generate-leads')),
  tokens int not null check (tokens between 1 and 100),
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index if not exists addon_token_requests_status_idx on public.addon_token_requests (status, created_at desc);
create index if not exists addon_token_requests_user_idx on public.addon_token_requests (user_id, status);
alter table public.addon_token_requests enable row level security;
drop policy if exists addon_token_requests_select_own on public.addon_token_requests;
create policy addon_token_requests_select_own on public.addon_token_requests for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.request_addon_tokens(p_tokens int, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.addon_token_requests;
  v_new public.addon_token_requests;
begin
  if v_uid is null then raise exception 'Belum login'; end if;
  if p_tokens is null or p_tokens < 1 or p_tokens > 100 then raise exception 'Jumlah token harus 1 sampai 100'; end if;
  select * into v_existing from public.addon_token_requests where user_id = v_uid and status = 'pending' order by created_at desc limit 1;
  if v_existing.id is not null then
    return jsonb_build_object('id', v_existing.id, 'tokens', v_existing.tokens, 'created_at', v_existing.created_at, 'already_pending', true);
  end if;
  insert into public.addon_token_requests (user_id, tokens, note) values (v_uid, p_tokens, left(coalesce(p_note, ''), 300)) returning * into v_new;
  return jsonb_build_object('id', v_new.id, 'tokens', v_new.tokens, 'created_at', v_new.created_at, 'already_pending', false);
end;
$$;
revoke all on function public.request_addon_tokens(int, text) from public, anon;
grant execute on function public.request_addon_tokens(int, text) to authenticated;
