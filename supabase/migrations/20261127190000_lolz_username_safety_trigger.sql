-- Enforce the text policy on profile usernames as well.
begin;
drop trigger if exists lolz_community_text_policy_username on public.profiles;
create trigger lolz_community_text_policy_username
before insert or update of username on public.profiles
for each row execute function public.lolz_enforce_community_text_policy();
commit;
