-- Chat masuk dari iklan / sosmed (9 Okt 2026), tahap 1: penerima webhook Cekat.ai.
-- Pesan dari WhatsApp, Instagram, Messenger, TikTok DM yang dikumpulkan Cekat dikirim ke fungsi chat-webhook.
-- Kontak baru otomatis menjadi lead (dibagi ke marketing), dan seluruh percakapan tersimpan di lead.
-- Aktif per organisasi lewat saklar organizations.features.lead_webhook (diatur admin di FITUR KLIEN).
-- Penulisan hanya oleh fungsi chat-webhook (service role); pengguna hanya membaca sesuai akses lead.

alter table public.leads add column if not exists ad_campaign text not null default '';

-- Saluran = satu alamat webhook per organisasi (kunci rahasia ada di URL-nya).
create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'cekat' check (provider in ('cekat')),
  secret text not null unique,
  active boolean not null default true,
  auto_assign boolean not null default true,
  created_at timestamptz not null default now(),
  last_event_at timestamptz,
  unique (org_id, provider)
);
alter table public.chat_channels enable row level security;
drop policy if exists chat_channels_owner on public.chat_channels;
create policy chat_channels_owner on public.chat_channels for all to authenticated
  using (exists (select 1 from public.organizations o where o.id = chat_channels.org_id and o.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.organizations o where o.id = chat_channels.org_id and o.owner_user_id = (select auth.uid())));

-- Percakapan: satu per kontak per organisasi.
create table if not exists public.lead_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  channel_id uuid references public.chat_channels(id) on delete set null,
  platform text not null default '',
  contact_key text not null,
  contact_name text not null default '',
  contact_phone text not null default '',
  campaign text not null default '',
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  unique (org_id, contact_key)
);
create index if not exists lead_conversations_lead_idx on public.lead_conversations (lead_id);
create index if not exists lead_conversations_org_msg_idx on public.lead_conversations (org_id, last_message_at desc);
alter table public.lead_conversations enable row level security;
drop policy if exists lead_conversations_select on public.lead_conversations;
create policy lead_conversations_select on public.lead_conversations for select to authenticated
  using (
    org_id in (select public.my_org_ids())
    and (public.my_role() in ('owner', 'manager') or lead_id in (select l.id from public.leads l where l.assigned_to = (select auth.uid())))
  );

create table if not exists public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  conversation_id uuid not null references public.lead_conversations(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  body text not null default '',
  media_url text not null default '',
  sender_name text not null default '',
  external_id text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists lead_messages_ext_uniq on public.lead_messages (conversation_id, external_id) where external_id is not null;
create index if not exists lead_messages_conv_idx on public.lead_messages (conversation_id, sent_at);
create index if not exists lead_messages_lead_idx on public.lead_messages (lead_id, sent_at);
alter table public.lead_messages enable row level security;
drop policy if exists lead_messages_select on public.lead_messages;
create policy lead_messages_select on public.lead_messages for select to authenticated
  using (
    org_id in (select public.my_org_ids())
    and (public.my_role() in ('owner', 'manager') or lead_id in (select l.id from public.leads l where l.assigned_to = (select auth.uid())))
  );

-- Catatan webhook yang masuk (untuk melihat apakah koneksi berhasil dan menyesuaikan pembacaan data).
create table if not exists public.chat_webhook_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  channel_id uuid references public.chat_channels(id) on delete cascade,
  received_at timestamptz not null default now(),
  event text not null default '',
  ok boolean not null default true,
  note text not null default '',
  payload jsonb
);
create index if not exists chat_webhook_log_org_idx on public.chat_webhook_log (org_id, received_at desc);
alter table public.chat_webhook_log enable row level security;
drop policy if exists chat_webhook_log_owner on public.chat_webhook_log;
create policy chat_webhook_log_owner on public.chat_webhook_log for select to authenticated
  using (exists (select 1 from public.organizations o where o.id = chat_webhook_log.org_id and o.owner_user_id = (select auth.uid())));

-- Owner membuat (atau membuat ulang) kunci webhook organisasinya. Hanya bila saklar lead_webhook menyala.
create or replace function public.ensure_chat_channel(p_rotate boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org uuid;
  v_ch public.chat_channels;
begin
  select o.id into v_org from public.organizations o
  where o.owner_user_id = auth.uid() and o.features @> '{"lead_webhook": true}'::jsonb
  order by o.created_at limit 1;
  if v_org is null then
    raise exception 'Fitur chat masuk belum diaktifkan untuk organisasi Anda. Hubungi admin Nexto.';
  end if;
  select * into v_ch from public.chat_channels where org_id = v_org and provider = 'cekat';
  if not found then
    insert into public.chat_channels (org_id, secret)
    values (v_org, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
    returning * into v_ch;
  elsif p_rotate then
    update public.chat_channels set secret = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    where id = v_ch.id returning * into v_ch;
  end if;
  return jsonb_build_object('id', v_ch.id, 'secret', v_ch.secret, 'active', v_ch.active, 'auto_assign', v_ch.auto_assign, 'last_event_at', v_ch.last_event_at);
end;
$$;
revoke all on function public.ensure_chat_channel(boolean) from public, anon;
grant execute on function public.ensure_chat_channel(boolean) to authenticated;
