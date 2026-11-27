-- Expand server-side community text enforcement to group/channel metadata and activities.
begin;

create or replace function public.lolz_enforce_community_text_policy()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $policy$
declare
  row_data jsonb := to_jsonb(new);
  text_value text;
begin
  text_value := lower(concat_ws(' ',
    row_data ->> 'content',
    row_data ->> 'caption',
    row_data ->> 'bio',
    row_data ->> 'name',
    row_data ->> 'description',
    row_data ->> 'title',
    row_data ->> 'question',
    row_data ->> 'options'
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

  if text_value ~* '(i will kill you|ill kill you|i am going to kill you|im going to kill you|i will hurt you|i will rape you|i am going to rape you|im going to rape you|i will shoot you|i will beat you up)'
     or text_value ~* '(ساقتلك|سوف اقتلك|راح اقتلك|بدي اقتلك|ساؤذيك|سوف اؤذيك|راح اؤذيك|سوف اعتدي عليك|ساغتصبك)' then
    raise exception 'Direct threats and incitement to violence are not allowed on LOLZ.'
      using errcode = 'P0001', detail = 'LOLZ_POLICY_DIRECT_THREAT';
  end if;

  return new;
end;
$policy$;

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
      ('profiles', 'bio'),
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
