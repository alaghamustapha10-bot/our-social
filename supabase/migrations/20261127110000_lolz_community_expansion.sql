-- LOLZ community expansion: close friends, privacy controls, richer chat and group activities
begin;

create table if not exists public.lolz_account_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_visibility text not null default 'public' check (profile_visibility in ('public','private')),
  allow_messages_from text not null default 'everyone' check (allow_messages_from in ('everyone','following','nobody')),
  allow_comments_from text not null default 'everyone' check (allow_comments_from in ('everyone','following','nobody')),
  show_activity boolean not null default true,
  show_last_seen boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.lolz_account_settings enable row level security;
drop policy if exists "Users manage their own LOLZ account settings" on public.lolz_account_settings;
create policy "Users manage their own LOLZ account settings"
  on public.lolz_account_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.lolz_account_settings to authenticated;

-- Presence values are shared only through a privacy-aware RPC.
create table if not exists public.lolz_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lolz_presence enable row level security;
drop policy if exists "Users update their own presence" on public.lolz_presence;
create policy "Users update their own presence" on public.lolz_presence
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.lolz_presence to authenticated;

create or replace function public.get_lolz_presence(p_user_ids uuid[])
returns table(user_id uuid, is_online boolean, last_seen_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $lolz$
  select
    p.user_id,
    case when coalesce(s.show_activity, true) then p.is_online else false end,
    case when coalesce(s.show_last_seen, true) then p.last_seen_at else null end
  from public.lolz_presence p
  left join public.lolz_account_settings s on s.user_id = p.user_id
  where p.user_id = any(coalesce(p_user_ids, array[]::uuid[]))
    and (
      p.user_id = auth.uid()
      or coalesce(s.show_activity, true)
      or coalesce(s.show_last_seen, true)
    );
$lolz$;
revoke all on function public.get_lolz_presence(uuid[]) from public;
grant execute on function public.get_lolz_presence(uuid[]) to authenticated;


create table if not exists public.lolz_close_friends (
  owner_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  constraint lolz_close_friends_no_self check (owner_id <> friend_id)
);
create index if not exists lolz_close_friends_friend_idx on public.lolz_close_friends(friend_id);
alter table public.lolz_close_friends enable row level security;
drop policy if exists "Users manage their own close friends" on public.lolz_close_friends;
create policy "Users manage their own close friends"
  on public.lolz_close_friends for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and friend_id <> auth.uid());
grant select, insert, delete on public.lolz_close_friends to authenticated;

drop policy if exists "Close-friends can confirm membership for story visibility" on public.lolz_close_friends;
create policy "Close-friends can confirm membership for story visibility"
  on public.lolz_close_friends for select to authenticated
  using (friend_id = auth.uid());

alter table public.stories add column if not exists audience text not null default 'everyone';
alter table public.stories drop constraint if exists stories_audience_check;
alter table public.stories add constraint stories_audience_check check (audience in ('everyone','close_friends'));
drop policy if exists "LOLZ restrict close-friends stories" on public.stories;
create policy "LOLZ restrict close-friends stories"
  on public.stories as restrictive for select to authenticated
  using (
    coalesce(audience, 'everyone') <> 'close_friends'
    or user_id = auth.uid()
    or exists (
      select 1 from public.lolz_close_friends cf
      where cf.owner_id = stories.user_id and cf.friend_id = auth.uid()
    )
  );

alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists expires_at timestamptz;
alter table public.messages add column if not exists reply_to_id text;
create index if not exists messages_expiry_idx on public.messages(expires_at) where expires_at is not null;
drop policy if exists "LOLZ users edit their own messages" on public.messages;
create policy "LOLZ users edit their own messages"
  on public.messages for update to authenticated
  using (sender_id = auth.uid() and public.lolz_conversation_is_allowed(conversation_id::text))
  with check (sender_id = auth.uid() and public.lolz_conversation_is_allowed(conversation_id::text));

drop policy if exists "LOLZ hide expired direct messages" on public.messages;
create policy "LOLZ hide expired direct messages"
  on public.messages as restrictive for select to authenticated
  using (expires_at is null or expires_at > now());

