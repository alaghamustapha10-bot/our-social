-- LOLZ monetization marketplace: offers, memberships, sales, sponsorships, ads and payouts.
begin;

create schema if not exists lolz_internal;
revoke all on schema lolz_internal from public, anon;
grant usage on schema lolz_internal to authenticated;

create table if not exists public.lolz_monetization_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'creator'
    check (account_type in ('creator', 'business')),
  display_name text not null check (length(btrim(display_name)) between 2 and 80),
  description text not null default '' check (length(description) <= 1200),
  website_url text,
  country_code text not null default 'NL' check (country_code ~ '^[A-Z]{2}$'),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lolz_monetization_profiles enable row level security;
drop policy if exists "LOLZ public monetization profiles" on public.lolz_monetization_profiles;
create policy "LOLZ public monetization profiles"
  on public.lolz_monetization_profiles for select to authenticated
  using (is_public or user_id = auth.uid());
drop policy if exists "LOLZ users manage own monetization profile" on public.lolz_monetization_profiles;
create policy "LOLZ users manage own monetization profile"
  on public.lolz_monetization_profiles for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on public.lolz_monetization_profiles to authenticated;

create or replace function lolz_internal.lolz_guard_offer_review()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_role text := auth.jwt() -> 'app_metadata' ->> 'role';
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.seller_id <> auth.uid() then
      raise exception 'Offer owner must match the signed-in user' using errcode = '42501';
    end if;
    new.status := 'pending_review';
    return new;
  end if;

  if new.seller_id <> old.seller_id or new.id <> old.id then
    raise exception 'Offer ownership cannot be changed' using errcode = '42501';
  end if;

  if auth.uid() = old.seller_id and coalesce(actor_role, '') not in ('admin', 'owner') then
    if new.status is distinct from old.status
      and not (
        (old.status = 'active' and new.status = 'paused')
        or (old.status = 'paused' and new.status = 'active')
      ) then
      raise exception 'Only moderators can approve or reject offers' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Offer trigger is attached after its table is created.
revoke all on function lolz_internal.lolz_guard_offer_review() from public, anon, authenticated;

create or replace function lolz_internal.lolz_guard_brief_review()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_role text := auth.jwt() -> 'app_metadata' ->> 'role';
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.advertiser_id <> auth.uid() then
      raise exception 'Advertiser must match the signed-in user' using errcode = '42501';
    end if;
    new.status := 'pending_review';
    return new;
  end if;

  if new.advertiser_id <> old.advertiser_id or new.id <> old.id then
    raise exception 'Collaboration owner cannot be changed' using errcode = '42501';
  end if;

  if auth.uid() = old.advertiser_id and coalesce(actor_role, '') not in ('admin', 'owner') then
    if new.status is distinct from old.status
      and not (
        (old.status = 'open' and new.status = 'paused')
        or (old.status = 'paused' and new.status = 'open')
      ) then
      raise exception 'Only moderators can approve or reject collaboration briefs' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Brief trigger is attached after its table is created.
revoke all on function lolz_internal.lolz_guard_brief_review() from public, anon, authenticated;



