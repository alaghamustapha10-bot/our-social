-- Include profile display names and usernames in the database text safety backstop.
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
    row_data ->> 'options',
    row_data ->> 'display_name',
    row_data ->> 'full_name',
    row_data ->> 'username'
  ));
  text_value := translate(text_value, 'أإآٱىة', 'اااايه');
  text_value := regexp_replace(text_value, '[[:space:][:punct:]]+', ' ', 'g');
  text_value := btrim(text_value);

  if text_value = '' then
    return new;
  end if;

  if text_value ~* '(^| )(pornhub|xvideos|xnxx|xxx video|sex tape|send nudes|nude photos?|explicit sex video|صور اباحيه|صور عاريه|مقاطع اباحيه|مقطع جنسي صريح|محتوي جنسي صريح|سكس صريح)( |$)' then
    raise exception 'This content is not allowed under LOLZ community guidelines.'
      using errcode = 'P0001', detail = 'LOLZ_POLICY_EXPLICIT_SEXUAL';
  end if;

  if text_value ~* '(sell|selling|buy|order|dealer|dm for|for sale|message me for|بيع|للبيع|اطلب|للطلب|شراء|راسلني|تواصل).{0,80}(cocaine|heroin|meth|ecstasy|mdma|fentanyl|weed|marijuana|opioids?|illegal drugs|مخدرات|حشيش|كوكايين|هيروين|ميثامفيتامين|اكستاسي|فنتانيل)'
     or text_value ~* '(cocaine|heroin|meth|ecstasy|mdma|fentanyl|weed|marijuana|opioids?|مخدرات|حشيش|كوكايين|هيروين|ميثامفيتامين|اكستاسي|فنتانيل).{0,80}(for sale|buy|order|dm me|message me|available now|للبيع|اطلب|للطلب|راسلني|تواصل)' then
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

commit;