create table if not exists public.lolz_message_reactions (
  message_id text not null,
  conversation_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('❤️','😂','😮','😢','👍','🔥')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.lolz_message_reactions enable row level security;
drop policy if exists "Conversation members read message reactions" on public.lolz_message_reactions;
create policy "Conversation members read message reactions"
  on public.lolz_message_reactions for select to authenticated
  using (public.lolz_conversation_is_allowed(conversation_id));
drop policy if exists "Users manage their own message reactions" on public.lolz_message_reactions;
create policy "Users manage their own message reactions"
  on public.lolz_message_reactions for all to authenticated
  using (user_id = auth.uid() and public.lolz_conversation_is_allowed(conversation_id))
  with check (user_id = auth.uid() and public.lolz_conversation_is_allowed(conversation_id));
grant select, insert, update, delete on public.lolz_message_reactions to authenticated;

create table if not exists public.lolz_message_pins (
  conversation_id text not null,
  message_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, message_id, user_id)
);
alter table public.lolz_message_pins enable row level security;
drop policy if exists "Users manage their own pinned messages" on public.lolz_message_pins;
create policy "Users manage their own pinned messages"
  on public.lolz_message_pins for all to authenticated
  using (user_id = auth.uid() and public.lolz_conversation_is_allowed(conversation_id))
  with check (user_id = auth.uid() and public.lolz_conversation_is_allowed(conversation_id));
grant select, insert, delete on public.lolz_message_pins to authenticated;

create table if not exists public.lolz_conversation_reads (
  conversation_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.lolz_conversation_reads enable row level security;
drop policy if exists "Conversation participants read read receipts" on public.lolz_conversation_reads;
create policy "Conversation participants read read receipts"
  on public.lolz_conversation_reads for select to authenticated
  using (public.lolz_conversation_is_allowed(conversation_id));
drop policy if exists "Users update their own read receipt" on public.lolz_conversation_reads;
create policy "Users update their own read receipt"
  on public.lolz_conversation_reads for all to authenticated
  using (user_id = auth.uid() and public.lolz_conversation_is_allowed(conversation_id))
  with check (user_id = auth.uid() and public.lolz_conversation_is_allowed(conversation_id));
grant select, insert, update on public.lolz_conversation_reads to authenticated;

create table if not exists public.lolz_typing_status (
  conversation_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '8 seconds'),
  primary key (conversation_id, user_id)
);
alter table public.lolz_typing_status enable row level security;
drop policy if exists "Conversation members read typing status" on public.lolz_typing_status;
create policy "Conversation members read typing status"
  on public.lolz_typing_status for select to authenticated
  using (public.lolz_conversation_is_allowed(conversation_id));
drop policy if exists "Users publish their own typing status" on public.lolz_typing_status;
create policy "Users publish their own typing status"
  on public.lolz_typing_status for all to authenticated
  using (user_id = auth.uid() and public.lolz_conversation_is_allowed(conversation_id))
  with check (user_id = auth.uid() and public.lolz_conversation_is_allowed(conversation_id));
grant select, insert, update, delete on public.lolz_typing_status to authenticated;

create table if not exists public.lolz_group_polls (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  question text not null check (length(trim(question)) between 2 and 300),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.lolz_group_poll_votes (
  poll_id uuid not null references public.lolz_group_polls(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 7),
  created_at timestamptz not null default now(),
  primary key (poll_id, voter_id)
);
create table if not exists public.lolz_group_events (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 160),
  description text check (description is null or length(description) <= 2000),
  starts_at timestamptz not null,
  location text,
  created_at timestamptz not null default now()
);
alter table public.lolz_group_polls enable row level security;
alter table public.lolz_group_poll_votes enable row level security;
alter table public.lolz_group_events enable row level security;
drop policy if exists "Group members read polls" on public.lolz_group_polls;
create policy "Group members read polls" on public.lolz_group_polls for select to authenticated
  using (exists (select 1 from public.group_members gm where gm.group_id::text = lolz_group_polls.group_id and gm.user_id = auth.uid()));