create table if not exists public.lolz_commerce_offers (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  offer_type text not null check (offer_type in (
    'creator_membership', 'community_access', 'digital_product',
    'event_ticket', 'course', 'booking', 'service'
  )),
  title text not null check (length(btrim(title)) between 3 and 100),
  description text not null default '' check (length(description) <= 3000),
  price_cents integer not null check (price_cents between 100 and 100000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  duration_days integer check (duration_days is null or duration_days between 1 and 3650),
  starts_at timestamptz,
  location text check (location is null or length(location) <= 240),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'sold_out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lolz_commerce_offers_active_idx
  on public.lolz_commerce_offers(status, offer_type, created_at desc);
create index if not exists lolz_commerce_offers_seller_idx
  on public.lolz_commerce_offers(seller_id, created_at desc);

alter table public.lolz_commerce_offers enable row level security;
drop policy if exists "LOLZ users browse active offers or own offers" on public.lolz_commerce_offers;
alter table public.lolz_commerce_offers
  drop constraint if exists lolz_commerce_offers_status_check;
alter table public.lolz_commerce_offers
  add constraint lolz_commerce_offers_status_check
  check (status in ('draft', 'pending_review', 'active', 'paused', 'rejected', 'sold_out'));

create policy "LOLZ users browse active offers or own offers"
  on public.lolz_commerce_offers for select to authenticated
  using (
    status = 'active'
    or seller_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner')
  );
drop policy if exists "LOLZ sellers create own offers" on public.lolz_commerce_offers;
create policy "LOLZ sellers create own offers"
  on public.lolz_commerce_offers for insert to authenticated
  with check (seller_id = auth.uid());
drop policy if exists "LOLZ sellers update own offers" on public.lolz_commerce_offers;
create policy "LOLZ sellers update own offers"
  on public.lolz_commerce_offers for update to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());
drop policy if exists "LOLZ sellers delete own offers" on public.lolz_commerce_offers;
create policy "LOLZ sellers delete own offers"
  on public.lolz_commerce_offers for delete to authenticated
  using (seller_id = auth.uid());
drop policy if exists "LOLZ admins review offers" on public.lolz_commerce_offers;
create policy "LOLZ admins review offers"
  on public.lolz_commerce_offers for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'));
grant select, insert, update, delete on public.lolz_commerce_offers to authenticated;

drop trigger if exists lolz_guard_offer_review_trigger on public.lolz_commerce_offers;
create trigger lolz_guard_offer_review_trigger
before insert or update on public.lolz_commerce_offers
for each row execute function lolz_internal.lolz_guard_offer_review();

create table if not exists public.lolz_commerce_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid references auth.users(id) on delete set null,
  offer_id uuid references public.lolz_commerce_offers(id) on delete set null,
  order_type text not null check (order_type in ('offer_purchase', 'creator_tip', 'project_support')),
  title text not null check (length(title) between 2 and 140),
  amount_cents integer not null check (amount_cents between 100 and 100000000),
  platform_fee_cents integer not null default 0 check (platform_fee_cents between 0 and amount_cents),
  seller_net_cents integer not null default 0 check (seller_net_cents between 0 and amount_cents),
  currency text not null default 'EUR' check (currency = 'EUR'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'failed', 'refunded')),
  paypal_order_id text unique,
  duration_days integer check (duration_days is null or duration_days between 1 and 3650),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists lolz_commerce_orders_buyer_idx
  on public.lolz_commerce_orders(buyer_id, created_at desc);
create index if not exists lolz_commerce_orders_seller_idx
  on public.lolz_commerce_orders(seller_id, created_at desc);
create index if not exists lolz_commerce_orders_pending_idx
  on public.lolz_commerce_orders(status, created_at desc);

alter table public.lolz_commerce_orders enable row level security;
drop policy if exists "LOLZ buyers and sellers read their orders" on public.lolz_commerce_orders;
create policy "LOLZ buyers and sellers read their orders"
  on public.lolz_commerce_orders for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());
revoke all on public.lolz_commerce_orders from anon, authenticated;
grant select on public.lolz_commerce_orders to authenticated;

