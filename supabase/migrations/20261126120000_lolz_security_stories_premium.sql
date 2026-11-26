-- LOLZ security, story views, and PayPal subscription foundations
-- Apply this migration to the linked Supabase project before deploying the matching Edge Function.

begin;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('user', 'post', 'comment', 'message', 'story', 'group', 'channel')),
  target_id text not null check (length(trim(target_id)) > 0),
  target_user_id uuid references auth.users(id) on delete set null,
  reason text not null check (length(trim(reason)) between 2 and 100),
  details text check (details is null or length(details) <= 1500),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists content_reports_status_created_idx
  on public.content_reports(status, created_at desc);

create index if not exists content_reports_target_idx
  on public.content_reports(target_type, target_id);

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
  using (reporter_id = auth.uid());

revoke update, delete on public.content_reports from anon, authenticated;
grant select, insert on public.content_reports to authenticated;

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
  with check (viewer_id = auth.uid());

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