drop policy if exists "Group members create polls" on public.lolz_group_polls;
create policy "Group members create polls" on public.lolz_group_polls for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.group_members gm where gm.group_id::text = lolz_group_polls.group_id and gm.user_id = auth.uid()));
drop policy if exists "Group members read poll votes" on public.lolz_group_poll_votes;
create policy "Group members read poll votes" on public.lolz_group_poll_votes for select to authenticated
  using (exists (select 1 from public.lolz_group_polls p join public.group_members gm on gm.group_id::text = p.group_id where p.id = poll_id and gm.user_id = auth.uid()));
drop policy if exists "Users vote in group polls" on public.lolz_group_poll_votes;
create policy "Users vote in group polls" on public.lolz_group_poll_votes for insert to authenticated
  with check (voter_id = auth.uid() and exists (select 1 from public.lolz_group_polls p join public.group_members gm on gm.group_id::text = p.group_id where p.id = poll_id and gm.user_id = auth.uid() and (p.ends_at is null or p.ends_at > now())));
drop policy if exists "Group members read events" on public.lolz_group_events;
create policy "Group members read events" on public.lolz_group_events for select to authenticated
  using (exists (select 1 from public.group_members gm where gm.group_id::text = lolz_group_events.group_id and gm.user_id = auth.uid()));
drop policy if exists "Group members create events" on public.lolz_group_events;
create policy "Group members create events" on public.lolz_group_events for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.group_members gm where gm.group_id::text = lolz_group_events.group_id and gm.user_id = auth.uid()));
grant select, insert on public.lolz_group_polls to authenticated;
grant select, insert on public.lolz_group_poll_votes to authenticated;
grant select, insert on public.lolz_group_events to authenticated;


-- Apply the privacy controls saved by the Account Center at the data boundary.
create or replace function public.lolz_can_message(p_sender uuid, p_recipient uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $lolz$
  select case coalesce((
    select s.allow_messages_from from public.lolz_account_settings s
    where s.user_id = p_recipient
  ), 'everyone')
    when 'everyone' then true
    when 'following' then exists (
      select 1 from public.follows f
      where f.follower_id = p_sender and f.following_id = p_recipient
    )
    else false
  end;
$lolz$;

create or replace function public.lolz_can_comment(p_actor uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $lolz$
  select case coalesce((
    select s.allow_comments_from from public.lolz_account_settings s
    where s.user_id = p_owner
  ), 'everyone')
    when 'everyone' then true
    when 'following' then exists (
      select 1 from public.follows f
      where f.follower_id = p_actor and f.following_id = p_owner
    )
    else false
  end;
$lolz$;

revoke all on function public.lolz_can_message(uuid, uuid) from public;
revoke all on function public.lolz_can_comment(uuid, uuid) from public;
grant execute on function public.lolz_can_message(uuid, uuid) to authenticated;
grant execute on function public.lolz_can_comment(uuid, uuid) to authenticated;

drop policy if exists "LOLZ respect private profiles" on public.profiles;
create policy "LOLZ respect private profiles"
  on public.profiles as restrictive for select to authenticated
  using (
    id = auth.uid()
    or coalesce((select s.profile_visibility from public.lolz_account_settings s where s.user_id = profiles.id), 'public') = 'public'
    or exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = profiles.id
    )
  );

drop policy if exists "LOLZ enforce recipient message preferences" on public.conversations;
create policy "LOLZ enforce recipient message preferences"
  on public.conversations as restrictive for insert to authenticated
  with check (
    (user_one = auth.uid() and public.lolz_can_message(auth.uid(), user_two))
    or (user_two = auth.uid() and public.lolz_can_message(auth.uid(), user_one))
  );

drop policy if exists "LOLZ enforce comment preferences" on public.comments;
create policy "LOLZ enforce comment preferences"
  on public.comments as restrictive for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id::text = comments.post_id::text
        and public.lolz_can_comment(auth.uid(), p.user_id)
    )
  );

commit;
