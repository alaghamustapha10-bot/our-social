-- Use a distinct trigger name per text field so all fields on a table remain protected.
begin;

do $$
declare
  item record;
  trigger_name text;
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
      ('profiles', 'bio'),
      ('profiles', 'display_name'),
      ('profiles', 'full_name'),
      ('groups', 'name'),
      ('groups', 'description'),
      ('channels', 'name'),
      ('channels', 'description'),
      ('lolz_group_polls', 'question'),
      ('lolz_group_polls', 'options'),
      ('lolz_group_events', 'title'),
      ('lolz_group_events', 'description')
    ) as candidates(table_name, text_column)
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = item.table_name
        and column_name = item.text_column
    ) then
      trigger_name := 'lolz_community_text_policy_' || item.text_column;
      execute format('drop trigger if exists lolz_community_text_policy on public.%I', item.table_name);
      execute format('drop trigger if exists %I on public.%I', trigger_name, item.table_name);
      execute format(
        'create trigger %I before insert or update of %I on public.%I for each row execute function public.lolz_enforce_community_text_policy()',
        trigger_name,
        item.text_column,
        item.table_name
      );
    end if;
  end loop;
end;
$$;

commit;
