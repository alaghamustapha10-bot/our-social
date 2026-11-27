-- LOLZ professional expansion: cloud text drafts and background-call preference.
begin;

alter table public.lolz_account_settings
  add column if not exists background_calls_enabled boolean not null default false;

create table if not exists public.lolz_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_type text not null default 'post'
    check (draft_type in ('post', 'story', 'video')),
  title text not null default '',
  content text not null default '',
  audience text not null default 'everyone'
    check (audience in ('everyone', 'close_friends')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists lolz_drafts_user_updated_idx
  on public.lolz_drafts(user_id, updated_at desc);

alter table public.lolz_drafts enable row level security;

drop policy if exists "LOLZ users manage their own drafts" on public.lolz_drafts;
create policy "LOLZ users manage their own drafts"
  on public.lolz_drafts
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.lolz_drafts to authenticated;

commit;
