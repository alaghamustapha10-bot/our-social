-- LOLZ community rules, text enforcement, and moderation audit trail.
begin;

create table if not exists public.lolz_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null check (action_type in ('warning','content_removed','temporary_suspension','permanent_suspension','report_resolved','report_rejected')),
  target_type text,
  target_id text,
  reason text not null check (length(trim(reason)) between 2 and 1000),
  suspension_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lolz_moderation_actions_target_idx
  on public.lolz_moderation_actions(target_user_id, created_at desc);
create index if not exists lolz_moderation_actions_actor_idx
  on public.lolz_moderation_actions(actor_user_id, created_at desc);

alter table public.lolz_moderation_actions enable row level security;
drop policy if exists "LOLZ moderators read moderation actions" on public.lolz_moderation_actions;
create policy "LOLZ moderators read moderation actions"
  on public.lolz_moderation_actions for select to authenticated
  using (coalesce(auth.jwt()->'app_metadata'->>'role','') in ('admin','owner'));
drop policy if exists "Users read their own moderation notices" on public.lolz_moderation_actions;
create policy "Users read their own moderation notices"
  on public.lolz_moderation_actions for select to authenticated
  using (target_user_id = auth.uid() and action_type in ('warning','temporary_suspension','permanent_suspension'));
revoke all on public.lolz_moderation_actions from anon, authenticated;
grant select on public.lolz_moderation_actions to authenticated;

-- Report ownership stays private, while both trusted moderator roles can review.
alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;
alter table public.content_reports
  add constraint content_reports_target_type_check
  check (target_type in ('user','post','video','comment','message','story','group','channel','group_message','channel_post','lolz_comment'));

drop policy if exists "Users can read their own reports" on public.content_reports;
drop policy if exists "LOLZ moderators can review reports" on public.content_reports;
drop policy if exists "LOLZ users and moderators read reports" on public.content_reports;
create policy "LOLZ users and moderators read reports"
  on public.content_reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or coalesce(auth.jwt()->'app_metadata'->>'role','') in ('admin','owner')
  );

create policy "LOLZ trusted moderators review reports"
  on public.content_reports for update to authenticated
  using (coalesce(auth.jwt()->'app_metadata'->>'role','') in ('admin','owner'))
  with check (coalesce(auth.jwt()->'app_metadata'->>'role','') in ('admin','owner'));

grant select, insert, update on public.content_reports to authenticated;

-- A deterministic database-side backstop for clear, explicit promotions.
-- Contextual discussion, education, prevention, and recovery are not targeted
-- unless the text itself contains an explicit offer, invitation, or promotion.
create or replace function public.lolz_enforce_community_text_policy()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $policy$
declare
  row_data jsonb := to_jsonb(new);
  text_value text;
begin
  text_value := lower(coalesce(
    row_data ->> 'content',
    row_data ->> 'caption',
    row_data ->> 'bio',
    ''
  ));
  text_value := translate(text_value, 'أإآٱىة', 'اااايه');
  text_value := regexp_replace(text_value, '[[:space:][:punct:]]+', ' ', 'g');
  text_value := btrim(text_value);

  if text_value = '' then
    return new;
  end if;

  if text_value ~* '(^| )(pornhub|xvideos|xnxx|xxx video|sex tape|send nudes|nude photos?|explicit sex video|صور اباحيه|صور عاريه|مقاطع اباحيه|مقطع جنسي صريح|محتوي جنسي صريح)( |$)' then
    raise exception 'This content is not allowed under LOLZ community guidelines.'
      using errcode = 'P0001', detail = 'LOLZ_POLICY_EXPLICIT_SEXUAL';
  end if;

  if text_value ~* '(^| )(sell|selling|buy|order|dealer|dm for|for sale|message me for)( ).{0,70}(cocaine|heroin|meth|ecstasy|mdma|fentanyl|illegal drugs|weed for sale|marijuana for sale)( |$)'
     or text_value ~* '(^| )(cocaine|heroin|meth|ecstasy|mdma|fentanyl|illegal drugs)( ).{0,70}(for sale|buy|order|dm me|message me|available now)( |$)'
     or text_value ~* '(بيع|للبيع|اطلب|للطلب|شراء|راسلني|تواصل).{0,45}(مخدرات|حشيش|كوكايين|هيروين|ميثامفيتامين|اكستاسي|فنتانيل)' then
    raise exception 'Promoting or selling illegal drugs is not allowed on LOLZ.'
      using errcode = 'P0001', detail = 'LOLZ_POLICY_DRUG_PROMOTION';
  end if;

  if text_value ~* '(^| )(online casino|casino bonus|bet now|place your bets?|sportsbook|bookmaker|slots bonus|gambling site|join my casino|deposit and win)( |$)'
     or text_value ~* '(كازينو اونلاين|مراهنات اونلاين|راهن الان|ضع رهانك|اشترك في القمار|موقع قمار|اربح من المراهنات)' then
    raise exception 'Gambling and betting promotions are not allowed on LOLZ.'
      using errcode = 'P0001', detail = 'LOLZ_POLICY_GAMBLING_PROMOTION';
  end if;

  return new;
end;
$policy$;

revoke all on function public.lolz_enforce_community_text_policy() from public, anon, authenticated;

do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('posts', 'content'),
      ('stories', 'caption'),
      ('comments', 'content'),
      ('lolz_comments', 'content'),
      ('lolz_videos', 'caption'),
      ('messages', 'content'),
      ('group_messages', 'content'),
      ('channel_posts', 'content'),
      ('profiles', 'bio')
    ) as candidates(table_name, text_column)
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = item.table_name
        and column_name = item.text_column
    ) then
      execute format('drop trigger if exists lolz_community_text_policy on public.%I', item.table_name);
      execute format(
        'create trigger lolz_community_text_policy before insert or update of %I on public.%I for each row execute function public.lolz_enforce_community_text_policy()',
        item.text_column,
        item.table_name
      );
    end if;
  end loop;
end;
$$;

commit;
