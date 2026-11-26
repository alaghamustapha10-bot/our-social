-- LOLZ security, story views, and PayPal subscription foundations
-- Apply this migration to the linked Supabase project before deploying the matching Edge Function.

begin;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('user', 'post', 'video', 'comment', 'message', 'story', 'group', 'channel')),
  target_id text not null check (length(trim(target_id)) > 0),
  target_user_id uuid references auth.users(id) on delete set null,
  reason text not null check (length(trim(reason)) between 2 and 100),
  details text check (details is null or length(details) <= 1500),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

-- Keep the target-type check correct when this migration is applied to an
-- already-existing content_reports table.
alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;
alter table public.content_reports
  add constraint content_reports_target_type_check
  check (target_type in ('user', 'post', 'video', 'comment', 'message', 'story', 'group', 'channel', 'group_message', 'channel_post'));

create index if not exists content_reports_status_created_idx
  on public.content_reports(status, created_at desc);

create index if not exists content_reports_target_idx
  on public.content_reports(target_type, target_id);

-- Prevent report spam even when a client bypasses the intended UI.
create or replace function public.limit_lolz_report_rate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $
declare
  recent_report_count integer;
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then
    raise exception 'Report owner does not match the signed-in user'
      using errcode = '42501';
  end if;

  new.created_at := now();

  select count(*) into recent_report_count
  from public.content_reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '1 hour';

  if recent_report_count >= 20 then
    raise exception 'Report limit reached. Try again later.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$;

drop trigger if exists limit_lolz_report_rate_trigger on public.content_reports;
create trigger limit_lolz_report_rate_trigger
before insert on public.content_reports
for each row execute function public.limit_lolz_report_rate();

revoke all on function public.limit_lolz_report_rate() from public;

alter table public.content_reports enable row level security;

drop policy if exists "Users can submit their own reports" on public.content_reports;
create policy "Users can submit their own reports"
  on public.content_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
  );

drop policy if exists "Users can read their own reports" on public.content_reports;
create policy "Users can read their own reports"
  on public.content_reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "LOLZ moderators can review reports" on public.content_reports;
create policy "LOLZ moderators can review reports"
  on public.content_reports for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke update, delete on public.content_reports from anon, authenticated;
grant select, insert, update on public.content_reports to authenticated;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can see their own blocks" on public.user_blocks;
create policy "Users can see their own blocks"
  on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "Users can create their own blocks" on public.user_blocks;
create policy "Users can create their own blocks"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid() and blocked_id <> auth.uid());

drop policy if exists "Users can remove their own blocks" on public.user_blocks;
create policy "Users can remove their own blocks"
  on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

grant select, insert, delete on public.user_blocks to authenticated;

-- Shared server-side block check. Both sides of a block are prevented from
-- interacting with or viewing one another's content.
create or replace function public.lolz_users_not_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $
  select
    p_user_a is not null
    and p_user_b is not null
    and not exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
         or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
    );
$;

revoke all on function public.lolz_users_not_blocked(uuid, uuid) from public;
grant execute on function public.lolz_users_not_blocked(uuid, uuid) to authenticated;

-- Restrict reads of core feed, profile, story, and LOLZ media rows even if an
-- older permissive SELECT policy also exists. The caller still needs an
-- applicable permissive policy; this policy only adds a block condition.
do $
declare
  item record;
begin
  for item in
    select * from (values
      ('profiles', 'id'),
      ('posts', 'user_id'),
      ('stories', 'user_id'),
      ('lolz_videos', 'user_id'),
      ('comments', 'user_id'),
      ('lolz_comments', 'user_id'),
      ('channel_posts', 'user_id')
    ) as targets(table_name, user_column)
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = item.table_name
        and column_name = item.user_column
    ) then
      execute format('alter table public.%I enable row level security', item.table_name);
      execute format(
        'drop policy if exists %I on public.%I',
        'LOLZ block filter for ' || item.table_name,
        item.table_name
      );
      execute format(
        'create policy %I on public.%I as restrictive for select to authenticated using (public.lolz_users_not_blocked(auth.uid(), %I))',
        'LOLZ block filter for ' || item.table_name,
        item.table_name,
        item.user_column
      );
    end if;
  end loop;
end;
$;

