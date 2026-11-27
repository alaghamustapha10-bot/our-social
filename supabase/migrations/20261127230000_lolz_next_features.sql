-- LOLZ next feature set: push preferences, story highlights, voice transcripts, and shared message deletion.
begin;

create table if not exists public.lolz_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  likes_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  follows_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  community_enabled boolean not null default true,
  calls_enabled boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time not null default time '22:00',
  quiet_hours_end time not null default time '08:00',
  timezone text not null default 'Europe/Amsterdam',
  updated_at timestamptz not null default now()
);

alter table public.lolz_notification_preferences enable row level security;
drop policy if exists "LOLZ users manage their notification preferences" on public.lolz_notification_preferences;
create policy "LOLZ users manage their notification preferences"
  on public.lolz_notification_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on public.lolz_notification_preferences to authenticated;

-- Soft-delete metadata preserves the conversation timeline for both participants.
alter table public.messages
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

-- Transcripts are generated on demand and remain private with their source message.
alter table public.messages add column if not exists transcript text;
alter table public.group_messages add column if not exists transcript text;
alter table public.channel_posts add column if not exists transcript text;

create table if not exists public.lolz_story_highlights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 30),
  cover_url text,
  created_at timestamptz not null default now()
);

create index if not exists lolz_story_highlights_owner_created_idx
  on public.lolz_story_highlights(owner_id, created_at desc);

create table if not exists public.lolz_story_highlight_items (
  id uuid primary key default gen_random_uuid(),
  highlight_id uuid not null references public.lolz_story_highlights(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  story_id text not null,
  media_url text not null,
  caption text not null default '',
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  media_filter text not null default 'none'
    check (media_filter in ('none', 'warm', 'mono', 'vivid', 'cool', 'soft')),
  caption_position text not null default 'bottom'
    check (caption_position in ('top', 'middle', 'bottom')),
  audience text not null default 'everyone'
    check (audience in ('everyone', 'close_friends')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (highlight_id, story_id)
);

create index if not exists lolz_story_highlight_items_highlight_position_idx
  on public.lolz_story_highlight_items(highlight_id, position, created_at);

-- Derive the saved media snapshot from the owner's actual story row so a client
-- cannot change a close-friends story into a public highlight item.
-- These helpers stay outside Supabase's exposed Data API schemas.
create schema if not exists lolz_internal;
revoke all on schema lolz_internal from public, anon;
grant usage on schema lolz_internal to authenticated;

create or replace function lolz_internal.lolz_clear_story_highlight_cover()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- The cover is derived from the first item the current viewer is allowed to see.
  -- Never persist an arbitrary URL here: it could point at a close-friends story.
  new.cover_url := null;
  return new;
end;
$$;

drop trigger if exists lolz_clear_story_highlight_cover_trigger on public.lolz_story_highlights;
create trigger lolz_clear_story_highlight_cover_trigger
before insert or update of cover_url on public.lolz_story_highlights
for each row execute function lolz_internal.lolz_clear_story_highlight_cover();

revoke all on function lolz_internal.lolz_clear_story_highlight_cover() from public, anon, authenticated;

create or replace function lolz_internal.lolz_snapshot_story_highlight_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_story public.stories%rowtype;
begin
  if auth.uid() is null or new.owner_id <> auth.uid() then
    raise exception 'Not allowed to add this story highlight item'
      using errcode = '42501';
  end if;

  select * into source_story
  from public.stories s
  where s.id::text = new.story_id
    and s.user_id = auth.uid()
    and s.expires_at > now();

  if not found then
    raise exception 'The selected story is unavailable or does not belong to you'
      using errcode = '42501';
  end if;

  new.owner_id := auth.uid();
  new.media_url := source_story.media_url;
  new.caption := coalesce(source_story.caption, '');
  new.audience := case when source_story.audience = 'close_friends'
    then 'close_friends' else 'everyone' end;
  new.media_filter := coalesce(source_story.media_filter, 'none');
  new.caption_position := coalesce(source_story.caption_position, 'bottom');
  new.media_type := case
    when source_story.media_url ~* '\.(mp4|webm|mov|m4v)(\?.*)?$' then 'video'
    else 'image'
  end;

  return new;
end;
$$;

drop trigger if exists lolz_snapshot_story_highlight_item_trigger on public.lolz_story_highlight_items;
create trigger lolz_snapshot_story_highlight_item_trigger
before insert on public.lolz_story_highlight_items
for each row execute function lolz_internal.lolz_snapshot_story_highlight_item();

create or replace function lolz_internal.lolz_can_read_story_highlight_item(
  p_owner_id uuid,
  p_audience text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and (
      auth.uid() = p_owner_id
      or (
        public.lolz_users_not_blocked(auth.uid(), p_owner_id)
        and case
          when p_audience = 'close_friends' then exists (
            select 1
            from public.lolz_close_friends cf
            where cf.owner_id = p_owner_id
              and cf.friend_id = auth.uid()
          )
          else
            coalesce((
              select settings.profile_visibility
              from public.lolz_account_settings settings
              where settings.user_id = p_owner_id
            ), 'public') = 'public'
            or exists (
              select 1 from public.follows f
              where f.follower_id = auth.uid()
                and f.following_id = p_owner_id
            )
            or exists (
              select 1 from public.lolz_close_friends cf
              where cf.owner_id = p_owner_id
                and cf.friend_id = auth.uid()
            )
        end
      )
    );
$$;

revoke all on function lolz_internal.lolz_snapshot_story_highlight_item() from public, anon, authenticated;
revoke all on function lolz_internal.lolz_can_read_story_highlight_item(uuid, text) from public, anon, authenticated;
grant execute on function lolz_internal.lolz_can_read_story_highlight_item(uuid, text) to authenticated;

alter table public.lolz_story_highlights enable row level security;
alter table public.lolz_story_highlight_items enable row level security;

drop policy if exists "LOLZ owners manage their story highlights" on public.lolz_story_highlights;
create policy "LOLZ owners manage their story highlights"
  on public.lolz_story_highlights for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "LOLZ users view highlights with visible stories" on public.lolz_story_highlights;
create policy "LOLZ users view highlights with visible stories"
  on public.lolz_story_highlights for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.lolz_story_highlight_items item
      where item.highlight_id = lolz_story_highlights.id
        and lolz_internal.lolz_can_read_story_highlight_item(item.owner_id, item.audience)
    )
  );

drop policy if exists "LOLZ owners add their own highlight stories" on public.lolz_story_highlight_items;
create policy "LOLZ owners add their own highlight stories"
  on public.lolz_story_highlight_items for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.lolz_story_highlights highlight
      where highlight.id = highlight_id
        and highlight.owner_id = auth.uid()
    )
  );

drop policy if exists "LOLZ users view highlight stories they can access" on public.lolz_story_highlight_items;
create policy "LOLZ users view highlight stories they can access"
  on public.lolz_story_highlight_items for select to authenticated
  using (lolz_internal.lolz_can_read_story_highlight_item(owner_id, audience));

grant select, insert, update, delete on public.lolz_story_highlights to authenticated;
grant select, insert on public.lolz_story_highlight_items to authenticated;

commit;