create table if not exists public.lolz_commerce_entitlements (
  order_id uuid primary key references public.lolz_commerce_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid references auth.users(id) on delete set null,
  offer_id uuid references public.lolz_commerce_offers(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lolz_commerce_entitlements_user_idx
  on public.lolz_commerce_entitlements(user_id, expires_at);
alter table public.lolz_commerce_entitlements enable row level security;
drop policy if exists "LOLZ buyers and sellers read entitlements" on public.lolz_commerce_entitlements;
create policy "LOLZ buyers and sellers read entitlements"
  on public.lolz_commerce_entitlements for select to authenticated
  using (user_id = auth.uid() or seller_id = auth.uid());
revoke all on public.lolz_commerce_entitlements from anon, authenticated;
grant select on public.lolz_commerce_entitlements to authenticated;

create table if not exists public.lolz_booking_requests (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.lolz_commerce_offers(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null,
  customer_note text not null default '' check (length(customer_note) <= 1200),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists lolz_booking_requests_seller_idx
  on public.lolz_booking_requests(seller_id, status, requested_at);
alter table public.lolz_booking_requests enable row level security;
drop policy if exists "LOLZ customers and providers read booking requests" on public.lolz_booking_requests;
create policy "LOLZ customers and providers read booking requests"
  on public.lolz_booking_requests for select to authenticated
  using (customer_id = auth.uid() or seller_id = auth.uid());
drop policy if exists "LOLZ users request active booking offers" on public.lolz_booking_requests;
create policy "LOLZ users request active booking offers"
  on public.lolz_booking_requests for insert to authenticated
  with check (
    customer_id = auth.uid()
    and customer_id <> seller_id
    and exists (
      select 1 from public.lolz_commerce_offers offer
      where offer.id = offer_id
        and offer.seller_id = seller_id
        and offer.offer_type = 'booking'
        and offer.status = 'active'
    )
  );
create or replace function lolz_internal.lolz_guard_booking_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
    or new.id <> old.id
    or new.offer_id <> old.offer_id
    or new.customer_id <> old.customer_id
    or new.seller_id <> old.seller_id
    or new.created_at <> old.created_at then
    raise exception 'Booking identity fields cannot be changed'
      using errcode = '42501';
  end if;

  if auth.uid() = old.seller_id then
    if new.status not in ('accepted', 'declined') then
      raise exception 'Providers can only accept or decline booking requests'
        using errcode = '42501';
    end if;
    new.requested_at := old.requested_at;
    new.customer_note := old.customer_note;
  elsif auth.uid() = old.customer_id then
    if new.status <> 'cancelled' then
      raise exception 'Customers can only cancel their booking requests'
        using errcode = '42501';
    end if;
    new.requested_at := old.requested_at;
    new.customer_note := old.customer_note;
  else
    raise exception 'Not allowed to update this booking request'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists lolz_guard_booking_update_trigger on public.lolz_booking_requests;
create trigger lolz_guard_booking_update_trigger
before update on public.lolz_booking_requests
for each row execute function lolz_internal.lolz_guard_booking_update();
revoke all on function lolz_internal.lolz_guard_booking_update() from public, anon, authenticated;

drop policy if exists "LOLZ customers and providers update booking decisions" on public.lolz_booking_requests;
create policy "LOLZ customers and providers update booking decisions"
  on public.lolz_booking_requests for update to authenticated
  using (customer_id = auth.uid() or seller_id = auth.uid())
  with check (customer_id = auth.uid() or seller_id = auth.uid());

revoke all on public.lolz_booking_requests from anon, authenticated;
grant select, insert, update on public.lolz_booking_requests to authenticated;

create table if not exists public.lolz_sponsorship_briefs (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 120),
  description text not null check (length(btrim(description)) between 10 and 3000),
  budget_min_cents integer not null check (budget_min_cents >= 100),
  budget_max_cents integer not null check (budget_max_cents >= budget_min_cents),
  status text not null default 'open' check (status in ('open', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lolz_sponsorship_briefs_open_idx
  on public.lolz_sponsorship_briefs(status, created_at desc);
alter table public.lolz_sponsorship_briefs enable row level security;
drop policy if exists "LOLZ creators view open sponsorship briefs" on public.lolz_sponsorship_briefs;
alter table public.lolz_sponsorship_briefs
  drop constraint if exists lolz_sponsorship_briefs_status_check;
alter table public.lolz_sponsorship_briefs
  add constraint lolz_sponsorship_briefs_status_check
  check (status in ('pending_review', 'open', 'paused', 'closed'));

create policy "LOLZ creators view open sponsorship briefs"
  on public.lolz_sponsorship_briefs for select to authenticated
  using (
    status = 'open'
    or advertiser_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner')
  );
drop policy if exists "LOLZ businesses manage own sponsorship briefs" on public.lolz_sponsorship_briefs;
create policy "LOLZ businesses manage own sponsorship briefs"
  on public.lolz_sponsorship_briefs for all to authenticated
  using (advertiser_id = auth.uid())
  with check (advertiser_id = auth.uid());
drop policy if exists "LOLZ admins review sponsorship briefs" on public.lolz_sponsorship_briefs;
create policy "LOLZ admins review sponsorship briefs"
  on public.lolz_sponsorship_briefs for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'));
grant select, insert, update, delete on public.lolz_sponsorship_briefs to authenticated;

drop trigger if exists lolz_guard_brief_review_trigger on public.lolz_sponsorship_briefs;
create trigger lolz_guard_brief_review_trigger
before insert or update on public.lolz_sponsorship_briefs
for each row execute function lolz_internal.lolz_guard_brief_review();

create table if not exists public.lolz_sponsorship_applications (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.lolz_sponsorship_briefs(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  pitch text not null check (length(btrim(pitch)) between 10 and 2000),
  proposed_rate_cents integer not null check (proposed_rate_cents >= 100),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (brief_id, creator_id)
);
alter table public.lolz_sponsorship_applications enable row level security;
drop policy if exists "LOLZ creators and brief owners read applications" on public.lolz_sponsorship_applications;
create policy "LOLZ creators and brief owners read applications"
  on public.lolz_sponsorship_applications for select to authenticated
  using (
    creator_id = auth.uid()
    or exists (
      select 1 from public.lolz_sponsorship_briefs brief
      where brief.id = brief_id and brief.advertiser_id = auth.uid()
    )
  );
drop policy if exists "LOLZ creators apply to open sponsorship briefs" on public.lolz_sponsorship_applications;
create policy "LOLZ creators apply to open sponsorship briefs"
  on public.lolz_sponsorship_applications for insert to authenticated
  with check (
    creator_id = auth.uid()
    and exists (
      select 1 from public.lolz_sponsorship_briefs brief
      where brief.id = brief_id and brief.status = 'open'
    )
  );
drop policy if exists "LOLZ advertisers review sponsorship applications" on public.lolz_sponsorship_applications;
create policy "LOLZ advertisers review sponsorship applications"
  on public.lolz_sponsorship_applications for update to authenticated
  using (
    exists (
      select 1 from public.lolz_sponsorship_briefs brief
      where brief.id = brief_id and brief.advertiser_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lolz_sponsorship_briefs brief
      where brief.id = brief_id and brief.advertiser_id = auth.uid()
    )
  );
grant select, insert, update on public.lolz_sponsorship_applications to authenticated;

create or replace function lolz_internal.lolz_guard_sponsorship_application_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
    or new.id <> old.id
    or new.brief_id <> old.brief_id
    or new.creator_id <> old.creator_id
    or new.created_at <> old.created_at then
    raise exception 'Sponsorship application identity cannot be changed'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.lolz_sponsorship_briefs brief
    where brief.id = old.brief_id and brief.advertiser_id = auth.uid()
  ) then
    raise exception 'Only the brief owner can review this application'
      using errcode = '42501';
  end if;

  if old.status <> 'pending' or new.status not in ('accepted', 'rejected') then
    raise exception 'Only pending applications can be accepted or rejected'
      using errcode = '42501';
  end if;
  new.pitch := old.pitch;
  new.proposed_rate_cents := old.proposed_rate_cents;
  return new;
end;
$$;

drop trigger if exists lolz_guard_sponsorship_application_update_trigger on public.lolz_sponsorship_applications;
create trigger lolz_guard_sponsorship_application_update_trigger
before update on public.lolz_sponsorship_applications
for each row execute function lolz_internal.lolz_guard_sponsorship_application_update();
revoke all on function lolz_internal.lolz_guard_sponsorship_application_update() from public, anon, authenticated;

create table if not exists public.lolz_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 100),
  description text not null check (length(description) between 10 and 1200),
  destination_url text check (destination_url is null or destination_url ~ '^https://'),
  placement text not null check (placement in ('feed', 'stories', 'lolz')),
  budget_cents integer not null check (budget_cents >= 500),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'paused')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lolz_ad_campaigns_review_idx
  on public.lolz_ad_campaigns(status, created_at desc);
alter table public.lolz_ad_campaigns enable row level security;
drop policy if exists "LOLZ advertisers and moderators read campaigns" on public.lolz_ad_campaigns;
create policy "LOLZ advertisers and moderators read campaigns"
  on public.lolz_ad_campaigns for select to authenticated
  using (
    advertiser_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner')
  );
drop policy if exists "LOLZ users create campaigns for review" on public.lolz_ad_campaigns;
create policy "LOLZ users create campaigns for review"
  on public.lolz_ad_campaigns for insert to authenticated
  with check (advertiser_id = auth.uid() and status = 'pending_review' and reviewed_by is null and reviewed_at is null);
drop policy if exists "LOLZ admins review campaigns" on public.lolz_ad_campaigns;
create policy "LOLZ admins review campaigns"
  on public.lolz_ad_campaigns for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'));
grant select, insert, update on public.lolz_ad_campaigns to authenticated;

create table if not exists public.lolz_payout_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 100),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'paid', 'rejected')),
  seller_note text not null default '' check (length(seller_note) <= 800),
  admin_note text,
  processed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lolz_payout_requests_seller_idx
  on public.lolz_payout_requests(seller_id, created_at desc);
alter table public.lolz_payout_requests enable row level security;
drop policy if exists "LOLZ sellers read own payout requests" on public.lolz_payout_requests;
create policy "LOLZ sellers read own payout requests"
  on public.lolz_payout_requests for select to authenticated
  using (seller_id = auth.uid());

drop policy if exists "LOLZ admins read payout requests" on public.lolz_payout_requests;
create policy "LOLZ admins read payout requests"
  on public.lolz_payout_requests for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'));
drop policy if exists "LOLZ sellers create own payout requests" on public.lolz_payout_requests;
create policy "LOLZ sellers create own payout requests"
  on public.lolz_payout_requests for insert to authenticated
  with check (seller_id = auth.uid() and status = 'pending_review' and processed_by is null and processed_at is null);
revoke all on public.lolz_payout_requests from anon, authenticated;
drop policy if exists "LOLZ admins process payout requests" on public.lolz_payout_requests;
create policy "LOLZ admins process payout requests"
  on public.lolz_payout_requests for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'));

grant select, insert, update on public.lolz_payout_requests to authenticated;

create or replace function lolz_internal.lolz_validate_payout_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  earned_cents bigint;
  reserved_cents bigint;
begin
  if auth.uid() is null or new.seller_id <> auth.uid() then
    raise exception 'Payout request owner does not match the signed-in user'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.seller_id::text, 0));

  select coalesce(sum(order_row.seller_net_cents), 0)::bigint
    into earned_cents
  from public.lolz_commerce_orders order_row
  where order_row.seller_id = new.seller_id
    and order_row.status = 'paid';

  select coalesce(sum(payout.amount_cents), 0)::bigint
    into reserved_cents
  from public.lolz_payout_requests payout
  where payout.seller_id = new.seller_id
    and payout.status in ('pending_review', 'approved', 'paid');

  if new.amount_cents > earned_cents - reserved_cents then
    raise exception 'Requested payout exceeds your available balance'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists lolz_validate_payout_request_trigger on public.lolz_payout_requests;
create trigger lolz_validate_payout_request_trigger
before insert on public.lolz_payout_requests
for each row execute function lolz_internal.lolz_validate_payout_request();
revoke all on function lolz_internal.lolz_validate_payout_request() from public, anon, authenticated;

commit;