-- Blocked users cannot see or create a private conversation with each other.
alter table public.conversations enable row level security;
drop policy if exists "LOLZ block filter on conversations" on public.conversations;
create policy "LOLZ block filter on conversations"
  on public.conversations as restrictive for all to authenticated
  using (
    auth.uid() in (user_one, user_two)
    and public.lolz_users_not_blocked(user_one, user_two)
  )
  with check (
    auth.uid() in (user_one, user_two)
    and public.lolz_users_not_blocked(user_one, user_two)
  );

create or replace function public.lolz_conversation_is_allowed(p_conversation_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $
  select exists (
    select 1
    from public.conversations c
    where c.id::text = p_conversation_id
      and auth.uid() in (c.user_one, c.user_two)
      and public.lolz_users_not_blocked(c.user_one, c.user_two)
  );
$;

revoke all on function public.lolz_conversation_is_allowed(text) from public;
grant execute on function public.lolz_conversation_is_allowed(text) to authenticated;

-- Enforce the block relationship for all private-message reads and writes.
alter table public.messages enable row level security;
drop policy if exists "LOLZ block filter on messages" on public.messages;
create policy "LOLZ block filter on messages"
  on public.messages as restrictive for all to authenticated
  using (public.lolz_conversation_is_allowed(conversation_id::text))
  with check (
    public.lolz_conversation_is_allowed(conversation_id::text)
    and sender_id = auth.uid()
  );

-- Private media bucket for direct-message attachments. New DM uploads are not
-- public URLs; only the conversation participants can create short-lived URLs.
insert into storage.buckets (id, name, public)
values ('private-messages', 'private-messages', false)
on conflict (id) do update set public = false;

drop policy if exists "LOLZ users upload their own private message media" on storage.objects;
create policy "LOLZ users upload their own private message media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'private-messages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "LOLZ conversation members read private message media" on storage.objects;
create policy "LOLZ conversation members read private message media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'private-messages'
    and exists (
      select 1
      from public.messages m
      where m.media_url = storage.objects.name
        and public.lolz_conversation_is_allowed(m.conversation_id::text)
    )
  );

drop policy if exists "LOLZ users delete their own private message media" on storage.objects;
create policy "LOLZ users delete their own private message media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'private-messages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.story_views (
  story_id text not null,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index if not exists story_views_viewer_idx
  on public.story_views(viewer_id, viewed_at desc);

alter table public.story_views enable row level security;

drop policy if exists "Viewers can record their own story views" on public.story_views;
create policy "Viewers can record their own story views"
  on public.story_views for insert to authenticated
  with check (
    viewer_id = auth.uid()
    and exists (
      select 1
      from public.stories s
      where s.id::text = story_id
        and s.user_id <> auth.uid()
        and s.expires_at > now()
    )
  );

drop policy if exists "Viewers can read their own story views" on public.story_views;
create policy "Viewers can read their own story views"
  on public.story_views for select to authenticated
  using (viewer_id = auth.uid());

grant select, insert on public.story_views to authenticated;

create or replace function public.get_lolz_story_viewers(p_story_id text)
returns table (viewer_id uuid, viewed_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.stories s
    where s.id::text = p_story_id
      and s.user_id = auth.uid()
  ) then
    raise exception 'Not allowed to view this story audience'
      using errcode = '42501';
  end if;

  return query
    select sv.viewer_id, sv.viewed_at
    from public.story_views sv
    where sv.story_id = p_story_id
    order by sv.viewed_at asc;
end;
$$;

revoke all on function public.get_lolz_story_viewers(text) from public;
grant execute on function public.get_lolz_story_viewers(text) to authenticated;

create table if not exists public.lolz_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  provider text not null default 'paypal',
  paypal_subscription_id text,
  paypal_plan_id text,
  next_billing_time timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lolz_subscriptions
  add column if not exists provider text not null default 'paypal',
  add column if not exists paypal_subscription_id text,
  add column if not exists paypal_plan_id text,
  add column if not exists next_billing_time timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists lolz_subscriptions_paypal_id_unique
  on public.lolz_subscriptions(paypal_subscription_id)
  where paypal_subscription_id is not null;

create index if not exists lolz_subscriptions_user_updated_idx
  on public.lolz_subscriptions(user_id, updated_at desc);

alter table public.lolz_subscriptions enable row level security;

drop policy if exists "Users can read their own LOLZ subscription" on public.lolz_subscriptions;
create policy "Users can read their own LOLZ subscription"
  on public.lolz_subscriptions for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.lolz_subscriptions from anon, authenticated;
grant select on public.lolz_subscriptions to authenticated;

commit;
