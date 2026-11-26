-- LOLZ admin controls: verified badges and manually granted Premium.
begin;
alter table public.profiles add column if not exists is_verified boolean not null default false, add column if not exists verified_at timestamptz, add column if not exists verified_by uuid references auth.users(id) on delete set null;
create index if not exists profiles_verified_true_idx on public.profiles(id) where is_verified=true;
update public.profiles p set is_verified=true,verified_at=coalesce(p.verified_at,now()) from auth.users u where u.id=p.id and coalesce(u.raw_app_meta_data->>'role','') in ('admin','owner');
create or replace function public.lolz_protect_verified_profile_fields() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare caller_role text;
begin
 if auth.uid() is not null then caller_role:=coalesce(auth.jwt()->'app_metadata'->>'role',''); if caller_role not in ('admin','owner') and (new.is_verified is distinct from old.is_verified or new.verified_at is distinct from old.verified_at or new.verified_by is distinct from old.verified_by) then raise exception 'Only LOLZ administrators can change verification status' using errcode='42501'; end if; end if;
 return new;
end;$$;
drop trigger if exists lolz_protect_verified_profile_fields_trigger on public.profiles;
create trigger lolz_protect_verified_profile_fields_trigger before update on public.profiles for each row execute function public.lolz_protect_verified_profile_fields();
revoke all on function public.lolz_protect_verified_profile_fields() from public;

-- New profile rows cannot claim verification unless created by a trusted admin.
create or replace function public.lolz_protect_verified_profile_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $
declare caller_role text;
begin
  caller_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  if caller_role not in ('admin', 'owner') then
    new.is_verified := false;
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end;
$;

drop trigger if exists lolz_protect_verified_profile_insert_trigger on public.profiles;
create trigger lolz_protect_verified_profile_insert_trigger
before insert on public.profiles
for each row execute function public.lolz_protect_verified_profile_insert();

revoke all on function public.lolz_protect_verified_profile_insert() from public;
create table if not exists public.lolz_admin_premium_grants(user_id uuid primary key references auth.users(id) on delete cascade,granted_by uuid not null references auth.users(id) on delete restrict,granted_at timestamptz not null default now(),revoked_at timestamptz);
create index if not exists lolz_admin_premium_grants_active_idx on public.lolz_admin_premium_grants(user_id) where revoked_at is null;
alter table public.lolz_admin_premium_grants enable row level security;
drop policy if exists "Users can read their own LOLZ admin Premium grant" on public.lolz_admin_premium_grants;
create policy "Users can read their own LOLZ admin Premium grant" on public.lolz_admin_premium_grants for select to authenticated using(user_id=auth.uid());
revoke all on public.lolz_admin_premium_grants from anon,authenticated;
grant select on public.lolz_admin_premium_grants to authenticated;
commit;
