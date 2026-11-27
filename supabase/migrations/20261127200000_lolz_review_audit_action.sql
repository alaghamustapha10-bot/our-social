-- Record the start of every report review in the moderation audit trail.
begin;
alter table public.lolz_moderation_actions
  drop constraint if exists lolz_moderation_actions_action_type_check;
alter table public.lolz_moderation_actions
  add constraint lolz_moderation_actions_action_type_check
  check (action_type in (
    'warning',
    'content_removed',
    'temporary_suspension',
    'permanent_suspension',
    'report_reviewing',
    'report_resolved',
    'report_rejected'
  ));
commit;