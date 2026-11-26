-- LOLZ push notification delivery foundation
-- This migration stores each signed-in device's FCM token and adds safe metadata
-- to the existing in-app notifications table. FCM credentials never belong here.

begin;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  language text not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_tokens
  add column if not exists platform text not null default 'android',
  add column if not exists language text not null default 'ar',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- A token belongs to one current account on a device. Keep the most recently
-- updated row if an older database contains duplicates before adding uniqueness.
with ranked_tokens as (
  select
    ctid,
    row_number() over (
      partition by token
      order by updated_at desc nulls last, created_at desc nulls last, ctid desc
    ) as row_number
  from public.push_tokens
)
delete from public.push_tokens p
using ranked_tokens r
where p.ctid = r.ctid
  and r.row_number > 1;

create unique index if not exists push_tokens_token_unique
  on public.push_tokens(token);

create index if not exists push_tokens_user_updated_idx
  on public.push_tokens(user_id, updated_at desc);

alter table public.push_tokens enable row level security;

drop policy if exists "LOLZ users manage their own push tokens" on public.push_tokens;
create policy "LOLZ users manage their own push tokens"
  on public.push_tokens
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_tokens to authenticated;

-- Notification metadata carries the destination needed when a user taps a push.
alter table public.notifications
  add column if not exists data jsonb not null default '{}'::jsonb;

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);

-- Keep the notifications table available to the app's realtime inbox when the
-- default Supabase Realtime publication exists.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;

commit;
