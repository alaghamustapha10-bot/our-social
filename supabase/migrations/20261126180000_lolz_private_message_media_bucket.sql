-- LOLZ private direct-message attachment storage.
-- This migration is intentionally isolated from the broader security migration.
-- Only conversation participants can create signed URLs for attached objects.

begin;

create or replace function public.lolz_private_message_media_allowed(p_conversation_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_user_one uuid;
  v_user_two uuid;
  v_not_blocked boolean := true;
begin
  select c.user_one, c.user_two
    into v_user_one, v_user_two
  from public.conversations c
  where c.id::text = p_conversation_id;

  if not found
    or auth.uid() is null
    or auth.uid() not in (v_user_one, v_user_two) then
    return false;
  end if;

  -- Respect blocks when the optional blocks table has been installed.
  -- Dynamic SQL keeps this isolated migration usable before that table exists.
  if to_regclass('public.user_blocks') is not null then
    execute
      'select not exists (
         select 1
         from public.user_blocks b
         where (b.blocker_id = $1 and b.blocked_id = $2)
            or (b.blocker_id = $2 and b.blocked_id = $1)
       )'
      into v_not_blocked
      using v_user_one, v_user_two;
  end if;

  return coalesce(v_not_blocked, false);
end;
$fn$;

revoke all on function public.lolz_private_message_media_allowed(text) from public;
grant execute on function public.lolz_private_message_media_allowed(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('private-messages', 'private-messages', false)
on conflict (id) do update
set public = false;

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
        and public.lolz_private_message_media_allowed(m.conversation_id::text)
    )
  );

drop policy if exists "LOLZ users delete their own private message media" on storage.objects;
create policy "LOLZ users delete their own private message media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'private-messages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
